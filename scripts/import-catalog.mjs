import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { validateCatalog } from "../src/library.js";

const args = process.argv.slice(2);
const directory = args.find(arg => !arg.startsWith("--"));
if (!directory) throw new Error("Usage: node scripts/import-catalog.mjs <private-watch-directory> [--allow-pending]");
const root = resolve(directory);
const manifest = JSON.parse(await readFile(join(root, "channel.json"), "utf8"));
const results = JSON.parse(await readFile(join(root, "fetch-results.json"), "utf8"));
const summaries = new Map();
for (const filename of (await readdir(root)).filter(name => /^summaries-\d+-\d+\.json$/.test(name)).sort()) {
  const batch = JSON.parse(await readFile(join(root, filename), "utf8"));
  for (const entry of batch) {
    if (summaries.has(entry.id)) throw new Error(`Duplicate summary: ${entry.id}`);
    if (entry.transcriptReadComplete !== true) throw new Error(`Transcript not fully read: ${entry.id}`);
    summaries.set(entry.id, entry);
  }
}
let sourceNotes = {};
try { sourceNotes = JSON.parse(await readFile(join(root, "source-notes.json"), "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }

const videos = [];
for (const [index, entry] of manifest.entries.entries()) {
  const summary = summaries.get(entry.id);
  const result = results.find(item => item.video_id === entry.id);
  const video = { id: entry.id, position: index + 1, title: entry.title, url: `https://www.youtube.com/watch?v=${entry.id}` };
  if (result?.ok && summary) {
    const transcript = JSON.parse(await readFile(join(root, "transcripts", `${entry.id}.transcript.json`), "utf8"));
    if (!transcript.ok || transcript.video_id !== entry.id || !transcript.segments?.length) {
      throw new Error(`Missing source transcript: ${entry.id}`);
    }
    videos.push({
      ...video,
      summary: summary.summary,
      rating: summary.rating,
      ratingReason: summary.ratingReason,
      labels: summary.labels,
      transcript: {
        status: "available", language: transcript.language, kind: transcript.kind,
        ...(sourceNotes[entry.id] ? { note: sourceNotes[entry.id] } : {}),
      },
    });
  } else {
    if (result?.ok || summary) throw new Error(`Incomplete source/editorial pair: ${entry.id}`);
    if (!args.includes("--allow-pending")) throw new Error(`Cannot publish without transcript: ${entry.id}`);
    videos.push({
      ...video, summary: null, rating: null, ratingReason: null, labels: [],
      transcript: {
        status: "pending",
        reason: "Awaiting transcript. YouTube blocked caption retrieval; a summary, interest rating, and topic labels will be added only after the transcript can be read.",
      },
    });
  }
}
const catalog = validateCatalog({
  schemaVersion: 1,
  channel: { name: manifest.channel || manifest.uploader, url: "https://www.youtube.com/@drmichaellevin/videos" },
  fetchedAt: new Date(manifest.epoch * 1000).toISOString(),
  videos,
});
await writeFile(new URL("../data/videos.json", import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Imported ${videos.length} entries; ${videos.filter(v => v.transcript.status === "available").length} summarized.`);
