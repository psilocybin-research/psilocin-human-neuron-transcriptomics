# Third-party sources and attribution

This repository does not redistribute the raw Schmidt RNA-sequencing downloads. Source locations, pinned versions and checksums are recorded in `metadata/provenance.json`.

## Schmidt et al. data and code

- Schmidt article: <https://doi.org/10.7554/eLife.104006>, CC BY 4.0. The reviewed eLife version used for this project is <https://doi.org/10.7554/eLife.104006.3>.
- Dryad dataset: <https://doi.org/10.5061/dryad.xsj3tx9w3>, record version 434510, CC0 1.0 as recorded by Dryad.
- Original Hoffrichter/Schmidt analysis repository: <https://github.com/ahoffrichter/Schmidt_et_al_2025>, pinned commit `c565709affafbea09406bd7b42fe494f08db6cce`, preserved as Software Heritage directory identifier `swh:1:dir:c847a8a51074c59d651e3258cf1355936e921048`, MIT License, copyright Anne Hoffrichter. The pinned upstream license has SHA-256 `fb4543330f1c9cf263ad289628fbc92df62ad4d65090f0480cf0e9a8529a7717`.

## Gene sets

The exact memberships used for the analysis are retained in `config/gene_sets.yaml` with their source release and checksums. MSigDB Human release 2026.1.Hs is attributed to the Broad Institute, MIT and the Regents of the University of California under the terms recorded by MSigDB: <https://www.gsea-msigdb.org/gsea/msigdb_license_terms.jsp>. The set-by-set redistribution review is in `metadata/gene_set_redistribution_review.json`.

Reactome-derived pathway annotations are cited and versioned in the configuration and metadata. Reactome licensing information is available at <https://reactome.org/license>.

Direct Reactome database annotations redistributed in `metadata/reactome_*` are CC0 1.0. HGNC-derived symbol mappings in `tables/oxphos_alias/alias_mapping.csv` are CC0 1.0 under <https://www.genenames.org/about/license/>; HGNC attribution is retained despite not being mandatory.

## Software dependencies

Python, R, Bioconductor, Observable Framework and other dependencies retain their own licenses. Lock files identify the resolved versions; inclusion in a lock file does not place a dependency under this repository's licenses.

## Publisher identity marks

The header uses unmodified official eLife artwork from <https://elifesciences.org/resources> and the blue Zenodo icon from <https://about.zenodo.org/#icon> to link to the original article and software archive. eLife is displayed at its recommended minimum web width of 80 pixels. Marks remain the property of eLife Sciences Publications Ltd and CERN; see `LICENSES/LicenseRef-Publisher-Branding.txt`. Their appearance identifies the linked resources and does not imply endorsement.

The source-data link uses the official, unmodified Dryad logo from <https://datadryad.org/>. Dryad permits informational logo use under <https://datadryad.org/terms>; no endorsement or affiliation is implied.

## Dated public molecular context

Ensembl / EMBL-EBI gene descriptions, genomic coordinates and biotypes follow [Ensembl data-use terms](https://www.ensembl.org/info/about/legal/disclaimer.html); source-description attributions are retained. [UniProt Consortium annotations](https://www.uniprot.org/help/license) and [AlphaFold DB predictions](https://alphafold.ebi.ac.uk/faq) are CC BY 4.0. [PDB coordinate models](https://www.rcsb.org/pages/policies) are CC0 1.0, with original deposit citations retained in their files. No experimental estimates are replaced by these annotations.

Exact queries, retrieval timestamps, provider releases where supplied, and coordinate SHA-256 identities are recorded in `explorer/src/assets/public-context/index.json`. `previews.json` identifies the coordinate source, mapped accession, sequence version, rendered chains and licence for each generated OXPHOS preview. AlphaFold previews use exact canonical sequence matches and local pLDDT colours; PDB previews isolate mapped chains and use sequence-position colours. These are structural context, not measurements of protein abundance, activity or a psilocin response.

## MitoCarta3.0 and complex-I reference assembly

MitoCarta3.0 human annotations and the 149 MitoPathways are from Rath S, Sharma R, Gupta R, et al. *MitoCarta3.0: an updated mitochondrial proteome now with sub-organelle localization and pathway annotations.* Nucleic Acids Research. 2021;49(D1):D1541–D1547. <https://doi.org/10.1093/nar/gkaa1011>. The source article specifies CC BY-NC 4.0 (<https://pmc.ncbi.nlm.nih.gov/articles/PMC7778944/>); the redistributed mitochondrial annotation and mapping derivatives retain this noncommercial restriction rather than inheriting the repository's default CC BY licence. Source workbook/GMX URLs, hashes, retrieval date and the source Ensembl mapping date accompany the snapshot. The data are abridged, normalized and linked to archived gene records; no endorsement is implied.

The complex-I pilot uses deposited Cα coordinates from human PDB entry 9TI4, biological assembly 1 (<https://www.rcsb.org/structure/9TI4>), and PDBe SIFTS UniProt mappings (<https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/9ti4>). PDB coordinates are CC0; SIFTS is attributed as the mapping provider. The combined pilot includes MitoCarta-derived mappings and is distributed under CC BY-NC 4.0. Per-chain author/label identifiers, sequence identity and coverage, source hashes and retrieval date are retained. Backbone traces omit unresolved residues and are not chemical bonds or simulated molecular motion. RNA overlays do not establish protein abundance, assembly, conformation or activity changes.


## Molecular visualization and authored spatial assets

Mol* 5.13.1 (<https://molstar.org/>, <https://github.com/molstar/molstar>) is MIT-licensed. The published molecular viewer retains its source distribution and dependency notices; MolViewSpec scenes identify PDB 9TI4 assembly 1 and the active anatomy/RNA evidence layer. The original deposited mmCIF coordinates are CC0, with source URL and SHA-256 in the molecular asset provenance. No protein response is measured by RNA overlays.

Blender 5.2.4 (<https://www.blender.org/>, GPL-3.0-or-later) and Molecular Nodes 520.2.0 (<https://github.com/BradyAJohnston/MolecularNodes>, GPL-3.0-or-later) were used as asset-authoring tools, not bundled browser runtimes. Coordinate-derived cartoon artwork and illustrative membrane geometry are authored by Christopher B. Germann, CC BY 4.0. The membrane shapes/positions are schematic; the molecular cartoon derives from deposited reference coordinates. Mapping audit derivatives retain MitoCarta CC BY-NC 4.0 terms. Original tool licences remain available at their source repositories. Browser GLB rendering uses the existing Three.js runtime and its bundled MIT notices.
