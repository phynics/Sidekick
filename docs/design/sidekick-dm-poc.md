# Sidekick DM — Pathfinder 2e Encounter Builder POC

Status: Accepted hackathon design  
Product: Sidekick DM  
Runtime: Static browser application  
Primary language: Swift  
Browser target: Desktop Chromium  
Agent integration: WebMCP progressive enhancement

## 1. Executive summary

Sidekick DM is a backendless Pathfinder Second Edition encounter and creature builder. Without WebMCP it is a complete manual application for configuring a party, composing a combat encounter, calculating encounter math, searching existing creatures and hazards, creating or adapting creatures, creating simple hazards and NPC profiles, writing the material needed to run the scene, autosaving locally, printing, and importing/exporting durable files.

With WebMCP available, an external agent can help the GM create a whole encounter on the spot. It can inspect the Encounter Brief and table constraints, ask high-impact questions in its host UI, search the bundled catalog, use or adapt existing creatures, create original creatures and combat NPCs, create a simple trap or hazard, author setup and running guidance, explain motivations and morale, define phases and outcomes, surface warnings, and revise the result. The generated work appears live inside the application and is grouped into an atomic `Generation Run` that can be finished or cancelled.

The product's differentiator is not another XP calculator. Existing tools already provide budget slots, creature search, weak/elite adjustments, save/print workflows, hazard support, random or theme-based rosters, and stat-block creation. Sidekick DM's core artifact is a structured, ready-to-run **Encounter Packet** that combines correct PF2 encounter math with the operational and narrative information a GM needs at the table.

## 2. Product thesis

> A real Swift/Wasm encounter-design domain can serve both a standalone GM application and an external agent through WebMCP, with no application backend.

The hackathon demonstration should make this visible:

```text
GM configures party and constraints
        ↓
Agent inspects the structured brief
        ↓
Agent searches existing options
        ↓
Agent creates/adapts participants and a hazard
        ↓
Encounter appears live while budget and warnings update
        ↓
Agent supplies setup, tactics, motivations, morale, and outcomes
        ↓
GM reviews a runnable Encounter Packet
        ↓
Targeted revision → visible provenance → Undo
```

## 3. Competitive baseline and differentiation

Current PF2 encounter tools establish the expected baseline:

- PF2Easy provides party level/size/difficulty setup, budget-constrained creature slots, powerful catalog filtering, weak/elite-style adjustments, saving, and printable encounter sheets.
- Pathbuilder Encounters exposes creatures, players, hazards, campaigns, random encounters, and stat-block import.
- Current Foundry encounter-builder modules provide automatic party detection, live budgets, hazards, weak/elite toggles, theme-driven roster generation, non-destructive previews, and scene/combat integration.
- PF2 creature tools provide benchmark bands and quick stat-block construction.

Sidekick DM must therefore differentiate on:

1. A structured Encounter Brief that lets the GM guide an agent without writing a giant prompt.
2. A complete Encounter Packet instead of only a balanced roster.
3. A shared semantic domain for manual UI and WebMCP.
4. Live, reversible whole-encounter generation.
5. First-class existing, adjusted, forked, and original creature provenance.
6. Creature, NPC, and simple-hazard authoring with benchmark validation.
7. Local-first durability without accounts or a backend.

## 4. Goals

### 4.1 Core manual goals

A GM can:

- create or select a Party Profile;
- set effective party level, size, target threat, capabilities, resource state, and content boundaries;
- search a bundled creature/hazard catalog;
- add participant groups with quantities, factions, placements, tactics, and morale;
- use catalog entries unchanged, apply Weak/Elite, or fork them into custom components;
- create an original Creature using official-style benchmark bands and roadmaps;
- create a brief NPC Profile, with deeper information only for important NPCs;
- create a custom simple trap, environmental hazard, or haunt;
- use existing complex hazards without building new ones;
- author encounter setup, battlefield guidance, cohesion, running guidance, phases, outcomes, and optional rewards;
- see target budget, adjusted construction budget, peak active XP, total encounter XP, base XP award, terrain estimate, inferred threat, readiness, errors, and warnings;
- autosave to a local Encounter Library;
- print a GM-facing Encounter Packet;
- import/export one encounter, selected reusable components, or the entire library.

