// Makes a depth map for each product photo with Depth Anything V2 (runs locally, once).
// Usage: node scripts/depth.mjs            -> public/images/<name>-depth.png
import { pipeline, RawImage } from "@huggingface/transformers";

const photos = process.argv.slice(2).length ? process.argv.slice(2) : ["back", "front"];
const depth = await pipeline("depth-estimation", "onnx-community/depth-anything-v2-small");

for (const name of photos) {
  const img = await RawImage.read(`public/images/${name}.webp`);
  const out = await depth(img);
  const map = out.depth; // grayscale, near = bright, same size as the photo
  await map.save(`public/images/${name}-depth.png`);
  console.log(`${name}: ${img.width}x${img.height} -> ${map.width}x${map.height}`);
}
