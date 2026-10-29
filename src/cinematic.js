// Home page cinematic: the Peace Tee photos as a cut-out 3D figure on a dark stage.
// Scroll drives the camera sweep, the figure turning back -> front -> back, the
// liquid-gold background and the story slides. Photos: <name>-cut.webp (scripts/cutout.mjs)
// for the shape, <name>-depth.png (scripts/depth.mjs) for the relief.
import * as THREE from "three";
import { softenDepth } from "./depthphoto.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;

const section = document.querySelector(".cine");
const stage = section.querySelector(".cine-stage");
const canvas = section.querySelector(".cine-canvas");
const isPhone = () => stage.clientWidth < 760;

// ---------- slides: split titles into letters ----------
section.querySelectorAll(".cine-title").forEach((title) => {
  let n = 0;
  title.innerHTML = title.innerHTML
    .split(/(<br\s*\/?>)/i)
    .map((part) =>
      part.toLowerCase().startsWith("<br")
        ? part
        : [...part.trim()].map((ch) => (ch === " " ? " " : `<span class="char" style="transition-delay:${(n++ * 0.035).toFixed(3)}s">${ch}</span>`)).join(""))
    .join("");
});

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#000000");
scene.fog = new THREE.FogExp2("#000000", 0.02);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0.2, 6);
scene.add(camera);

// ---------- liquid-gold background (child of the camera so it always fills the view) ----------
const bgUniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uMouse: { value: new THREE.Vector2() },
  uScroll: { value: 0 },
};
{
  const material = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      uniform float uScroll;
      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
        float aspect = uResolution.x / uResolution.y;
        float time = uTime * 0.08;
        float s = uScroll * 5.0;

        vec2 w = uv;
        w.x += sin(uv.y * 2.5 + time * 0.2 + s) * 0.35;
        w.y += cos(uv.x * 2.5 - time * 0.15 - s * 0.8) * 0.35;
        w.x += sin(uv.y * 1.2 - time * 0.1 - s * 1.5) * 0.25;
        w.y += cos(uv.x * 1.2 + time * 0.18 + s * 1.2) * 0.25;
        w += vec2(uScroll * 0.04, -uScroll * 0.02) + vec2(uMouse.x * aspect * 0.05, uMouse.y * 0.05);

        float w1 = sin(dot(w, vec2(cos(0.6), sin(0.6))) * 2.4 + time);
        float w2 = cos(dot(w, vec2(cos(-0.7), sin(-0.7))) * 3.2 - time * 1.4 + w1 * 0.4);
        float w3 = sin(dot(w, vec2(cos(1.2), sin(1.2))) * 4.0 + time * 1.8 + w2 * 0.5);
        float f = w1 * 0.5 + w2 * 0.35 + w3 * 0.15;

        float crest = pow(max(0.0, 1.0 - abs(f - 0.1)), 2.5) * 0.5 + pow(max(0.0, 1.0 - abs(f - 0.15)), 8.0) * 0.9;

        // EMK palette: molten gold at the top of the story, cool champagne-graphite at the end
        float t = smoothstep(0.0, 1.0, uScroll);
        vec3 shadow = mix(vec3(0.0010, 0.0007, 0.0004), vec3(0.0008, 0.0008, 0.0008), t);
        vec3 wave1  = mix(vec3(0.050, 0.031, 0.012), vec3(0.030, 0.027, 0.023), t);
        vec3 wave2  = mix(vec3(0.028, 0.017, 0.006), vec3(0.016, 0.014, 0.012), t);
        vec3 crestC = mix(vec3(0.50, 0.38, 0.22), vec3(0.40, 0.37, 0.32), t);

        vec3 col = shadow;
        col = mix(col, wave2, smoothstep(-0.6, 0.2, f));
        col = mix(col, wave1, smoothstep(0.0, 0.8, f));
        col += crestC * crest * 0.55;
        col *= 1.0 - dot(uv, uv) * 0.12;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), material);
  mesh.position.z = -10;
  mesh.renderOrder = -10;
  camera.add(mesh);
}

// ---------- the figure: cut-out photo with depth relief and a gold rim ----------
const figure = new THREE.Group();
const pivot = new THREE.Group();
pivot.add(figure);
scene.add(pivot);

