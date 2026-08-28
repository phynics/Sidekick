# Sidekick DM POC — Detailed Implementation Plan

Status: Ready for implementation  
Strategy: risk-first, vertical-slice delivery  
Core constraint: static Swift/Wasm app, no application backend

## 0. Execution rules

1. Prove Swift/Wasm and encounter math before broad UI work.
2. Prove one complete manual encounter before broad Catalog coverage.
3. Prove the same commands through WebMCP before adding tool breadth.
4. Keep generated work live and reversible through `GenerationRun`.
5. Treat official rules calculations as deterministic and all cohesion/synergy judgments as advisory.
6. Reduce breadth before faking mechanics or introducing a backend.
7. Stop adding features once the manual and agent definitions of done are green; rehearse and harden the demo.

Priority:

- **P0** required for accepted end-to-end scenarios.
- **P1** valuable polish after P0 reliability.
- **P2** stretch.

## 1. Milestone map

```text
M0  Source, license, and Wasm compatibility audit
 ↓
M1  SidekickDMCore domain + encounter math
 ↓
M2  Catalog generator + curated fixture
 ↓
M3  Persistence and JSON contracts
 ↓
M4  Swift/Wasm manual Encounter Builder
 ↓
M5  Creature/NPC/Simple Hazard builders
 ↓
M6  Encounter Packet, print, import/export
 ↓
M7  WebMCP read/query bridge
 ↓
M8  Generation Run + composition tools
 ↓
M9  Acceptance tests, CI, deployment, demo rehearsal
```

## M0 — Empirical risk audit

Priority: P0  
Exit: repository and dependency choices are factual, not assumed.

### Task 0.1 — Create repository and docs

Create separate `SidekickDM` repository with:

```text
CONTEXT.md
docs/adr/0001-backendless-swift-wasm-sidekick-dm.md
docs/design/sidekick-dm-poc.md
docs/plans/sidekick-dm-implementation.md
docs/contracts/sidekick-dm-webmcp-v1.md
docs/contracts/sidekick-dm-json-v1.md
```

### Task 0.2 — Pin toolchain

- Pin a released Swift 6.3.x toolchain and exactly matching official Wasm SDK.
- Record install/build commands.
- Pin ElementaryUI, JavaScriptKit/BridgeJS, Node, and Vite versions.
- Add a reproducible local bootstrap script.

### Task 0.3 — Wasm UI spike

Build the smallest static app that:

1. loads Swift/Wasm;
2. renders one Swift-owned value;
3. responds to a button;
4. loads one static JSON asset;
5. calls one tiny JavaScript bridge function.

Timebox ElementaryUI. If it blocks delivery, replace only the UI binding layer.

### Task 0.4 — Foundry/source audit

Inspect candidate source packs and determine:

- JSON locations and actor/hazard shapes;
- creature, NPC, simple/complex Hazard discrimination;
- current/remastered/legacy fields;
- source publication/page fields;
- stable slug candidates;
- HTML/text normalization requirements;
- spellcasting block normalization;
- completeness gaps;
- license/notice metadata available per source.

Output `docs/compatibility/catalog-source-audit.md`.

### Task 0.5 — Initial catalog selection

Select coherent source/publication set supporting:

- party levels 1–10;
- relative component levels approximately −1 through 13;
- common environments;
- each major Encounter Role;
- spellcasting and non-spellcasting examples;
- Simple and Complex Hazards;
- current content as default;
- selected legacy/adventure variants behind filters.

No art/token assets.

### Task 0.6 — Rules table verification

Encode golden fixtures for:

- threat budgets;
- party adjustments;
- creature XP by relative level;
- Simple/Complex Hazard XP;
- benchmark tables required by Creature/Hazard builders.

Cross-check against accepted official rules references.

## M1 — Implement SidekickDMCore

Priority: P0  
Exit: native Swift can create, calculate, validate, mutate, and undo an Encounter Draft without browser code.

### Task 1.1 — Package layout

```text
Sources/
  SidekickDMCore/
    IDs/
    Brief/
    Encounter/
    Math/
    Participants/
    Creatures/
    NPCs/
    Hazards/
    Phases/
    Packet/
    Validation/
    History/
    Contracts/

  SidekickDMCatalog/
  SidekickDMWeb/
  GenerateSidekickDMCatalog/
```

Keep Foundation/browser dependencies minimal in `SidekickDMCore`.

### Task 1.2 — Strong IDs and enums

Implement typed IDs and enums:

