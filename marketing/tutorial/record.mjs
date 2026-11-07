// Films the "how to use Synergy Wizard" tutorial from the live site: search, hide words, uniques,
// save to My list, share a link, open a shared list. Captions (no voiceover) + click highlights.
// Usage: node marketing/tutorial/record.mjs --format landscape|vertical   (then build.mjs with the same format)
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FORMAT = process.argv.includes("vertical") ? "vertical" : "landscape";
// Host frame = final video size; the site runs in an iframe scaled up so it renders sharply.
const F =
  FORMAT === "vertical"
    ? { w: 1080, h: 1920, siteW: 540, siteH: 960, scale: 2, capTop: "72%", capFont: 28 }
    : { w: 1920, h: 1080, siteW: 1280, siteH: 720, scale: 1.5, capTop: "82%", capFont: 30 };

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(here, ".work", FORMAT);
const SITE = "https://poe2.90sgamer.com/";
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: F.w, height: F.h },
  recordVideo: { dir: path.join(work, "video"), size: { width: F.w, height: F.h } },
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: SITE.slice(0, -1) });
// No cookie bar, no analytics, an empty list to start from.
await context.addInitScript(() => {
  try {
    localStorage["sw.consent"] = "denied";
    if (!sessionStorage["sw.keepList"]) localStorage.removeItem("sw.saved");
    sessionStorage["sw.keepList"] = "1";
  } catch {}
});
await context.route(/google-analytics\.com|googletagmanager\.com/, (r) => r.abort());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const smartReady = (p) =>
  p.waitForFunction(() => /Smart search/.test(document.querySelector(".status-bar")?.textContent ?? ""), null, { timeout: 90000 });

// Warm-up so the search model is cached before filming.
const warm = await context.newPage();
await warm.goto(SITE);
await warm.fill("#q", "warm up");
await smartReady(warm);
await warm.close();

const pageCreated = Date.now();
const host = await context.newPage();
const video = host.video();
const HOST = `<body style="margin:0;background:#008080;overflow:hidden"><iframe id="f" allow="clipboard-read; clipboard-write" src="${SITE}" style="width:${F.siteW}px;height:${F.siteH}px;border:0;transform:scale(${F.scale});transform-origin:0 0"></iframe></body>`;
await context.route(SITE + "__host.html", (r) => r.fulfill({ contentType: "text/html", body: HOST }));
await host.goto(SITE + "__host.html");
let page;
for (let i = 0; i < 100 && !page; i++) {
  page = host.frames().find((f) => f !== host.mainFrame() && f.url().startsWith(SITE));
  if (!page) await sleep(100);
}
await page.waitForSelector("#q");
await page.waitForLoadState("networkidle").catch(() => {});
const bannerSrc = await page.evaluate(() => document.querySelector("h1 img").src);

// Overlays in the host page: caption box + click ring.
await host.evaluate(
  ({ capTop, capFont }) => {
    const c = document.createElement("div");
    c.id = "cap";
    c.style.cssText = `position:fixed;left:50%;top:${capTop};transform:translateX(-50%);max-width:90%;width:max-content;box-sizing:border-box;text-align:center;background:#000;border:6px solid #fff;box-shadow:12px 12px 0 #000;font:${capFont}px/1.5 'Press Start 2P',monospace;color:#ffe600;padding:22px 28px;pointer-events:none;z-index:20000;display:none`;
    document.body.appendChild(c);
    const r = document.createElement("div");
    r.id = "ring";
    r.style.cssText =
      "position:fixed;border:6px solid #ff2bd6;border-radius:10px;box-shadow:0 0 0 4px #000,0 0 24px #ff2bd6;pointer-events:none;z-index:19000;display:none;transition:all .25s";
    document.body.appendChild(r);
    const iframe = document.getElementById("f");
    for (const ff of iframe.contentDocument.fonts) if (ff.family.includes("Press Start")) document.fonts.add(ff);
  },
  { capTop: F.capTop, capFont: F.capFont },
);
await host.evaluate(() => document.fonts.load("28px 'Press Start 2P'")).catch(() => {});

const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;
const timings = { format: FORMAT, videoOffset: (t0 - pageCreated) / 1000, events: [] };
const log = (label) => {
  timings.events.push({ t: now(), label });
  console.log(now().toFixed(2), label);
};
const caption = (text) =>
  host.evaluate((t) => {
    const c = document.getElementById("cap");
    c.textContent = t;
    c.style.display = t ? "block" : "none";
  }, text);

