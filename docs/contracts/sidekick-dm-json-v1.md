# Sidekick DM JSON Contract v1

Status: POC durable-file and persistence contract  
Format name: `sidekickdm`  
Format version: `1`  
Primary extensions: `.sidekickdm.json`, `.sidekickdm.zip`

## 1. Goals

The JSON format must:

- survive without a backend or installed Catalog;
- support one Encounter, selected reusable components, or a whole library;
- embed Component Snapshots required to run an exported Encounter;
- retain Catalog Provenance and agent/GM origin;
- support known-version migration;
- reject unknown future major versions safely;
- exclude derived budget/readiness results as authoritative persisted state;
- permit attachments without making them required to run the Encounter.

## 2. Common envelope

```json
{
  "format": "sidekickdm",
  "format_version": 1,
  "export_kind": "encounter",
  "exported_at": "2026-08-28T12:00:00Z",
  "generator": {
    "product": "Sidekick DM",
    "version": "0.1.0"
  },
  "license_notices": [],
  "data": {}
}
```

`export_kind`:

```text
encounter
components
library
```

## 3. Identity and timestamps

- Local IDs are opaque strings with type prefixes (`enc_`, `cmp_`, `cre_`, `haz_`, `npc_`, `party_`, `phase_`, `att_`).
- Import collision behavior creates new local IDs and preserves original IDs under import provenance.
- Timestamps are UTC RFC 3339 strings.
- Catalog `ContentID` values are semantic strings and are not replaced on import.

## 4. Encounter export

Conceptual root:

```json
{
  "object_type": "encounter",
  "object_version": 1,
  "encounter": {},
  "embedded_components": {
    "creatures": [],
    "npc_profiles": [],
    "hazards": []
  },
  "attachments": []
}
```

### 4.1 Encounter

```json
{
  "id": "enc_01J...",
  "object_version": 1,
  "created_at": "...",
  "modified_at": "...",
  "title": "The Bell Beneath Blackwater",
  "tags": ["swamp", "ambush"],
  "brief": {},
  "participant_groups": [],
  "npc_only_participants": [],
  "hazards": [],
  "phases": [],
  "packet": {},
  "generation_metadata": {},
  "review_state": "needed",
  "provenance": {}
}
```

Encounter Revision and derived validation/budget values are runtime state and need not be preserved in portable exports. IndexedDB records may store the local revision used for concurrency.

## 5. Encounter Brief

```json
{
  "object_version": 1,
  "party": {
    "effective_level": 5,
    "size": 5,
    "mixed_level_notes": null,
    "allied_combatants": [],
    "capabilities": {
      "strengths": ["melee_pressure", "healing"],
      "weaknesses": ["ranged_pressure"],
      "notes": ""
    },
    "player_experience": "experienced",
    "resource_state": "mostly_fresh"
  },
  "threat_target": {
    "kind": "severe",
    "custom_xp": null
  },
  "creative": {
    "purpose": "Guard the entrance to the flooded shrine",
    "premise": "...",
    "theme": ["swamp", "cult"],
    "environment": "Flooded ruin",
    "tone": ["tense", "mysterious"],
    "desired_complexity": "moderate",
    "existing_vs_custom": "mixed",
    "preferred_traits": [],
    "excluded_traits": [],
    "source_restrictions": [],
    "approximate_play_minutes": 60
  },
  "content_boundaries": {
    "lines": [],
    "veils": [],
    "excluded_themes": [],
    "tone_limits": {
      "gore": "low",
      "horror": "moderate",
      "cruelty": "low"
    },
    "notes": ""
  },
  "generation_assumptions": []
}
```

## 6. Participant Group

```json
{
  "id": "cmp_...",
  "object_version": 1,
  "creature_snapshot_id": "cre_...",
  "quantity": 3,
  "adjustment": "normal",
  "faction": "primary_opposition",
  "participation": {
    "mode": "mandatory",
    "condition": null
  },
  "encounter_role": "skirmisher",
  "narrative_tier": "incidental",
  "npc_profile_id": null,
  "starting_area": "Eastern pools",
  "tactics": {
    "opening": "...",
    "ongoing": "...",
    "coordination": "..."
  },
  "morale": "Flee after their leader falls.",
  "phase_ids": ["phase_1"],
  "provenance": {
    "origin": "webmcp",
    "generation_run_id": "run_..."
  }
}
```

`faction`:

```text
party
primary_opposition
secondary_opposition
allied
neutral
```

`participation.mode`:

```text
mandatory
avoidable
conditional
reinforcement
```

## 7. Creature snapshot

