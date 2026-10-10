import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { FAVORITES_KEY, filterVideos } from "../src/library.js";

const catalog = JSON.parse(await readFile(new URL("../data/videos.json", import.meta.url), "utf8"));
const cards = page => page.locator(".video-card");

test("loads all 50 videos at a GitHub Pages project path", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("./");
  await expect(cards(page)).toHaveCount(50);
  await expect(page.locator(".video-title").first()).toHaveText(catalog.videos[0].title);
  await expect(page.locator(".video-title").last()).toHaveAttribute("href", catalog.videos[49].url);
  await expect(page.locator("#snapshot")).toContainText("snapshot");
  await expect(page.locator(".video-summary").first()).toHaveText(catalog.videos[0].summary);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("library.png") });
});

test("favorites persist across reload and can be removed from watchlist", async ({ page }) => {
  await page.goto("./");
  await expect(cards(page)).toHaveCount(50);
  const first = page.locator(".favorite-button").first();
  await first.click();
  await expect(page.locator(".favorite-button").first()).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator(".favorite-button").first()).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Favorites only").check();
  await expect(cards(page)).toHaveCount(1);
  await page.locator(".favorite-button").click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator("#empty")).toBeVisible();
  await expect(page.locator("#result-count")).toBeFocused();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(cards(page)).toHaveCount(50);
});

test("label and rating filters combine correctly with favorites and reset", async ({ page }) => {
  await page.goto("./");
  await expect(cards(page)).toHaveCount(50);
  const selected = catalog.videos[0];
  await page.locator(".favorite-button").first().click();
  await page.getByLabel("Favorites only").check();
  await page.getByRole("button", { name: selected.labels[0], exact: true }).click();
  await page.getByLabel("Minimum interest rating").selectOption("7");
  await expect(cards(page)).toHaveCount(selected.rating >= 7 ? 1 : 0);
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(cards(page)).toHaveCount(50);
  await page.getByLabel("Minimum interest rating").selectOption("9");
  await expect(cards(page)).toHaveCount(catalog.videos.filter(video => video.rating >= 9).length);
  await page.getByRole("button", { name: selected.labels[0], exact: true }).click();
  await expect(cards(page)).toHaveCount(filterVideos(catalog.videos, { minRating: 9, labels: [selected.labels[0]] }).length);
  const other = catalog.videos.flatMap(video => video.labels).find(label => label !== selected.labels[0]);
  await page.getByRole("button", { name: other, exact: true }).click();
  await expect(cards(page)).toHaveCount(filterVideos(catalog.videos, { minRating: 9, labels: [selected.labels[0], other] }).length);
});

test("search, sort and score explanations work", async ({ page }) => {
  await page.goto("./");
  await expect(cards(page)).toHaveCount(50);
  await page.getByLabel("Search the collection").fill("no-matching-video-xyz");
  await expect(page.locator("#empty")).toBeVisible();
  await page.getByLabel("Search the collection").fill("bioelectric");
  await expect(cards(page)).toHaveCount(filterVideos(catalog.videos, { query: "bioelectric" }).length);
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByLabel("Sort", { exact: true }).selectOption("rating");
  const sorted = filterVideos(catalog.videos, { sort: "rating" });
  await expect(page.locator(".video-title").first()).toHaveText(sorted[0].title);
  await page.locator(".score-detail summary").first().click();
  await expect(page.locator(".score-reason").first()).toBeVisible();
  await expect(page.locator(".score-reason").first()).toHaveText(sorted[0].ratingReason);
});

test("pending transcripts have explicit status, no fabricated score, and working favorites", async ({ page }) => {
  await page.goto("./");
  await expect(cards(page)).toHaveCount(50);
  const pendingVideos = catalog.videos.filter(video => video.transcript.status === "pending");
  await expect(page.locator(".pending-card")).toHaveCount(pendingVideos.length);
  await expect(page.locator("#coverage")).toContainText(`${pendingVideos.length} awaiting transcripts`);
  const pending = page.locator(".pending-card").first();
  await expect(pending.locator(".unrated")).toHaveText("Not rated yet");
  await expect(pending.locator(".score")).toHaveCount(0);
  await expect(pending.locator(".tag")).toHaveCount(0);
  await pending.locator(".favorite-button").click();
  await page.getByLabel("Favorites only").check();
  await expect(cards(page)).toHaveCount(1);
  await page.getByLabel("Minimum interest rating").selectOption("5");
  await expect(cards(page)).toHaveCount(0);
});

test("storage write failure is visible but favorites still work for this visit", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error("Storage disabled"); };
  });
  await page.goto("./");
  await expect(cards(page)).toHaveCount(50);
  await page.locator(".favorite-button").first().click();
  await expect(page.locator("#notice")).toContainText("couldn't be saved");
  await page.getByLabel("Favorites only").check();
  await expect(cards(page)).toHaveCount(1);
});

test("corrupt favorites are reported without breaking the library", async ({ page }) => {
  await page.addInitScript(key => window.localStorage.setItem(key, "{broken"), FAVORITES_KEY);
  await page.goto("./");
  await expect(cards(page)).toHaveCount(50);
  await expect(page.locator("#notice")).toContainText("couldn't be read");
});

test("failed catalog request can be retried", async ({ page }) => {
  let fail = true;
  await page.route("**/data/videos.json", route => fail ? route.fulfill({ status: 503, body: "Unavailable" }) : route.continue());
  await page.goto("./");
  await expect(page.locator("#load-error")).toBeVisible();
  await expect(page.locator("#load-error-detail")).toContainText("503");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(cards(page)).toHaveCount(50);
  await expect(page.locator("#load-error")).toBeHidden();
});

test("untrusted title and summary render only as text", async ({ page }) => {
  const data = structuredClone(catalog);
  const payload = '<img src=x onerror="window.injected=true">';
  data.videos[0].title = payload;
  data.videos[0].summary = payload;
  await page.route("**/data/videos.json", route => route.fulfill({ json: data }));
  await page.goto("./");
  await expect(cards(page)).toHaveCount(50);
  await expect(page.locator(".video-title").first()).toHaveText(payload);
  await expect(page.locator(".video-summary").first()).toHaveText(payload);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator(".video-title img")).toHaveCount(0);
});
