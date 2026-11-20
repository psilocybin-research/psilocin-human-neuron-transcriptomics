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
const [,{default: Framework7}, atlas, provenance] = await Promise.all([
  styleReady,
  FileAttachment("./assets/vendor/framework7.js").url().then((url) => import(url)),
  FileAttachment("./data/atlas.json").json(),
  FileAttachment("./data/provenance.json").json()
]);
const uiNotices = await FileAttachment("./assets/vendor/framework7.NOTICES.txt").url();
const plotNotices = await FileAttachment("./assets/vendor/observable-plot.NOTICES.txt").url();
const editorNotices = await FileAttachment("./assets/vendor/r-editor.NOTICES.txt").url();
const fuseNotices = await FileAttachment("./assets/vendor/fuse.NOTICES.txt").url();
const geneFile = FileAttachment("./data/genes.json");
const branding = {bayesian: await FileAttachment("./data/bayesian.json").json(), Framework7, uiNotices, plotNotices, editorNotices, fuseNotices, elife: await FileAttachment("./assets/elife-logo.svg").url(), zenodo: await FileAttachment("./assets/zenodo-icon.svg").url(), dryad: await FileAttachment("./assets/dryad-logo.png").url(), rLogo: await FileAttachment("./assets/r-logo.svg").url(), pythonLogo: await FileAttachment("./assets/python-logo.svg").url()};
const application = createAtlas(atlas, provenance, () => geneFile.json(), branding);
display(application);
invalidation.then(() => { application.destroy(); stylesheet.remove(); });
```

<noscript>This atlas requires JavaScript. All numerical results are also available as downloadable tables in the public repository and archived release.</noscript>
