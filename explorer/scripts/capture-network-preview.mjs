// Regenerate after building and serving explorer/dist. This is the actual archived network, not an illustration.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(
    (process.env.ATLAS_URL || "http://127.0.0.1:4173/") + "#view=overview",
  );
  await p
    .getByRole("button", {
      name: "Explore 3D gene–pathway membership",
      exact: true,
    })
    .click();
  await p.waitForFunction(
    () =>
      document.querySelector(".oxphos-network-3d")?.dataset.rendererReady ===
      "true",
  );
  const clear = p.getByRole("button", { name: "Clear selection", exact: true });
  if (await clear.isVisible()) await clear.click();
  await p.getByRole("button", { name: "Reset camera", exact: true }).click();
  await p
    .locator(".oxphos-3d-stage canvas")
    .screenshot({ path: "/tmp/oxphos-network-preview.png" });
} finally {
  await browser.close();
}
// Pillow is used only for this maintenance command, never in the browser/build.
const { execFileSync } = await import("node:child_process");
execFileSync(
  "python3",
  [
    "-c",
    `from PIL import Image, ImageChops, ImageOps
im=Image.open('/tmp/oxphos-network-preview.png').convert('RGB')
d=ImageChops.difference(im,Image.new('RGB',im.size,'white')).convert('L').point(lambda v:255 if v>40 else 0)
b=d.getbbox(); p=35
box=(max(0,b[0]-p),max(0,b[1]-p),min(im.width,b[2]+p),min(im.height,b[3]+p))
ImageOps.pad(im.crop(box),(960,600),color='white').save('explorer/src/assets/oxphos-network-preview.webp','WEBP',quality=88,method=6)
`,
  ],
  { cwd: new URL("../../", import.meta.url) },
);
