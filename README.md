# Possible Minds

A static reading room for the latest 50 uploads from [Michael Levin's academic channel](https://www.youtube.com/@drmichaellevin/videos), captured as a dated snapshot.

**[Open the library](https://alejandroechev.github.io/Michael-levin-videos2/)**

The collection has 50 video links: **32 have transcript-based summaries, subjective interest ratings out of 10 with reasoning, and topic labels; 18 await transcripts because YouTube blocked caption requests.** Pending entries explicitly have no summary, rating, or labels. Publishing these placeholders was approved rather than inventing content.

Save favorites locally in your browser and combine favorites, topic, minimum-rating, and text filters. Selected topics use **OR**; different filter types use **AND**. Pending entries can be favorited and searched by title, but do not match topic or minimum-rating filters. Sort by channel order or rating; unrated entries sort last.

Favorites do not require an account and do not sync between browsers. Clearing this site's browser storage removes them. If storage is unavailable, the site reports it and keeps favorites for the current visit.

## Content

`data/videos.json` holds the public catalog in the channel's newest-first order. Full captions are not included. Summaries derive from the complete available transcripts, not video titles or truncated console previews. Automated captions may contain errors, and four supplied transcripts end mid-sentence or mid-thought; their entries disclose that limitation. Speakers' proposals and preliminary results are not scientific consensus or medical advice.

Ratings are AI editorial opinions about topic interest, not accuracy or production quality. They favor surprising questions, connections across disciplines, and explanatory depth: 9–10 exceptional, 7–8 strong, 5–6 narrower appeal, 1–4 limited interest. Each entry explains its score.

This is a snapshot, not an automatic feed. To update it, retrieve the latest 50 channel uploads, read each full transcript, author its summary/rating/labels, and replace the catalog with an updated `fetchedAt`. Do not substitute title-based guesses when captions cannot be retrieved. The build validates the count, IDs, channel order, ratings, labels, and transcript provenance.

`scripts/import-catalog.mjs` imports private `/watch` results and editorial batches without copying transcripts into the repository. It expects `channel.json`, `fetch-results.json`, `transcripts/<id>.transcript.json`, and `summaries-<start>-<end>.json` arrays containing `id`, `summary`, `rating`, `ratingReason`, `labels`, and `transcriptReadComplete: true`. An optional `source-notes.json` maps IDs to caption limitations. It rejects missing transcripts by default; `--allow-pending` explicitly permits blank pending entries.

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev
```

The local server opens at `http://127.0.0.1:4173/Michael-levin-videos2/`. It serves `dist/`; rebuild after editing source. Browser tests exercise both desktop and mobile layouts at the same project subpath used by GitHub Pages.

## Deployment

GitHub Actions validates, builds, and deploys `dist/` on pushes to `master`. The repository's Pages source must be **GitHub Actions**. Only static HTML, CSS, JavaScript, catalog data, and the favicon are published.

No runtime API key, backend, tracking script, or YouTube embed is used. Thumbnail images load from YouTube and optional fonts load from Google Fonts; both providers receive ordinary asset requests. System fonts are used if web fonts cannot load.

This independent index is not affiliated with Michael Levin or the speakers.