### 4.2 Core agent goals

An external WebMCP agent can:

- inspect the Brief, checklist, party capabilities, content constraints, current budget, readiness, and Encounter Packet;
- ask the GM high-impact questions in the agent host UI;
- submit an optional preflight roster plan for budget feedback;
- begin a Generation Run;
- explore the Catalog independently of the active encounter;
- add an existing participant group;
- use Weak/Elite or fork an existing Creature;
- validate and create an original Creature or combat NPC;
- validate and create a simple Hazard;
- define factions, participation modes, placements, phases, and triggers;
- author the required Encounter Packet sections;
- finish or cancel the Generation Run;
- perform visible targeted revisions afterward;
- recover from stale revisions and structured domain errors;
- use Undo/Redo through the same command model.

### 4.3 Quality goals

- Correct standard PF2 encounter-budget calculations.
- Explicit separation of deterministic math from advisory guidance.
- No hidden agent-only state or mutation path.
- No arbitrary JSON patch API.
- No silently discarded invalid or partial generated work.
- No claim that a budget or heuristic guarantees encounter quality.
- No redistributed art, portraits, tokens, or maps in the initial Catalog.

## 5. Non-goals

The following are outside the core POC:

- pure social encounters as a first-class builder;
- a Victory Point or Influence subsystem runner;
- guaranteed social/skill bypasses for every encounter;
- generated battle maps;
- a map/grid editor;
- custom complex-hazard construction;
- custom spellcasting repertoire generation;
- a general item, equipment, inventory, or treasure generator;
- combat execution, initiative tracking, hit point tracking, or VTT automation;
- Foundry scene, actor, or combat export;
- random encounter generation in the manual app;
- embedded chat, model provider, API key, or prompt runner;
- cloud accounts, sync, collaboration, or server persistence;
- campaign folders and adventure planning;
- player-facing handouts;
- mobile/responsive polish;
- broad browser compatibility or PWA installation;
- full Foundry corpus distribution.

An optional `AlternativeResolution` structure and `Map Generation Prompt` exist in the domain from the beginning, but richer workflows remain stretch scope.

## 6. Technical stack

### 6.1 Browser application

- Swift 6.3+ and the matching official Swift WebAssembly SDK.
- ElementaryUI as the default declarative UI layer.
- JavaScriptKit, BridgeJS, or equivalent typed browser bindings.
- A very small TypeScript/JavaScript bootstrap and WebMCP adapter.
- Vite or equivalent static build tooling.
- IndexedDB for local durable storage.
- Browser File APIs for JSON/ZIP import/export.
- Print CSS for printable packets.
- Playwright for the browser boundary where practical.

ElementaryUI is treated as a hackathon implementation choice, not a permanent product dependency. If its early-stage limitations block delivery, only the UI/browser binding layer changes; `SidekickDMCore`, catalog contracts, persistence contracts, and WebMCP command semantics remain stable.

### 6.2 Static deployment

```text
Static HTTPS host
├── index.html
├── CSS
├── bootstrap / interop JavaScript
├── SidekickDMWeb.wasm
├── normalized catalog fixture(s)
├── license and attribution notices
└── optional demo library fixture
```

After initial static assets load, the application requires no API server or runtime external network calls.

## 7. High-level architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│                                                              │
│  ElementaryUI views ───────┐                                 │
│  WebMCP adapter ───────────┼── SidekickDMCommands            │
│  Import/export UI ─────────┘           │                     │
│                                         ▼                    │
│                                SidekickDMCore                 │
│                                ├── Encounter Draft            │
│                                ├── Encounter math             │
│                                ├── validation/readiness       │
│                                ├── Generation Run             │
│                                ├── undo/redo                   │
│                                └── projections                │
│                                         │                    │
│                ┌────────────────────────┼───────────────┐     │
│                ▼                        ▼               ▼     │
│       SidekickDMCatalog          IndexedDB adapter   Print/UI │
│       static normalized data     local library       adapters │
└──────────────────────────────────────────────────────────────┘

