// One motion system for the site: Lenis smooth scroll driven by the GSAP ticker, wired to
// ScrollTrigger, with gsap.matchMedia splitting desktop / phone / reduced motion.
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: "power3.out", duration: 0.85 });

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
export let lenis = null;

// ---------- the one loop ----------
if (!reduce) {
  lenis = new Lenis({ lerp: 0.12, smoothWheel: true, wheelMultiplier: 0.9, anchors: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
}
gsap.ticker.lagSmoothing(0);
addEventListener("load", () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());

// ---------- split headings into masked words (accessible name stays on the parent) ----------
function splitWords(el) {
  if (el.dataset.splitDone) return el.querySelectorAll(".word");
  const text = el.textContent.trim();
  el.setAttribute("aria-label", text);
  el.innerHTML = text
    .split(/\s+/)
    .map((w) => `<span class="mask" aria-hidden="true"><span class="word">${w}</span></span>`)
    .join(" ");
  el.dataset.splitDone = "1";
  return el.querySelectorAll(".word");
}

// ---------- page intro: line rise, everything settled by ~1.2s ----------
function intro() {
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  // the title is painted on the first frame; only the copy and header arrive
  tl.from("[data-intro]", { autoAlpha: 0, y: 16, duration: 0.8, stagger: 0.08 }, 0.15);
  const pieceWords = document.querySelector(".piece-copy [data-split]");
  if (pieceWords) tl.from(splitWords(pieceWords), { yPercent: 105, duration: 0.95, stagger: 0.06 }, 0.1);
}

// ---------- scroll reveals (each kind moves differently) ----------
function reveals(phone) {
  gsap.utils.toArray("[data-split]").forEach((el) => {
    if (el.closest(".piece-copy")) return; // handled by the intro
    gsap.from(splitWords(el), {
      yPercent: 105, duration: 0.95, ease: "power4.out", stagger: 0.06,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });
  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.to(el, {
      autoAlpha: 1, y: 0, duration: 1, ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });
  gsap.utils.toArray("[data-clip]").forEach((el) => {
    gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } })
      .to(el, { clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "power4.out" })
      .from(el.querySelector("img"), { scale: 1.12, duration: 1.4, ease: "power4.out" }, 0);
  });
  gsap.utils.toArray("[data-parallax]").forEach((img) => {
    gsap.fromTo(img, { yPercent: -6 }, {
      yPercent: phone ? 0 : 6, ease: "none",
      scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: 1.2 },
    });
  });
  // size table rows line up one after another
  const rows = document.querySelectorAll(".size-table tbody tr");
  if (rows.length) {
    gsap.from(rows, {
      autoAlpha: 0, x: -24, duration: 0.8, stagger: 0.08, ease: "power3.out",
      scrollTrigger: { trigger: ".size-table", start: "top 85%", once: true },
    });
  }
}

// ---------- hero: lines part as the tee turns ----------
function hero(heroApi) {
  const section = document.querySelector(".hero");
  if (!section) return;
  ScrollTrigger.create({
    trigger: section, start: "top top", end: "bottom bottom",
    onUpdate: (s) => heroApi?.setProgress(s.progress),
  });
  gsap.timeline({ scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 1 } })
    .to(".hero-title .l1", { xPercent: -18, autoAlpha: 0.15, ease: "none" }, 0.1)
    .to(".hero-title .l2", { xPercent: 14, autoAlpha: 0.15, ease: "none" }, 0.1)
    .to(".hero-copy", { y: -40, autoAlpha: 0, ease: "none", duration: 0.4 }, 0.05);
}

// ---------- showcase: one frame, three distances ----------
function showcase() {
  const section = document.querySelector(".showcase");
  if (!section) return;
  const frame = section.querySelector(".showcase-frame");
  const img = frame.querySelector("img");
  const caps = section.querySelectorAll(".showcase-caps p");
  const aspect = 858 / 1168;
  // centre a point (u, v) of the photo in the frame at scale s
  const aim = (u, v, s) => {
    const W = frame.clientWidth, H = frame.clientHeight;
    const Hi = W / aspect;
    const px = u * W, py = v * Hi - (Hi - H) / 2;
    return { x: -(px - W / 2) * s, y: -(py - H / 2) * s, scale: s };
  };
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 1, invalidateOnRefresh: true },
  });
  tl.to(img, { x: () => aim(0.52, 0.4, 2.3).x, y: () => aim(0.52, 0.4, 2.3).y, scale: 2.3, duration: 0.35 }, 0.05)
    .to(caps[0], { autoAlpha: 0, duration: 0.08 }, 0.2)
    .to(caps[1], { autoAlpha: 1, duration: 0.08 }, 0.26)
    .to(img, { x: () => aim(0.53, 0.55, 2.8).x, y: () => aim(0.53, 0.55, 2.8).y, scale: 2.8, duration: 0.3 }, 0.55)
    .to(caps[1], { autoAlpha: 0, duration: 0.08 }, 0.62)
    .to(caps[2], { autoAlpha: 1, duration: 0.08 }, 0.68)
    .to({}, { duration: 0.15 });
  gsap.from(".sc-top, .sc-bottom", {
    y: 40, autoAlpha: 0, duration: 1, stagger: 0.12, ease: "expo.out",
    scrollTrigger: { trigger: section, start: "top 70%", once: true },
  });
}

