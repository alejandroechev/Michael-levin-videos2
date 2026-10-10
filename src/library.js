export const FAVORITES_KEY = "possible-minds:favorites:v1";
export const TOPICS = [
  "AI & computation", "Aging", "Bioelectricity", "Biophysics", "Cancer",
  "Cell biology", "Cognition", "Collective intelligence", "Consciousness",
  "Control theory", "Evolution", "Experimental methods", "Language & communication",
  "Mathematics", "Metabolism", "Neuroscience", "Philosophy", "Regeneration",
  "Thermodynamics",
];

export function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.videos) || catalog.videos.length !== 50) {
    throw new Error("Expected a version 1 collection containing 50 videos.");
  }
  if (!Number.isFinite(Date.parse(catalog.fetchedAt))) throw new Error("Missing snapshot date.");
  const ids = new Set();
  for (const [index, video] of catalog.videos.entries()) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(video.id) || ids.has(video.id)) throw new Error("Invalid or duplicate video ID.");
    ids.add(video.id);
    if (video.position !== index + 1) throw new Error("Videos must retain their channel order.");
    if (typeof video.title !== "string" || !video.title.trim()) throw new Error(`Missing title for ${video.id}.`);
    if (video.url !== `https://www.youtube.com/watch?v=${video.id}`) throw new Error("Invalid video URL.");
    if (video.transcript?.status === "pending") {
      if (video.summary !== null || video.rating !== null || video.ratingReason !== null ||
          !Array.isArray(video.labels) || video.labels.length !== 0 ||
          typeof video.transcript.reason !== "string" || !video.transcript.reason.trim()) {
        throw new Error(`Pending video ${video.id} must not have invented editorial content.`);
      }
      continue;
    }
    for (const key of ["summary", "ratingReason"]) {
      if (typeof video[key] !== "string" || !video[key].trim()) throw new Error(`Missing ${key} for ${video.id}.`);
    }
    if (!Number.isInteger(video.rating) || video.rating < 1 || video.rating > 10) throw new Error("Invalid rating.");
    if (!Array.isArray(video.labels) || video.labels.length < 1 || video.labels.length > 4 ||
        new Set(video.labels).size !== video.labels.length || video.labels.some(label => !TOPICS.includes(label))) {
      throw new Error(`Invalid labels for ${video.id}.`);
    }
    if (video.transcript?.status !== "available" || !video.transcript.language ||
        !["manual", "generated", "whisper"].includes(video.transcript.kind)) {
      throw new Error(`Missing transcript provenance for ${video.id}.`);
    }
  }
  return catalog;
}

export function filterVideos(videos, { query = "", favoritesOnly = false, labels = [], minRating = 0, sort = "newest" } = {}, favorites = new Set()) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return videos.filter(video => {
    const text = `${video.title} ${video.summary || ""} ${video.labels.join(" ")}`.toLocaleLowerCase();
    return (!favoritesOnly || favorites.has(video.id)) &&
      (minRating === 0 || (video.rating !== null && video.rating >= minRating)) &&
      (!labels.length || labels.some(label => video.labels.includes(label))) &&
      terms.every(term => text.includes(term));
  }).sort((a, b) => sort === "rating" ? (b.rating ?? -1) - (a.rating ?? -1) || a.position - b.position : a.position - b.position);
}

export function readFavorites(storage, validIds) {
  try {
    const raw = storage.getItem(FAVORITES_KEY);
    if (raw === null) return { favorites: new Set(), error: null };
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) throw new Error("Invalid favorites data.");
    return { favorites: new Set(ids.filter(id => validIds.has(id))), error: null };
  } catch {
    return { favorites: new Set(), error: "Saved favorites couldn't be read. Favorites will work for this visit, but may not persist." };
  }
}

export function writeFavorites(storage, favorites) {
  try {
    storage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    return null;
  } catch {
    return "Favorites couldn't be saved in this browser. Your changes will only last for this visit.";
  }
}
