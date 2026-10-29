import "./styles.css";
import "./app.js";

// Load Three.js only on pages that show a 3D photo.
if (document.querySelector("[data-depth]")) {
  import("./depthphoto.js").then((m) => m.mountAll());
}
