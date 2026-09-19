---
title: Psilocin transcriptomic atlas
---

```js
import {createAtlas} from "./components/atlas.js";
const atlas = await FileAttachment("./data/atlas.json").json();
const provenance = await FileAttachment("./data/provenance.json").json();
const geneFile = FileAttachment("./data/genes.json");
display(createAtlas(atlas, provenance, () => geneFile.json()));
```

<noscript>This explorer requires JavaScript. All numerical results are also available in the manuscript's Supplementary Data workbook and reproducibility archive.</noscript>
