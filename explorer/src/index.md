---
title: Metabolic and redox transcription after brief psilocin exposure in human iPSC-derived cortical neurons
---

```js
import {createAtlas} from "./components/atlas.js";
const initialDark = (() => {const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;try {const saved=localStorage.getItem("atlas-appearance");return saved?saved==="dark":systemDark;} catch {return systemDark;}})();
document.documentElement.classList.toggle("dark", initialDark);
const uiStyles = await FileAttachment("./assets/vendor/framework7.css").url();
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = uiStyles;
const styleReady = new Promise((resolve, reject) => { stylesheet.onload = resolve; stylesheet.onerror = reject; });
document.head.prepend(stylesheet);
await styleReady;
const {default: Framework7} = await import(await FileAttachment("./assets/vendor/framework7.js").url());
const uiNotices = await FileAttachment("./assets/vendor/framework7.NOTICES.txt").url();
const plotNotices = await FileAttachment("./assets/vendor/observable-plot.NOTICES.txt").url();
const atlas = await FileAttachment("./data/atlas.json").json();
const provenance = await FileAttachment("./data/provenance.json").json();
const geneFile = FileAttachment("./data/genes.json");
const branding = {Framework7, uiNotices, plotNotices, elife: await FileAttachment("./assets/elife-logo.svg").url(), zenodo: await FileAttachment("./assets/zenodo-icon.svg").url(), dryad: await FileAttachment("./assets/dryad-logo.png").url()};
const application = createAtlas(atlas, provenance, () => geneFile.json(), branding);
display(application);
invalidation.then(() => { application.destroy(); stylesheet.remove(); });
```

<noscript>This atlas requires JavaScript. All numerical results are also available as downloadable tables in the public repository and archived release.</noscript>