// Smooth scroll of the site so element `sel` sits `offset` px from the top of the iframe.
const glideTo = async (y, ms = 900) =>
  page.evaluate(
    ([y, ms]) =>
      new Promise((res) => {
        const y0 = scrollY,
          s = performance.now();
        const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
        const step = (n) => {
          const p = Math.min(1, (n - s) / ms);
          scrollTo(0, y0 + (y - y0) * ease(p));
          p < 1 ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      }),
    [y, ms],
  );
const topOf = (locator) => locator.evaluate((el) => el.getBoundingClientRect().top + scrollY);
const showSearchArea = async (ms) => glideTo(Math.max(0, (await topOf(page.locator("#q"))) - 12), ms);

// Highlight an element (ring in host coordinates), then click it.
async function point(locator, click = true) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const b = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  await host.evaluate(
    ({ b, s }) => {
      const r = document.getElementById("ring");
      Object.assign(r.style, { left: `${b.x * s - 8}px`, top: `${b.y * s - 8}px`, width: `${b.w * s + 4}px`, height: `${b.h * s + 4}px`, display: "block" });
    },
    { b, s: F.scale },
  );
  await sleep(700);
  if (click) await locator.click();
  await sleep(500);
  await host.evaluate(() => (document.getElementById("ring").style.display = "none"));
}
const typeSlow = (text, ms) => host.keyboard.type(text, { delay: Math.max(25, ms / text.length) });
const card = (name) => page.locator("article", { has: page.locator("h3", { hasText: new RegExp(`^${name}$`) }) }).first();
const waitResults = async () => {
  await page.waitForSelector("article");
  await page.waitForFunction(() => /Smart search/.test(document.querySelector(".status-bar")?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
  await sleep(600);
};

// ---- the story ----
log("start");
await caption("How to use Synergy Wizard");
await sleep(3200);

await showSearchArea(1200);
await caption("Describe what your build needs, in plain words");
await page.click("#q");
await typeSlow("a skill that protects me for a few seconds", 2600);
await waitResults();
log("results");
await sleep(1800);
await caption("Results are ranked by how well they match");
await glideTo((await topOf(page.locator("article").first())) - 40, 1400);
await sleep(2200);

await showSearchArea(800);
await caption('Hide what doesn\'t fit: put a minus in front, like -"energy shield"');
await page.click("#q");
await host.keyboard.press("End");
await typeSlow(' -"energy shield"', 1500);
await waitResults();
log("minus");
await sleep(2600);

await caption("Tap the star to save anything to My list");
await point(card("Parry").locator(".save-star"));
log("saved Parry");
await sleep(1200);

await showSearchArea(700);
await caption("Uniques too: search items by what they do");
await page.fill("#q", "");
await page.click("#q");
await typeSlow("unique boots with movement speed", 2000);
await waitResults();
log("boots");
await sleep(1600);
await caption("Save the ones you like");
await point(card("Wanderlust").locator(".save-star"));
await point(card("Corpsewade").locator(".save-star"));
log("saved boots");
await sleep(600);

await showSearchArea(800);
await caption("Open My list. It stays saved in your browser");
await point(page.getByRole("tab", { name: /My list/ }));
log("my list");
await sleep(2400);

await caption("Copy a link to share your list with friends");
await point(page.getByRole("button", { name: /Copy share link/ }));
const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
log(`copied ${link}`);
await sleep(2400);

if (link.startsWith("http")) {
  await caption("Your friend opens the link and sees your list");
  await page.evaluate(() => localStorage.removeItem("sw.saved"));
  await page.goto(link);
  await page.waitForSelector("article");
  await page.evaluate(() => {
    const q = document.querySelector("#q");
    scrollTo(0, Math.max(0, q.getBoundingClientRect().top + scrollY - 12));
  });
  log("shared view");
  await sleep(2600);
  await caption("One click adds it to their own list");
  await point(page.getByRole("button", { name: /Add all to my list/ }));
  await sleep(2400);
}

log("end card");
await caption("");
await host.evaluate(
  ({ src, vertical }) => {
    const o = document.createElement("div");
    o.style.cssText = `position:fixed;inset:0;background:#008080;z-index:30000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${vertical ? 56 : 36}px;font-family:'Press Start 2P',monospace;text-align:center;`;
    o.innerHTML = `<img src="${src}" style="width:${vertical ? "100%" : "70%"};height:auto;display:block"><div style="color:#fff;font-size:${vertical ? 30 : 34}px;line-height:1.5">Search. Save. Share.<br>Free, updated every patch.</div><div style="color:#39ff14;font-size:${vertical ? 46 : 56}px;text-shadow:6px 6px 0 #000">poe2.90sgamer.com</div><div style="color:#fff;font-size:24px">a 90sGamer.com tool</div>`;
    document.body.appendChild(o);
  },
  { src: bannerSrc, vertical: FORMAT === "vertical" },
);
await sleep(4000);
timings.total = now();
log("end");

fs.writeFileSync(path.join(work, "timings.json"), JSON.stringify(timings, null, 2));
await context.close();
await video.saveAs(path.join(work, "raw.webm"));
await browser.close();
console.log("Saved", path.join(work, "raw.webm"));
