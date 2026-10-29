// The 3D Peace Tee. Built in code (no model file): a padded tee silhouette whose
// front and back surfaces are lifted from a blurred mask, with the print drawn on
// a canvas. To use the real artwork later, draw images/print-back.png in drawBack().
import * as THREE from "three";

const W = 4; // plane width in world units (x: -2..2)
const H = 3; // plane height (y: -1.5..1.5)
const TEX_W = 2048;
const TEX_H = 1536;
const PX = TEX_W / W; // texture pixels per world unit

const CREAM = "#e8e0cc";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- silhouette: oversized tee, dropped shoulders ----------
function shirtPath(ctx, sx, sy) {
  const p = (x, y) => [sx(x), sy(y)];
  ctx.beginPath();
  ctx.moveTo(...p(-0.98, -1.32));
  ctx.quadraticCurveTo(...p(0, -1.37), ...p(0.98, -1.32));
  ctx.lineTo(...p(1.0, 0.38));
  ctx.lineTo(...p(1.74, 0.08));
  ctx.lineTo(...p(1.95, 0.7));
  ctx.quadraticCurveTo(...p(1.55, 1.12), ...p(1.08, 1.22));
  ctx.lineTo(...p(0.4, 1.32));
  ctx.quadraticCurveTo(...p(0, 0.9), ...p(-0.4, 1.32));
  ctx.lineTo(...p(-1.08, 1.22));
  ctx.quadraticCurveTo(...p(-1.55, 1.12), ...p(-1.95, 0.7));
  ctx.lineTo(...p(-1.74, 0.08));
  ctx.lineTo(...p(-1.0, 0.38));
  ctx.closePath();
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// world -> texture pixel helpers
const tx = (x) => (x + W / 2) * PX;
const ty = (y) => (H / 2 - y) * PX;

// ---------- height field: blurred mask gives a soft, padded profile ----------
function heightField(gw, gh) {
  const c = canvas(gw, gh);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, gw, gh);
  ctx.fillStyle = "#fff";
  shirtPath(ctx, (x) => ((x + W / 2) / W) * gw, (y) => ((H / 2 - y) / H) * gh);
  ctx.fill();
  const src = ctx.getImageData(0, 0, gw, gh).data;
  let a = new Float32Array(gw * gh);
  for (let i = 0; i < a.length; i++) a[i] = src[i * 4] / 255;

  // three box-blur passes ≈ gaussian (works in every browser, unlike ctx.filter)
  const r = Math.round(gw * 0.035);
  let b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < gh; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[y * gw + Math.min(gw - 1, Math.max(0, x))];
      for (let x = 0; x < gw; x++) {
        b[y * gw + x] = acc / (2 * r + 1);
        acc += a[y * gw + Math.min(gw - 1, x + r + 1)] - a[y * gw + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < gw; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(gh - 1, Math.max(0, y)) * gw + x];
      for (let y = 0; y < gh; y++) {
        a[y * gw + x] = acc / (2 * r + 1);
        acc += b[Math.min(gh - 1, y + r + 1) * gw + x] - b[Math.max(0, y - r) * gw + x];
      }
    }
  }
  return { field: a, gw, gh };
}

