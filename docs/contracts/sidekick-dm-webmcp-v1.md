# Sidekick DM WebMCP Contract v1

Status: POC contract  
Protocol version: `1`  
Tool prefix: `sidekickdm_`  
Transport surface: browser WebMCP (`document.modelContext`)  
Authoritative implementation: Swift `SidekickDMCore` command/query layer

## 1. Contract goals

This contract lets an external agent inspect, compose, and revise a Sidekick DM Encounter Draft without exposing arbitrary object mutation or internal engine serialization.

The contract is:

- semantic rather than JSON Patch-based;
- revision-checked;
- compact by default;
- explicit about Generation Run lifecycle;
- explicit about content constraints;
- usable without a conventional MCP server;
- a progressive enhancement over the manual application.

## 2. Common response envelope

Successful response:

```json
{
  "protocol_version": 1,
  "encounter_revision": 12,
  "constraints_revision": 4,
  "generation_run_id": "run_01J...",
  "ok": true,
  "data": {}
}
```

`generation_run_id` is omitted when no run is active.

Expected domain failure:

```json
{
  "protocol_version": 1,
  "encounter_revision": 13,
  "constraints_revision": 4,
  "ok": false,
  "error": {
    "code": "stale_revision",
    "message": "The encounter changed after it was inspected.",
    "details": {
      "expected_revision": 12,
      "current_revision": 13
    },
    "recovery": "Read the encounter summary again before retrying."
  }
}
```

Unexpected programming faults may reject/throw. Expected domain failures return the envelope.

## 3. Mutation preconditions

Every mutation requires:

```json
{
  "encounter_id": "enc_...",
  "expected_encounter_revision": 12
}
```

Every agent-authored content mutation additionally requires:

```json
{
  "expected_constraints_revision": 4
}
```

During a Generation Run, every mutation additionally requires:

```json
{
  "generation_run_id": "run_..."
}
```

Rules:

1. Check encounter identity.
2. Check Encounter Revision.
3. Check Constraints Revision where required.
4. Check active Generation Run identity where required.
5. Validate the complete semantic command.
6. Apply atomically or leave state unchanged.
7. Increment Encounter Revision exactly once on success.

## 4. Provenance and trust

- Catalog descriptions and user/agent-authored text are untrusted content.
- Read tools that return such text should use `untrustedContentHint` where the implementation supports it.
- Read-only tools set `readOnlyHint: true`.
- Tool descriptions never include catalog/user text.
- Sidekick DM does not expose internal effects, Foundry rule elements, persistence records, or arbitrary engine serialization.
- Cross-origin exposure is not part of v1.

## 5. Error vocabulary

Initial expected codes:

```text
stale_revision
stale_constraints
unknown_encounter
unknown_component
unknown_catalog_entry
catalog_entry_partial
invalid_party_profile
invalid_threat_target
invalid_participant_group
invalid_quantity
invalid_creature_stat_block
invalid_hazard
invalid_phase
invalid_packet_section
unsupported_spellcasting_generation
unsupported_complex_hazard_generation
content_constraint_not_acknowledged
no_active_generation
wrong_generation_run
generation_already_active
generation_interrupted
manual_write_locked
nothing_to_undo
nothing_to_redo
future_schema_version
```

Errors may add structured `field_errors`, `warnings`, and recovery hints.

## 6. Read tools

### 6.1 `sidekickdm_get_capabilities`

Purpose: identify app, protocol, catalog, and optional feature support.

Input:

```json
{}
```

Output data:

```json
{
  "product": "Sidekick DM",
  "protocol_version": 1,
  "webmcp_available": true,
  "features": {
    "custom_creatures": true,
    "custom_simple_hazards": true,
    "custom_complex_hazards": false,
    "custom_spellcasting": false,
    "alternative_resolutions": true,
    "map_attachments": true
  },
  "catalog": {
    "fixture_version": 1,
    "party_level_focus": [1, 10]
  }
}
```

### 6.2 `sidekickdm_get_encounter_summary`

Purpose: compact current state without full prose or stat blocks.

