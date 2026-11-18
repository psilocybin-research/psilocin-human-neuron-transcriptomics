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
  await p.waitForTimeout(500);
  const png = await p
    .locator(".oxphos-network-3d")
    .evaluate((root) => root.capturePreview());
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    "/tmp/oxphos-network-preview.png",
    Buffer.from(png.split(",")[1], "base64"),
  );
} finally {
  await browser.close();
}
// Pillow is used only for this maintenance command, never in the browser/build.
const { execFileSync } = await import("node:child_process");
execFileSync(
  "python3",
  [
    "-c",
    `from PIL import Image, ImageChops
im=Image.open('/tmp/oxphos-network-preview.png').convert('RGB')
# Crop the actual label-free rendering to its visible geometry, without decorative padding.
diff=ImageChops.difference(im, Image.new('RGB', im.size, '#060d17')).convert('L')
box=diff.point(lambda p: 255 if p > 16 else 0).getbbox()
if not box: raise RuntimeError('Empty network preview')
im=im.crop(box)
im.thumbnail((1200,900),Image.Resampling.LANCZOS)
im.save('explorer/src/assets/oxphos-network-preview.webp','WEBP',quality=90,method=6)
`,
  ],
  { cwd: new URL("../../", import.meta.url) },
);
