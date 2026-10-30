// Hero: the Peace tee as the one lit exhibit in a dark room.
// A background-removed photo (images/<side>-cut.webp) lifted into relief by a baked depth map
// (images/<side>-relief.png, scripts/relief.py), lit with a gold rim, turning back -> front with
// scroll. GPU sparks drift around it. Renders on the shared GSAP ticker, only while on screen.
import * as THREE from "three";
import { gsap } from "gsap";

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const { damp, clamp, smoothstep } = THREE.MathUtils;

const TIERS = [
  { dpr: 1, aa: false, seg: [56, 76], sparks: 110, low: true },
  { dpr: 1.5, aa: false, seg: [80, 108], sparks: 220, low: false },
  { dpr: 2, aa: true, seg: [120, 160], sparks: 420, low: false },
];
function pickTier() {
  const n = navigator;
  if (n.connection?.saveData || (n.deviceMemory ?? 8) <= 2) return 0;
  return matchMedia("(pointer: coarse)").matches ? 1 : 2;
}

const FIG_H = 3.4;
const GOLD = "vec3(0.651, 0.448, 0.170)"; // #d4c3a3-ish champagne gold, linear

const figureVertex = /* glsl */ `
  uniform sampler2D uRelief;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += 0.03 + texture2D(uRelief, uv).r * 0.42;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const figureFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uRelief;
  uniform vec2 uMapTexel;
  uniform vec2 uReliefTexel;
  uniform vec2 uLight;
  uniform float uReveal;
  uniform float uSweep;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    // the matte is soft on the dark fabric: make the inside solid, keep a soft edge; legs fade into the dark
    float a = smoothstep(0.08, 0.45, c.a) * smoothstep(0.0, 0.16, vUv.y) * uReveal;
    if (a < 0.02) discard;
    vec3 col = c.rgb;
    vec3 gold = ${GOLD};
  #ifndef LOW
    float dl = texture2D(uRelief, vUv - vec2(uReliefTexel.x * 2.0, 0.0)).r;
    float dr = texture2D(uRelief, vUv + vec2(uReliefTexel.x * 2.0, 0.0)).r;
    float dd = texture2D(uRelief, vUv - vec2(0.0, uReliefTexel.y * 2.0)).r;
    float du = texture2D(uRelief, vUv + vec2(0.0, uReliefTexel.y * 2.0)).r;
    vec3 n = normalize(vec3((dl - dr) * 7.0, (dd - du) * 7.0, 1.0));
    float shade = 0.84 + 0.28 * max(dot(n, normalize(vec3(uLight, 0.9))), 0.0);
    float e = texture2D(uMap, vUv + vec2(uMapTexel.x * 6.0, 0.0)).a
            + texture2D(uMap, vUv - vec2(uMapTexel.x * 6.0, 0.0)).a
            + texture2D(uMap, vUv + vec2(0.0, uMapTexel.y * 6.0)).a
            + texture2D(uMap, vUv - vec2(0.0, uMapTexel.y * 6.0)).a;
    float rim = (1.0 - smoothstep(0.08, 0.45, e * 0.25)) * smoothstep(0.08, 0.45, c.a);
    col = col * shade + gold * rim * 0.75;
  #endif
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const sparkVertex = /* glsl */ `
  uniform float uTime, uTravel, uTurb, uScale, uSize;
  attribute vec4 aMotion;
  attribute float aWarm;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + 2.5 + uTravel * aMotion.x, 5.5) - 2.5;
    float s = uTime * aMotion.y + aMotion.w;
    p.xz += vec2(sin(s), cos(s)) * aMotion.z * (1.0 + uTurb);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / -mv.z;
    vAlpha = smoothstep(-2.5, -1.9, p.y) * (1.0 - smoothstep(2.3, 3.0, p.y)) * (0.55 + 0.45 * sin(s * 3.0));
    vColor = mix(vec3(1.0, 0.88, 0.66), vec3(1.0, 0.42, 0.08), aWarm);
  }`;

const sparkFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vColor, a * a * vAlpha * 0.8);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const glowFragment = /* glsl */ `
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    vec2 q = vUv - 0.5;
    float g = exp(-dot(q, q) * 16.0) * uStrength;
    gl_FragColor = vec4(${GOLD} * 0.5, g);
    #include <colorspace_fragment>
  }`;
const plainVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export async function initHero(stage, canvas) {
  let level = pickTier();
  let tier = TIERS[level];
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.aa, powerPreference: "high-performance" });
  } catch {
    return null; // the CSS poster stays
  }
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x0a0a0a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);

  // ---------- textures ----------
  const loader = new THREE.TextureLoader();
  const load = (src) => loader.loadAsync(src);
  const [backMap, frontMap, backRelief, frontRelief] = await Promise.all([
    load("images/back-cut.webp"), load("images/front-cut.webp"),
    load("images/back-relief.png"), load("images/front-relief.png"),
  ]);
  for (const t of [backMap, frontMap]) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  }
  for (const t of [backRelief, frontRelief]) {
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
  }

  const light = new THREE.Vector2(0.6, 0.7);
  const shared = { uLight: { value: light }, uReveal: { value: 0 }, uSweep: { value: -0.5 } };
  function side(map, relief, turned) {
    const aspect = map.image.width / map.image.height;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uMap: { value: map },
        uRelief: { value: relief },
        uMapTexel: { value: new THREE.Vector2(1 / map.image.width, 1 / map.image.height) },
        uReliefTexel: { value: new THREE.Vector2(1 / relief.image.width, 1 / relief.image.height) },
      },
      defines: tier.low ? { LOW: "" } : {},
      vertexShader: figureVertex,
      fragmentShader: figureFragment,
      transparent: true,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FIG_H * aspect, FIG_H, ...tier.seg), mat);
    if (turned) mesh.rotation.y = Math.PI;
    pivot.add(mesh);
    return mesh;
  }
  const back = side(backMap, backRelief, false);
  const front = side(frontMap, frontRelief, true);

  // a pool of light behind the figure, like a lit exhibit
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.ShaderMaterial({
      uniforms: { uStrength: { value: 0 } },
      vertexShader: plainVertex, fragmentShader: glowFragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  glow.position.set(0, 0.4, -1.4);
  scene.add(glow);

  // ---------- GPU sparks ----------
  const sparkU = {
    uTime: { value: 0 }, uTravel: { value: 0 }, uTurb: { value: 0 },
    uScale: { value: 1 }, uSize: { value: 0.035 },
  };
  const n = TIERS[2].sparks;
  const pos = new Float32Array(n * 3);
  const motion = new Float32Array(n * 4);
  const warm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos.set([(Math.random() - 0.5) * 6.4, Math.random() * 5.5 - 2.5, (Math.random() - 0.5) * 5 - 0.5], i * 3);
    motion.set([0.15 + Math.random() * 0.3, 0.5 + Math.random() * 1.5, 0.05 + Math.random() * 0.15, Math.random() * 6.28], i * 4);
    warm[i] = Math.random() < 0.7 ? 0.6 + Math.random() * 0.4 : Math.random() * 0.2;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  sparkGeo.setAttribute("aMotion", new THREE.BufferAttribute(motion, 4));
  sparkGeo.setAttribute("aWarm", new THREE.BufferAttribute(warm, 1));
  sparkGeo.setDrawRange(0, tier.sparks);
  const sparks = new THREE.Points(sparkGeo, new THREE.ShaderMaterial({
    uniforms: sparkU, vertexShader: sparkVertex, fragmentShader: sparkFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sparks.frustumCulled = false;
  scene.add(sparks);

  // ---------- layout (read on resize only) ----------
  const buf = new THREE.Vector2();
  const view = { d: 7, targetY: 0, phone: false };
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier.dpr));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(buf);
    sparkU.uScale.value = buf.y * 0.5;
    view.phone = w < 760;
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // phone: figure fills the lower 60% under the copy; desktop: the lower 80%
    const V = view.phone ? Math.max(FIG_H / 0.6, 2.7 / camera.aspect) : FIG_H / 0.8;
    view.d = V / k;
    view.targetY = view.phone ? 0.2 * V : 0.1 * V;
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------- input ----------
  let mx = 0, my = 0, tx = 0, ty = 0;
  let drag = 0, dragTarget = 0, dragging = false, lastX = 0;
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tx = (e.clientX / innerWidth) * 2 - 1;
    ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  stage.addEventListener("pointerdown", (e) => { if (e.target.closest("a, button")) return; dragging = true; lastX = e.clientX; });
  addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragTarget = clamp(dragTarget + (e.clientX - lastX) * 0.01, -1.4, 1.4);
    lastX = e.clientX;
  }, { passive: true });
  const release = () => { dragging = false; };
  addEventListener("pointerup", release);
  addEventListener("pointercancel", release);

  // ---------- state + loop ----------
  let progress = 0, eased = 0, reveal = 0, travel = 0, time = 0;
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: "120px" }).observe(stage);
  let slow = 0, frames = 0, warmup = 60;

  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stage.classList.remove("has-webgl"); visible = false; });
  canvas.addEventListener("webglcontextrestored", () => { stage.classList.add("has-webgl"); visible = true; });

  function stepDown() {
    if (level === 0) return;
    level--;
    tier = { ...tier, dpr: TIERS[level].dpr, sparks: TIERS[level].sparks };
    sparkGeo.setDrawRange(0, tier.sparks);
    resize();
  }

  function tick(_t, deltaMs) {
    if (!visible || document.hidden) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    const still = reduce.matches;
    time += still ? 0 : dt;

    // adaptive quality: step down once if frames are consistently slow
    if (warmup-- <= 0) {
      frames++;
      if (dt > 0.025) slow++;
      if (frames === 90) { if (slow > 18) stepDown(); slow = frames = 0; }
    }

    eased = damp(eased, progress, still ? 20 : 5, dt);
    mx = damp(mx, tx, 3, dt);
    my = damp(my, ty, 3, dt);
    if (!dragging) dragTarget = damp(dragTarget, 0, 1.5, dt);
    drag = damp(drag, dragTarget, 8, dt);
    reveal = Math.min(1, reveal + dt * 0.9);

    // scroll turns the tee from its back print to the chest label
    const turn = smoothstep(eased, 0.12, 0.8) * Math.PI;
    const yaw = turn + mx * 0.3 + drag;
    pivot.rotation.y = yaw;
    pivot.rotation.x = my * 0.08;
    pivot.position.y = still ? 0 : Math.sin(time * 0.9) * 0.04;
    const c = Math.cos(yaw);
    back.visible = c > -0.25;
    front.visible = c < 0.25;

    shared.uReveal.value = reveal;
    shared.uSweep.value = -0.4 + eased * 1.4 + Math.sin(time * 0.25) * 0.15;
    light.set(0.6 - mx * 0.5, 0.7 + my * 0.3);
    glow.material.uniforms.uStrength.value = 0.1 * reveal;

    const d = view.d * (1 - 0.1 * eased);
    camera.position.set(Math.sin(mx * 0.12) * d * 0.15, view.targetY + 0.2 + eased * 0.25, d);
    camera.lookAt(0, view.targetY, 0);

    const velocity = Math.abs(progress - eased);
    travel += still ? 0 : dt * (1 + velocity * 9);
    sparkU.uTravel.value = travel;
    sparkU.uTurb.value = velocity * 3.2;
    sparkU.uTime.value = time;

    renderer.render(scene, camera);
  }

  await renderer.compileAsync(scene, camera);
  stage.classList.add("has-webgl");
  gsap.ticker.add(tick);

  return {
    setProgress(p) { progress = p; },
  };
}
