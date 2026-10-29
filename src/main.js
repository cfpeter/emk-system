import "./styles.css";
import "./app.js";

// Load Three.js only on pages that use it.
if (document.querySelector(".cine")) import("./cinematic.js");
if (document.querySelector("[data-depth]")) {
  import("./depthphoto.js").then((m) => m.mountAll());
}
