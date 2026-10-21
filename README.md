# Synergy Wizard

Search every Path of Exile 2 skill gem, support and passive by what it does
("protect me for a few seconds"). Live at https://synergywizard.netlify.app.

Everything runs in the browser from two static files, so hosting costs nothing
beyond Netlify and there is no database, server function or paid AI.

## How it works

| Piece | Where |
|---|---|
| Game data | [RePoE PoE2 export](https://repoe-fork.github.io/poe2/), community JSON regenerated after each patch |
| Build | `datagen/`: fetches RePoE, translates passive stats, tags effects (Defensive, Timed effect, …) by rule, embeds each entry with `Xenova/all-MiniLM-L6-v2` |
| Output | `public/data/poe2.json` (entries) + `public/data/poe2.vec` (int8 vectors, 384 per entry) |
| Search | `src/search/search.ts`: keyword hits + plain-English intent + vector similarity, computed in the browser |
| Updates | `.github/workflows/pipeline.yml` runs daily, rebuilds when the RePoE version changes, commits to `master`, Netlify deploys |

## Commands

```bash
npm install
npm run dev          # site at http://localhost:5173
npm test             # unit tests
npm run data         # rebuild public/data if RePoE has a new version (Node 24+)
npm run data:force   # rebuild regardless
npm run eval         # print top results for sample player questions
npm run eval -- "your question"
```

Effect categories and the words that map to them live in `src/data/effects.ts`.
After changing them, run `npm run data:force` and `npm run eval` to check rankings.
