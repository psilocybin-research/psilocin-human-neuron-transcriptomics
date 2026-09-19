PYTHON ?= .venv/bin/python

.PHONY: acquire audit audit-design test validate-release zenodo-payload setup-r qc-reproduce analyze targeted-redox dna-maintenance oxphos-alias-sensitivity figures atlas

acquire:
	$(PYTHON) -m src.acquisition.download
	$(PYTHON) -m src.acquisition.analysis_inputs

audit:
	$(PYTHON) -m src.audit.inventory

audit-design:
	$(PYTHON) -m src.audit.schmidt_design

test:
	$(PYTHON) -m pytest -q
	$(PYTHON) src/validate_release.py

validate-release:
	$(PYTHON) src/validate_release.py

zenodo-payload:
	$(PYTHON) src/zenodo_release.py payload

setup-r:
	Rscript src/transcriptomics/restore_environment.R

qc-reproduce:
	Rscript src/transcriptomics/qc_reproduce.R

analyze:
	Rscript src/transcriptomics/analyze.R

targeted-redox:
	Rscript src/transcriptomics/targeted_redox.R

dna-maintenance:
	Rscript src/transcriptomics/dna_maintenance.R

oxphos-alias-sensitivity:
	Rscript src/transcriptomics/oxphos_alias_sensitivity.R

figures:
	Rscript src/transcriptomics/publication_figures.R
	Rscript src/transcriptomics/oxphos_gene_heatmap.R

atlas:
	$(PYTHON) src/figures/export_explorer.py
	npm --prefix explorer test
	npm --prefix explorer run build
