// Records the footage for the narrated YouTube Short. Usage: npm run short:record
// Actions and subtitles are driven at absolute cue times (narration.mjs) measured from filming start.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cues, named } from "./narration.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(here, ".work");
const SITE = "https://poe2.90sgamer.com/";
const FEEDBACK = "https://90sgamer.com/games/synergy-wizard/#feedback";
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
const vidDir = path.join(work, "video");

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  recordVideo: { dir: vidDir, size: { width: 1080, height: 1920 } },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
});
// No cookie bar in any origin, no Google Analytics.
await context.addInitScript(() => {
  try {
    localStorage["sw.consent"] = "denied";
    localStorage["90s.consent"] = "denied";
  } catch {}
});
await context.route(/google-analytics\.com|googletagmanager\.com/, (r) => r.abort());
// Hide the consent bar / Floppy helper / popups on the 90sGamer page even if they would still appear.
await context.route(/^https:\/\/90sgamer\.com\/games\/synergy-wizard/, async (r) => {
  try {
    const resp = await r.fetch();
    const ct = resp.headers()["content-type"] ?? "";
    if (!ct.includes("text/html")) return r.fulfill({ response: resp });
    const css = "<style>#consent,#floppy,#netscape-alert,#joke-alert{display:none!important}</style>";
    let body = await resp.text();
    body = body.includes("</head>") ? body.replace("</head>", css + "</head>") : css + body;
    const headers = { ...resp.headers() };
    delete headers["content-length"];
    delete headers["content-encoding"];
    await r.fulfill({ response: resp, body, headers });
  } catch {
    await r.continue().catch(() => {});
  }
});

const smartReady = (p) =>
  p.waitForFunction(
    () => {
      const t = document.querySelector(".status-bar")?.textContent ?? "";
      return t.includes("Smart search") && !t.includes("Loading");
    },
    null,
    { timeout: 90000 },
  );

// Warm-up so the AI model is cached before filming.
const warm = await context.newPage();
await warm.goto(SITE);
await warm.waitForSelector("#q");
await warm.fill("#q", "warm up query");
await smartReady(warm);
await warm.close();

const pageCreated = Date.now();
const host = await context.newPage();
const pageVideo = host.video();
// The host page is 1080x1920 and shows the site in a 540x960 iframe scaled 2x: the site sees a 540-wide mobile viewport
// but is rasterised sharply at 1080x1920. Same-origin host page (a fake path on the site) so the iframe gets normal localStorage.
// Subtitles and the end card live in the host page so they survive the iframe navigating to 90sgamer.com.
const HOST_HTML = `<body style="margin:0;background:#000;overflow:hidden"><iframe id="f" src="${SITE}" style="width:540px;height:960px;border:0;transform:scale(2);transform-origin:0 0"></iframe></body>`;
await context.route(SITE + "__host.html", (r) => r.fulfill({ contentType: "text/html", body: HOST_HTML }));
await host.goto(SITE + "__host.html");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
for (let i = 0; i < 100 && !page; i++) {
  page = host.frames().find((f) => f !== host.mainFrame() && f.url().startsWith(SITE));
  if (!page) await sleep(100);
}
await page.waitForSelector("#q");
await page.waitForLoadState("networkidle").catch(() => {});
const bannerSrc = await page.evaluate(() => document.querySelector("h1 img").src);
await host.mouse.move(540, 960);
await sleep(500);
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;
const timings = { videoOffset: (t0 - pageCreated) / 1000, events: [] };
const log = (label) => {
  timings.events.push({ t: now(), label });
  console.log(now().toFixed(2), label);
};
const until = async (t) => {
  const d = t * 1000 - now() * 1000;
  if (d > 0) await sleep(d);
};

// Subtitle overlay in the lower part of the frame (host page, 1080 coordinates).
await host.evaluate(() => {
  const d = document.createElement("div");
  d.id = "sw-cap";
  d.style.cssText =
    "position:fixed;left:50%;top:70%;transform:translateX(-50%);max-width:92%;width:max-content;box-sizing:border-box;text-align:center;background:#000;border:6px solid #fff;box-shadow:12px 12px 0 #000;font:28px/1.5 'Press Start 2P',monospace;color:#ffe600;padding:24px 28px;pointer-events:none;z-index:20000;display:none";
  document.body.appendChild(d);
});
// Share the site's pixel webfont with the host page.
await host
  .evaluate(async () => {
    const iframe = document.getElementById("f");
    for (const ff of iframe.contentDocument.fonts) if (ff.family.includes("Press Start")) document.fonts.add(ff);
    await document.fonts.load("28px 'Press Start 2P'").catch(() => {});
  })
  .catch(() => {});

async function runSubtitles() {
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    await until(c.start);
    await host.evaluate((t) => {
      const d = document.getElementById("sw-cap");
      d.textContent = t;
      d.style.display = "block";
    }, c.text);
    const next = cues[i + 1];
    if (!next || next.start - c.end > 0.05) {
      await until(c.end);
      await host.evaluate(() => {
        document.getElementById("sw-cap").style.display = "none";
      });
    }
  }
}
const subtitles = runSubtitles();