- EncounterID, ComponentID, CreatureID, NPCProfileID, HazardID, PhaseID, AttachmentID;
- ThreatTarget;
- Faction;
- ParticipationMode;
- CreatureOrigin and Adjustment;
- EncounterRole and CreatureRoadmap;
- NarrativeDetailTier;
- HazardType and Complexity;
- Readiness and ReviewState;
- MutationOrigin;
- GenerationRunState.

### Task 1.3 — Encounter Brief

Implement:

- PartySnapshot;
- capability checklist plus notes;
- target threat/custom XP;
- creative fields;
- ContentBoundaries;
- Brief/Constraints revisions;
- Generation Assumptions;
- checklist query with impact guidance.

Ensure agent-editable and GM-owned fields are explicit in command validation.

### Task 1.4 — Official encounter math

Pure functions:

```swift
baseBudget(for: ThreatTarget)
partyAdjustedBudget(...)
creatureXP(componentLevel:partyLevel:)
hazardXP(level:partyLevel:complexity:)
phaseXP(...)
peakActiveXP(...)
totalEncounterXP(...)
baseXPAward(...)
inferredThreat(...)
```

Tests:

- all threat bands;
- party sizes 1–8;
- relative levels −4 through +4;
- below-range trivial Hazards;
- Simple/Complex Hazard table values;
- base award remains unchanged by party-size adjustment;
- custom XP target.

### Task 1.5 — Composition model

Implement ParticipantGroup, embedded Creature snapshot reference, NPC Profile link, Hazard references, Faction, Participation, starting area, tactics, morale, and phase membership.

Repeated groups use quantity; named leaders are separate.

### Task 1.6 — Phase model and calculations

Implement structured triggers, active components, terrain changes, and guidance.

Derive:

- guaranteed XP;
- avoidable XP;
- conditional/reinforcement XP;
- per-phase XP;
- Peak Active XP;
- Total Encounter XP;
- overlap warnings.

### Task 1.7 — Encounter Packet model

Implement semantic sections and required-section validation.

Keep read-aloud, Alternative Resolutions, reward guidance, and map attachment optional.

### Task 1.8 — Validation split

Implement two output types:

```swift
StructuralError
DesignWarning
```

No heuristic guidance may block mutation unless the data is structurally unusable.

### Task 1.9 — Revisioned commands

Create `SidekickDMCommands`:

```text
create encounter
update GM-owned brief
update creative brief
add/update/remove component
upsert phase
set packet sections
begin/finish/cancel generation
mark reviewed
undo/redo
```

Every success increments one Encounter Revision.

### Task 1.10 — Generation Run

Requirements:

- only one active run;
- opening snapshot;
- run ID;
- manual-write lock flag;
- live mutation activity;
- finish collapses to one history entry;
- cancel restores exact opening state;
- reload/interruption state serializable;
- later targeted mutations remain separate.

### Task 1.11 — Atomic history

A snapshot-based stack is acceptable for POC simplicity.

Tests:

- one command = one Undo;
- finished run = one Undo;
- cancel does not create post-run state;
- new mutation after Undo clears Redo;
- derived calculations restore exactly.

## M2 — Catalog generator and search

Priority: P0  
Exit: deterministic normalized static data can be searched and embedded without Foundry runtime types.

### Task 2.1 — Define Catalog DTOs

- CatalogEntrySummary;
- CatalogCreature;
- CatalogHazard;
- ContentID;
- CatalogProvenance;
- Completeness and support status;
- current/legacy/adventure variant markers.

### Task 2.2 — Implement ContentID

Deterministic identity:

```text
kind/source-slug/stable-slug/edition-or-variant
```

Retain upstream Foundry UUID separately.

### Task 2.3 — Import Foundry creature actors

Normalize:

- identity/source;
- level, rarity, size, traits;
- perception/senses/languages/skills;
- AC, saves, HP, immunities/weaknesses/resistances;
- speeds;
- Strikes;
- spellcasting for existing creatures;
- game-facing actions/reactions/passives;
- safe text.

Do not attempt to preserve rule-element automation.

### Task 2.4 — Import hazards

Normalize:

- Simple/Complex;
- trap/environmental/haunt;
- detection/Stealth;
- Disable Methods;
- defenses;
- trigger/effect;
- routine/actions for Complex Hazards;
- reset;
- provenance.

### Task 2.5 — Safe markup normalization

Implement an allowlisted text/markup representation. Reject:

- scripts;
- event handlers;
- remote embeds;
- unsafe URLs;
- arbitrary styles.

### Task 2.6 — Completeness validation

Entries that cannot be normalized completely remain searchable as `partial` with missing-field diagnostics but cannot be used directly in a ready Encounter.

