# Contributing

Questions, reproducibility reports and corrections are welcome. Choose an
[issue form](https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/issues/new/choose)
and identify the release or commit and the affected file, result or atlas view.
Include reproduction commands, software versions and relevant errors. Scientific
questions should identify the specific table, method or claim. Keep participant
information, credentials and private correspondence out of public issues.

Fork the repository, create a branch and open a pull request explaining the
change and its verification. Follow [LICENSE.md](LICENSE.md), retain upstream
notices and preserve frozen specifications and historical releases. Maintainers
prepare refreshed integrity and licence inventories before merging public changes.

## Development and verification

The atlas uses Observable Framework and Framework7. Its analysis workflow is
R/Python analysis → archived result tables → Python display-data export → atlas
build. Browser R and Python sessions are separate, explicitly initiated research
workspaces. Interface development does not require translating components into R.

## Source ownership

| Material | Maintained source | Generated output |
| --- | --- | --- |
| Scientific analyses | `src/transcriptomics/` and frozen specifications in `config/` | Approved tables and figures |
| Display data | Archived tables and explicit export scripts | `explorer/src/data/` |
| Website interface | `explorer/src/components/`, styles and entry documents | `explorer/dist/` |
| Runtime preparation | `explorer/scripts/` and locked dependencies | Prepared vendor assets and offline inventories |
| Public documentation, licences and workflows | Their versioned repository files | Reviewed release package |

The complete research project also maintains a synchronized website working
copy and private release tooling. Website improvements may be developed through
either environment and exchanged through Git. Reconcile at development
milestones, and always before a local package export or publication. Inspect
remote revisions and local modifications first; preserve overlapping work and
resolve it deliberately. Private release tooling checks live GitHub revisions,
matching website sources and publication integrity before exporting. Public
documentation and workflow definitions are copied from their versioned files.

## Local checks

From the repository root:

```sh
npm --prefix explorer ci
npm --prefix explorer test
npm --prefix explorer run build
python3 -m http.server 4173 --bind 127.0.0.1 --directory explorer/dist
```

Run relevant existing browser checks against that server, for example:

```sh
node explorer/test/source-browser-check.mjs
node explorer/test/workspace-layout-browser-check.mjs
```

Or let the shared runner start an isolated server and collect diagnostics:

```sh
npm --prefix explorer run check:ui -- source
npm --prefix explorer run check:ui -- research-a
```

The same registry supplies the release browser jobs. It preserves all existing
release checks across `research-a`, `research-b` and `ui`; an individual registered
test name selects a targeted check. Timing summaries, logs and failure traces,
screenshots and browser console/page errors are saved under `artifacts/browser/`.
Successful diagnostic captures are discarded. See [development and publication](docs/development.md).

`ATLAS_URL` selects another server and `BROWSER_PATH` selects the browser binary.
The existing CI workflow lists the broader research and interface regressions.
For an archive exported without Git metadata, provide the verified full source
revision as `ATLAS_SOURCE_COMMIT` and explicitly set `ATLAS_SOURCE_DIRTY` to
`true` or `false` when building. Use `true` for reconciled changes that have not
been committed. This prevents an enclosing, unrelated repository from being
mistaken for the app's source revision.
Use targeted checks during iteration and complete the required validation for the
final revision. Runtime, persistence and export changes require their respective
integration checks; scientific changes require scientific validation.

Use native Framework7 controls and lifecycle APIs where appropriate. Preserve
specialized scientific renderers, code editors and computation environments.
Keep scientific identifiers, contrast definitions, missingness, statistical
families and provenance intact. Generated display files require their explicit
export scripts; build outputs should not be hand edited. Update and validate
publication checksums and path-level licensing when preparing a changed package.

## Publication

Ordinary commits validate without deploying. After owner authorization, create
a separate publication-request commit on canonical `main`, changing only
`.github/publication-request.json` and its two integrity inventories. The request
names its immediate parent revision and a new unique ID. The full validation
workflow must succeed, and publication reuses its exact checksummed build.
Superseded requests, repeated IDs and workflow reruns cannot deploy. Both local
tools and repository-editing clients use this same mechanism; workflow dispatch
and local terminal access are not required. Exact steps and failure recovery are
in [development and publication](docs/development.md).

Scientific outputs, historical release tags and deposited archives retain their
versioned identity. Manuscript, submission and private operational material do
not belong in this computational companion.
