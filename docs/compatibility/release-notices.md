# Sidekick PF2 release-notice matrix

This is an implementation checklist, not legal advice. Confirm final wording and attribution with the project owner before distribution. The P0 scope is an audit and source selection from the local Foundry PF2e system; it is not yet a generated or normalized release artifact, and it is not a Paizo or Foundry product.

| Surface | Required notice | Provenance to retain | Audit status |
| --- | --- | --- | --- |
| In-app About/help | Unofficial-product notice; Pathfinder/Paizo attribution for each included publication; ORC notice; Foundry PF2e extraction attribution; no endorsement claim | P0 source titles, edition, source revision, license basis | Required; copy cannot ship until publication attribution is confirmed |
| Catalog metadata and detail view | Source title/page when known, current/legacy/variant status, upstream pack/identifier, license basis, normalization diagnostics | `catalog-manifest.v1.json` fields and per-entry provenance | Schema defined; page metadata is missing in local JSON and must remain “not known” |
| JSON/ZIP export | Unofficial-product notice, ORC notice, Paizo attribution, Foundry extraction attribution, source provenance, and statement that no art/token/map rights are implied | Manifest plus source hashes and notices array | Required for every export |
| Print/PDF output | Same notices, visible in the document or an attached notices page; preserve source title/page | Export manifest and rendered-output provenance | Required; validate the actual renderer before release |
| Public repository/release | Full notices in release documentation and distribution archive; list the exact source revision and generated artifacts | `source_revision`, generator revision, deterministic manifest | Blocked until generator and source attribution are present |

## Notice requirements

1. State that Sidekick is an unofficial product and is not affiliated with, endorsed by, or sponsored by Paizo Inc. or Foundry VTT.
2. Include the ORC notice used by the canonical local projects: “This product is licensed under the ORC License located at the Library of Congress at TX 9-307-067 and available online at various locations including http://azoralaw.com/orclicense/ and others. All warranties are disclaimed as set forth therein.”
3. Attribute the included licensed material by its publication title: Pathfinder Monster Core, Pathfinder NPC Core, and Pathfinder GM Core. Add the copyright year, designers, and authors from the authoritative publication/license notice before release; the local Foundry records do not contain those complete attribution fields, so this audit deliberately does not invent them.
4. Identify the Foundry PF2e system as the technical extraction source and link/name the exact source revision. The Foundry Apache-2.0 notice applies only to Apache-licensed code actually reused; it does not relicense Paizo game content.
5. Do not redistribute portraits, art, tokens, maps, attachments, Foundry configuration, macros, or rule-element automation unless each asset and transformation has an independent clearance. P0 is scoped to rules/data extraction and a future normalization pass only.
6. If character data from OmenArchive/OmenTome is ever added, include its MIT/ORC notices separately. Those projects are not the source of the P0 creature/hazard records.

## Release gate

Before publishing, the generator owner must populate the notices array for every record, confirm source publication/page metadata, record the exact source and generator revisions, regenerate byte-identical catalog and manifest artifacts, and inspect app, JSON/ZIP, and print surfaces. Any missing attribution, unsafe markup, unresolved license basis, or uncleared attachment blocks release.
