import "./styles.css";
import "./sizes.js";
import { startMotion } from "./motion.js";

// The 3D hero loads Three.js only on the home page; the rest of the site never waits for it.
const stage = document.querySelector(".hero-stage");
if (stage) {
  let api = null;
  const proxy = { setProgress: (p) => api?.setProgress(p) };
  startMotion(proxy);
  import("./hero3d.js")
    .then((m) => m.initHero(stage, stage.querySelector(".hero-canvas")))
    .then((a) => { api = a; })
    .catch(() => {});
} else {
  startMotion(null);
}
