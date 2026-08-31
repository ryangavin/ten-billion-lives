import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";
import { createServer as createViteServer } from "vite";

const outputDirectory = "docs/evidence/issue-31";
const screenshotPath = `${outputDirectory}/playback-browser.png`;
const transcriptPath = `${outputDirectory}/playback-browser.json`;

const html = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Issue #31 playback evidence</title>
    <style>
      :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; padding: 42px; color: #edf7f5; background: #071817; }
      main { max-width: 1160px; margin: auto; }
      h1 { margin: 0 0 8px; font: 700 32px/1.15 system-ui, sans-serif; letter-spacing: -0.02em; }
      .subtitle { margin: 0 0 28px; color: #9ac9c1; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      article { min-height: 212px; padding: 22px; border: 1px solid #28786c; border-radius: 12px; background: #0d2926; box-shadow: 0 12px 28px #0005; }
      h2 { margin: 0 0 14px; font: 650 19px/1.2 system-ui, sans-serif; }
      dl { display: grid; grid-template-columns: 160px 1fr; gap: 8px 16px; margin: 0; }
      dt { color: #8ebdb5; }
      dd { margin: 0; color: #fff; }
      .pass { color: #64f0b5; font-weight: 800; }
      footer { margin-top: 22px; color: #8ebdb5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Injected-clock playback · isolated browser evidence</h1>
      <p class="subtitle">Actual <code>apps/web/src/playback.ts</code> module · no ambient clock reads</p>
      <section class="grid" id="results"></section>
      <footer id="footer"></footer>
    </main>
    <script type="module">
      import {
        createPlaybackState,
        playbackAdvanceAt,
        reducePlayback,
      } from "/apps/web/src/playback.ts";

      const at = (tick, phasePermillion) => ({ tick: BigInt(tick), phasePermillion });
      const shown = (time) => ({ tick: time.tick.toString(), phasePermillion: time.phasePermillion });
      const same = (left, right) => JSON.stringify(shown(left)) === JSON.stringify(shown(right));
      const cases = [];

      const playing = reducePlayback(createPlaybackState(at(8, 900_000)), {
        type: "play", rate: 15, clockMicroseconds: 10_000,
      });
      const played = reducePlayback(playing, {
        type: "sample", clockMicroseconds: 2_010_000,
      });
      const directSeek = reducePlayback(createPlaybackState(at(0, 0)), {
        type: "seek", visualTime: at(9, 400_000), clockMicroseconds: 2_010_000,
      });
      const advance = playbackAdvanceAt(playing, 2_010_000);
      cases.push({
        name: "Playback equals direct seek",
        passed: same(played.visualTime, directSeek.visualTime) && advance.advanceTicks === 1n,
        facts: {
          "played time": shown(played.visualTime),
          "direct-seek time": shown(directSeek.visualTime),
          "explicit advance": advance.advanceTicks.toString() + " tick",
        },
      });

      const pauseStart = reducePlayback(createPlaybackState(at(1, 500_000)), {
        type: "play", rate: 5, clockMicroseconds: 1_000_000,
      });
      const paused = reducePlayback(pauseStart, {
        type: "pause", clockMicroseconds: 4_000_000,
      });
      const pausedLater = reducePlayback(paused, {
        type: "sample", clockMicroseconds: 40_000_000,
      });
      const resumed = reducePlayback(pausedLater, {
        type: "play", rate: 1, clockMicroseconds: 40_000_000,
      });
      const resumedLater = reducePlayback(resumed, {
        type: "sample", clockMicroseconds: 43_000_000,
      });
      cases.push({
        name: "Pause and explicit resume",
        passed: same(paused.visualTime, pausedLater.visualTime) && same(resumedLater.visualTime, at(1, 800_000)),
        facts: {
          "paused at": shown(paused.visualTime),
          "after 36 s paused": shown(pausedLater.visualTime),
          "resumed result": shown(resumedLater.visualTime),
        },
      });

      const hiddenStart = reducePlayback(createPlaybackState(at(2, 0)), {
        type: "play", rate: 60, clockMicroseconds: 0,
      });
      const hidden = reducePlayback(hiddenStart, {
        type: "hidden", clockMicroseconds: 500_000,
      });
      const hiddenLater = reducePlayback(hidden, {
        type: "sample", clockMicroseconds: 100_000_000,
      });
      const visible = reducePlayback(hiddenLater, {
        type: "visible", clockMicroseconds: 100_000_000,
      });
      const afterVisible = reducePlayback(visible, {
        type: "sample", clockMicroseconds: 100_250_000,
      });
      cases.push({
        name: "Hidden interval has no catch-up",
        passed: same(hidden.visualTime, hiddenLater.visualTime) && same(afterVisible.visualTime, at(2, 750_000)),
        facts: {
          "hidden at": shown(hidden.visualTime),
          "after 99.5 s hidden": shown(hiddenLater.visualTime),
          "250 ms after visible": shown(afterVisible.visualTime),
        },
      });

      const sought = reducePlayback(createPlaybackState(at(0, 0)), {
        type: "seek", visualTime: at(19, 250_000), clockMicroseconds: 1_000,
      });
      const rewound = reducePlayback(sought, {
        type: "rewind", visualTime: at(7, 0), clockMicroseconds: 2_000,
      });
      cases.push({
        name: "Explicit rewind target",
        passed: same(sought.visualTime, at(19, 250_000)) && same(rewound.visualTime, at(7, 0)),
        facts: {
          "before rewind": shown(sought.visualTime),
          "rewound checkpoint/time": shown(rewound.visualTime),
          "ambient clock reads": "none",
        },
      });

      const results = document.querySelector("#results");
      for (const item of cases) {
        const article = document.createElement("article");
        const facts = Object.entries(item.facts)
          .map(([label, value]) => "<dt>" + label + "</dt><dd>" + (typeof value === "string" ? value : "tick " + value.tick + " · phase " + value.phasePermillion) + "</dd>")
          .join("");
        article.innerHTML = "<h2>" + item.name + " · <span class=\"pass\">" + (item.passed ? "PASS" : "FAIL") + "</span></h2><dl>" + facts + "</dl>";
        results.append(article);
      }
      const passed = cases.every((item) => item.passed);
      document.querySelector("#footer").textContent = (passed ? "PASS" : "FAIL") + " · " + cases.length + " deterministic browser scenarios · injected integer microseconds only";
      globalThis.__playbackEvidence = {
        passed,
        module: "apps/web/src/playback.ts",
        cases: cases.map((item) => ({ ...item, facts: item.facts })),
      };
      document.body.dataset.ready = "true";
    </script>
  </body>
</html>`;

const vite = await createViteServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
const server = createHttpServer((request, response) => {
  if (request.url === "/issue-31-playback") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }
  vite.middlewares(request, response, () => {
    response.writeHead(404);
    response.end("not found");
  });
});

await new Promise((resolvePromise, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolvePromise);
});
const address = server.address();
if (address === null || typeof address === "string")
  throw new Error("playback evidence server did not bind a TCP port");
const origin = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const consoleMessages = [];
  const requestUrls = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  page.on("request", (request) => requestUrls.push(request.url()));
  await page.goto(`${origin}/issue-31-playback`);
  await page.locator('body[data-ready="true"]').waitFor();
  const evidence = await page.evaluate(() => globalThis.__playbackEvidence);
  if (evidence?.passed !== true)
    throw new Error("playback browser evidence scenarios failed");
  if (requestUrls.some((request) => !request.startsWith(origin)))
    throw new Error("playback browser evidence made an external request");
  await page.screenshot({ path: screenshotPath });
  const screenshotSha256 = createHash("sha256")
    .update(await readFile(screenshotPath))
    .digest("hex");
  const transcript = {
    schemaVersion: 1,
    evidenceVersion: "issue-31-playback-browser-v1",
    browser: `Chromium ${browser.version()}`,
    viewport: { width: 1280, height: 800 },
    screenshot: {
      path: screenshotPath,
      sha256: screenshotSha256,
    },
    requests: requestUrls.map((request) => new URL(request).pathname),
    consoleMessages,
    ...evidence,
  };
  await writeFile(transcriptPath, `${JSON.stringify(transcript, null, 2)}\n`);
  console.log(JSON.stringify(transcript, null, 2));
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolvePromise, reject) =>
    server.close((error) =>
      error === undefined ? resolvePromise() : reject(error),
    ),
  );
}