Input:

```json
{ "encounter_id": "enc_..." }
```

Output includes:

- title/premise summary;
- Party Snapshot summary;
- target and inferred threat;
- budget summary;
- participant/hazard/phase summaries;
- readiness and review state;
- active/interrupted Generation Run state;
- revisions.

### 6.3 `sidekickdm_get_encounter_brief`

Returns the full Encounter Brief, Party Snapshot, creative preferences, assumptions, and Content Boundaries. It is read-only to the agent for human-owned fields.

### 6.4 `sidekickdm_get_brief_checklist`

Returns checklist items:

```json
{
  "items": [
    {
      "field": "environment",
      "status": "missing",
      "required": false,
      "agent_editable": true,
      "impact": "Helps choose fitting creatures, hazards, and terrain."
    }
  ]
}
```

### 6.5 `sidekickdm_get_budget`

Returns:

```json
{
  "target_threat": "severe",
  "base_target_xp": 120,
  "party_size_adjustment": 30,
  "construction_budget": 150,
  "guaranteed_xp": 90,
  "avoidable_xp": 8,
  "conditional_xp": 40,
  "peak_active_xp": 130,
  "total_encounter_xp": 138,
  "base_xp_award": 120,
  "terrain_adjustment": 0,
  "inferred_threat": "severe",
  "warnings": []
}
```

### 6.6 `sidekickdm_get_readiness`

Returns structural errors, design warnings, missing required packet sections, and review state.

### 6.7 `sidekickdm_get_encounter_packet`

Returns the full GM-facing packet projection, optionally limited by sections.

Input:

```json
{
  "encounter_id": "enc_...",
  "sections": ["setup", "running_guidance", "outcomes"]
}
```

Omitting `sections` returns all packet content. Full component stat blocks are represented by summaries and IDs; use `get_component` for detail unless `include_stat_blocks: true` is explicitly requested.

### 6.8 `sidekickdm_get_component`

Input:

```json
{
  "encounter_id": "enc_...",
  "component_id": "cmp_..."
}
```

Returns one Participant Group, Creature snapshot, NPC Profile, Hazard, Phase, or Alternative Resolution.

## 7. Catalog tools

### 7.1 `sidekickdm_search_catalog`

Input schema:

```json
{
  "query": "bog swamp",
  "kind": "creature",
  "level_min": 2,
  "level_max": 6,
  "traits": ["amphibious"],
  "rarity": ["common", "uncommon"],
  "sources": [],
  "environments": ["swamp"],
  "roles": ["skirmisher"],
  "edition": "current",
  "spellcasting": null,
  "hazard_complexity": null,
  "completeness": "complete",
  "limit": 20,
  "offset": 0
}
```

All fields are optional. Limits: default 20, maximum 50.

Result item:

```json
{
  "content_id": "creature/monster-core/bog-strider/current",
  "kind": "creature",
  "name": "Bog Strider",
  "level": 5,
  "traits": ["amphibious", "fey"],
  "rarity": "uncommon",
  "source": "Monster Core",
  "edition": "current",
  "spellcasting": false,
  "completeness": "complete",
  "summary": "A mobile swamp skirmisher..."
}
```

### 7.2 `sidekickdm_get_catalog_entry`

Input:

```json
{ "content_id": "creature/monster-core/bog-strider/current" }
```

Returns the normalized full game-facing entry and Catalog Provenance. No Foundry implementation internals.

### 7.3 `sidekickdm_get_creature_benchmarks`

Input:

```json
{
  "level": 5,
  "statistics": ["ac", "attack", "damage", "hp", "saves", "dc"]
}
```

Returns official-style benchmark bands used by the Creature Builder.

### 7.4 `sidekickdm_get_hazard_benchmarks`

Input:

```json
{
  "level": 5,
  "complexity": "simple",
  "statistics": ["stealth", "disable_dc", "attack", "dc", "damage"]
}
```

## 8. Generation lifecycle tools

### 8.1 `sidekickdm_preflight_generation`

Read-only. Estimates an outline without mutation.

Input:

