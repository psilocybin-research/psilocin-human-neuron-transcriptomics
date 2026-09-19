# Psilocin human-neuron transcriptomics

[![CI](https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/actions/workflows/ci.yml/badge.svg)](https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/actions/workflows/ci.yml)

Reproducible secondary analysis of public bulk RNA-sequencing data from human iPSC-derived cortical neurons after a 10-minute psilocin pulse followed by washout. The analysis focuses on oxidative phosphorylation, metabolic and redox transcription, robustness across the verified experimental design, and bounded exploratory DNA-maintenance results.

Psilocin is the active metabolite of psilocybin. The experiment analyzed here used **psilocin**, and this repository preserves that distinction.

## Main result

A brief psilocin pulse was associated with a broad OXPHOS-centered transcriptional signature at both later sampling points. The signal was distributed across 95 and 107 leading-edge genes, with 89 shared, and retained its direction across the prespecified block and RNA-quality checks. The public metadata do not identify control harvest days, so a treatment-specific temporal trajectory is not estimable. Transcriptomic enrichment does not establish respiration, ATP production, redox flux, DNA-repair activity, or telomere preservation.

## Repository contents

| Path | Contents |
|---|---|
| `src/` | acquisition, audit, RNA-seq, enrichment and figure code |
| `config/` | frozen model, pathway and sensitivity specifications |
| `metadata/` | sample mappings, source inventory and design audit |
| `tables/` | complete derived gene, pathway and sensitivity results |
| `figures/` | final scientific figures and QC summaries |
| `explorer/` | source and frozen display data for the interactive atlas |
| `site/` | frozen static atlas build from this release |
| `reports/` | frozen plan and scientific result reports |
| `docs/` | concise public analysis chronology |
| `provenance/` | freeze records, session information and source checksums |

The repository intentionally excludes manuscript files, journal correspondence, raw upstream downloads and internal development materials. `config/public_release_outputs.json` is the exact allowlist for redistributed numerical outputs.

## Interactive atlas

The live atlas will be available at:

<https://psilocybin-research.github.io/psilocin-human-neuron-transcriptomics/>

The atlas displays frozen outputs and does not run new statistical analyses in the browser. A static copy is retained in `site/`.

## Source data

The analysis uses the public data and code accompanying Schmidt et al.:

- Article: <https://doi.org/10.7554/eLife.104006.3>
- Author repository: <https://github.com/ahoffrichter/Schmidt_et_al_2025>
- Dryad record: <https://doi.org/10.5061/dryad.xsj3tx9w3>

Raw files are not duplicated here. `metadata/provenance.json` records pinned source URLs, versions and SHA-256 checksums. Acquisition scripts restore and verify the public inputs.

## Reproduction

The analysis used Python 3.10 and R 4.6.1. Exact Python and R package states are recorded in `requirements.lock.txt`, `renv.lock` and `renv.figures.lock`.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock.txt
make acquire
make audit
make audit-design
make test
make setup-r
make qc-reproduce
make analyze
make targeted-redox
make dna-maintenance
make oxphos-alias-sensitivity
make figures
```

Network acquisition is explicit. Analysis and reporting commands use checksum-verified inputs and frozen specifications. The repository already contains the complete derived results so readers can inspect every reported result without rerunning the upstream acquisition.

For the atlas:

```bash
npm --prefix explorer ci
npm --prefix explorer test
npm --prefix explorer run build
python3 -m http.server 4173 --directory explorer/dist
```

## Statistical scope

The primary model conservatively aggregates 23 libraries into nine condition profiles across three differentiation blocks and two genetic backgrounds. Competitive pathway p-values describe concentration within ranked genes; they are not biological-replicate p-values. “Robust” denotes the frozen within-dataset directional criterion described in `reports/analysis_plan_frozen.md`.

Exploratory DNA-repair and telomere-maintenance findings and their post hoc decomposition are clearly separated from the primary metabolic and redox analysis. See `docs/analysis_history.md`.

## Citation

Citation metadata are provided in `CITATION.cff`. A version-specific Zenodo DOI will be added after archival of the first GitHub release.

## Release process

The release pipeline is split into reviewable stages. `src/zenodo_release.py` uses Zenodo's official API to reserve a DOI, upload one checksum-verified ZIP, inspect the draft, and publish only when the record ID, DOI and SHA-256 are explicitly confirmed. Its token is read from a private file outside the repository and is never placed in GitHub Actions. `make validate-release` checks the local package; `make zenodo-payload` prints the proposed metadata without requiring credentials. Tags matching `v*` run the full repository checks before GitHub creates the corresponding release.

## License

Original software is released under the MIT License. Original documentation, figures and derived result tables are released under CC BY 4.0, with upstream components separately attributed. See `LICENSE.md`, `FILE_LICENSES.json`, `THIRD_PARTY_NOTICES.md` and `metadata/gene_set_redistribution_review.json`.