function surfaceGeometry({ field, gw, gh }) {
  const geo = new THREE.PlaneGeometry(W, H, gw - 1, gh - 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const gx = i % gw;
    const gy = Math.floor(i / gw);
    const s = Math.min(1, Math.max(0, (field[gy * gw + gx] - 0.5) * 2));
    const x = pos.getX(i);
    const y = pos.getY(i);
    // rounded padding plus a few soft folds
    const folds = 0.022 * Math.sin(x * 5.5 + y * 2.2) * Math.sin(y * 3.8 - x * 1.4)
      + 0.018 * Math.exp(-((x - 0.85) ** 2 + (y - 0.25) ** 2) * 9)
      + 0.018 * Math.exp(-((x + 0.85) ** 2 + (y - 0.25) ** 2) * 9);
    pos.setZ(i, 0.24 * Math.sqrt(s) + s * folds);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- textures ----------
function alphaTexture() {
  const c = canvas(1024, 768);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fff";
  shirtPath(ctx, (x) => ((x + W / 2) / W) * c.width, (y) => ((H / 2 - y) / H) * c.height);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

function fabricBase(ctx) {
  ctx.fillStyle = "#0f0f0f";
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  // knit grain
  const img = ctx.getImageData(0, 0, TEX_W, TEX_H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 9 + (((i / 4) % TEX_W) % 3 === 0 ? 2 : 0);
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // seams: collar rib, cuffs, hem
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(tx(0.4), ty(1.32));
  ctx.quadraticCurveTo(tx(0), ty(0.9), tx(-0.4), ty(1.32));
  ctx.stroke();
  ctx.strokeStyle = "#1f1f1f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx(0.43), ty(1.28));
  ctx.quadraticCurveTo(tx(0), ty(0.83), tx(-0.43), ty(1.28));
  ctx.stroke();
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(tx(s * 1.68), ty(0.13));
    ctx.lineTo(tx(s * 1.88), ty(0.72));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx(s * 1.0), ty(0.4));
    ctx.quadraticCurveTo(tx(s * 1.06), ty(0.85), tx(s * 1.08), ty(1.2));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(tx(-0.97), ty(-1.24));
  ctx.quadraticCurveTo(tx(0), ty(-1.29), tx(0.97), ty(-1.24));
  ctx.stroke();
}

// worn screen-print look: knock small specks out of the ink
function inkify(c) {
  const ctx = c.getContext("2d");
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 14000; i++) {
    ctx.globalAlpha = Math.random() * 0.45;
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawBack(ctx) {
  const ink = canvas(TEX_W, TEX_H);
  const c = ink.getContext("2d");
  c.fillStyle = CREAM;
  c.strokeStyle = CREAM;
  c.textBaseline = "alphabetic";

  const L = tx(-0.62);
  const R = tx(0.62);
  const T = ty(0.56);
  const B = ty(-0.6);

  // header
  c.font = "700 44px Archivo";
  c.fillText("EMK SYSTEM™", L, ty(0.9));
  c.font = "600 26px Archivo";
  c.fillText("PEACE PROTOCOL", L, ty(0.8));
  c.fillText("SERIES-001", L, ty(0.73));
  c.fillRect(L, ty(0.665), R - L, 4);

  // frame with offset corner brackets
  c.lineWidth = 9;
  c.strokeRect(L, T, R - L, B - T);
  c.lineWidth = 6;
  const o = 22;
  c.beginPath();
  c.moveTo(L - o, T + 120); c.lineTo(L - o, T - o); c.lineTo(L + 160, T - o);
  c.moveTo(R + o, B - 120); c.lineTo(R + o, B + o); c.lineTo(R - 160, B + o);
  c.stroke();

  // PEACE + سلام overlapping
  c.font = "700 150px Archivo";
  c.textAlign = "left";
  c.fillText("PEACE", L + 34, T + 160);
  c.font = "700 290px Amiri";
  c.textAlign = "center";
  c.direction = "rtl";
  c.fillText("سلام", tx(0.08), T + 400);
  c.direction = "ltr";

  // Armenian along the bottom of the frame
  c.font = "700 64px 'Noto Serif Armenian'";
  c.fillText("Խաղաղություն", tx(0), B - 34);

  // vertical line on the left
  c.save();
  c.translate(L - 46, B - 40);
  c.rotate(-Math.PI / 2);
  c.font = "600 24px Archivo";
  c.textAlign = "left";
  c.fillText("MOVE WITH INTENTION", 0, 0);
  c.restore();

  // tagline under the frame
  c.textAlign = "center";
  c.font = "700 36px Archivo";
  c.fillText("MOVE WITH INTENTION.", tx(0), ty(-0.75));
  c.font = "400 30px Archivo";
  c.fillText("Peace is power.", tx(0), ty(-0.83));

  inkify(ink);
  ctx.drawImage(ink, 0, 0);
}

function drawFront(ctx) {
  // woven chest label (wearer's left chest = viewer's right)
  const cx = tx(0.5);
  const cy = ty(0.5);
  const w = 150;
  const h = 240;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.05);
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = CREAM;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.font = "700 34px Archivo";
  ctx.fillText("PEACE", 0, -h / 2 + 44);
  ctx.font = "700 54px Amiri";
  ctx.fillText("سلام", 0, -h / 2 + 100);
  ctx.font = "700 12px Archivo";
  ctx.fillText("EMK STREETWEAR", 0, -h / 2 + 128);
  for (let i = 0; i < 34; i++) {
    const bw = Math.random() < 0.3 ? 3 : 1.5;
    ctx.fillRect(-w / 2 + 16 + i * 3.5, -h / 2 + 142, bw, 44);
  }
  ctx.font = "600 10px Archivo";
  ctx.fillText("EST. 2021 · LOS ANGELES", 0, -h / 2 + 204);
  ctx.fillText("EMK-001", 0, -h / 2 + 220);
  ctx.restore();

  // small hem tag
  ctx.fillStyle = "#d9d0bd";
  ctx.fillRect(tx(-0.82), ty(-1.12), 42, 70);
  ctx.fillStyle = "#111";
  ctx.font = "700 14px Archivo";
  ctx.save();
  ctx.translate(tx(-0.82) + 26, ty(-1.12) + 60);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("EMK", 0, 0);
  ctx.restore();
}

function faceTexture(draw, renderer) {
  const c = canvas(TEX_W, TEX_H);
  const ctx = c.getContext("2d");
  fabricBase(ctx);
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function shadowTexture() {
  const c = canvas(256, 256);
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,.85)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load("700 100px Archivo"),
      document.fonts.load("600 100px Archivo"),
      document.fonts.load("700 100px Amiri", "سلام"),
      document.fonts.load("700 100px 'Noto Serif Armenian'", "Խաղաղություն"),
    ]);
  } catch {}
}

