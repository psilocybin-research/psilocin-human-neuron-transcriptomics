# Psilocin human-neuron transcriptomic atlas

Static Observable Framework companion for the archived analysis. It displays frozen gene, pathway and sensitivity results and does not fit models or calculate new inferential statistics in the browser.

```bash
npm ci
npm test
npm run build
python3 -m http.server 4173 --directory dist
```

All runtime assets and scientific display data are local. The built site performs no third-party network requests during normal use. A frozen build is also retained in the repository-level `site/` directory.