### Task 2.7 — Preferred variants

Preserve distinct variants. Mark one preferred current entry; default search filters to current/complete/supported.

### Task 2.8 — Deterministic fixture

Output:

```text
Web/Public/data/sidekickdm-catalog.v1.json
Web/Public/data/NOTICE.txt
Web/Public/data/catalog-manifest.v1.json
```

Manifest records generator/source revisions, counts, level coverage, publications, and license metadata.

### Task 2.9 — Search engine

In-memory index supporting accepted filters, compact results, limit 20/max 50, offset pagination. Start with normalized substring/token matching and deterministic ranking; no vector search.

### Task 2.10 — Fixture tests

- deterministic bytes/order;
- unique ContentIDs;
- no images/tokens;
- safe markup only;
- required notice/provenance fields;
- expected level/environment/role counts;
- valid detail decode.

## M3 — Durable JSON and IndexedDB

Priority: P0  
Exit: encounters/components survive reload and round-trip through v1 files.

### Task 3.1 — Implement contract DTOs

Implement `docs/contracts/sidekick-dm-json-v1.md` as explicit versioned DTOs separate from internal domain models.

### Task 3.2 — Migration layer

```swift
protocol SidekickDMMigration {
  var fromVersion: Int { get }
  var toVersion: Int { get }
  func migrate(_ value: JSONValue) throws -> JSONValue
}
```

Unknown future major version fails before writes.

### Task 3.3 — Browser persistence adapter

IndexedDB stores:

- encounters;
- creatures;
- NPC profiles;
- Hazards;
- Party Profiles;
- attachments;
- metadata.

Structural mutations save immediately; narrative text debounces.

### Task 3.4 — Transactional import

1. read/decompress;
2. validate envelope/version;
3. migrate;
4. decode and validate all objects;
5. remap colliding local IDs;
6. commit one IndexedDB transaction;
7. report result.

No partial imports.

### Task 3.5 — Self-contained export

Embed all used component snapshots and provenance. Generate plain JSON without attachments or ZIP with `attachments/`.

### Task 3.6 — Reload semantics

Persist current state and active Generation opening snapshot. On reload:

- mark active run interrupted;
- offer retain/finish-manually/cancel;
- do not restore normal Undo/Redo stack.

## M4 — Swift/Wasm manual Encounter Builder

Priority: P0  
Exit: complete standalone manual encounter creation works in target Chromium.

### Task 4.1 — App shell and routing

Views:

- Encounter Library;
- Encounter Builder;
- Creature Builder;
- Hazard Builder;
- reusable component library;
- print view;
- About/notices.

### Task 4.2 — Encounter Library

Search/list by title, level, threat, tags, modified date. Actions: new, duplicate, import, export, delete (human only).

### Task 4.3 — Brief/checklist panel

Inputs for required party facts and optional guidance. Content Boundaries get an explicit human-owned visual treatment.

### Task 4.4 — Persistent budget/readiness panel

Always display accepted distinct calculations and warnings. Never label advisory guidance as authoritative.

### Task 4.5 — Catalog panel

Search, filters, summaries, detail, add group, quantity, Weak/Elite, fork.

### Task 4.6 — Roster editor

Edit groups, factions, participation, placement, tactics, morale, NPC profile tier, and phase membership.

### Task 4.7 — Phase editor

Create triggers, active components, terrain changes, and guidance. Visualize per-phase and Peak Active XP.

### Task 4.8 — Packet editor

Semantic section forms with presence/readiness feedback. Separate immediately apparent/discoverable/secret information.

### Task 4.9 — Autosave and status

Compact `saving / saved / error` status. No manual Save requirement.

### Task 4.10 — Accessibility baseline

Semantic controls, labels, keyboard operation, focus movement, status announcements, and sensible contrast. No certification matrix.

## M5 — Creature, NPC, and Hazard builders

Priority: P0  
Exit: one original Creature and one original Simple Hazard can be created manually and used in a ready Encounter.

### Task 5.1 — Benchmark table module

Encode official-style benchmark ranges and helper queries across supported levels.

### Task 5.2 — Creature Roadmap presets

Implement recommended bands for initial roles/roadmaps. Preserve manual override.

### Task 5.3 — Creature stat editor

Show selected band, expected range, actual value, and warnings. Support existing, adjusted, forked, original provenance.

### Task 5.4 — Structured ability editor

Action cost, traits, trigger, requirements, target/range/area, resolution, DC, damage, conditions, duration, frequency, effect text.

### Task 5.5 — Holistic warnings

Start with explicit heuristics:

