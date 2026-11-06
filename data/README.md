# Data layout

Raw upstream files are intentionally absent from the repository. Restore them with `make acquire`; every download is checked against `metadata/provenance.json`.

Generated raw, interim and processed directories are ignored by Git. Complete derived statistical outputs are versioned under `tables/`. Never edit downloaded inputs or numerical result tables manually.

A compact convenience bundle is available under [`derived/`](derived/); see the [R results guide](../docs/r-results.md). It contains derived results and metadata, not raw sequencing files or fitted models.