Native build-time tool:
Canonical source / Foundry JSON
        ↓
GenerateSidekickDMCatalog
        ↓
normalized versioned static catalog + notices
```

### 7.1 Proposed Swift targets

```text
SidekickDMCore
- domain entities
- encounter math
- creature/hazard benchmark tables
- commands and queries
- validation/readiness
- revisions and Generation Run
- export DTOs

SidekickDMCatalog
- normalized catalog types
- search and indexing
- provenance and support status

SidekickDMWeb
- ElementaryUI application
- browser application state
- IndexedDB/file/print adapters
- WebMCP Swift adapter

GenerateSidekickDMCatalog
- native CLI
- Foundry/source extraction
- normalization
- license/provenance audit data
- deterministic fixture generation
```

Do not introduce a shared cross-prototype platform framework until concrete duplication justifies it.

## 8. Core domain model

### 8.1 Encounter Draft

`EncounterDraft` is the sole source of truth. Both manual controls and WebMCP call the same semantic command layer.

Conceptual shape:

```swift
struct EncounterDraft: Codable, Identifiable {
    var id: EncounterID
    var revision: Int
    var constraintsRevision: Int
    var title: String
    var brief: EncounterBrief
    var participantGroups: [ParticipantGroup]
    var hazards: [EncounterHazard]
    var phases: [EncounterPhase]
    var packet: EncounterPacketContent
    var generation: GenerationState?
    var reviewState: ReviewState
    var provenance: ProvenanceSummary
}
```

Derived calculations—budgets, readiness, inferred threat, and warnings—are not persisted as authoritative state.

### 8.2 Encounter Brief

Required:

- effective party level;
- party size;
- intended threat or custom target XP.

Optional but agent-visible:

- purpose;
- premise/theme;
- environment;
- tone;
- party strengths and weaknesses;
- player experience;
- party resource state;
- desired complexity;
- preferred and excluded creature traits/types;
- existing-vs-custom preference;
- source restrictions;
- approximate play time;
- Lines, Veils, exclusions, and tone limits.

The UI presents a checklist. Missing optional fields include an impact explanation so an external agent can ask only the questions that materially improve generation.

Party facts and Content Boundaries remain GM-owned. The agent may edit creative Brief fields when explicitly asked, but cannot silently alter party level, party size, effective party assumptions, Lines, Veils, or exclusions.

### 8.3 Participant Group

```swift
struct ParticipantGroup: Codable, Identifiable {
    var id: ComponentID
    var creature: CreatureSnapshot
    var quantity: Int
    var adjustment: CreatureAdjustment
    var faction: Faction
    var participation: Participation
    var encounterRole: EncounterRole
    var narrativeTier: NarrativeDetailTier
    var npcProfile: NPCProfile?
    var startingArea: String?
    var tactics: RunningTactics
    var morale: String
}
```

Repeated identical opponents use one group. A named leader or mechanically different member is separate.

### 8.4 Creature provenance

A Creature snapshot declares one origin:

```text
existing
adjusted (weak or elite)
forked (based on catalog ContentID)
original
```

Encounter-local edits to an Existing or Adjusted Creature automatically create a Forked Creature. The Catalog itself is immutable at runtime.

### 8.5 NPC Profile

Every meaningful NPC may have a profile, but required depth depends on narrative tier.

Incidental minimum:

- encounter purpose;
- one-line motivation;
- morale/exit condition.

Supporting guidance:

- appearance/hook;
- tactical identity;
- response to a peaceful approach.

Prominent guidance:

- voice/manner;
- deeper goal and fear;
- leverage/weakness;
- knowledge and concealment;
- long-term consequence.

A noncombat NPC can exist without a Creature stat block. A combat-capable NPC references a Creature snapshot plus an NPC Profile.

### 8.6 Hazard

Custom core scope is Simple Hazards. Existing Complex Hazards are fully readable and usable.

A Simple Hazard requires:

- name, level, type, traits, and description;
- detection/Stealth information;
- one or more Disable Methods;
- trigger;
- effect;
- attack or save/DC and damage/conditions when applicable;
- reset or one-use status;
- defenses only when attackable.

Hazard types include trap, environmental, and haunt.

### 8.7 Phases

A Phase specifies:

- trigger type and explanation;
- active participant groups;
- active hazards;
- terrain/state changes;
- phase-specific running guidance.

Participation modes are mandatory, avoidable, conditional, and reinforcement. This allows the budget model to distinguish guaranteed, conditional, maximum, total, and peak simultaneous threat.

### 8.8 Encounter Packet content

Required for `ready` status:

```text
Identity
- title
- premise
- objective
- stakes

