// Records the footage for the YouTube Short. Usage: npm run short:record
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(here, ".work");
const SITE = "https://poe2.90sgamer.com/";
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
const vidDir = path.join(work, "video");

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  recordVideo: { dir: vidDir, size: { width: 1080, height: 1920 } },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
});
// No cookie bar, no Google Analytics.
await context.addInitScript(() => {
  try { localStorage["sw.consent"] = "denied"; } catch {}
});
await context.route(/google-analytics\.com|googletagmanager\.com/, (r) => r.abort());

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
// Playwright records frames at CSS-pixel size. So the host page is 1080x1920 and shows the site in a 540x960 iframe
// scaled 2x: the site sees a 540-wide mobile viewport (mobile layout) but is rasterised sharply at 1080x1920.
// Same-origin host page (a fake path on the site) so the iframe gets normal, unpartitioned localStorage (consent=denied).
const HOST_HTML = `<body style="margin:0;background:#000;overflow:hidden"><iframe src="${SITE}" style="width:540px;height:960px;border:0;transform:scale(2);transform-origin:0 0"></iframe></body>`;
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
await host.mouse.move(540, 960);
await sleep(500);
const t0 = Date.now();
const now = () => Date.now() - t0;
const timings = { videoOffset: (t0 - pageCreated) / 1000, events: [] };
const log = (type, label) => {
  timings.events.push({ t: now(), type, label });
  console.log(now(), type, label);
};

await page.evaluate(() => {
  const d = document.createElement("div");
  d.id = "sw-cap";
  d.style.cssText =
    "position:fixed;left:50%;top:24%;transform:translateX(-50%);max-width:92%;width:max-content;box-sizing:border-box;text-align:center;background:#000;border:3px solid #fff;box-shadow:6px 6px 0 #000;font:20px/1.5 'Press Start 2P',monospace;color:#ffe600;padding:14px 16px;pointer-events:none;z-index:9999;display:none";
  document.body.appendChild(d);
});
async function caption(text, rainbow = false) {
  await page.evaluate(
    ([t, rb]) => {
      const d = document.getElementById("sw-cap");
      d.textContent = t;
      d.style.display = "block";
      if (rb) {
        d.style.color = "transparent";
        d.style.background = "linear-gradient(90deg,#ff3b3b,#ffe600,#39ff14,#00e5ff,#c13bff) text, #000";
        d.style.webkitBackgroundClip = "text";
        d.style.backgroundClip = "padding-box";
        d.innerHTML = `<span style="background:linear-gradient(90deg,#ff3b3b,#ffe600,#39ff14,#00e5ff,#c13bff);-webkit-background-clip:text;background-clip:text;color:transparent">${t}</span>`;
        d.style.background = "#000";
      } else {
        d.style.background = "#000";
        d.style.color = "#ffe600";
      }
    },
    [text, rainbow],
  );
  log("caption", text);
}

await page.evaluate(() => window.scrollTo(0, 0));
log("scene1", "start");
await caption("Need a PoE2 skill that does X?", true);
await sleep(3000);

// Scene 2
await page.click("#q");
await caption("Just ask in plain words.");
log("action", "typing q1");
await host.keyboard.type("a skill that protects me for a few seconds", { delay: 60 });
await sleep(500);

// Scene 3
log("scene3", "results");
await page.waitForSelector("article", { timeout: 20000 }).catch(() => {});
await sleep(800);
await caption("It finds skills by what they DO.");
await sleep(1200);
for (let i = 0; i < 4; i++) {
  await host.mouse.wheel(0, 240);
  log("action", "scroll " + i);
  await sleep(800);
}
await page.evaluate(() => window.scrollTo({ top: 0 }));
await sleep(500);

// Scene 4
await caption("Every gem, support & passive.");
const more = page.getByText(/Show \d+ more line/i).first();
if (await more.count()) {
  await more.scrollIntoViewIfNeeded();
  await sleep(600);
  await more.click();
  log("action", "show more lines");
} else log("action", "no show-more link found");
await sleep(2600);

// Scene 5
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await page.fill("#q", "");
await page.click("#q");
await caption("Passives too. Updated every patch.");
log("action", "typing q2");
await host.keyboard.type("make my minions tankier", { delay: 60 });
log("scene5", "results");
await sleep(1500);
await host.mouse.wheel(0, 300);
await sleep(1500);
await host.mouse.wheel(0, 300);
await sleep(1200);

// Scene 6: end card
log("scene6", "end card");
await page.evaluate(() => {
  document.getElementById("sw-cap").style.display = "none";
  const src = document.querySelector("h1 img").src;
  const o = document.createElement("div");
  o.style.cssText =
    "position:fixed;inset:0;background:#008080;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;font-family:'Press Start 2P',monospace;text-align:center;";
  o.innerHTML = `<img src="${src}" style="width:100%;height:auto;display:block"><div style="color:#fff;font-size:20px;line-height:1.5">Free. No ads.</div><div style="color:#39ff14;font-size:24px;text-shadow:3px 3px 0 #000">poe2.90sgamer.com</div><div style="color:#fff;font-size:12px">a 90sGamer.com tool</div>`;
  document.body.appendChild(o);
});
await sleep(4200);
timings.total = now();
log("end", "done");

fs.writeFileSync(path.join(work, "timings.json"), JSON.stringify(timings, null, 2));
await context.close();
await pageVideo.saveAs(path.join(work, "raw.webm"));
await browser.close();
console.log("Saved", path.join(work, "raw.webm"));
