# Licensing

This is a mixed-license research repository. `REUSE.toml` is the authoritative path-level license and copyright map; `FILE_LICENSES.json` expands that map to every released file. Full license texts are in `LICENSES/`.

## Software

Original source code and workflow files in `src/`, `tests/`, `explorer/`, `.github/` and the root `Makefile` are licensed under the [MIT License](LICENSES/MIT.txt).

## Documentation and derived research outputs

Original documentation, figures, metadata created for this analysis, and derived result tables are licensed under the [Creative Commons Attribution 4.0 International License](LICENSES/CC-BY-4.0.txt).

## Upstream and mixed-source files

- MitoCarta3.0 annotations, linked mappings and exploratory mitochondrial outputs retain **CC BY-NC 4.0**. These files are an exception to the default CC BY terms; source attribution and exact paths are in the licence map and `THIRD_PARTY_NOTICES.md`.
- MSigDB memberships are CC BY 4.0 with upstream attribution and collection-specific restriction review recorded in `metadata/gene_set_redistribution_review.json`.
- Direct Reactome database annotations are CC0 1.0.
- Dated Ensembl annotations follow Ensembl unrestricted data-use terms, with source descriptions and attribution retained. UniProt annotations and AlphaFold models are CC BY 4.0. PDB coordinate files retain CC0 1.0. OXPHOS model previews are CC BY 4.0, with per-model source and licence provenance in `explorer/src/assets/public-context/previews.json`.
- HGNC-derived alias mappings are CC0 1.0; attribution is retained as requested by HGNC.
- Optional browser R uses the unmodified webR 0.6.0 distribution, with original licences and corresponding-source links under `explorer/vendor/webr/`.
- Optional PDF compilation uses unmodified Siglum 0.2.2 / BusyTeX / TeX Live 2026, with MIT, GPL, LPPL and font-specific terms retained under `explorer/vendor/latex/`. Public corresponding-source locations and SHA-256 values are in `SOURCE-ACCESS.json`; the large development source archives are excluded from offline downloads. CodeMirror and ZIP dependency notices are retained in the generated editor bundle.
- Observable Framework code included in the frozen static atlas retains its ISC license and Observable, Inc. copyright. Original package notices are preserved in `third_party_licenses/`.
- Selected sample and gene-annotation metadata derived from the pinned Schmidt repository retain Anne Hoffrichter's MIT notice alongside the license for the project's additions.

The R convenience bundle under `data/derived/` combines derived tables and attributed upstream metadata. Its combined MIT, CC BY 4.0 and CC0 provenance is recorded in `REUSE.toml` and `FILE_LICENSES.json`; it does not change the licences of its source files.

## Scope

No repository-wide license overrides these file-level assignments. This project does not claim Christopher B. Germann copyright over MSigDB, Reactome, HGNC, Observable, or Schmidt source material. Their applicable terms and attribution are described in `THIRD_PARTY_NOTICES.md`, `ATLAS_THIRD_PARTY_NOTICES.md`, `REUSE.toml` and the source provenance records.
