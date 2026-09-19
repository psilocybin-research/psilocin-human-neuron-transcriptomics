# Third-party sources and attribution

This repository does not redistribute the raw Schmidt RNA-sequencing downloads. Source locations, pinned versions and checksums are recorded in `metadata/provenance.json`.

## Schmidt et al. data and code

- Schmidt article: <https://doi.org/10.7554/eLife.104006.3>, CC BY 4.0.
- Dryad dataset: <https://doi.org/10.5061/dryad.xsj3tx9w3>, record version 434510, CC0 1.0 as recorded by Dryad.
- Author repository: <https://github.com/ahoffrichter/Schmidt_et_al_2025>, pinned commit `c565709affafbea09406bd7b42fe494f08db6cce`, MIT License, copyright Anne Hoffrichter. The pinned upstream license has SHA-256 `fb4543330f1c9cf263ad289628fbc92df62ad4d65090f0480cf0e9a8529a7717`.

## Gene sets

The exact memberships used for the analysis are retained in `config/gene_sets.yaml` with their source release and checksums. MSigDB Human release 2026.1.Hs is attributed to the Broad Institute, MIT and the Regents of the University of California under the terms recorded by MSigDB: <https://www.gsea-msigdb.org/gsea/msigdb_license_terms.jsp>. The set-by-set redistribution review is in `metadata/gene_set_redistribution_review.json`.

Reactome-derived pathway annotations are cited and versioned in the configuration and metadata. Reactome licensing information is available at <https://reactome.org/license>.

Direct Reactome database annotations redistributed in `metadata/reactome_*` are CC0 1.0. HGNC-derived symbol mappings in `tables/oxphos_alias/alias_mapping.csv` are CC0 1.0 under <https://www.genenames.org/about/license/>; HGNC attribution is retained despite not being mandatory.

## Software dependencies

Python, R, Bioconductor, Observable Framework and other dependencies retain their own licenses. Lock files identify the resolved versions; inclusion in a lock file does not place a dependency under this repository's licenses.
