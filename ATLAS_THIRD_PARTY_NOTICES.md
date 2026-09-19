# Third-party code in the frozen atlas build

The committed `site/` directory is a generated static build. Its `_observablehq/` JavaScript contains code from Observable packages distributed under the ISC License:

- `@observablehq/framework` 1.13.4 — copyright 2023–2024 Observable, Inc.
- `@observablehq/runtime` 6.0.1 — copyright 2018–2024 Observable, Inc.
- `@observablehq/inspector` 5.0.1 — copyright 2018–2024 Observable, Inc.

The full original package license notices, including the applicable copyright lines, are preserved in `third_party_licenses/`. The generic SPDX ISC text is in `LICENSES/ISC.txt`. Custom atlas components and styles are MIT licensed; frozen scientific display JSON follows the file-level mixed-origin notices. The generated `site/index.html` combines project and Observable-generated material and is annotated `MIT AND ISC` in `REUSE.toml`.

The package lock contains other development and build dependencies that are not redistributed as installed packages. Their names, versions and integrity hashes remain in `explorer/package-lock.json`; each dependency retains its own license.
