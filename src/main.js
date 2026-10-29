import "./styles.css";
import "./app.js";

// Load Three.js only on pages that show the 3D shirt.
if (document.querySelector("[data-shirt]")) {
  import("./shirt3d.js").then((m) => m.mountAll());
}
