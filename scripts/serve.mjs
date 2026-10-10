import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT || 4173);
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
createServer(async (request, response) => {
  let path;
  try { path = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { response.writeHead(400).end("Invalid URL"); return; }
  // Mirror a GitHub Pages project path in browser tests.
  const prefix = "/Michael-levin-videos2";
  if (path === prefix) {
    response.writeHead(302, { Location: `${prefix}/` }).end();
    return;
  }
  if (path.startsWith(`${prefix}/`)) path = path.slice(prefix.length);
  const file = resolve(root, `.${path.endsWith("/") ? `${path}index.html` : path}`);
  if (!file.startsWith(`${root}${sep}`)) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": `${mime[extname(file)] || "application/octet-stream"}; charset=utf-8` }).end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") response.writeHead(404).end("Not found");
    else { console.error(error); response.writeHead(500).end("Server error"); }
  }
}).listen(port, "127.0.0.1", () => console.log(`Serving http://127.0.0.1:${port}/Michael-levin-videos2/`));