// ---------- mount ----------
export async function mountShirt(el) {
  const mode = el.dataset.shirt; // "hero" | "product"
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    el.innerHTML = `<div class="stage-fallback">3D needs WebGL</div>`;
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x050505, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 6);
  scene.add(key);
  const key2 = new THREE.DirectionalLight(0xffffff, 1.8);
  key2.position.set(-3, 3, -6);
  scene.add(key2);
  const rim = new THREE.DirectionalLight(0xd4c3a3, 3.2);
  rim.position.set(-5, 2, -2);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xd4c3a3, 2.4);
  rim2.position.set(5, 1, 2);
  scene.add(rim2);

  await fontsReady();

  const hf = heightField(220, 165);
  const geo = surfaceGeometry(hf);
  const alpha = alphaTexture();
  const fabric = (map) => new THREE.MeshPhysicalMaterial({
    map, alphaMap: alpha, alphaTest: 0.5, roughness: 0.9, metalness: 0,
    sheen: 1, sheenColor: new THREE.Color(0x4a4a4a), sheenRoughness: 0.55,
  });

  const shirt = new THREE.Group();
  const front = new THREE.Mesh(geo, fabric(faceTexture(drawFront, renderer)));
  const back = new THREE.Mesh(geo, fabric(faceTexture(drawBack, renderer)));
  back.rotation.y = Math.PI; // same surface turned around; texture reads correctly from behind
  shirt.add(front, back);

  const float = new THREE.Group();
  float.add(shirt);
  scene.add(float);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 1.3),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.7 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // gold dust in the hero
  let dust;
  if (mode === "hero") {
    const n = 260;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 14;
      pts[i * 3 + 1] = (Math.random() - 0.5) * 9;
      pts[i * 3 + 2] = -4 + Math.random() * 5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    dust = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xd4c3a3, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(dust);
  }

  // ---------- layout ----------
  let baseY = 0;
  function resize() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(15)); // view height per unit distance
    let d;
    if (mode === "hero") {
      d = Math.max(11.5, 4.7 / (k * camera.aspect));
      baseY = k * d * (camera.aspect < 1 ? 0.17 : 0.16);
    } else {
      d = Math.max(8.2, 4.5 / (k * camera.aspect));
      baseY = 0.1;
    }
    camera.position.set(0, 0, d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    shadow.position.set(0, baseY - 1.85, 0.2);
  }
  new ResizeObserver(resize).observe(el);
  resize();

  // ---------- interaction ----------
  const BACK = Math.PI;
  let yaw = mode === "hero" ? BACK - 0.45 : BACK - 0.3; // drag-controlled
  let yawTarget = yaw;
  let vel = 0;
  let mx = 0;
  let my = 0;
  let dragging = false;
  let lastX = 0;
  let lastInput = performance.now();
  const hint = el.parentElement.querySelector(".drag-hint");

  el.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    vel = 0;
    el.setPointerCapture(e.pointerId);
    hint?.classList.add("gone");
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    yawTarget += dx * 0.012;
    vel = dx * 0.012;
    lastInput = performance.now();
  });
  const end = () => { dragging = false; lastInput = performance.now(); };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);

  if (mode === "hero") {
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      mx = (e.clientX / innerWidth) * 2 - 1;
      my = (e.clientY / innerHeight) * 2 - 1;
    });
  }

  // front / back buttons on the product page
  const wrap = el.closest(".stage-wrap");
  wrap?.querySelectorAll("[data-face]").forEach((b) =>
    b.addEventListener("click", () => {
      const goal = b.dataset.face === "back" ? BACK : 0;
      // turn the short way round
      const turns = Math.round((yawTarget - goal) / (Math.PI * 2));
      yawTarget = goal + turns * Math.PI * 2;
      vel = 0;
      lastInput = performance.now();
      wrap.querySelectorAll("[data-face]").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    }));

  // ---------- render loop (paused off-screen) ----------
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(el);
  const clock = new THREE.Clock();
  let tiltX = 0;
  let tiltY = 0;

  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const idle = performance.now() - lastInput > 2500;

    if (!dragging) {
      yawTarget += vel;
      vel *= 0.92;
      if (idle && !reduceMotion && mode === "product") yawTarget += dt * 0.35;
    }
    yaw += (yawTarget - yaw) * Math.min(1, dt * 8);

    // hero: follow the mouse and turn as the page scrolls
    let scrollTurn = 0;
    let lift = 0;
    if (mode === "hero") {
      const p = Math.min(1, Math.max(0, scrollY / Math.max(1, el.clientHeight)));
      scrollTurn = p * Math.PI * 0.9;
      lift = p * 0.8;
    }
    tiltY += (mx * 0.45 - tiltY) * Math.min(1, dt * 4);
    tiltX += (my * 0.22 - tiltX) * Math.min(1, dt * 4);
    const sway = reduceMotion ? 0 : Math.sin(t * 0.6) * 0.08;

    shirt.rotation.y = yaw + scrollTurn + tiltY + sway;
    shirt.rotation.x = tiltX + (reduceMotion ? 0 : Math.sin(t * 0.8) * 0.02);
    shirt.rotation.z = reduceMotion ? 0 : Math.sin(t * 0.5) * 0.015;
    const bob = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.06;
    float.position.y = baseY + bob + lift;
    shadow.material.opacity = 0.55 - bob * 1.5 - lift * 0.5;

    if (dust && !reduceMotion) {
      const a = dust.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) + dt * 0.12;
        if (y > 4.5) y = -4.5;
        a.setY(i, y);
      }
      a.needsUpdate = true;
      dust.rotation.y = tiltY * 0.3;
    }
    renderer.render(scene, camera);
  });
}

export function mountAll() {
  document.querySelectorAll("[data-shirt]").forEach((el) => mountShirt(el));
}
