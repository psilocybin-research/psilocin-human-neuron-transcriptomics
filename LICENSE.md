# Licensing

This is a mixed-license research repository. `REUSE.toml` is the authoritative path-level license and copyright map; `FILE_LICENSES.json` expands that map to every released file. Full license texts are in `LICENSES/`.

## Software

Original source code and workflow files in `src/`, `tests/`, `explorer/`, `.github/` and the root `Makefile` are licensed under the [MIT License](LICENSES/MIT.txt).

## Documentation and derived research outputs

Original documentation, figures, metadata created for this analysis, and derived result tables are licensed under the [Creative Commons Attribution 4.0 International License](LICENSES/CC-BY-4.0.txt).

## Upstream and mixed-source files

- MSigDB memberships are CC BY 4.0 with upstream attribution and collection-specific restriction review recorded in `metadata/gene_set_redistribution_review.json`.
- Direct Reactome database annotations are CC0 1.0.
- HGNC-derived alias mappings are CC0 1.0; attribution is retained as requested by HGNC.
- Observable Framework code included in the frozen static atlas retains its ISC license and Observable, Inc. copyright. Original package notices are preserved in `third_party_licenses/`.
- Selected sample and gene-annotation metadata derived from the pinned Schmidt repository retain Anne Hoffrichter's MIT notice alongside the license for the project's additions.

## Scope

No repository-wide license overrides these file-level assignments. This project does not claim Christopher B. Germann copyright over MSigDB, Reactome, HGNC, Observable, or Schmidt source material. Their applicable terms and attribution are described in `THIRD_PARTY_NOTICES.md`, `ATLAS_THIRD_PARTY_NOTICES.md`, `REUSE.toml` and the source provenance records.
