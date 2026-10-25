// Builds and uploads the site to Cloudflare Pages (project "synergywizard").
// The bundle loads data from jsDelivr at this exact commit, so the commit must already be on GitHub.
import { execSync } from "node:child_process";

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const out = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

const sha = out("git rev-parse HEAD");
if (out("git status --porcelain -- public src index.html vite.config.ts package.json")) {
  console.error("Uncommitted site changes. Commit them first: the deployed build must match a pushed commit.");
  process.exit(1);
}
out("git fetch origin master --quiet");
if (out(`git branch -r --contains ${sha}`).indexOf("origin/master") === -1) {
  console.error(`Commit ${sha.slice(0, 7)} isn't on origin/master yet. Push first (data files are served from GitHub via jsDelivr).`);
  process.exit(1);
}

sh("npm test");
sh("npx tsc --noEmit");
sh("npx vite build", { env: { ...process.env, CF_PAGES_COMMIT_SHA: sha } });
const message = out("git log -1 --format=%s").replace(/"/g, "'");
sh(`npx wrangler pages deploy dist --project-name synergywizard --branch master --commit-hash ${sha} --commit-message "${message}" --commit-dirty=true`);