const figureVertex = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += 0.03 + texture2D(uDepth, uv).r * uDepthScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const figureFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uDepth;
  uniform vec2 uTexel;
  uniform vec2 uLight;
  uniform float uReveal;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    // the matte is soft on the dark fabric: make the inside solid, keep a soft edge
    float a = smoothstep(0.08, 0.45, c.a) * smoothstep(0.0, 0.16, vUv.y) * uReveal; // legs fade into the dark
    if (a < 0.02) discard;

    // relief normal from the depth map
    float dl = texture2D(uDepth, vUv - vec2(uTexel.x * 3.0, 0.0)).r;
    float dr = texture2D(uDepth, vUv + vec2(uTexel.x * 3.0, 0.0)).r;
    float dd = texture2D(uDepth, vUv - vec2(0.0, uTexel.y * 3.0)).r;
    float du = texture2D(uDepth, vUv + vec2(0.0, uTexel.y * 3.0)).r;
    vec3 n = normalize(vec3((dl - dr) * 9.0, (dd - du) * 9.0, 1.0));

    vec3 key = normalize(vec3(uLight, 0.9));
    float shade = 0.82 + 0.3 * max(dot(n, key), 0.0);

    // gold rim along the silhouette
    float e = 0.0;
    e += texture2D(uMap, vUv + vec2(uTexel.x * 6.0, 0.0)).a;
    e += texture2D(uMap, vUv - vec2(uTexel.x * 6.0, 0.0)).a;
    e += texture2D(uMap, vUv + vec2(0.0, uTexel.y * 6.0)).a;
    e += texture2D(uMap, vUv - vec2(0.0, uTexel.y * 6.0)).a;
    float rim = (1.0 - smoothstep(0.08, 0.45, e * 0.25)) * smoothstep(0.08, 0.45, c.a);
    float side = max(dot(n, normalize(vec3(-uLight, 0.4))), 0.0);

    vec3 col = c.rgb * shade;
    col += vec3(0.83, 0.70, 0.45) * (rim * 0.9 + side * 0.03);
    gl_FragColor = vec4(col, a);
  }`;

const FIG_H = 3.4;
const figureMats = [];
const loader = new THREE.TextureLoader();
const loadTex = (src) => new Promise((ok, fail) => loader.load(src, ok, undefined, fail));

async function addSide(name, turned) {
  const [map, depthTex] = await Promise.all([loadTex(`images/${name}-cut.webp`), loadTex(`images/${name}-depth.png`)]);
  // grow the near areas past the outline so edge triangles stay flat (no stair-steps)
  const depth = new THREE.CanvasTexture(softenDepth(depthTex.image, 9));
  depthTex.dispose();
  for (const t of [map, depth]) {
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
  }
  const aspect = map.image.width / map.image.height;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uDepth: { value: depth },
      uDepthScale: { value: 0.42 },
      uTexel: { value: new THREE.Vector2(1 / map.image.width, 1 / map.image.height) },
      uLight: { value: new THREE.Vector2(0.6, 0.7) },
      uReveal: { value: 0 },
    },
    vertexShader: figureVertex,
    fragmentShader: figureFragment,
    transparent: true,
  });
  figureMats.push(mat);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FIG_H * aspect, FIG_H, 180, 240), mat);
  if (turned) mesh.rotation.y = Math.PI;
  figure.add(mesh);
}

Promise.all([addSide("back", false), addSide("front", true)]).catch(() => {
  stage.classList.add("no-figure");
});

// ---------- gold sparks ----------
const sparkCount = isPhone() ? 220 : 450;
const sparkData = [];
let sparks;
{
  const tex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,.85)");
    g.addColorStop(0.6, "rgba(255,255,255,.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    return new THREE.CanvasTexture(c);
  })();
  const pos = new Float32Array(sparkCount * 3);
  const col = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 6.5;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 5 - 0.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6.5;
    if (Math.random() < 0.7) {
      col.set([1.0, 0.62 + Math.random() * 0.15, 0.22 + Math.random() * 0.12], i * 3); // molten gold
    } else {
      col.set([1.0, 0.94, 0.82], i * 3); // champagne white
    }
    sparkData.push({
      sx: (Math.random() - 0.5) * 0.4,
      sy: 0.15 + Math.random() * 0.3,
      sz: (Math.random() - 0.5) * 0.4,
      sway: 0.5 + Math.random() * 1.5,
      radius: 0.05 + Math.random() * 0.15,
      phase: Math.random() * Math.PI * 2,
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  sparks = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.03, vertexColors: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, map: tex,
  }));
  scene.add(sparks);
}

// ---------- sizing ----------
function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  bgUniforms.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- input ----------
let targetMouseX = 0, targetMouseY = 0, mouseX = 0, mouseY = 0;
let cursorX = innerWidth / 2, cursorY = innerHeight / 2, outerX = cursorX, outerY = cursorY;
const cursorInner = document.querySelector(".cursor-inner");
const cursorOuter = document.querySelector(".cursor-outer");
if (finePointer && cursorInner) document.body.classList.add("has-cursor");

addEventListener("mousemove", (e) => {
  cursorX = e.clientX;
  cursorY = e.clientY;
  if (cursorInner) {
    cursorInner.style.left = `${cursorX}px`;
    cursorInner.style.top = `${cursorY}px`;
  }
  targetMouseX = (e.clientX / innerWidth) * 2 - 1;
  targetMouseY = (e.clientY / innerHeight) * 2 - 1;
});
document.addEventListener("mouseover", (e) => {
  cursorOuter?.classList.toggle("hover", !!e.target.closest("a, button, input, summary"));
});

// ---------- scroll story ----------
const slides = [...section.querySelectorAll(".cine-slide")];
const ranges = [[-0.1, 0.13], [0.26, 0.42], [0.55, 0.7], [0.84, 1.05]];
const fills = [...section.querySelectorAll(".story-dash-fill")];
const imageMask = section.querySelector(".cine-image");
const dots = [...section.querySelectorAll(".grid-dot")];
const cue = section.querySelector(".scroll-cue");

function scrollProgress() {
  const top = section.offsetTop;
  const span = section.offsetHeight - innerHeight;
  return Math.min(1, Math.max(0, (scrollY - top) / Math.max(1, span)));
}

function updateOverlay(p) {
  slides.forEach((s, i) => s.classList.toggle("active", p >= ranges[i][0] && p <= ranges[i][1]));
  imageMask?.classList.toggle("active", p >= ranges[1][0] && p <= ranges[1][1]);
  fills.forEach((f, i) => {
    f.style.height = `${Math.min(1, Math.max(0, (p - i * 0.25) / 0.25)) * 100}%`;
  });
  dots.forEach((dot, i) => {
    let speed = 90 + ((i * 55) % 180);
    if (i % 2 === 0) speed = -speed;
    const y = (((((i * 17) % 80) + 10 + p * speed) % 100) + 100) % 100;
    dot.style.top = `${y}%`;
  });
  cue?.classList.toggle("gone", p > 0.03);
}

// slide buttons jump to a point in the story
section.querySelectorAll("[data-story]").forEach((a) =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    const span = section.offsetHeight - innerHeight;
    scrollTo({ top: section.offsetTop + span * Number(a.dataset.story), behavior: "smooth" });
  }));

const ease = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- loop (paused once the story is scrolled past) ----------
let running = true;
new IntersectionObserver(([en]) => { running = en.isIntersecting; }).observe(section);
const clock = new THREE.Clock();
let current = scrollProgress();
let reveal = 0;
const lookAt = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  outerX += (cursorX - outerX) * 0.2;
  outerY += (cursorY - outerY) * 0.2;
  if (cursorOuter) {
    cursorOuter.style.left = `${outerX}px`;
    cursorOuter.style.top = `${outerY}px`;
  }
  if (!running || document.hidden) return;

  const t = clock.elapsedTime;
  const target = scrollProgress();
  current += (target - current) * (reduceMotion ? 1 : 0.05);
  mouseX += (targetMouseX - mouseX) * 0.05;
  mouseY += (targetMouseY - mouseY) * 0.05;

  // figure: turn to the front, then back to the print for the last slide
  const turn = ease(0.38, 0.56, current) * Math.PI + ease(0.74, 0.88, current) * Math.PI;
  pivot.rotation.y = turn + mouseX * 0.25;
  pivot.rotation.x = mouseY * 0.1;
  pivot.position.y = -0.15 + (reduceMotion ? 0 : Math.sin(t * 0.9) * 0.04);
  reveal = Math.min(1, reveal + dt * 0.8);
  const light = new THREE.Vector2(0.6 - mouseX * 0.5, 0.7 + mouseY * 0.3);
  figureMats.forEach((m) => {
    m.uniforms.uReveal.value = reveal;
    m.uniforms.uLight.value.copy(light);
  });

  // camera sweep around the figure
  const phone = isPhone();
  const phi = Math.sin(current * Math.PI * 2) * 0.4;
  const lift = Math.sin(current * Math.PI);
  const radius = (6.0 - lift * 0.7) * (camera.aspect < 0.8 ? 1.9 : 1);
  camera.position.lerp(new THREE.Vector3(radius * Math.sin(phi), 0.2 + lift * 0.5, radius * Math.cos(phi)), 0.05);
  // first screen: frame the figure to the right of the headline (above it on a phone)
  const intro = (Math.cos(Math.min(1, current / 0.28) * Math.PI) + 1) / 2;
  lookAt.set(phone ? 0 : -1.25 * intro, phone ? -1.3 : -0.1, 0);
  camera.lookAt(lookAt);

  // sparks rise, and swirl harder while scrolling fast
  const pos = sparks.geometry.attributes.position.array;
  const v = Math.abs(target - current);
  const speed = reduceMotion ? 0 : 1 + v * 9;
  const turb = v * 0.8;
  for (let i = 0; i < sparkCount; i++) {
    const k = i * 3;
    const d = sparkData[i];
    pos[k] += d.sx * dt * speed + Math.sin(t * d.sway + d.phase) * d.radius * (1 + turb * 4) * dt;
    pos[k + 1] += d.sy * dt * speed;
    pos[k + 2] += d.sz * dt * speed + Math.cos(t * d.sway + d.phase) * d.radius * (1 + turb * 4) * dt;
    if (pos[k + 1] > 3 || Math.abs(pos[k]) > 3.5 || Math.abs(pos[k + 2]) > 3.5) {
      pos[k + 1] = -2.5;
      pos[k] = (Math.random() - 0.5) * 3;
      pos[k + 2] = (Math.random() - 0.5) * 3;
    }
  }
  sparks.geometry.attributes.position.needsUpdate = true;

  bgUniforms.uTime.value = t;
  bgUniforms.uMouse.value.set(mouseX, -mouseY);
  bgUniforms.uScroll.value = current;

  updateOverlay(current);
  renderer.render(scene, camera);
}
updateOverlay(current);
frame();