```json
{
  "encounter_id": "enc_...",
  "planned_participants": [
    { "level": 4, "quantity": 2, "participation": "mandatory" }
  ],
  "planned_hazards": [
    { "level": 3, "complexity": "simple", "participation": "avoidable" }
  ],
  "planned_phases": 1
}
```

Returns estimated budget and warnings.

### 8.2 `sidekickdm_begin_generation`

Input:

```json
{
  "encounter_id": "enc_...",
  "expected_encounter_revision": 5,
  "expected_brief_revision": 3,
  "expected_constraints_revision": 4,
  "content_boundaries_acknowledged": true,
  "intent_summary": "Create a severe swamp ambush with one custom leader."
}
```

Output includes new `generation_run_id`, opening revision, and current checklist/readiness.

### 8.3 `sidekickdm_finish_generation`

Input:

```json
{
  "encounter_id": "enc_...",
  "generation_run_id": "run_...",
  "expected_encounter_revision": 19,
  "expected_constraints_revision": 4,
  "completion_note": "Encounter is complete; budget warnings retained."
}
```

Finishes if no structural error prevents serialization/running. Warnings do not block. The run collapses into one history entry and review state becomes `needed`.

### 8.4 `sidekickdm_cancel_generation`

Restores the opening snapshot atomically.

Input:

```json
{
  "encounter_id": "enc_...",
  "generation_run_id": "run_...",
  "expected_encounter_revision": 19
}
```

## 9. Brief and assumption tools

### 9.1 `sidekickdm_set_generation_assumptions`

Sets concise assumptions invented because optional Brief fields were omitted.

Input:

```json
{
  "encounter_id": "enc_...",
  "generation_run_id": "run_...",
  "expected_encounter_revision": 6,
  "expected_constraints_revision": 4,
  "assumptions": [
    "The encounter occurs in a flooded ruin.",
    "The GM prefers a tactically mobile fight."
  ]
}
```

### 9.2 `sidekickdm_update_creative_brief`

Agent-editable fields only: purpose, premise, theme, environment, tone, complexity preference, existing/custom preference, approximate play time, preferred/excluded ordinary creative tags when not part of human-owned constraints.

Attempting to modify party facts or Content Boundaries returns `content_constraint_not_acknowledged` or an agent-ownership error.

## 10. Composition tools

### 10.1 `sidekickdm_add_existing_participant_group`

Input:

```json
{
  "encounter_id": "enc_...",
  "generation_run_id": "run_...",
  "expected_encounter_revision": 7,
  "expected_constraints_revision": 4,
  "content_id": "creature/monster-core/bog-strider/current",
  "quantity": 2,
  "adjustment": "normal",
  "faction": "primary_opposition",
  "participation": { "mode": "mandatory" },
  "encounter_role": "skirmisher",
  "narrative_tier": "incidental",
  "starting_area": "Shallow pools on the east side",
  "shared_tactics": "Circle isolated targets and use the water as cover.",
  "morale": "Flee when their leader falls."
}
```

`adjustment`: `weak | normal | elite`.

### 10.2 `sidekickdm_fork_existing_creature`

Creates a custom Creature draft from a Catalog Entry. Existing spellcasting blocks may be preserved but not regenerated.

### 10.3 `sidekickdm_validate_custom_creature`

Read-only validation of a complete or partial Creature DTO. Returns structural errors, band deviations, and holistic warnings without adding it.

### 10.4 `sidekickdm_create_custom_creature`

Creates and adds an Original or Forked Creature. May combine validation and commit only when there are no structural errors.

Input contains:

- identity/concept;
- level/rarity/size/traits;
- Roadmap and Encounter Role;
- benchmark band/value statistics;
- senses/languages/skills;
- defenses, HP, immunities/weaknesses/resistances;
- Speeds;
- Strikes;
- structured abilities;
- tactics/morale;
- provenance (`original` or `forked`).

### 10.5 `sidekickdm_update_creature`

Typed partial update to one encounter-embedded custom Creature. Editing an Existing/Adjusted Creature first converts it to Forked.

