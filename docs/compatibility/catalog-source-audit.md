# PF2 catalog source audit

Status: audit-only, captured 2026-08-28. This document records what the local canonical data proves and what a future `GenerateSidekickDMCatalog` pass must still verify. Sidekick must ship normalized, static data; Foundry is an extraction source, not a runtime dependency.

## Canonical inputs

The audit uses the local `pf2e` checkout at revision `4cbdaa37d6c33e9519561bae2c59a23e0288cbce` (PF2e system 6.12.4). P0 is limited to the current remaster packs `pathfinder-monster-core`, `pathfinder-npc-core`, and the current GM Core records in `packs/hazards`. The inventory is 492, 270, and 32 records respectively. All are marked ORC/remaster in their local publication metadata.

OmenArchive and OmenTome were inspected for reusable conventions. They contain character resources and spell/feat import manifests, not creature or hazard records. Their useful conventions are source publication/page, upstream identifier, source hash, generator revision, counts, status, and diagnostics. They are not canonical PF2 creature/hazard inputs.

The rules fixture links the published GM Core encounter tables and Building Hazards tables 2-13 through 2-16. The hazard fixture stores Stealth/Disable DCs, Defenses, and Offense values for levels -1 through 13; the explicit Hazard XP table remains authoritative at +4 (150 XP for a complex hazard).

## Observed record shapes

| Target kind | Local shape | Required mapping | Risk or unknown |
| --- | --- | --- | --- |
| creature | `type: npc`; `system.details.level.value`, traits, attributes, perception, abilities, actions; top-level `items` | name, level, traits, defenses, attacks/actions, spellcasting, description, publication | NPC and monster records have no canonical role or environment field; derive only with an explicit rationale |
| hazard | `type: hazard`; `system.details.isComplex`, level, traits, publication, description, disable/reset/routine, defenses | name, level, traits, complexity, stealth/DC, defenses, trigger/effect, disable, reset/routine | some fields are optional; simple hazards do not have a routine; hazard pack mixes current ORC and legacy OGL publications |

For hazards, the concrete local paths are `system.details.level.value`, `system.details.isComplex`, `system.details.description`, `system.details.disable`, `system.details.reset`, and `system.details.routine`; `system.attributes.stealth.value`, `system.attributes.ac.value`, `system.attributes.hardness`, and `system.attributes.hp.*`; `system.saves.fortitude.value`, `system.saves.reflex.value`, and `system.saves.will.value`; and `system.traits.value`. User-facing action/effect text is nested in `items[].system.description`, with action metadata in `items[].system.actionType`, `actions`, `traits`, and `rules`. Both `system.details.publication` and nested `items[].system.publication` must be retained as provenance: the local current GM Core hazard records can contain nested action entries marked legacy OGL, so a future normalizer must review nested licenses instead of inheriting the parent publication blindly.

Concrete examples are `pf2e/packs/hazards/quicksand.json` (complex hazard with `items[0].system.description` and a nested publication object) and `pf2e/packs/hazards/electric-latch-rune.json` (simple hazard with the same defense/save paths). The selected fixture records these files and their SHA-256 values.

Foundry `_id` values and pack paths are technical provenance, not public identity. The public identity must be stable and collision-resistant: `kind/source-slug/stable-slug/edition-or-variant`. Do not merge current and legacy records or silently replace variants. A source filename is a useful deterministic slug input but must be retained alongside the normalized display name and upstream identifier.

## Completeness and normalization

An entry is `complete` only when its name, level, publication/license basis, kind, and user-facing rules text are present. Missing optional fields produce diagnostics; missing required fields produce `unsupported` with a reason. Preserve source publication and page when known, and retain `source_sha256`, source revision, generator revision, and diagnostics in the manifest.

Imported Foundry HTML must never be rendered or copied verbatim. The normalizer should convert paragraphs, lists, emphasis, tables, and references to a plain/allowlisted representation. Review or reject `@Check`, `@UUID`, `@Damage`, `@Template`, action-glyph enrichers, embedded documents, scripts, event attributes, inline styles, remote URLs, and macro/rule-element automation. Images, portraits, tokens, maps, and Foundry configuration are out of P0 scope.

The local records prove spellcasting coverage through `items` entries with `type: spellcastingEntry` (Monster Core: 215; NPC Core: 70). They do not prove that every record is normalizable. A generator must emit per-record diagnostics and fail closed for incomplete or unsafe records.

## P0 selection and gaps

P0 is the three-pack current set in [p0-catalog-selection.v1.json](./p0-catalog-selection.v1.json). The audit verifies party levels 1–10 and component levels -1–13, with both simple and complex hazards and the target trap/environmental/haunt trait families. It does not claim Creature Roadmap, Encounter Role, or environment coverage: the design vocabularies remain blocked until reviewed assignments and evidence exist. `soldier` is retained under Creature Roadmap vocabulary, not Encounter Role. Representative source hashes and paths are recorded in that fixture.

Known gaps are intentional: local JSON does not carry reliable page numbers, role/environment facets, or a universal stable slug; hazard records mix current and legacy publications; Foundry action/rule automation is not portable; and OmenArchive/OmenTome do not fill the creature/hazard gap. These are release-blocking diagnostics for any record that needs them, not reasons to fabricate metadata.

## Reproducibility

The future generator must follow the deterministic pattern already used by Foretell: typed input/output, sorted-key JSON, stable ordering, explicit source revision, and byte-for-byte verification against checked-in fixtures. It should produce the catalog, manifest, and notice file together. The current Sidekick checkout has no executable catalog scaffold, so this audit does not add one or edit shared build files.

Useful read-only checks from the repository root:

```text
git -C pf2e rev-parse HEAD
find pf2e/packs/pathfinder-monster-core -name '*.json' | wc -l
find pf2e/packs/pathfinder-npc-core -name '*.json' ! -name '_folders.json' | wc -l
find pf2e/packs/hazards -name '*.json' | wc -l
```

Follow-up owned by the catalog implementation: add a Sidekick-native generator and fixture verifier, normalize each selected record, emit deterministic `sidekickdm-catalog.v1.json`, and compare regenerated bytes. That work must avoid the FOR-30 shared scaffolding until ownership is coordinated.
