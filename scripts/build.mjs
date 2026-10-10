import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { validateCatalog } from "../src/library.js";

validateCatalog(JSON.parse(await readFile(new URL("../data/videos.json", import.meta.url), "utf8")));
const output = new URL("../dist/", import.meta.url);
await mkdir(output, { recursive: true });
for (const name of ["index.html", "favicon.svg", "src", "data"]) {
  // Remove only the known build output being replaced, never the workspace.
  await rm(new URL(name, output), { recursive: true, force: true });
  await cp(new URL(`../${name}`, import.meta.url), new URL(name, output), { recursive: true });
}
console.log("Built static site in dist/");
