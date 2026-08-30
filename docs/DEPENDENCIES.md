# Dependencies and licenses

The project is MIT-licensed; see [`LICENSE`](../LICENSE). It has no external production runtime package and makes no runtime network request. All application `dependencies` are private `@ten-billion-lives/*` workspace packages covered by the repository license. Browser execution otherwise uses standard Web APIs.

Verify the production and direct development inventory locally with:

```sh
pnpm docs:check
```

The checker asserts every production dependency is an in-repository workspace package. It also reads each installed direct development package manifest and compares its exact version and SPDX license with the table below.

## Direct development tools

These tools exist only for building, testing, formatting, documentation, and evidence capture; they are not shipped as runtime services.

| Package                | Pinned/range | License    | Purpose                                        |
| ---------------------- | ------------ | ---------- | ---------------------------------------------- |
| `@axe-core/playwright` | `4.13.0`     | MPL-2.0    | Automated accessibility audit                  |
| `@eslint/js`           | `10.0.1`     | MIT        | ESLint JavaScript rules                        |
| `@playwright/test`     | `1.62.1`     | Apache-2.0 | Local Chromium/WebKit/browser journeys         |
| `@types/node`          | `24.13.3`    | MIT        | Node.js type declarations                      |
| `cspell`               | `10.1.1`     | MIT        | Local documentation spelling check             |
| `eslint`               | `10.9.1`     | MIT        | Static analysis                                |
| `globals`              | `17.11.0`    | MIT        | ESLint global definitions                      |
| `prettier`             | `3.9.6`      | MIT        | Deterministic text formatting                  |
| `typescript`           | `6.0.3`      | Apache-2.0 | Compiler and strict type checking              |
| `typescript-eslint`    | `8.68.0`     | MIT        | TypeScript ESLint integration                  |
| `vite`                 | `8.2.2`      | MIT        | Local development and production browser build |
| `vitest`               | `4.1.11`     | MIT        | Deterministic unit/contract tests              |

The lockfile records exact transitive versions and integrity hashes. Pnpm 11.24.0 currently fails its optional aggregate `licenses list` report for this lockfile with `ERR_PNPM_MISSING_PACKAGE_INDEX_FILE` even after a frozen reinstall, so that command is not presented as passing evidence. The repository-native direct inventory above remains deterministic and is what `pnpm docs:check` enforces.

License metadata is checked during the #26 clean documentation walkthrough. Adding an external runtime dependency requires explicit issue justification and an updated runtime/license account here; adding a server, remote API, paid service, or runtime LLM is outside the local MVP.
