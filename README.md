<p align="center">
  <img src="public/brand/sidekick-logo-v3-transparent.png" width="180" alt="Sidekick DM logo: a green dragon hand raising a checked note above a game master screen">
</p>

# Sidekick DM

Sidekick is a local-first Pathfinder 2e workspace for game masters. It brings encounter preparation, reusable creature libraries, and at-the-table combat tracking into one browser application.

## What Sidekick does

Build an encounter for a party level, party size, and target difficulty. Sidekick calculates the encounter budget and shows how each creature or hazard contributes to it.

Use the bundled Catalog or your own library to assemble the encounter. You can create creatures from level-based benchmarks, fork and edit existing creatures, apply adjustments such as weak or strong, and keep the result for later encounters. Creature roles, statistics, attacks, and damage stay connected while you edit them.

An encounter can include:

- Creatures and hazards with complete game statistics
- Multiple phases with separate active participants and XP totals
- NPC profiles, battlefield setup, tactics, outcomes, and rewards
- A runnable encounter packet for use at the table

When play starts, Sidekick tracks initiative, rounds, hit points, conditions, attacks, damage, and dice rolls. The encounter remains available for inspection, so the DM can read abilities and statistics without leaving the run view.

Sidekick stores encounters and custom content in the browser. You can save them to reusable libraries or transfer them as validated JSON and ZIP archives.

## Agent-assisted preparation

A WebMCP-capable agent can build and revise creatures or encounters through typed tools. The agent uses the same validation and Pathfinder math as the visible interface.

Agent work runs as a tracked generation session. Sidekick shows the current target and each meaningful change without taking over the screen. The DM can stop the run, inspect its log, undo the complete run, or make a separate revision afterward. Revision checks prevent an agent from overwriting newer edits.

## How Sidekick is built

Sidekick has no application server. The deployed site is static HTML, CSS, JavaScript, JSON, and WebAssembly.

The rules engine is written in Swift and compiled to WebAssembly. It owns the encounter document, Pathfinder calculations, validation, revisions, and undo history. The JavaScript application sends semantic commands to the engine and renders the returned projection. This boundary keeps the browser interface and WebMCP tools on the same domain model.

IndexedDB stores the engine snapshot, reusable libraries, and attachments on the local device. Sidekick does not require an account, and encounter data does not leave the browser unless the DM exports it or shares it with an agent.

The repository includes:

- A Swift package for encounter rules, persistence contracts, and the WebAssembly command boundary
- A dependency-free JavaScript interface for building, running, importing, exporting, and printing encounters
- A WebMCP adapter with structured reads, mutations, validation feedback, cancellation, and revision checks
- Deterministic fixtures and browser tests for rules math, archives, IndexedDB persistence, and complete user flows

The checked-in `.toolchain-version` pins Swift, the Wasm SDK, Node.js, and Chromium so the acceptance build can reproduce the shipped browser artifact.

## Run Sidekick locally

Package the checked-in browser assets:

```text
npm run build:pages
```

Serve the generated `dist/` directory over HTTP:

```text
python3 -m http.server 4187 --directory dist
```

Open `http://127.0.0.1:4187/`.

## Verify the project

Run the JavaScript tests and verify the checked-in Catalog, WebMCP contract, native Wasm artifact, and browser source:

```text
npm run check:pages
```

Run the complete pinned build, including Swift tests, a fresh Wasm build, and the Chromium user flow:

```text
npm run acceptance
```
