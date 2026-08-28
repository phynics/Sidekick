# Sidekick DM

Sidekick DM is a local-first Pathfinder Second Edition encounter-design context. It exists to help a Game Master manually assemble a mechanically coherent, ready-to-run combat encounter and, when WebMCP is available, let an external agent create and revise the same encounter through semantic tools.

## Language

### Product and session

**Sidekick DM**:
The product name for the backendless Swift/Wasm encounter and creature builder.
_Avoid_: Sidekick, DM assistant, encounter AI

**GM**:
The person preparing and running the encounter. The GM owns party facts, content boundaries, final mechanical judgment, and review.
_Avoid_: User when a game-specific term is clearer, DM in domain code

**Encounter Library**:
The browser-local collection of Encounter Drafts, reusable custom Creatures, NPC Profiles, Hazards, Party Profiles, and attachments.
_Avoid_: Workspace, campaign database, cloud library

**Encounter Draft**:
The single engine-backed encounter being edited. It may be incomplete or carry warnings while being prepared.
_Avoid_: Form state, document model, generated response

**Encounter Packet**:
The ready-to-run GM-facing projection of an Encounter Draft, including setup, roster, stat blocks, hazards, tactics, motivations, phases, outcomes, rewards, and optional alternatives.
_Avoid_: Prompt output, encounter description, report

**Encounter Revision**:
A monotonically increasing local version of an Encounter Draft used to reject stale mutations.
_Avoid_: File version, schema version

**Mutation**:
One atomic, reversible change to an Encounter Draft, initiated by the GM or WebMCP.
_Avoid_: Patch, edit event

**Mutation Origin**:
The actor that initiated a Mutation: `gm` or `webmcp`.
_Avoid_: Author, owner

**Generation Run**:
A transactional period in which an external agent builds an encounter through multiple visible mutations. The run can be finished into one history entry or cancelled back to its opening snapshot.
_Avoid_: Chat session, generation request, transaction when discussing persistence

**Generation Assumption**:
A concise fact invented by the agent because the Encounter Brief omitted an optional input and the GM permitted it to proceed.
_Avoid_: Hidden prompt assumption

**Review State**:
Whether an agent-generated encounter has been explicitly reviewed by the GM.
_Avoid_: Approval workflow

### Brief and party

**Encounter Brief**:
The GM-owned design input for an encounter: party facts, target threat, creative direction, constraints, and preferences.
_Avoid_: Prompt, questionnaire

**Party Profile**:
A reusable description of party level, size, capability notes, experience, resource state, and table preferences.
_Avoid_: Character roster, party import

**Party Snapshot**:
The copy of a Party Profile stored in an Encounter Draft so later profile edits do not silently change prepared encounters.
_Avoid_: Live party reference

**Effective Party Level**:
The single level used by the standard encounter-budget calculation. Mixed-level details may be recorded as notes but do not create a second budget algorithm.
_Avoid_: Average level unless that is the GM's chosen effective value

**Threat Target**:
The desired encounter category: trivial, low, moderate, severe, extreme, or custom XP.
_Avoid_: Challenge rating, CR

**Content Boundaries**:
The GM-owned Lines, Veils, excluded themes, and tone limits the agent must inspect before authoring content.
_Avoid_: Soft preferences, safety prompt

**Constraints Revision**:
A local version that changes whenever Content Boundaries change. Agent-authored mutations must target the current revision.
_Avoid_: Encounter Revision

**Brief Checklist**:
A structured view of required and optional Encounter Brief fields, including why each missing field matters.
_Avoid_: Validation errors

### Encounter composition

**Participant**:
An entity that can take part in the encounter. A Participant may reference a Creature, an NPC Profile, or both.
_Avoid_: Monster when a mechanical term is intended

**Participant Group**:
One or more mechanically identical Participants represented by a shared Creature snapshot, quantity, faction, role, placement, tactics, and morale.
_Avoid_: Mob unless referring to fiction

**Creature**:
A Pathfinder combat stat block used by monsters, combat-capable NPCs, and similar adversaries or allies.
_Avoid_: Monster in code and contracts

**Existing Creature**:
A catalog Creature used unchanged in an encounter.
_Avoid_: Imported creature

**Adjusted Creature**:
An Existing Creature used with the official Weak or Elite adjustment.
_Avoid_: Scaled creature

**Forked Creature**:
A custom snapshot derived from an Existing Creature and retaining `based_on` provenance.
_Avoid_: Modified catalog entry

**Original Creature**:
A custom Creature built from scratch.
_Avoid_: Homebrew monster when the broader term is intended

