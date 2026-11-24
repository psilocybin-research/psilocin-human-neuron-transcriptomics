# Development and publication

## Shared source and checks

Use a review branch for website changes. Keep native Framework7 controls and
lifecycle management, accessible names, focus restoration, safe-area sizing and
responsive layouts. Use stable roles/accessibility labels or explicit data-test
attributes for browser selectors. Scope selectors to the active F7 surface;
wait for actual readiness rather than fixed sleeps. Preserve specialized
scientific plots, code editors and browser R/Python runtimes.

Never change frozen scientific inputs, results or statistical families as part
of interface maintenance. Preserve exact gene IDs, contrast signs, missingness,
axis meanings, source licences and provenance. Add meaningful tests for changed
behavior; do not weaken assertions to hide a product defect.

```sh
npm --prefix explorer ci
npm --prefix explorer test
npm --prefix explorer run build
npm --prefix explorer run check:ui -- source
python .github/scripts/refresh_integrity.py --write
python .github/scripts/refresh_integrity.py
python src/validate_release.py
```

The Python commands use the existing release requirements. Integrity maintenance
changes only `FILE_LICENSES.json`, `PUBLICATION_MANIFEST.json` and `SHA256SUMS`,
with stable ordering and retained version/date metadata. It does not run analyses
or repair scientific data. Commit the reviewed changes and these inventories
together. CI checks them without rewriting or generating automatic commits.

Browser test groups are registered once in `explorer/scripts/browser-suite.mjs`.
Select `research-a`, `research-b`, `ui` or an individual registered name. The
runner serves the existing production build on a free localhost port unless
`ATLAS_URL`/`BASE_URL` is supplied. `BROWSER_PATH` selects a browser. Logs, timing
summaries and retained failure diagnostics are under `artifacts/browser/`.
Traces capture the public test inputs and browser state. Hard process/runner
termination may leave only partial diagnostics; server and test logs remain.

The release gate requires scientific/package/R checks, licensing, inventory
checks, infrastructure rejection tests, JavaScript unit tests, all three browser
groups and Bayesian-input verification. Browser groups download the same build;
none rebuilds it. Archive and per-file SHA-256 values are checked before browser
tests, after them, and before publication. The deployment job has the only Pages
and OIDC write permissions.

## Publication from repository edits

Publication requires the owner's explicit authorization. A workflow cannot
independently authenticate a statement of human authorization in a file; normal
repository write permissions, review rules and the `github-pages` environment
remain the trust boundary. Do not request publication without that authorization.

1. Finish/review the website change on a branch, refresh inventories and wait for
   all required CI checks, including `release-gate`, to pass.
2. Promote the reviewed source to `main` only when authorized. An ordinary source
   commit on `main` runs validation but does not publish.
3. Read the current full `main` SHA, including any merge commit. In a **separate
   commit**, edit `.github/publication-request.json` to:

   ```json
   {
     "intent": "publish",
     "source_sha": "FULL_40_CHARACTER_CURRENT_MAIN_SHA",
     "request_id": "publish-YYYYMMDD-UNIQUE_SUFFIX",
     "authorized_by_owner": true
   }
   ```

4. Update only `PUBLICATION_MANIFEST.json` and `SHA256SUMS` for the request file's
   new bytes; `FILE_LICENSES.json` needs no change because the path already exists.
   Use the deterministic utility locally, or perform equivalent byte-size and
   SHA-256 updates through the repository-editing client. JSON whitespace and
   the trailing newline count toward the checksum. The manifest's own checksum
   is deliberately excluded. Commit these three files together on `main`.
5. Inspect the resulting CI run. It validates the request commit and builds once.
   Deployment waits for every required job, verifies its source/archive/file
   identities, and checks that this request is still the latest canonical main.
   The deployed app identifies the request commit; its scientific/interface
   source equals the named parent because other file changes are prohibited.
6. Confirm the `deploy` job and live build identity. Record the actual deployed
   revision and run URL in the private handover/status record.

The connector needs only repository reads/edits/commits and CI inspection.
Workflow dispatch, shell access and issue/comment creation are unnecessary.

A failed request does not publish. Fix the source in an ordinary development
commit, then create a new request naming the new main SHA and a fresh request ID.
Rerunning a request's workflow is useful for diagnostics but cannot deploy.
Leaving an old request in the file does not publish later commits. Reverting,
reusing or cherry-picking an old ID is rejected. To cancel a pending request,
make a new main commit restoring `intent: none`, null source/ID and false
authorization, then refresh its integrity inventories. Any newer main commit
supersedes an older request, and branch concurrency cancels the older run.

Do not create a request on a staging branch expecting it to publish: production
is limited to pushes on the canonical repository's main branch. Repository
administrators should retain branch review and environment protection rules.

## Local and remote reconciliation

The complete local project owns scientific analysis and export integration;
the public checkout is the versioned exchange point for website source, public
documentation, workflow definitions and approved results. Website improvements
may accumulate remotely. Reconcile at development milestones and before any
local export/publication: fetch and inspect new history, preserve local changes,
resolve overlaps deliberately, update the parent website source, and run the
live-revision/synchronization preflight and isolated-export validation.

Reusable calculations belong in ordinary R/Python modules with shared inputs
and numerical checks. Framework7 presentation remains web code. No Shiny
translation is part of this atlas's workflow. Keep private integration notes,
manuscripts, credentials, machine paths and backup artifacts outside the public
companion. Public source and workflow files are exported directly, without
duplicate embedded templates. Scientific archives and historical tags are immutable.
