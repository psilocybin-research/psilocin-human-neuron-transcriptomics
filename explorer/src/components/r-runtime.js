// Each instance owns a worker. Callers may retain it explicitly between cells;
// close() terminates computation and releases service-worker progress listeners.
const base = new URL("./", document.baseURI);
export const rBase = new URL("webr/", base);
export async function createRRuntime({ onResource } = {}) {
  const receive = ({ data }) => {
    if (
      data?.type === "R_RESOURCE_PROGRESS" &&
      typeof data.path === "string" &&
      data.path.startsWith("webr/")
    )
      onResource?.(data);
  };
  if (onResource) navigator.serviceWorker?.addEventListener("message", receive);
  const detach = () =>
    navigator.serviceWorker?.removeEventListener("message", receive);
  onResource?.({ path: "webr/webr.js", state: "loading", source: "module" });
  let api;
  try {
    api = await import(new URL("webr.js", rBase).href);
  } catch (error) {
    detach();
    throw error;
  }
  onResource?.({ path: "webr/webr.js", state: "loaded", source: "module" });
  const { WebR, ChannelType } = api;
  const runtime = new WebR({
    baseUrl: rBase.href,
    channelType: ChannelType.PostMessage,
    interactive: false,
  });
  const close = runtime.close.bind(runtime);
  runtime.close = () => {
    detach();
    close();
  };
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