- extreme defenses combined;
- extreme attack + damage;
- strong mobility/reach/reaction combination;
- strong control with no frequency limit;
- solo boss action-economy warning;
- too much complexity for a large group.

### Task 5.6 — Existing spellcaster fork rule

Preserve spell block. Disable/flag spell-list generation editing. Allow non-spell fields and narrative edits.

### Task 5.7 — NPC Profile editor

Progressive disclosure by narrative tier. Incidental fields minimal.

### Task 5.8 — Simple Hazard editor

Builder for identity, detection, multiple Disable Methods, defenses, trigger/effect, structured resolution/damage/conditions, reset, and integration notes.

### Task 5.9 — Existing Complex Hazard viewer

Render routine/actions and allow encounter placement, but no create-new flow.

## M6 — Print and file UX

Priority: P0  
Exit: a durable and printable Encounter Packet works without external data.

### Task 6.1 — Print projection

Order content for table use:

1. summary/budget/warnings;
2. setup/battlefield;
3. phases/tactics;
4. participant stat blocks and NPC notes;
5. Hazards;
6. outcomes/rewards/alternatives;
7. source/notices.

### Task 6.2 — Print CSS

Avoid split headings/stat blocks where practical; hide editing controls; repeat encounter title/page headers.

### Task 6.3 — Import/export UI

One Encounter, selected reusable components, whole library; JSON or ZIP. Present migration/ID remap results.

### Task 6.4 — Notices

About view and export/print notice assembly from embedded provenance.

## M7 — WebMCP read/query bridge

Priority: P0  
Exit: external agent can understand the current Brief, encounter, budget, Catalog, and readiness.

### Task 7.1 — Tiny TypeScript adapter

Responsibilities only:

- feature detection;
- register/unregister;
- JS/Swift callback bridge;
- AbortSignal propagation;
- JSON serialization boundary.

No product logic.

### Task 7.2 — Swift adapter and response envelope

Implement protocol version, revisions, structured errors, read-only/untrusted annotations.

### Task 7.3 — P0 read tools

Implement the P0 set from the contract first. Add full detail tools only after agent exploration works.

### Task 7.4 — No-WebMCP behavior

Manual app unchanged; show a small unavailable status.

### Task 7.5 — Bridge tests

Invoke the same Swift handlers through test JS callbacks. Verify compact outputs and error mapping.

## M8 — Generation Run and composition tools

Priority: P0  
Exit: accepted agent definition of done works end-to-end.

### Task 8.1 — Begin/finish/cancel tools

Enforce current Encounter, Brief, and Constraints revisions. Content-boundary acknowledgement is required.

### Task 8.2 — Live run UI

- visible run banner;
- manual write lock;
- activity stream;
- Finish manually;
- Cancel;
- interrupted recovery.

### Task 8.3 — Catalog composition tool

Add Existing Participant Group with quantity, adjustment, faction, participation, role, placement, tactics, and morale.

### Task 8.4 — Custom Creature validation/commit

Two-step flow; combined validate-and-create only with no structural errors.

### Task 8.5 — NPC and Hazard tools

Upsert brief NPC profile; validate/create Simple Hazard; add Existing Hazard.

### Task 8.6 — Packet section tools

Implement semantic section replacement/update with constraints revision.

### Task 8.7 — Phase tool

Upsert structured Phase and recalculate math.

### Task 8.8 — Removal and revision

Allow visible/undoable component removal. Do not expose library deletion/reset.

### Task 8.9 — Finish readiness

Warnings never block finish. Structural errors may result in `incomplete draft` rather than pretending ready.

### Task 8.10 — Post-run targeted revisions

Each revision is a separate history entry and marked `changed by agent` at component/section level.

### Task 8.11 — Whole-run Undo

One Undo after finish restores the pre-run Encounter exactly.

## M9 — Tests, CI, deployment, and demo

Priority: P0  
Exit: one command builds deployable static assets and both accepted scenarios are repeatable.

### Task 9.1 — Native test matrix

Complete domain, math, builder validation, generation, history, migration, and Catalog tests.

### Task 9.2 — Wasm smoke test

- page loads;
- Catalog loads;
- new Encounter initializes;
- real budget calculation renders;
- IndexedDB adapter opens.

### Task 9.3 — Manual E2E

Automate the complete manual definition of done.

### Task 9.4 — WebMCP bridge E2E

Automate:

1. Brief read;
2. begin run;
3. Catalog search;
4. existing participant add;
5. custom Creature create;
6. Hazard create;
7. packet sections;
8. finish;
9. targeted edit;
10. Undo;
11. whole-run Undo/cancel.