### 10.6 `sidekickdm_upsert_npc_profile`

Creates or updates the profile associated with a participant or a noncombat NPC component.

Minimum incidental fields:

- encounter purpose;
- one-line motivation;
- morale/exit condition.

### 10.7 `sidekickdm_add_existing_hazard`

Adds a normalized Catalog Hazard with participation mode, placement, and optional phase assignment.

### 10.8 `sidekickdm_validate_simple_hazard`

Read-only validation of a Simple Hazard DTO.

### 10.9 `sidekickdm_create_simple_hazard`

Creates and adds a trap/environmental/haunt Simple Hazard. Custom Complex Hazard creation is rejected with `unsupported_complex_hazard_generation`.

### 10.10 `sidekickdm_update_hazard`

Typed partial update to an embedded custom Hazard. Editing an Existing Hazard forks it.

### 10.11 `sidekickdm_remove_component`

Removes a participant group, NPC-only component, Hazard, Phase, or Alternative Resolution. It never deletes reusable library records.

### 10.12 `sidekickdm_upsert_phase`

Input contains:

- phase ID if updating;
- title/order;
- structured trigger;
- active participant IDs;
- active Hazard IDs;
- terrain changes;
- running guidance.

The command validates references and recalculates phase/peak math.

## 11. Encounter Packet tools

All replace/update a semantic section, not arbitrary strings elsewhere.

### 11.1 `sidekickdm_set_encounter_identity`

Fields: title, premise, objective, stakes.

### 11.2 `sidekickdm_set_setup`

Fields: trigger, battlefield description, starting positions, awareness/detection, immediate features, optional read-aloud text.

### 11.3 `sidekickdm_set_battlefield_guidance`

Fields: dimensions, zones, elevations, cover, concealment, difficult terrain, entry points, escape routes, interactive objects, hazard placement, recommended distances, optional map prompt.

### 11.4 `sidekickdm_set_running_guidance`

Fields: opening tactics, ongoing tactics, participant coordination/conflict, triggers/reinforcements, morale summary, adjudication issues.

### 11.5 `sidekickdm_set_cohesion`

Fields: why participants are present, relationships, why hazards/terrain fit, encounter-theme explanation.

### 11.6 `sidekickdm_set_outcomes`

Fields are independently optional except success and at least one failure/aftermath branch:

- victory;
- partial success;
- failure;
- party retreat;
- enemy surrender;
- enemy escape;
- long-term consequence.

### 11.7 `sidekickdm_set_reward_guidance`

Optional narrative/accomplishment/treasure suggestions. This is not a full treasure generator.

### 11.8 `sidekickdm_set_alternative_resolutions`

Adds/replaces optional structured alternatives containing availability, objective, approaches, checks/DCs, progress model, combat impact, success, and failure consequences. No subsystem execution is provided.

## 12. History tools

### 12.1 `sidekickdm_undo`

Outside an active Generation Run, undoes one atomic history entry. A finished Generation Run is one entry.

### 12.2 `sidekickdm_redo`

Reapplies one undone entry. A new mutation after Undo clears the redo branch.

Resetting an Encounter or deleting library records is not exposed through WebMCP v1.

## 13. Tool registration lifecycle

- Register tools when an Encounter is active.
- Tie registrations to an `AbortController`/document lifetime.
- Read tools remain available during a Generation Run.
- Manual writes are disabled during a run, but WebMCP run mutations remain registered.
- If WebMCP is unavailable, the app shows status and does not fail initialization.

## 14. P0 tool set

If hackathon time forces cuts, preserve in order:

```text
get_capabilities
get_encounter_summary
get_encounter_brief
get_brief_checklist
get_budget
get_readiness
search_catalog
get_catalog_entry
begin_generation
add_existing_participant_group
validate_custom_creature
create_custom_creature
validate_simple_hazard
create_simple_hazard
set_encounter_identity
set_setup
set_running_guidance
set_cohesion
set_outcomes
finish_generation
cancel_generation
undo
redo
```

Other detail tools may be implemented as compact extensions after the full acceptance flow works.