Setup
- encounter trigger
- battlefield description
- starting positions
- awareness/detection state
- immediate environmental features

Running Guidance
- participant roles
- opening tactics
- ongoing tactics
- coordination/conflict
- phase and reinforcement triggers
- morale/exit conditions
- likely adjudication issues

Cohesion
- why each component is present
- participant relationships
- why hazards and terrain fit

Outcomes
- success
- relevant failure/partial/retreat/surrender/escape branches
- aftermath and long-term consequences

Optional
- read-aloud text
- reward guidance
- alternative resolution
- secondary objective
- time pressure
- map attachment
```

Information may be categorized as immediately apparent, discoverable, or GM-secret.

## 9. Encounter math

Sidekick DM implements the standard PF2 encounter-budget rules, not variant Proficiency Without Level math in the POC.

### 9.1 Threat budgets

For a four-character party:

| Threat | Base budget | Per-character adjustment |
|---|---:|---:|
| Trivial | 40 XP or less | 10 XP or less |
| Low | 60 XP | 20 XP |
| Moderate | 80 XP | 20 XP |
| Severe | 120 XP | 30 XP |
| Extreme | 160 XP | 40 XP |

For each character above or below four, adjust the Construction Budget using the threat's character adjustment. The Base XP Award remains the standard four-character value.

### 9.2 Creature XP by relative level

| Relative level | XP |
|---:|---:|
| Party −4 | 10 |
| Party −3 | 15 |
| Party −2 | 20 |
| Party −1 | 30 |
| Party level | 40 |
| Party +1 | 60 |
| Party +2 | 80 |
| Party +3 | 120 |
| Party +4 | 160 |

Creatures outside the common −4 to +4 range are allowed only with explicit warnings and rule-based handling.

### 9.3 Hazards

Use the explicit remastered GM Core Hazard XP table rather than deriving values from a generic formula. This preserves the published rounding and the party-level +4 entry.

| Relative level | Simple Hazard | Complex Hazard |
|---:|---:|---:|
| Party −4 | 2 XP | 10 XP |
| Party −3 | 3 XP | 15 XP |
| Party −2 | 4 XP | 20 XP |
| Party −1 | 6 XP | 30 XP |
| Party level | 8 XP | 40 XP |
| Party +1 | 12 XP | 60 XP |
| Party +2 | 16 XP | 80 XP |
| Party +3 | 24 XP | 120 XP |
| Party +4 | 30 XP | 150 XP |

Hazards lower than party level −4 contribute no XP. Complex Hazards act in initiative with routines; Simple Hazards normally resolve once unless reset.

### 9.4 Displayed values

Never collapse encounter difficulty into one opaque score. Display separately:

- target threat budget;
- party-size-adjusted Construction Budget;
- guaranteed opposition XP;
- avoidable Hazard XP;
- conditional/reinforcement XP;
- Peak Active XP;
- Total Encounter XP;
- Base XP Award;
- optional Terrain Adjustment;
- inferred actual threat band;
- warnings.

### 9.5 Phases and waves

Two waves are not treated as identical to all opponents being active simultaneously.

Sidekick DM calculates:

- per-phase active XP;
- Peak Active XP;
- Total Encounter XP;
- possible-overlap warnings based on phase triggers and participation conditions.

### 9.6 Permissive budget policy

Over- or under-budget compositions are never blocked. The application calculates, labels, and explains the deviation. The GM retains final authority.

### 9.7 Advisory guidance

The following produce warnings, not automatic XP changes:

- superior enemy range/elevation;
- flight versus a melee-heavy party;
- forced movement into hazards;
- overlapping control effects;
- coordinated reactions;
- strong shared resistances against party strengths;
- extreme solo-boss swinginess;
- excessive participant count;
- terrain that disproportionately favors one faction.

A Terrain Adjustment may be authored explicitly, but Sidekick DM does not claim to infer an official value.

## 10. Creature Builder

### 10.1 Workflow

Use the official top-down design approach:

1. concept;
2. level and Creature Roadmap;
3. size and traits;
4. attribute emphasis;
5. Perception and senses;
6. languages and skills;
7. AC, saves, and HP;
8. immunities, weaknesses, resistances;
9. Speeds;
10. Strikes and damage;
11. special abilities;
12. holistic review.

### 10.2 Roadmaps and roles

Roadmaps recommend benchmark bands. Encounter Roles explain tactical purpose. They are recorded separately.

Initial role vocabulary:

```text
brute
soldier
defender
skirmisher
sniper
controller
support
ambusher
leader
solo boss
```

Presets accelerate work but never lock statistics.

### 10.3 Band and value

Each important statistic stores both intended band and actual value. Manual values outside the selected band are allowed with explanation/warning.

### 10.4 Minimum ready stat block

Required:

- identity, level, rarity, size, traits, concept, Roadmap, Encounter Role;
- Perception, senses, languages, and skills as applicable;
- AC, Fortitude, Reflex, Will, HP, and relevant immunities/weaknesses/resistances;
- at least one Speed;
- at least one Strike or offensive action with action cost, attack/save, and damage;
- tactics and morale.

A Creature may be incomplete while drafted but cannot be used in a ready encounter until structural requirements pass.

### 10.5 Special abilities

Abilities are structured enough to run and validate:

- name;
- action/reaction/passive;
- traits;
- trigger and requirements;
- targets, range, and area;
- attack or save/DC;
- damage and damage types;
- conditions/duration;
- frequency;
- effect text.

They remain GM-facing, not executable rules-engine definitions. Validation checks attack/DC, raw damage, action cost, frequency, and a limited set of obvious high-impact combinations. It does not claim a universal ability-balance score.

### 10.6 Spellcasters

Existing spellcasting Creatures may be used unchanged or with Weak/Elite. A fork may preserve the existing spellcasting block while other statistics and narrative are edited. Generating or substantially rebalancing spell lists is unsupported.

## 11. Hazard Builder

### 11.1 Core scope

Create Simple Hazards only. Use Existing Complex Hazards from the Catalog.

### 11.2 Builder fields

- identity and concept;
- level, type, complexity, and traits;
- detection or Stealth;
- one or more Disable Methods;
- defenses where relevant;
- trigger;
- effect;
- structured attack/save, damage, conditions, and duration;
- reset/one-use behavior;
- narrative integration with nearby participants and terrain.

### 11.3 Validation

Use official-style benchmark bands for detection, disable DCs, defenses, attack/DC, and damage. Overrides are permitted with warnings.

## 12. Existing-content Catalog

### 12.1 Source pipeline

The POC may use Foundry PF2e JSON as an extraction source, but the browser never consumes raw Foundry Actor documents.

```text
Foundry/source data
        ↓