// Smooth eased scroll of the iframe's window to y over ms.
const glide = (frame, y, ms) =>
  frame.evaluate(
    ([y, ms]) =>
      new Promise((res) => {
        const y0 = window.scrollY,
          t0 = performance.now();
        const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
        const step = (n) => {
          const p = Math.min(1, (n - t0) / ms);
          window.scrollTo(0, y0 + (y - y0) * ease(p));
          p < 1 ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      }),
    [y, ms],
  );
const typeTo = async (text, endAt) => {
  const per = Math.max(30, ((endAt - now() - 0.2) * 1000) / text.length);
  await host.keyboard.type(text, { delay: per });
};

await page.evaluate(() => window.scrollTo(0, 0));
log("start");

// v1: banner + search box, then a gentle scroll down the default list during "looking through the usual sites".
await until(5.4);
log("scroll list");
await glide(page, 900, 2600);
await until(9.0);
await glide(page, 0, 1000);

// v1 ~9-26: browse with filters (they sit below the list on mobile), without searching.
await until(9.4);
const filtersBtn = page.locator("button", { hasText: /^Filters/ }).first();
const btnY = await filtersBtn.evaluate((el) => el.getBoundingClientRect().top + scrollY - 260);
log("glide down to filters");
await glide(page, btnY, 3200);
await until(12.8);
await filtersBtn.click().catch(() => log("no filters button"));
log("filters open");
await until(13.8);
await page.locator("label", { hasText: "Defensive" }).first().click().catch(() => log("no Defensive label"));
log("tick Defensive");
await until(15.6);
await page.locator("label", { hasText: "Defensive" }).first().click().catch(() => {});
log("untick Defensive");
await until(16.6);
await page.locator("label", { hasText: "Recovery" }).first().click().catch(() => {});
log("tick Recovery");
await until(18.2);
await page.locator("label", { hasText: "Recovery" }).first().click().catch(() => {});
await until(19.0);
await filtersBtn.click().catch(() => {}); // collapse
log("filters closed");
await until(19.4);
await glide(page, 0, 6000);
await until(26.0);
log("hold banner");

// "You search for a skill by what it does": focus the search box.
await until(31.6);
await page.click("#q");
log("focus search");

// typeQuery -> showResults: type the quoted phrase, finishing as it ends.
await until(named.typeQuery);
log("typeQuery");
await typeTo("what skill will protect me for a few seconds", named.showResults);
await until(named.showResults);
log("showResults");
await page.waitForSelector("article", { timeout: 20000 }).catch(() => {});

// showResults -> ranked: browse ~5 cards (skill, support, ...), then make sure a passive is seen.
const kinds = () =>
  page.evaluate(() => [...document.querySelectorAll("article")].slice(0, 8).map((a) => a.innerText.split("\n")[0].trim().toUpperCase()));
const k = await kinds();
console.log("badges:", k.join(","));
const hasPassive = k.some((x) => /PASSIVE|NOTABLE|KEYSTONE/.test(x));
await glide(page, 1250, 3600);
if (!hasPassive) {
  await until(named.showResults + 4.2);
  log("switch to minions query");
  await glide(page, 0, 350);
  await page.fill("#q", "");
  await page.click("#q");
  await host.keyboard.type("make my minions tankier", { delay: 30 });
  await sleep(900);
  await glide(page, 700, Math.max(800, (named.ranked - now() - 0.9) * 1000));
}
await until(named.ranked);
log("ranked");
await glide(page, 0, 900);

// beta: header with the patch badge.
await until(named.beta);
await glide(page, 0, 300);
log("beta (top, patch badge)");

// feedback: 90sGamer feedback form.
await until(named.feedback);
log("feedback navigate");
await page.goto(FEEDBACK, { waitUntil: "load" }).catch((e) => console.log("goto failed", e.message));
await page
  .evaluate(() => {
    for (const id of ["consent", "floppy"]) document.getElementById(id)?.remove();
  })
  .catch(() => {});
await sleep(300);
await page
  .evaluate(() => {
    const el = document.getElementById("feedback");
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70);
  })
  .catch(() => {});
log("feedback visible");

// checkItOut / url: end card (in the host page, under the subtitles).
await until(named.checkItOut);
log("end card");
await host.evaluate((src) => {
  const o = document.createElement("div");
  o.style.cssText =
    "position:fixed;inset:0;background:#008080;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;font-family:'Press Start 2P',monospace;text-align:center;";
  o.innerHTML = `<img src="${src}" style="width:100%;height:auto;display:block"><div style="color:#fff;font-size:34px;line-height:1.5">Free. Updated every patch.</div><div style="color:#39ff14;font-size:48px;text-shadow:6px 6px 0 #000">poe2.90sgamer.com</div><div style="color:#fff;font-size:24px">a 90sGamer.com tool</div>`;
  document.body.insertBefore(o, document.getElementById("sw-cap"));
}, bannerSrc);
await subtitles;
await until(named.end);
timings.total = now() * 1000;
log("end");

fs.writeFileSync(path.join(work, "timings.json"), JSON.stringify(timings, null, 2));
await context.close();
await pageVideo.saveAs(path.join(work, "raw.webm"));
await browser.close();
console.log("Saved", path.join(work, "raw.webm"));