Where actual browser-host agent behavior cannot be automated, maintain a deterministic manual acceptance script.

### Task 9.5 — CI

```text
swift test
catalog generate + verify
Wasm build
static build
browser smoke
manual builder E2E
WebMCP bridge E2E
```

### Task 9.6 — Static deployment

Deploy only HTML/CSS/JS/Wasm/static Catalog/notices. Confirm no runtime API requests after load.

### Task 9.7 — Demo fixture

Prepare one deterministic Brief with:

- party level/size/capabilities;
- clear constraints;
- enough missing optional information for the agent to ask 2–3 useful questions;
- Catalog entries suitable for one Existing group;
- room for one custom leader and one Simple Hazard;
- a visible but non-blocking budget/synergy warning;
- one compelling targeted revision;
- reliable Undo moment.

## 2. Suggested repository shape

```text
SidekickDM/
├── Package.swift
├── CONTEXT.md
├── docs/
│   ├── adr/
│   ├── design/
│   ├── plans/
│   ├── contracts/
│   └── compatibility/
├── Sources/
│   ├── SidekickDMCore/
│   ├── SidekickDMCatalog/
│   ├── SidekickDMWeb/
│   └── GenerateSidekickDMCatalog/
├── Tests/
│   ├── SidekickDMCoreTests/
│   ├── SidekickDMCatalogTests/
│   └── SidekickDMContractTests/
└── Web/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── src/
    │   ├── bootstrap.ts
    │   └── webmcp-bridge.ts
    ├── styles/
    └── Public/
        ├── data/
        └── notices/
```

## 3. P0 cut strategy

When behind schedule, cut in this order:

1. Reduce Catalog publications/count.
2. Reduce visual polish.
3. Reduce Creature roadmap presets.
4. Reduce advisory warning heuristics.
5. Keep only one existing Complex Hazard example.
6. Omit Alternative Resolution UI while preserving DTO.
7. Omit map attachment UI while preserving Battlefield Brief.
8. Reduce reusable component library polish.

Do not cut:

- correct budget math;
- standalone manual builder;
- one custom Creature;
- one custom Simple Hazard;
- structured Encounter Packet;
- Generation Run begin/finish/cancel;
- existing Catalog search/add;
- custom Creature/Hazard agent creation;
- revision checks;
- atomic Undo;
- persistence and export;
- content-boundary checks.

## 4. Explicit stretch backlog

- Alternative Resolution authoring polish;
- Victory Point/Influence runner;
- agent-created map attachment workflow;
- custom Complex Hazards;
- custom spellcasting;
- treasure generator;
- random manual encounter generator;
- Foundry export;
- campaign folders;
- full Catalog;
- player handouts;
- mobile layout;
- cloud sync/collaboration;
- conventional external MCP server wrapping the same command layer.

## 5. Final acceptance checklist

### Architecture

- [ ] Static HTTPS, no application backend.
- [ ] Swift/Wasm owns core domain and primary UI state.
- [ ] WebMCP adapter contains no game logic.
- [ ] Manual app works when WebMCP is absent.

### Math

- [ ] Threat and party-size budgets match golden rules fixtures.
- [ ] Creature and Hazard XP correct.
- [ ] Peak/Total/conditional values distinct.
- [ ] Base XP Award not incorrectly party-adjusted.
- [ ] Budget deviations never blocked.

### Manual builder

- [ ] Party/Brief checklist.
- [ ] Catalog search and group composition.
- [ ] Weak/Elite.
- [ ] Fork/original Creature.
- [ ] Brief NPC Profile.
- [ ] Simple Hazard.
- [ ] Phase editor.
- [ ] Required Packet sections.
- [ ] Autosave/reload.
- [ ] Print and JSON export.

### Agent

- [ ] Reads Brief and constraints.
- [ ] Searches Catalog.
- [ ] Begins Generation Run with revision acknowledgement.
- [ ] Adds Existing group.
- [ ] Creates original Creature or combat NPC.
- [ ] Creates Simple Hazard.
- [ ] Authors setup/tactics/cohesion/motivations/outcomes.
- [ ] Finishes with warnings preserved.
- [ ] GM review status shown.
- [ ] Targeted edit visible and undoable.
- [ ] Whole run cancels/undos atomically.

### Content and release

- [ ] Catalog normalized, deterministic, and curated.
- [ ] ContentID/provenance present.
- [ ] No art/tokens.
- [ ] Applicable notices in app, exports, print.
- [ ] Final per-source release notice audit complete.

When the P0 checklist is green, freeze scope and rehearse the demo.