// ---------- gallery: each photo sinks as the next covers it ----------
function curtains() {
  const items = gsap.utils.toArray(".curtain");
  items.forEach((fig, i) => {
    const next = items[i + 1];
    if (!next) return;
    gsap.to(fig.querySelector("img"), {
      scale: 0.9, yPercent: -6, autoAlpha: 0.4, ease: "none",
      scrollTrigger: { trigger: next, start: "top bottom", end: "top top", scrub: true },
    });
  });
  items.forEach((fig) => {
    gsap.from(fig.querySelector("figcaption"), {
      yPercent: 100, duration: 1, ease: "expo.out",
      scrollTrigger: { trigger: fig, start: "top 40%", once: true },
    });
  });
}

// ---------- footer: wordmark rises out of the cream field ----------
function footer() {
  const mark = document.querySelector(".footer-mark svg");
  if (!mark) return;
  gsap.from(mark, {
    yPercent: 60, autoAlpha: 0, ease: "none",
    scrollTrigger: { trigger: ".site-footer", start: "top bottom", end: "bottom bottom", scrub: 1 },
  });
}

// ---------- magnetic buttons (mouse only) ----------
function magnetic() {
  gsap.utils.toArray("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.18);
      yTo((e.clientY - r.top - r.height / 2) * 0.18);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}

// ---------- piece page: back / front, and a slight tilt toward the mouse ----------
function piece(desktop) {
  const fig = document.querySelector("[data-tilt]");
  if (!fig || fig.dataset.bound) return;
  fig.dataset.bound = "1";
  const tilt = fig.querySelector(".piece-tilt");
  const backImg = tilt.querySelector(".is-back");
  const frontImg = tilt.querySelector(".is-front");
  document.querySelectorAll("[data-face]").forEach((b) =>
    b.addEventListener("click", () => {
      const toFront = b.dataset.face === "front";
      document.querySelectorAll("[data-face]").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      gsap.timeline({ defaults: { duration: reduce ? 0 : 0.5, ease: "power3.inOut" } })
        .to(tilt, { rotationY: toFront ? 90 : -90, duration: reduce ? 0 : 0.3, ease: "power2.in" })
        .set(backImg, { autoAlpha: toFront ? 0 : 1 })
        .set(frontImg, { autoAlpha: toFront ? 1 : 0 })
        .fromTo(tilt, { rotationY: toFront ? -90 : 90 }, { rotationY: 0, duration: reduce ? 0 : 0.45, ease: "power3.out" });
    }));
  if (!desktop) return;
  const rx = gsap.quickTo(tilt, "rotationX", { duration: 0.8, ease: "power3.out" });
  const rz = gsap.quickTo(tilt, "x", { duration: 0.8, ease: "power3.out" });
  fig.addEventListener("pointermove", (e) => {
    const r = fig.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    rx(-ny * 6);
    rz(nx * 16);
  });
  fig.addEventListener("pointerleave", () => { rx(0); rz(0); });
}

// ---------- start ----------
export function startMotion(heroApi) {
  const mm = gsap.matchMedia();
  mm.add(
    {
      desktop: "(min-width: 761px) and (pointer: fine)",
      phone: "(max-width: 760px)",
      still: "(prefers-reduced-motion: reduce)",
    },
    ({ conditions: { desktop, phone, still } }) => {
      hero(heroApi);
      piece(desktop && !still);
      if (still) {
        gsap.set("[data-reveal], [data-clip]", { clearProps: "all" });
        return;
      }
      intro();
      reveals(phone);
      showcase();
      curtains();
      footer();
      if (desktop) magnetic();
      ScrollTrigger.refresh();
    },
  );
}
