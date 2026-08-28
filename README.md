# Sidekick DM

Sidekick DM is a local-first Pathfinder 2e encounter workspace. Build creatures and encounters, keep reusable libraries, and run combat with initiative, hit points, conditions, and dice rolls. A WebMCP-capable agent can use the same validated encounter model.

The browser loads a Swift engine compiled to WebAssembly. Encounter data stays in IndexedDB unless you export it.

## Project documentation

- [Domain glossary](CONTEXT.md)
- [Architecture decision](docs/adr/0001-backendless-swift-wasm-sidekick-dm.md)
- [Product and technical design](docs/design/sidekick-dm-poc.md)
- [Detailed implementation plan](docs/plans/sidekick-dm-implementation.md)
- [WebMCP contract v1](docs/contracts/sidekick-dm-webmcp-v1.md)
- [JSON contract v1](docs/contracts/sidekick-dm-json-v1.md)

## Run the acceptance build

The checked-in `.toolchain-version` pins the Swift, Wasm SDK, Node, and Chromium inputs. The build scripts select that Swift toolchain from the standard system or user toolchain directory. They do not require `SWIFT_EXEC`.

Run the full acceptance build with:

```text
npm run acceptance
```

To build and verify only the native browser artifact, run:

```text
npm run build
npm run verify:native
```

The Wasm build keeps SwiftPM and compiler module caches in the versioned `native/.build` directory. This prevents modules from another Swift or SDK version from being reused.

`npm run check` is an alias for the same command. The command checks the rules and Catalog fixtures. It runs JavaScript and native tests. It builds the static application and verifies the Wasm artifact. It checks browser source and runs the Chromium manual scenario.

The output is in `dist/`. Serve that directory over HTTP to load the Wasm module and the static JSON asset.

## Publish with GitHub Pages

The repository includes [the Pages workflow](.github/workflows/pages.yml). Only the `github-pages` branch can deploy `dist/`. The workflow skips deployment until the repository variable `PUBLISH_PAGES` is `true`, so you can prepare GitHub Pages without publishing the site.

The Pages job uses the checked-in `public/wasm/sidekick-engine.wasm`. It does not rebuild the engine because GitHub-hosted runners do not include the pinned SwiftWasm toolchain. Run `npm run acceptance` on the pinned local toolchain before you update the Wasm artifact.

To enable the first deployment:

1. Open the repository on GitHub.
2. Open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push `github-pages`.

GitHub Pages is now ready but does not publish the site. To publish later, create an Actions repository variable named `PUBLISH_PAGES` with the value `true`. Then push `github-pages`, or run **Publish Sidekick to GitHub Pages** from the **Actions** tab with that branch selected.

To publish a tested version, bring the desired commits into the publishing branch and push only that branch:

```text
git switch github-pages
git merge main
git push -u origin github-pages
```

GitHub publishes a project repository at `https://<owner>.github.io/<repository>/`. Sidekick uses relative asset URLs, so it works under the repository path without a hard-coded site name.

To verify the Pages artifact without the Swift toolchain, run:

```text
npm run check:pages
```

To test the production site under a repository-style path, run:

```text
npm run build:pages
SIDEKICK_BASE_PATH=/Sidekick/ npm run test:browser
```

See [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for GitHub's deployment model and repository settings.
