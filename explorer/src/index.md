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

<noscript>This atlas requires JavaScript. All numerical results are also available as downloadable tables in the public repository and archived release.</noscript>
