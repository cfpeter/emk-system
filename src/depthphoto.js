// Real photos made 3D: each photo has a depth map (scripts/depth.mjs, Depth Anything V2).
// A shader shifts every pixel by its depth as the mouse, finger or phone tilt moves,
// so the person and shirt move in front of the background like a real 3D photo.
import * as THREE from "three";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uImage;
  uniform sampler2D uDepth;
  uniform vec2 uMouse;      // -1..1
  uniform vec2 uRes;        // container size
  uniform float uImgAspect; // photo width / height
  uniform vec2 uFocus;      // which part of the photo stays in frame (0..1)
  uniform float uZoom;
  uniform float uStrength;
  uniform float uPivot;     // depth that stays still
  uniform float uFade;
  varying vec2 vUv;

  vec2 cover(vec2 uv) {
    float ca = uRes.x / uRes.y;
    vec2 s = ca > uImgAspect ? vec2(1.0, uImgAspect / ca) : vec2(ca / uImgAspect, 1.0);
    return uv * s + (1.0 - s) * uFocus;
  }

  void main() {
    vec2 base = cover(vUv);
    vec2 c = cover(vec2(0.5));
    vec2 uv = c + (base - c) / uZoom;

    // a few refinement steps keep edges from smearing
    vec2 p = uv;
    for (int i = 0; i < 5; i++) {
      float d = texture2D(uDepth, p).r;
      p = uv + uMouse * (d - uPivot) * uStrength;
    }
    vec3 col = texture2D(uImage, p).rgb;
    float d = texture2D(uDepth, p).r;

    // soft light that follows the pointer across the near surfaces (shirt, skin)
    vec2 light = vec2(0.5) + uMouse * vec2(0.35, -0.3);
    float glow = exp(-dot(vUv - light, vUv - light) * 6.0) * smoothstep(0.55, 1.0, d);
    col += vec3(0.95, 0.88, 0.74) * glow * 0.07;

    // edge vignette
    vec2 q = vUv - 0.5;
    col *= 1.0 - dot(q, q) * 0.55;

    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;

function loadImage(src) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });
}