```json
{
  "id": "cre_...",
  "object_version": 1,
  "origin": "forked",
  "based_on": {
    "content_id": "creature/monster-core/example/current",
    "catalog_fixture_version": 1
  },
  "identity": {
    "name": "Mire Bell Captain",
    "level": 6,
    "rarity": "uncommon",
    "size": "medium",
    "traits": ["humanoid"],
    "concept": "A drowned cult enforcer",
    "roadmap": "soldier",
    "encounter_role": "leader"
  },
  "perception": { "band": "high", "value": 17 },
  "senses": [],
  "languages": ["Common"],
  "skills": [],
  "defenses": {
    "ac": { "band": "high", "value": 24 },
    "fortitude": { "band": "high", "value": 17 },
    "reflex": { "band": "moderate", "value": 14 },
    "will": { "band": "moderate", "value": 14 },
    "hp": { "band": "moderate", "value": 95 },
    "immunities": [],
    "weaknesses": [],
    "resistances": []
  },
  "speeds": [{ "type": "land", "feet": 25 }],
  "strikes": [],
  "abilities": [],
  "spellcasting": {
    "status": "preserved_existing",
    "blocks": []
  },
  "tactics": "...",
  "morale": "...",
  "catalog_provenance": {},
  "content_provenance": {
    "origin": "webmcp",
    "created_at": "..."
  }
}
```

`origin`:

```text
existing
adjusted
forked
original
```

### 7.1 Strike

```json
{
  "id": "strike_1",
  "name": "Hooked spear",
  "action_cost": 1,
  "traits": ["reach"],
  "attack": { "band": "high", "value": 17 },
  "damage": [
    { "expression": "2d8+7", "type": "piercing" }
  ],
  "effect": ""
}
```

### 7.2 Ability

```json
{
  "id": "ability_1",
  "name": "Drag Under",
  "kind": "action",
  "action_cost": 2,
  "traits": ["attack"],
  "trigger": null,
  "requirements": "Target is adjacent to water.",
  "target": "one creature",
  "range": null,
  "area": null,
  "resolution": {
    "type": "save",
    "save": "fortitude",
    "dc": { "band": "high", "value": 24 }
  },
  "damage": [],
  "conditions": ["prone"],
  "duration": null,
  "frequency": "once per round",
  "effect_text": "..."
}
```

Abilities are descriptive/validated, not executable automation.

## 8. NPC Profile

```json
{
  "id": "npc_...",
  "object_version": 1,
  "tier": "supporting",
  "name": "Captain Varo",
  "encounter_purpose": "Commands the smugglers",
  "appearance_hook": "Keeps one glove dry at all times",
  "voice_manner": "Clipped and suspicious",
  "immediate_goal": "Protect the shipment",
  "deeper_motivation": "Escape debt to the cult",
  "fear": "Being abandoned by the crew",
  "leverage": "The crew has not been paid",
  "knowledge": [
    { "topic": "cult route", "state": "knows_but_conceals", "text": "..." }
  ],
  "attitude": "hostile",
  "combat_objective": "Delay the party",
  "morale_exit": "Surrenders when isolated",
  "peaceful_response": "Will negotiate if shown proof of betrayal",
  "future_consequence": ""
}
```

Knowledge state:

```text
knows_and_will_tell
knows_but_conceals
believes_incorrectly
does_not_know
```

## 9. Hazard snapshot

```json
{
  "id": "haz_...",
  "object_version": 1,
  "origin": "original",
  "based_on": null,
  "identity": {
    "name": "Mire Bell Snare",
    "level": 4,
    "type": "trap",
    "complexity": "simple",
    "traits": ["mechanical"]
  },
  "description": "...",
  "detection": {
    "kind": "stealth_dc",
    "band": "high",
    "value": 22,
    "minimum_proficiency": "trained"
  },
  "disable_methods": [
    {
      "skill": "Thievery",
      "dc": 20,
      "requirements": "thieves' tools",
      "success": "...",
      "failure": "...",
      "critical_failure": "Triggers a reduced effect."
    }
  ],
  "defenses": null,
  "trigger": "A creature crosses the submerged chain.",
  "effect": {
    "resolution": {
      "type": "save",
      "save": "reflex",
      "dc": { "band": "high", "value": 22 }
    },
    "damage": [{ "expression": "2d8", "type": "bludgeoning" }],
    "conditions": ["prone"],
    "text": "..."
  },
  "reset": "Manual reset takes 10 minutes.",
  "catalog_provenance": null,
  "content_provenance": { "origin": "webmcp" }
}
```

Existing Complex Hazards additionally preserve initiative, routine, actions, and partial-disable information. Custom v1 Hazards must be simple.

## 10. Phase

```json
{
  "id": "phase_...",
  "object_version": 1,
  "order": 1,
  "title": "The bell is rung",
  "trigger": {
    "type": "alarm_raised",
    "value": null,
    "description": "Begins when any cultist reaches the hanging bell."
  },
  "active_participant_group_ids": ["cmp_..."],
  "active_hazard_ids": ["haz_..."],
  "terrain_changes": ["The east gate closes."],
  "running_guidance": "..."
}
```

Trigger types:

```text
round_reached
participant_hp_threshold
alarm_raised
zone_entered
hazard_disabled
objective_completed
gm_triggered
custom
```