GenerateSidekickDMCatalog
        ↓
normalized Sidekick DM DTOs
        ↓
validated static catalog fixture
        ↓
SidekickDMCatalog search/index
```

### 12.2 Identity and variants

`ContentID` is based on kind, source, stable slug, and edition/variant. Foundry UUIDs remain provenance only.

Distinct source variants are preserved. Search identifies a preferred current entry rather than merging potentially different stat blocks automatically.

### 12.3 Initial breadth

The mechanical engine supports official ranges broadly, approximately:

- party levels 1–20;
- creature/hazard benchmark levels −1 through 24 where source tables apply.

The first bundled Catalog targets useful encounters for party levels 1–10 and includes the relative levels needed for composition, approximately −1 through 13. It favors a coherent set of publications and enough environments, roles, traits, hazards, and spellcasting/non-spellcasting options to demonstrate variety.

### 12.4 Search

Filters:

- text;
- creature or hazard;
- level/range;
- traits;
- rarity;
- source;
- environment;
- Encounter Role where derived/curated;
- current, legacy, adventure-specific;
- spellcasting;
- simple/complex Hazard;
- complete/partial/support status.

Search defaults to current, complete, supported entries. Results are compact; full stat blocks require detail lookup. Default limit 20, maximum 50, offset pagination.

### 12.5 Normalization and safety

Keep game-facing mechanical/narrative data. Exclude or transform:

- images, portraits, tokens, and maps;
- Foundry sheet configuration;
- macros and rule-element automation;
- Foundry IDs as public identity;
- arbitrary HTML.

Text is normalized to plain text or a tightly restricted markup subset before rendering.

### 12.6 Provenance and release premise

Each Catalog Entry retains:

- source publication and page when available;
- current/legacy/variant status;
- upstream identifier;
- Foundry PF2e as technical extraction source when applicable;
- the applicable release/license basis and notices.

The accepted project premise is to distribute rules/content under the applicable ORC and Paizo community-use/fan-content terms. The release process still performs a final per-source notice audit. Foundry's Apache software license is not treated as the content license. No art assets are redistributed.

## 13. Generation Run

### 13.1 Lifecycle

```text
begin_generation
→ verify Encounter Revision
→ verify Brief and Constraints revisions
→ acknowledge content boundaries
→ save opening snapshot
→ issue Generation Run ID

