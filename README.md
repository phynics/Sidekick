<p align="center">
  <img src="public/brand/sidekick-logo-v3-transparent.png" width="180" alt="Sidekick DM logo: a green dragon hand raising a checked note above a game master screen">
</p>

# Sidekick DM

Sidekick DM is a local-first Pathfinder 2e encounter workspace. Build creatures and encounters, keep reusable libraries, and run combat with initiative, hit points, conditions, and dice rolls. A WebMCP-capable agent can use the same validated encounter model.

The browser loads a Swift engine compiled to WebAssembly. Encounter data stays in IndexedDB unless you export it.

The canonical logo is [`public/brand/sidekick-logo-v3-transparent.png`](public/brand/sidekick-logo-v3-transparent.png).

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
