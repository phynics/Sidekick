# Sidekick DM POC Documentation

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