## 11. Encounter Packet

```json
{
  "object_version": 1,
  "identity": {
    "premise": "...",
    "objective": "...",
    "stakes": "..."
  },
  "setup": {
    "trigger": "...",
    "battlefield_description": "...",
    "starting_positions": "...",
    "awareness_state": "...",
    "immediate_features": [],
    "read_aloud": null
  },
  "battlefield": {
    "dimensions": "...",
    "zones": [],
    "elevations": [],
    "cover": [],
    "concealment": [],
    "difficult_terrain": [],
    "entry_points": [],
    "escape_routes": [],
    "interactive_objects": [],
    "hazard_placement": [],
    "recommended_distances": [],
    "map_generation_prompt": null,
    "attachment_id": null
  },
  "running_guidance": {
    "opening_tactics": "...",
    "ongoing_tactics": "...",
    "coordination_conflict": "...",
    "triggers_reinforcements": "...",
    "morale_summary": "...",
    "adjudication_issues": []
  },
  "cohesion": {
    "participant_presence": "...",
    "relationships": "...",
    "hazard_terrain_fit": "...",
    "theme": "..."
  },
  "information": {
    "immediately_apparent": [],
    "discoverable": [],
    "gm_secret": []
  },
  "outcomes": {
    "victory": "...",
    "partial_success": null,
    "failure": "...",
    "party_retreat": null,
    "enemy_surrender": "...",
    "enemy_escape": null,
    "long_term_consequence": "..."
  },
  "reward_guidance": null,
  "alternative_resolutions": []
}
```

## 12. Alternative Resolution

```json
{
  "id": "alt_...",
  "title": "Turn the crew against the captain",
  "availability": "Learn that wages were stolen.",
  "objective": "Convince the crew to abandon the captain.",
  "approaches": [
    {
      "skill": "Diplomacy",
      "dc": 22,
      "requirements": null,
      "notes": "..."
    }
  ],
  "progress": {
    "model": "victory_points",
    "success_threshold": 4,
    "failure_threshold": 3
  },
  "combat_impact": "Two participants leave; captain begins frightened 1.",
  "success": "...",
  "failure": "Combat starts with enemies prepared."
}
```

This is preparation data, not an executable subsystem.

## 13. Provenance

### 13.1 Catalog provenance

```json
{
  "content_id": "creature/monster-core/example/current",
  "source_title": "Monster Core",
  "source_page": 123,
  "edition": "current",
  "upstream": {
    "system": "foundryvtt-pf2e",
    "identifier": "Compendium.pf2e..."
  },
  "license_basis": ["ORC", "Paizo community-use/fan-content policy"],
  "notices": []
}
```

### 13.2 Generated provenance

```json
{
  "origin": "webmcp",
  "generation_run_id": "run_...",
  "created_at": "...",
  "last_changed_by": "gm"
}
```

Provenance records origin; it does not make ownership/legal conclusions.

## 14. Attachments

JSON references attachment metadata only:

```json
{
  "id": "att_...",
  "kind": "battle_map",
  "filename": "blackwater-map.webp",
  "media_type": "image/webp",
  "sha256": "...",
  "required": false,
  "description": "Agent-generated encounter map"
}
```

In `.sidekickdm.zip`, files live under `attachments/`. Missing optional attachments never make the Encounter unrunnable.

## 15. Library export

```json
{
  "object_type": "library",
  "object_version": 1,
  "encounters": [],
  "creatures": [],
  "npc_profiles": [],
  "hazards": [],
  "party_profiles": [],
  "attachments": []
}
```

Library organization is intentionally flat in v1. Tags and modified timestamps support search. Folders/campaigns are not part of the contract.

## 16. Derived fields excluded from durable authority

Do not persist as authoritative truth:

- construction budget;
- inferred threat;
- creature/hazard XP totals;
- Peak Active XP;
- Total Encounter XP;
- readiness;
- validation errors/warnings;
- search indexes.

They may appear in caches or print snapshots but are recalculated from authored state.

## 17. Migration behavior

- `format_version: 1` is accepted.
- Known older versions are migrated through explicit pure transformations.
- Unknown future major versions are rejected without writing any local records.
- Import validation completes before committing IndexedDB changes.
- ID collisions create copies with new local IDs by default.
- Imports never destructively merge or replace existing records in v1.

## 18. Text and markup safety

- Imported HTML is not stored/rendered verbatim.
- Normalize to plain text or an allowlisted markup AST.
- Reject scripts, event attributes, remote embeds, inline styles, and unsafe URLs.
- Preserve paragraphs, lists, emphasis, safe tables, and game-facing references where practical.

## 19. File notices

Each export envelope can include notices required by the content it embeds. Print/JSON/ZIP should preserve:

- unofficial product notice;
- applicable ORC notice;
- applicable Paizo community-use/fan-content notice;
- source publication/provenance;
- Foundry extraction attribution where applicable;
- no art/token license claims unless an attachment was independently cleared.
