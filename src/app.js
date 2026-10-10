import { filterVideos, readFavorites, validateCatalog, writeFavorites } from "./library.js";

const $ = selector => document.querySelector(selector);
let videos = [];
let favorites = new Set();
const selectedLabels = new Set();
let storage;

function notify(message) {
  $("#notice").textContent = message || "";
  $("#notice").hidden = !message;
}

function card(video) {
  const article = document.createElement("article");
  article.className = "video-card";
  article.innerHTML = `
    <a class="thumbnail-link" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img class="thumbnail" loading="lazy" width="480" height="270" alt=""><span class="play-icon">▶</span><span class="video-number"></span></a>
    <div class="card-body">
      <div class="card-topline"><span class="video-format">FROM THE CHANNEL</span><button class="favorite-button" type="button"><span class="favorite-icon" aria-hidden="true"></span><span class="favorite-text"></span></button></div>
      <h3><a class="video-title" target="_blank" rel="noopener noreferrer"></a></h3>
      <p class="video-summary"></p>
      <div class="card-labels"></div>
      <div class="card-bottom"><details class="score-detail"><summary><span class="score"></span><span class="score-caption"> / 10 interest <span aria-hidden="true">ⓘ</span></span></summary><p class="score-reason"></p></details><a class="watch-link" target="_blank" rel="noopener noreferrer">Watch on YouTube <span aria-hidden="true">↗</span></a></div>
    </div>`;
  for (const link of article.querySelectorAll("a")) link.href = video.url;
  article.querySelector(".thumbnail").src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
  article.querySelector(".video-number").textContent = String(video.position).padStart(2, "0");
  article.querySelector(".video-title").textContent = video.title;
  if (video.transcript.status === "pending") {
    article.classList.add("pending-card");
    article.querySelector(".video-format").textContent = "AWAITING TRANSCRIPT";
    article.querySelector(".video-summary").textContent = video.transcript.reason;
    const unrated = document.createElement("span");
    unrated.className = "unrated";
    unrated.textContent = "Not rated yet";
    article.querySelector(".score-detail").replaceWith(unrated);
  } else {
    article.querySelector(".video-summary").textContent = video.summary;
    article.querySelector(".score").textContent = video.rating;
    article.querySelector(".score-reason").textContent = video.ratingReason;
    if (video.transcript.note) {
      const note = document.createElement("p");
      note.className = "source-note";
      note.textContent = video.transcript.note;
      article.querySelector(".video-summary").after(note);
    }
  }
  article.querySelector(".watch-link").setAttribute("aria-label", `Watch on YouTube: ${video.title}`);
  for (const label of video.labels) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = label;
    article.querySelector(".card-labels").append(tag);
  }
  const button = article.querySelector(".favorite-button");
  button.dataset.videoId = video.id;
  button.setAttribute("aria-pressed", String(favorites.has(video.id)));
  button.setAttribute("aria-label", `Favorite: ${video.title}`);
  button.querySelector(".favorite-icon").textContent = favorites.has(video.id) ? "★" : "☆";
  button.querySelector(".favorite-text").textContent = favorites.has(video.id) ? "Saved" : "Save";
  button.addEventListener("click", () => {
    if (favorites.has(video.id)) favorites.delete(video.id);
    else favorites.add(video.id);
    notify(writeFavorites(storage, favorites));
    render();
    const replacement = [...document.querySelectorAll(".favorite-button")].find(element => element.dataset.videoId === video.id);
    (replacement || $("#result-count")).focus({ preventScroll: true });
  });
  return article;
}

function render() {
  const visible = filterVideos(videos, {
    query: $("#search").value,
    favoritesOnly: $("#favorites-only").checked,
    labels: [...selectedLabels],
    minRating: Number($("#rating").value),
    sort: $("#sort").value,
  }, favorites);
  $("#result-count").textContent = `${visible.length} of ${videos.length} videos`;
  $("#favorites-count").textContent = favorites.size;
  $("#video-list").replaceChildren(...visible.map(card));
  $("#empty").hidden = visible.length !== 0;
  for (const button of document.querySelectorAll(".topic-button")) {
    button.setAttribute("aria-pressed", String(selectedLabels.has(button.dataset.label)));
  }
}

function reset() {
  $("#search").value = "";
  $("#favorites-only").checked = false;
  $("#rating").value = "0";
  $("#sort").value = "newest";
  selectedLabels.clear();
  render();
}

async function load() {
  $("#load-error").hidden = true;
  $("#video-list").setAttribute("aria-busy", "true");
  $("#result-count").textContent = "Loading videos…";
  try {
    const response = await fetch(new URL("../data/videos.json", import.meta.url));
    if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
    const catalog = validateCatalog(await response.json());
    videos = catalog.videos;
    const pending = videos.filter(video => video.transcript.status === "pending").length;
    $("#coverage").hidden = pending === 0;
    $("#coverage").textContent = `${videos.length - pending} videos summarized · ${pending} awaiting transcripts. YouTube blocked caption retrieval for those entries, so summaries, ratings, and topics are intentionally left blank. They can still be saved as favorites; topic and minimum-rating filters show only reviewed videos.`;
    $("#total-count").textContent = videos.length;
    const date = new Date(catalog.fetchedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    $("#snapshot").textContent = `Latest 50 uploads · snapshot ${date}`;
    try { storage = window.localStorage; } catch { storage = undefined; }
    const saved = readFavorites(storage, new Set(videos.map(video => video.id)));
    favorites = saved.favorites;
    notify(saved.error);
    $("#topics").replaceChildren();
    const labels = [...new Set(videos.flatMap(video => video.labels))].sort();
    for (const label of labels) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "topic-button";
      button.dataset.label = label;
      button.setAttribute("aria-pressed", "false");
      const name = document.createElement("span");
      name.textContent = label;
      const count = document.createElement("span");
      count.className = "topic-count";
      count.textContent = videos.filter(video => video.labels.includes(label)).length;
      count.setAttribute("aria-hidden", "true");
      button.append(name, count);
      button.addEventListener("click", () => {
        if (selectedLabels.has(label)) selectedLabels.delete(label);
        else selectedLabels.add(label);
        render();
      });
      $("#topics").append(button);
    }
    render();
  } catch (error) {
    $("#load-error").hidden = false;
    $("#load-error-detail").textContent = `${error.message} Check your connection and try again.`;
    $("#result-count").textContent = "Collection unavailable";
    $("#snapshot").textContent = "Snapshot unavailable";
  } finally {
    $("#video-list").setAttribute("aria-busy", "false");
  }
}

$("#search").addEventListener("input", render);
for (const selector of ["#favorites-only", "#rating", "#sort"]) $(selector).addEventListener("change", render);
$("#reset").addEventListener("click", reset);
$("#empty-reset").addEventListener("click", () => { reset(); $("#search").focus(); });
$("#retry").addEventListener("click", load);
load();
