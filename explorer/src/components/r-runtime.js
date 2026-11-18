// A fresh worker per run isolates R state and makes Stop terminate computation.
const base = new URL("./", document.baseURI);
export const rBase = new URL("webr/", base);
export async function createRRuntime() {
  const { WebR, ChannelType } = await import(new URL("webr.js", rBase).href);
  const runtime = new WebR({
    baseUrl: rBase.href,
    channelType: ChannelType.PostMessage,
    interactive: false,
  });
  return runtime;
}
export async function verifyRRuntime(values = [1, 4, 9]) {
  const runtime = await createRRuntime();
  const timer = setTimeout(() => runtime.close(), 90000);
  try {
    await runtime.init();
    await runtime.FS.writeFile(
      "/home/web_user/readiness.csv",
      new TextEncoder().encode("value\n" + values.join("\n")),
    );
    const shelter = await new runtime.Shelter();
    try {
      const captured = await shelter.captureR(
        `x <- read.csv("/home/web_user/readiness.csv"); stopifnot(nrow(x) == 3, abs(sum(x$value) - ${values.reduce((a, b) => a + b, 0)}) < 1e-10); plot(x$value); cat("R and archived data ready\\n")`,
        {
          captureGraphics: { width: 480, height: 320 },
        },
      );
      const ok =
        captured.images.length > 0 &&
        !captured.output.some((x) => x.type === "error");
      for (const image of captured.images) image.close();
      if (!ok)
        throw Error("The R computation or graphics readiness check failed.");
      return true;
    } finally {
      await shelter.purge();
    }
  } finally {
    clearTimeout(timer);
    runtime.close();
  }
}