agent mutations
→ appear immediately
→ update encounter revision
→ create live activity entries
→ GM writes are locked, reads remain available

finish_generation
→ validate structural readiness
→ preserve warnings
→ collapse the run into one Undo entry
→ mark review needed

cancel_generation
→ atomically restore opening snapshot
```

A page reload preserves the partial Draft and opening snapshot, then marks the run `interrupted`. It never resumes agent execution automatically.

### 13.2 Partial state

During a run, the encounter may be incomplete, under budget, over budget, or missing narrative sections. Structurally malformed individual mutations are rejected.

### 13.3 GM interaction

While a run is active, the GM may inspect, navigate, print the partial result, finish manually, or cancel. Manual writes are temporarily disabled for deterministic rollback.

### 13.4 Provenance

During the run, generated components/sections are marked at section level. After finish, one history entry represents the whole generation. Later targeted agent edits are immediate, separately undoable, and marked more strongly as `changed by agent`.

## 14. WebMCP behavior

WebMCP is a browser API adapter over Sidekick DM commands, not the domain implementation itself.

```text
WebMCP browser API
        ↓
webmcp-bridge.ts
        ↓
Swift SidekickDMWebMCPAdapter
        ↓
SidekickDMCommands / CatalogQueries
```

Principles:

- `sidekickdm_` tool namespace;
- protocol version in every response;
- compact query outputs, targeted detail tools;
- semantic mutations, no arbitrary JSON Patch;
- expected revisions on every mutation;
- current Constraints Revision required for agent-authored content;
- structured expected errors;
- tool text and catalog/user content marked untrusted where supported;
- no cross-origin exposure in the POC;
- no embedded agent/chat UI;
- manual feature parity when WebMCP is absent.

The full v1 contract is defined in `docs/contracts/sidekick-dm-webmcp-v1.md`.

## 15. Manual application UX

### 15.1 Main layout

```text
┌────────────────────┬────────────────────────────┬────────────────────┐
│ Brief & Budget     │ Encounter Packet           │ Catalog / Builder  │
│                    │                            │                    │
│ party checklist    │ participants and hazards   │ search             │
│ threat target      │ setup and battlefield      │ stat block detail  │
│ calculations       │ tactics and phases         │ creature builder   │
│ readiness          │ motivations and outcomes   │ hazard builder     │
├────────────────────┴────────────────────────────┴────────────────────┤
│ Generation status · Activity · Autosave · Undo/Redo                 │
└──────────────────────────────────────────────────────────────────────┘
```

Budget/readiness remain visible while editing any section.

### 15.2 Standalone parity

Without WebMCP, all of the following work manually:

- configure Party Profile and Brief;
- search the Catalog;
- compose groups and quantities;
- Weak/Elite adjustments;
- fork/create Creatures;
- create NPC Profiles;
- create Simple Hazards;
- phases and running guidance;
- local library;
- import/export;
- print.

There is no built-in random/generative button in core scope.

## 16. Persistence and files

### 16.1 IndexedDB stores

```text
encounters
creatures
npc_profiles
hazards
party_profiles
attachments
library_metadata
```

Structural commands save immediately. Narrative text uses a short debounce. Ordinary Undo/Redo is session-local; current state and an active Generation Run rollback snapshot survive reload.

### 16.2 Snapshot semantics

Encounters embed Component Snapshots and Party Snapshots. Later edits to reusable library templates do not alter prepared encounters without an explicit refresh flow.

### 16.3 Export

Supported:

- one Encounter;
- selected reusable components;
- whole library.

File forms:

```text
*.sidekickdm.json
*.sidekickdm.zip   # only when attachments are included
```

Encounter exports are self-contained and retain Catalog Provenance.

### 16.4 Print

The GM-facing print view includes:

- Brief summary;
- budget and warnings;
- setup and Battlefield Brief;
- participant and Hazard stat blocks;
- tactics, phases, morale, and motivations;
- outcomes/rewards;
- Alternative Resolutions when present;
- source and license notices.

## 17. Readiness and validation

### 17.1 Deterministic validation

- required party facts;
- encounter-budget math;
- party-size adjustment;
- Creature and Hazard XP;
- phase composition and Peak Active XP;
- unknown references;
- required stat-block mechanics;
- benchmark deviations;
- stale revisions;
- file/schema versions;
- required packet section presence.

### 17.2 Advisory guidance

- likely synergy;
- solo-boss swinginess;
- excessive participants;
- terrain mismatch;
- repetitive tactics;
- missing morale/surrender behavior;
- limited party spotlight opportunities;
- brief narrative usability.

Sidekick DM does not claim to judge whether prose is compelling or an encounter will be fun.

### 17.3 Statuses

```text
incomplete draft
ready with warnings
ready with review needed
ready to run
```

No structural errors are allowed in a ready state. Any number of acknowledged or unacknowledged warnings may remain. An agent-generated encounter is `review needed` until the GM checks one encounter-level review control.

## 18. Security and trust

- No application secrets exist in the browser.
- No remote account, auth token, or API key is stored.
- Imported text is sanitized before rendering.
- Catalog/user-authored text is treated as untrusted data for agent purposes.
- Mutations are revision-checked.
- Resetting/deleting library records remains human-only.
- Agent component removals are allowed because they are visible and undoable; library deletion is not exposed.
- Content Boundaries are versioned and human-owned.
- WebMCP is same-origin/default mediation only in the POC.

## 19. Licensing and notices

Release requirements:

- applicable ORC notice;
- applicable Paizo community-use/fan-content notice;
- unofficial-product notice and required attribution;
- source publication metadata;
- Foundry PF2e identified as an extraction source when used;
- Foundry code license retained only where Foundry code is actually reused;
- no implication that Foundry's Apache license governs Paizo content;
- no redistributed artwork or tokens;
- notices carried in app About view, catalog metadata, JSON/ZIP exports, and print output where applicable;
- final per-source notice audit before public deployment.

This document records the project owner's accepted release premise; it is not legal advice.

## 20. Testing strategy

### Native Swift tests

- threat budgets and party-size adjustments;
- creature XP tables;
- Simple/Complex Hazard XP;
- Weak/Elite effective level;
- guaranteed/conditional/Peak/Total calculations;
- phase overlap warnings;
- custom Creature benchmark validation;
- Simple Hazard validation;
- revisions and stale writes;
- Generation Run finish/cancel/interruption;
- atomic Undo/Redo;
- readiness states;
- JSON migrations.

### Catalog tests

- deterministic fixture generation;
- unique ContentIDs;
- preferred current variants;
- normalized safe markup;
- required provenance/license metadata;
- expected level/role/environment coverage;
- no images/tokens.

### Browser tests

- boot real Swift/Wasm core;
- manual encounter creation through print/export;
- IndexedDB reload behavior;
- active Generation Run interruption/cancel;
- WebMCP bridge read/mutation flow;
- no-WebMCP manual parity.

### Acceptance testing

Automate the bridge and app commands with Playwright where the browser permits. Keep a deterministic manual script for actual external-agent behavior that cannot be automated reliably in the experimental WebMCP environment.

## 21. Core definition of done

### 21.1 Manual

1. Create/select Party Profile.
2. Set target threat.
3. Search and add existing Creatures.
4. Adjust quantities and Weak/Elite state.
5. Create or fork one custom Creature.
6. Add one Simple Hazard.
7. See correct budget and readiness.
8. Write/edit all required running guidance.
9. Autosave locally and survive reload.
10. Print and export a self-contained Encounter.

### 21.2 Agent

1. Inspect Brief, checklist, and constraints.
2. Ask a small number of high-impact questions.
3. Begin a Generation Run.
4. Search existing Creatures/Hazards.
5. Add an Existing Creature group.
6. Create an Original Creature or combat NPC.
7. Create a Simple Hazard.
8. Author setup, tactics, cohesion, motivations, morale, phases, and outcomes.
9. Finish generation despite non-blocking warnings.
10. GM reviews the complete Encounter Packet.
11. Agent performs one targeted revision.
12. Undo restores the prior encounter.
13. Whole generation can be cancelled or undone atomically.
14. Encounter persists locally and can be printed/exported.

## 22. P0 cut line

Protect features in this order:

1. correct encounter math;
2. real manual encounter builder;
3. static Catalog search;
4. custom Creature Builder;
5. Simple Hazard Builder;
6. structured Encounter Packet;
7. WebMCP read tools;
8. Generation Run;
9. WebMCP composition tools;
10. provenance and atomic Undo;
11. local persistence/export/print;
12. catalog breadth and polish.

Never trade #1–#10 for broader data or visual polish.

## 23. Risks

### Swift/Wasm dependency risk

Mitigation: prove the portable core first; keep browser adapters outside core; reduce features/content rather than add a backend.

### Early UI framework risk

Mitigation: timebox ElementaryUI adoption; preserve core/contract boundaries; fall back to narrower DOM bindings.

### Catalog licensing/provenance risk

Mitigation: deterministic generator, per-entry provenance/license fields, no art, final source audit, notices included in every release surface.

### Catalog size/performance risk

Mitigation: curated party-level 1–10 fixture, compact search summaries, lazy detail decoding if necessary, static indexing.

### Agent partial-output risk

Mitigation: live Generation Run with opening snapshot, visible activity, finish/cancel, interrupted state, one-step rollback.

### False precision risk

Mitigation: separate official calculations from heuristic warnings; permissive budget policy; explicit GM review state.

### Scope explosion

Mitigation: protect the definition-of-done flow; keep maps, social subsystem runners, custom complex hazards, spell list generation, VTT export, cloud features, and full catalog outside P0.

## 24. References

- Pathfinder GM Core, Running the Game: https://2e.aonprd.com/Rules.aspx?ID=2468&NoRedirect=1
- Pathfinder GM Core, Building Games: https://2e.aonprd.com/Rules.aspx?ID=2665&NoRedirect=1
- Pathfinder GM Core, Subsystems: https://2e.aonprd.com/Rules.aspx?ID=3026&NoRedirect=1
- Pathfinder GM Core, Treasure Trove: https://2e.aonprd.com/Rules.aspx?ID=3135&NoRedirect=1
- WebMCP draft: https://webmachinelearning.github.io/webmcp/
- Swift WebAssembly SDK guide: https://swift.org/documentation/articles/wasm-getting-started.html
- ElementaryUI: https://github.com/elementary-swift/elementary-ui
- PF2Easy encounter builder: https://builder.pf2easy.com/
- Pathbuilder encounter mode: https://pathbuilder2e.com/beta/encounters.html
- Foundry PF2e Encounter Builder: https://foundryvtt.com/packages/pf2e-encounter-builder
- Foundry PF2e source: https://github.com/foundryvtt/pf2e
- Paizo licenses: https://paizo.com/licenses/
