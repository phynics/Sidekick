# Sidekick DM POC Documentation

- [Domain glossary](CONTEXT.md)
- [Architecture decision](docs/adr/0001-backendless-swift-wasm-sidekick-dm.md)
- [Product and technical design](docs/design/sidekick-dm-poc.md)
- [Detailed implementation plan](docs/plans/sidekick-dm-implementation.md)
- [WebMCP contract v1](docs/contracts/sidekick-dm-webmcp-v1.md)
- [JSON contract v1](docs/contracts/sidekick-dm-json-v1.md)

## Browser boundary proof

The checked-in `.toolchain-version` pins the tested Swift, Wasm SDK, Node, and Chromium inputs. Build and verify the static application with:

```text
npm run check
```

The output is in `dist/`. Serve that directory over HTTP to load the Wasm module and the static JSON asset.
