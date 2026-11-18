import { fileURLToPath } from "node:url";
// Maintenance command: render the shared scientific-app mark with the local browser.
import { chromium } from "@playwright/test";
import { brandIcon } from "../src/components/app-brand.js";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
});
try {
  const page = await browser.newPage();
  for (const [name, size, maskable] of [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["apple-touch-icon.png", 180, false],
    ["maskable-512.png", 512, true],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;background:transparent}body>svg{display:block;width:100%;height:100%}</style>${brandIcon(maskable)}`,
    );
    await page.screenshot({
      path: fileURLToPath(
        new URL(`../src/assets/app/${name}`, import.meta.url),
      ),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
execFileSync(
  "python3",
  [
    "-c",
    "from PIL import Image; im=Image.open('explorer/src/assets/app/icon-512.png'); im.save('explorer/src/assets/app/favicon.ico',sizes=[(16,16),(32,32),(48,48),(64,64)])",
  ],
  { cwd: new URL("../../", import.meta.url) },
);
