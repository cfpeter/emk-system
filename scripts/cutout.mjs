// Cuts the person + tee out of each photo (transparent background), once, locally.
// Usage: node scripts/cutout.mjs           -> art/<name>-mask.png
import { readFile, writeFile } from "node:fs/promises";
import { removeBackground } from "@imgly/background-removal-node";

const photos = process.argv.slice(2).length ? process.argv.slice(2) : ["back", "front"];
for (const name of photos) {
  const input = new Blob([await readFile(`public/images/${name}.webp`)], { type: "image/webp" });
  const out = await removeBackground(input, { model: "medium", output: { format: "image/png" } });
  await writeFile(`art/${name}-mask.png`, Buffer.from(await out.arrayBuffer()));
  console.log(`${name}: cut out (run scripts/merge-cut.py next for full colour)`);
}