// Grow the near (bright) areas a little, then soften: the background stretches
// around the person instead of the person's outline smearing.
function softenDepth(img) {
  const w = 384;
  const h = Math.round((img.height / img.width) * w);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  let a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = data.data[i * 4];

  const pass = (src, r, op) => {
    const out = new Float32Array(src.length);
    const tmp = new Float32Array(src.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = op === "max" ? 0 : 0;
        for (let k = -r; k <= r; k++) {
          const s = src[y * w + Math.min(w - 1, Math.max(0, x + k))];
          v = op === "max" ? Math.max(v, s) : v + s;
        }
        tmp[y * w + x] = op === "max" ? v : v / (2 * r + 1);
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (let k = -r; k <= r; k++) {
          const s = tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
          v = op === "max" ? Math.max(v, s) : v + s;
        }
        out[y * w + x] = op === "max" ? v : v / (2 * r + 1);
      }
    return out;
  };
  a = pass(a, 5, "max");
  a = pass(a, 4, "blur");
  a = pass(a, 3, "blur");
  for (let i = 0; i < a.length; i++) {
    data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = a[i];
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

async function loadPhoto(name) {
  const [img, depth] = await Promise.all([
    loadImage(`images/${name}.webp`),
    loadImage(`images/${name}-depth.png`),
  ]);
  const image = new THREE.Texture(img);
  image.needsUpdate = true;
  image.minFilter = THREE.LinearFilter;
  image.generateMipmaps = false;
  const d = new THREE.CanvasTexture(softenDepth(depth));
  d.minFilter = THREE.LinearFilter;
  d.generateMipmaps = false;
  return { image, depth: d, aspect: img.width / img.height };
}

export async function mountDepthPhoto(el) {
  const mode = el.dataset.mode || "hero";
  const focus = (el.dataset.focus || "0.5,0.5").split(",").map(Number);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
  } catch {
    el.innerHTML = `<img src="images/${el.dataset.depth}.webp" alt="" style="width:100%;height:100%;object-fit:cover">`;
    return;
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // pass photo colours straight through
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a0a);

  const cache = {};
  const get = (name) => (cache[name] ??= loadPhoto(name));
  let photo = await get(el.dataset.depth);

  const uniforms = {
    uImage: { value: photo.image },
    uDepth: { value: photo.depth },
    uMouse: { value: new THREE.Vector2() },
    uRes: { value: new THREE.Vector2(1, 1) },
    uImgAspect: { value: photo.aspect },
    uFocus: { value: new THREE.Vector2(focus[0], 1 - focus[1]) },
    uZoom: { value: 1.07 },
    uStrength: { value: mode === "hero" ? 0.026 : 0.022 },
    uPivot: { value: 0.97 },
    uFade: { value: 0 },
  };
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })));
  const camera = new THREE.Camera();
  el.appendChild(renderer.domElement);

  const resize = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  };
  new ResizeObserver(resize).observe(el);
  resize();

  // ---------- input: mouse, finger drag, phone tilt ----------
  const target = new THREE.Vector2();
  let lastInput = -1e9;
  const hint = el.parentElement.querySelector(".drag-hint");
  const touched = () => { lastInput = performance.now(); hint?.classList.add("gone"); };

  const fromPoint = (x, y, r) => {
    target.set(((x - r.left) / r.width) * 2 - 1, ((y - r.top) / r.height) * 2 - 1).clampScalar(-1, 1);
  };
  if (mode === "hero") {
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      fromPoint(e.clientX, e.clientY, { left: 0, top: 0, width: innerWidth, height: innerHeight });
      touched();
    });
  } else {
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      fromPoint(e.clientX, e.clientY, el.getBoundingClientRect());
      touched();
    });
    el.addEventListener("pointerleave", () => target.set(0, 0));
  }
  let dragFrom = null;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    dragFrom = { x: e.clientX, y: e.clientY, t: target.clone() };
    askForTilt();
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragFrom || e.pointerType === "mouse") return;
    target.set(dragFrom.t.x + (e.clientX - dragFrom.x) / 120, dragFrom.t.y + (e.clientY - dragFrom.y) / 120).clampScalar(-1, 1);
    touched();
  });
  const endDrag = () => { dragFrom = null; };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);

  let tiltAsked = false;
  function askForTilt() {
    if (tiltAsked) return;
    tiltAsked = true;
    const listen = () => addEventListener("deviceorientation", (e) => {
      if (e.gamma == null) return;
      target.set(Math.max(-1, Math.min(1, e.gamma / 25)), Math.max(-1, Math.min(1, (e.beta - 45) / 25)));
      touched();
    });
    if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().then((s) => s === "granted" && listen()).catch(() => {});
    } else {
      listen();
    }
  }

  // ---------- Back / Front switch on the product page ----------
  const wrap = el.closest(".stage-wrap");
  let swapping = null;
  wrap?.querySelectorAll("[data-face]").forEach((b) =>
    b.addEventListener("click", async () => {
      wrap.querySelectorAll("[data-face]").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      const next = await get(b.dataset.face);
      swapping = next;
    }));

  // ---------- render (paused off-screen) ----------
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(el);
  const clock = new THREE.Clock();
  const m = uniforms.uMouse.value;

  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // drift gently on its own when nobody is touching it
    const idle = performance.now() - lastInput > 2200;
    const goal = idle && !reduceMotion ? new THREE.Vector2(Math.sin(t * 0.5) * 0.55, Math.sin(t * 0.37) * 0.3) : target;
    m.x += (goal.x - m.x) * Math.min(1, dt * (idle ? 1.5 : 5));
    m.y += (goal.y - m.y) * Math.min(1, dt * (idle ? 1.5 : 5));

    // fade in on load, and through black when switching photos
    if (swapping) {
      uniforms.uFade.value -= dt * 5;
      if (uniforms.uFade.value <= 0) {
        photo = swapping;
        swapping = null;
        uniforms.uImage.value = photo.image;
        uniforms.uDepth.value = photo.depth;
        uniforms.uImgAspect.value = photo.aspect;
      }
    } else {
      uniforms.uFade.value = Math.min(1, uniforms.uFade.value + dt * 3);
    }
    renderer.render(scene, camera);
  });
}

export function mountAll() {
  document.querySelectorAll("[data-depth]").forEach((el) => mountDepthPhoto(el));
}
