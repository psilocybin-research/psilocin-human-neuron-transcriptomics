# Contributing

Questions, reproducibility reports and corrections are welcome. Choose an [issue form](https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/issues/new/choose) and identify the release or commit and the affected file, result or atlas view.

For reproduction failures, include the command, software versions and relevant error output. For scientific questions, link the specific table, method or claim and explain the proposed correction. Keep participant information, credentials and private correspondence out of public issues.

To propose a change, fork the repository, create a branch and open a pull request explaining the change and how it was checked. Small documentation corrections do not require rerunning analyses. For atlas changes, run `npm --prefix explorer test` and `npm --prefix explorer run build`.

Scientific changes should identify the affected analysis, assumptions and validation. Preserve source attribution, frozen specifications and original results; generate revised outputs through code and document changes separately. Historical release tags and Zenodo archives remain unchanged.

Files have different licences; follow [LICENSE.md](LICENSE.md) and retain upstream notices. Public-file changes require refreshed integrity and licence inventories, which the maintainer prepares before merging.
