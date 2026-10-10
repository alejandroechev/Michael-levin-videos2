import test from "node:test";
import assert from "node:assert/strict";
import { FAVORITES_KEY, TOPICS, filterVideos, readFavorites, validateCatalog, writeFavorites } from "../src/library.js";

const video = (id, position, rating, labels, title = "Cellular intelligence") => ({
  id, position, rating, labels, title,
  url: `https://www.youtube.com/watch?v=${id}`,
  summary: "An exploration of cells and their behavior.",
  ratingReason: "The link between cells and cognition is intriguing.",
  transcript: { status: "available", language: "en", kind: "generated" },
});
const examples = [
  video("aaaaaaaaaaa", 1, 7, ["Cell biology"]),
  video("bbbbbbbbbbb", 2, 9, ["Cognition", "Bioelectricity"]),
  video("ccccccccccc", 3, 8, ["Cognition"], "Mathematical ideas"),
  video("ddddddddddd", 4, 9, ["Evolution"]),
];
const validCatalog = () => ({
  schemaVersion: 1,
  fetchedAt: "2026-10-10T20:30:00Z",
  videos: Array.from({ length: 50 }, (_, index) => video(String(index).padStart(11, "0"), index + 1, 8, [TOPICS[index % TOPICS.length]])),
});

test("filters combine favorite, rating, topic and case-insensitive search", () => {
  assert.deepEqual(filterVideos(examples, { favoritesOnly: true, minRating: 8, labels: ["Cognition"], query: " CELLULAR " }, new Set(["bbbbbbbbbbb", "ccccccccccc"])).map(v => v.id), ["bbbbbbbbbbb"]);
});

test("topic selections use OR while rating is inclusive", () => {
  assert.deepEqual(filterVideos(examples, { labels: ["Cell biology", "Cognition"], minRating: 8 }).map(v => v.rating), [9, 8]);
});

test("search requires all words and covers summaries and labels", () => {
  assert.equal(filterVideos(examples, { query: "mathematical behavior" }).length, 1);
  assert.equal(filterVideos(examples, { query: "BIOELECTRICITY" }).length, 1);
  assert.equal(filterVideos(examples, { query: "missing word" }).length, 0);
  assert.equal(filterVideos(examples, { query: "    " }).length, 4);
});

test("sort is stable by channel order and never mutates input", () => {
  assert.deepEqual(filterVideos(examples, { sort: "rating" }).map(v => v.position), [2, 4, 3, 1]);
  assert.deepEqual(examples.map(v => v.position), [1, 2, 3, 4]);
  assert.deepEqual(filterVideos([...examples].reverse()).map(v => v.position), [1, 2, 3, 4]);
});

test("favorites round-trip and discard unknown IDs", () => {
  let stored = null;
  const storage = { getItem: key => { assert.equal(key, FAVORITES_KEY); return stored; }, setItem: (key, value) => { assert.equal(key, FAVORITES_KEY); stored = value; } };
  assert.equal(readFavorites(storage, new Set()).favorites.size, 0);
  assert.equal(writeFavorites(storage, new Set(["aaaaaaaaaaa", "outdated"])), null);
  const result = readFavorites(storage, new Set(["aaaaaaaaaaa"]));
  assert.deepEqual([...result.favorites], ["aaaaaaaaaaa"]);
  assert.equal(result.error, null);
});

test("unavailable, corrupt and malformed favorites surface errors", () => {
  for (const raw of ["broken JSON", "{}", "[3]", "null"]) {
    const result = readFavorites({ getItem: () => raw }, new Set());
    assert.ok(result.error);
    assert.equal(result.favorites.size, 0);
  }
  assert.ok(readFavorites(undefined, new Set()).error);
  assert.ok(writeFavorites({ setItem: () => { throw new Error("Quota exceeded"); } }, new Set()));
});

test("valid catalog has exactly 50 ordered, attributed videos", () => {
  assert.equal(validateCatalog(validCatalog()).videos.length, 50);
});

test("explicitly pending videos remain discoverable without fabricated ratings or labels", () => {
  const catalog = validCatalog();
  const pending = catalog.videos[0];
  Object.assign(pending, {
    summary: null, rating: null, ratingReason: null, labels: [],
    transcript: { status: "pending", reason: "Caption retrieval blocked." },
  });
  assert.equal(validateCatalog(catalog).videos.length, 50);
  assert.equal(filterVideos([pending]).length, 1);
  assert.equal(filterVideos([pending], { minRating: 5 }).length, 0);
  assert.equal(filterVideos([pending], { labels: ["Cognition"] }).length, 0);
  assert.equal(filterVideos([pending], { favoritesOnly: true }, new Set([pending.id])).length, 1);
  assert.equal(filterVideos([pending, examples[0]], { sort: "rating" }).at(-1), pending);
  pending.rating = 7;
  assert.throws(() => validateCatalog(catalog));
});

test("invalid catalogs are rejected rather than published", () => {
  const mutations = [
    c => { c.videos.pop(); },
    c => { c.videos[1].id = c.videos[0].id; },
    c => { c.videos[0].summary = ""; },
    c => { c.videos[0].ratingReason = ""; },
    c => { c.videos[0].rating = 11; },
    c => { c.videos[0].rating = 7.5; },
    c => { c.videos[0].labels = ["Unknown topic"]; },
    c => { c.videos[0].labels = ["Cognition", "Cognition"]; },
    c => { c.videos[0].url = "javascript:alert(1)"; },
    c => { c.videos[0].position = 3; },
    c => { c.videos[0].transcript.status = "unavailable"; },
    c => { c.fetchedAt = "never"; },
  ];
  for (const mutate of mutations) {
    const catalog = validCatalog();
    mutate(catalog);
    assert.throws(() => validateCatalog(catalog));
  }
});
