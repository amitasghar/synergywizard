# Synergy Wizard

Search every Path of Exile 2 skill gem, support and passive by what it does
("protect me for a few seconds"). Live at https://poe2.90sgamer.com (also https://90sgamer.com/poe2).

Everything runs in the browser from two static files, so hosting costs nothing
beyond Netlify and there is no database, server function or paid AI.

## How it works

| Piece | Where |
|---|---|
| Game data | [RePoE PoE2 export](https://repoe-fork.github.io/poe2/), community JSON regenerated after each patch |
| Build | `datagen/`: fetches RePoE, translates passive stats, tags effects (Defensive, Timed effect, …) by rule, embeds each entry with `Xenova/all-MiniLM-L6-v2` |
| Output | `public/data/poe2.json` (entries) + `public/data/poe2.vec` (int8 vectors, 384 per entry) |
| Search | `src/search/search.ts`: keyword hits + plain-English intent + vector similarity, computed in the browser |
| Updates | `.github/workflows/pipeline.yml` runs every 3 hours, rebuilds when the RePoE version changes, commits to `master`, Netlify deploys |

## Ads

Ads are off unless these build-time env vars are set: `VITE_ADSENSE_CLIENT` (e.g. `ca-pub-1234567890123456`), `VITE_ADSENSE_SLOT_INLINE` and `VITE_ADSENSE_SLOT_BOTTOM` (numeric slot ids). Set them in Netlify, Site configuration, Environment variables, then redeploy. AdSense loads only after the visitor accepts cookies. `ads.txt` lives on the root domain 90sgamer.com (owned by the 90sGamer site), not in this repo.

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

## After a big patch (about 15 minutes)

1. Check the site header shows the new patch number (the job runs every 3 hours once RePoE updates).
2. If the job failed with "Refusing to publish suspicious data", read the listed problems. A real format change needs a fix in `datagen/build.ts`; an expected shrink (content removed) can be published with `npm run data -- --allow-shrink` and a commit.
3. Run `npm run eval` and skim the top results for the sample questions.
4. Search the new skills for mechanics our tags don't know yet (new defences, keywords) and add their words to `src/data/effects.ts`, then `npm run data:force` and commit `public/data`.