**Creature Roadmap**:
The intended distribution of benchmark bands across a custom Creature's statistics.
_Avoid_: Encounter role

**Encounter Role**:
The Creature's tactical purpose in this encounter, such as brute, defender, skirmisher, sniper, controller, support, ambusher, leader, or solo boss.
_Avoid_: Creature Roadmap

**NPC Profile**:
The game-running narrative information for an NPC: purpose, motivation, morale, peaceful response, knowledge, and optional characterization.
_Avoid_: Backstory, influence stat block

**Narrative Detail Tier**:
The expected depth of an NPC Profile: incidental, supporting, or prominent.
_Avoid_: NPC level

**Faction**:
A participant alignment within an encounter: party, primary opposition, secondary opposition, allied, or neutral.
_Avoid_: Enemy flag

**Participation Mode**:
How a participant or hazard enters the encounter: mandatory, avoidable, conditional, or reinforcement.
_Avoid_: Optional boolean

**Phase**:
A structured stage of an encounter with a trigger, active participants, active hazards, terrain changes, and phase-specific running guidance.
_Avoid_: Round, wave when the broader concept is intended

**Phase Trigger**:
The structured condition that starts a Phase, such as a round number, HP threshold, alarm, zone entry, disabled hazard, completed objective, GM action, or custom condition.
_Avoid_: Script

### Hazards

**Hazard**:
A trap, environmental danger, haunt, or similar obstacle with Pathfinder hazard mechanics.
_Avoid_: Trap when referring to all hazard types

**Simple Hazard**:
A Hazard that normally resolves through one trigger/effect sequence unless reset.
_Avoid_: Minor hazard

**Complex Hazard**:
A Hazard that rolls initiative and follows a routine during an encounter.
_Avoid_: Boss trap

**Disable Method**:
One structured way to disable or mitigate a Hazard, including skill, DC, requirements, and consequences.
_Avoid_: Solution text

### Rules and guidance

**Construction Budget**:
The threat budget adjusted for party size and used to assemble the encounter.
_Avoid_: XP award

**Base XP Award**:
The standard four-character XP award for the encounter, kept distinct from the party-size-adjusted Construction Budget.
_Avoid_: Construction Budget

**Peak Active XP**:
The highest XP value expected to be simultaneously active in any Phase.
_Avoid_: Total Encounter XP

**Total Encounter XP**:
The XP represented across the full encounter, including separate phases and conditional components as configured.
_Avoid_: Peak Active XP

**Terrain Adjustment**:
An explicit GM- or agent-authored estimate of additional challenge from terrain. It is displayed separately and is never inferred as authoritative XP.
_Avoid_: Automatic terrain XP

**Structural Error**:
A deterministic problem that prevents a component or encounter from being runnable, such as malformed statistics, missing required mechanics, or unknown references.
_Avoid_: Warning

**Design Warning**:
Non-blocking mechanical or narrative guidance, such as budget deviation, likely synergy, swinginess, unusual benchmark combinations, or missing morale.
_Avoid_: Error, balance fact

**Readiness**:
The computed state of an Encounter Draft: incomplete draft, ready with warnings, ready with review needed, or ready to run.
_Avoid_: Validity

**Benchmark Band**:
An official-style category such as terrible, low, moderate, high, or extreme associated with a creature or hazard statistic.
_Avoid_: Proficiency rank

**Alternative Resolution**:
An optional structured way to bypass, transform, or resolve a combat encounter through social or skill-based play.
_Avoid_: Full subsystem runner

**Battlefield Brief**:
The structured textual description of zones, dimensions, entry points, elevation, cover, difficult terrain, hazard placement, interactive objects, and escape routes.
_Avoid_: Map

**Map Generation Prompt**:
An optional prompt derived from the Battlefield Brief for an external image-capable agent.
_Avoid_: Battlefield Brief

### Catalog and provenance

**Catalog**:
The bundled, normalized, static collection of Existing Creatures and Hazards available for search and reuse.
_Avoid_: Foundry compendium at runtime

**Catalog Entry**:
One normalized Creature or Hazard in the Catalog.
_Avoid_: Actor document

**ContentID**:
Sidekick DM's stable semantic identity for a Catalog Entry, independent of a Foundry document UUID.
_Avoid_: Local ID, Foundry UUID

**Catalog Provenance**:
The source publication, page when available, current/legacy status, upstream identifier, extraction source, and license basis retained for a Catalog Entry.
_Avoid_: Ownership claim

**Component Snapshot**:
The self-contained copy of a Creature, NPC Profile, or Hazard embedded in an Encounter Draft or export.
_Avoid_: Live catalog reference
