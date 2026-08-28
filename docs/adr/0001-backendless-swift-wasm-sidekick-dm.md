# Build Sidekick DM as a backendless Swift/Wasm application with WebMCP as progressive enhancement

Sidekick DM will be a static HTTPS web application whose domain, encounter math, local state, and primary UI are written in Swift and compiled to WebAssembly where practical. The manual encounter, creature, NPC, and simple-hazard builders are complete without an agent; a narrow JavaScript/TypeScript adapter exposes the same semantic command layer through WebMCP. Catalog content is normalized into static fixtures ahead of time, durable user data lives in IndexedDB, and there is no application server, authentication service, cloud database, embedded model, or runtime dependency on Archives of Nethys or Foundry.

## Consequences

- The product remains useful when WebMCP is unavailable; only agent acceleration disappears.
- Whole-encounter generation is a visible transactional `Generation Run`, while later targeted agent edits are separate reversible mutations.
- Existing PF2 content is imported into a Sidekick DM-specific catalog format rather than exposing Foundry internals in the browser.
- Encounter math is deterministic; synergy, terrain, narrative quality, and fun remain advisory or GM judgments.
- Local persistence, JSON import/export, optional attachment ZIPs, and print output replace backend accounts and sync.
- The POC targets desktop Chromium and static hosting. Mobile, broad browser support, cloud collaboration, Foundry export, map generation, social subsystem runners, custom complex hazards, and custom spellcasting are stretch scope.
- If a Swift dependency is not Wasm-compatible within the hackathon, the supported feature/content surface is reduced or isolated behind an adapter rather than moved to a new backend.
