---
title: Metabolic and redox transcription after brief psilocin exposure in human iPSC-derived cortical neurons
---

```js
import {createAtlas} from "./components/atlas.js";
const atlas = await FileAttachment("./data/atlas.json").json();
const provenance = await FileAttachment("./data/provenance.json").json();
const geneFile = FileAttachment("./data/genes.json");
const branding = {elife: await FileAttachment("./assets/elife-logo.svg").url(), zenodo: await FileAttachment("./assets/zenodo-icon.svg").url(), dryad: await FileAttachment("./assets/dryad-logo.png").url()};
display(createAtlas(atlas, provenance, () => geneFile.json(), branding));
```

<noscript>This atlas requires JavaScript. All numerical results are also available as downloadable tables in the public repository and archived release.</noscript>
