import XCTest
@testable import SidekickDMCore

final class CatalogTests: XCTestCase {
    func testFixtureIsVersionedSortedAndProvenanced() {
        let catalog = CatalogFixture.demo()
        XCTAssertEqual(catalog.fixtureVersion, 1)
        XCTAssertEqual(catalog.entries.map { $0.summary.contentID }, catalog.entries.map { $0.summary.contentID }.sorted())
        XCTAssertEqual(Set(catalog.entries.map { $0.summary.contentID }).count, catalog.entries.count)
        for entry in catalog.entries {
            XCTAssertFalse(entry.summary.contentID.isEmpty)
            XCTAssertFalse(entry.provenance.sourceTitle.isEmpty)
            XCTAssertFalse(entry.provenance.upstreamIdentifier.isEmpty)
            XCTAssertEqual(entry.provenance.licenseBasis, "ORC")
            XCTAssertTrue(entry.summary.completeness == .complete)
            XCTAssertTrue(entry.summary.support == .supported)
        }
    }

    func testSearchUsesAcceptedFiltersRankingAndPagination() {
        let catalog = CatalogFixture.demo()
        let ranked = catalog.search(CatalogSearchRequest(query: "bog swamp", kind: .creature))
        XCTAssertEqual(ranked.results.first?.name, "Bog Strider")
        XCTAssertEqual(ranked.limit, 20)

        let hazards = catalog.search(CatalogSearchRequest(kind: .hazard, traits: ["TRAP"], environments: ["urban"], hazardComplexity: .simple))
        XCTAssertEqual(hazards.results.map { $0.name }, ["Electric Latch Rune"])

        let capped = catalog.search(CatalogSearchRequest(limit: 999))
        XCTAssertEqual(capped.limit, 50)
        let page = catalog.search(CatalogSearchRequest(kind: .creature, limit: 1, offset: 1))
        XCTAssertEqual(page.offset, 1)
        XCTAssertEqual(page.results.count, 1)
        XCTAssertFalse(page.hasMore)
    }

    func testGeneratorContentIDsAreStableAndSearchable() {
        let provenance = CatalogProvenance(sourceTitle: "Test Source", upstreamPack: "test-pack", upstreamIdentifier: "test-creature", sourceSHA256: String(repeating: "a", count: 64))
        let record = CatalogSourceRecord(kind: .creature, sourceSlug: "Test Pack", stableSlug: "Rain Crawler", name: "Rain Crawler", level: 2, traits: ["aquatic"], source: "Test Source", summary: "A test creature.", environments: ["aquatic"], roles: [.skirmisher], spellcasting: false, provenance: provenance)
        let catalog = CatalogGenerator.generate([record], sourceRevision: "fixture")
        XCTAssertEqual(catalog.entries.first?.summary.contentID, "creature/test-pack/rain-crawler/current")
        XCTAssertEqual(catalog.search(CatalogSearchRequest(environments: ["aquatic"])).total, 1)
    }

    func testCatalogSnapshotRejectsCallerSpoofedMetadata() throws {
        let catalog = CatalogFixture.demo()
        let snapshot = try XCTUnwrap(catalog.authoritativeSnapshot(for: "creature/monster-core/bog-strider/current"))
        try catalog.validate(snapshot: snapshot, for: snapshot.contentID)

        var spoofed = snapshot
        spoofed.summary.name = "Spoofed Creature"
        XCTAssertThrowsError(try catalog.validate(snapshot: spoofed, for: snapshot.contentID)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "catalog_snapshot_mismatch")
        }
        XCTAssertFalse(catalog.matches(snapshot: spoofed, for: snapshot.contentID))

        let store = CatalogCompositionStore(catalog: catalog)
        XCTAssertThrowsError(try store.addExistingCreature(contentID: snapshot.contentID, catalogSnapshot: spoofed)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "catalog_snapshot_mismatch")
        }
        XCTAssertTrue(store.draft.participantGroups.isEmpty)
    }

    func testExistingCreatureCompositionRejectsIncompleteAndUpdatesXP() throws {
        let catalog = CatalogFixture.demo()
        let store = CatalogCompositionStore(catalog: catalog, draft: EncounterDraft(brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 5, size: 4))))
        let groupID = try store.addExistingCreature(contentID: "creature/monster-core/bog-strider/current", quantity: 2)
        XCTAssertEqual(store.draft.participantGroups.first?.id, groupID)
        XCTAssertEqual(store.budget.guaranteedXP, 80)

        try store.updateParticipantGroup(id: groupID, quantity: 1, adjustment: .elite, expectedRevision: 1)
        XCTAssertEqual(store.budget.guaranteedXP, 60)
        XCTAssertThrowsError(try store.addExistingCreature(contentID: "hazard/gm-core/electric-latch-rune/current")) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "invalid_participant_kind")
        }
        XCTAssertThrowsError(try store.addExistingCreature(contentID: "missing")) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "unknown_catalog_entry")
        }
        XCTAssertThrowsError(try store.addExistingCreature(contentID: "creature/monster-core/bog-strider/current", quantity: 0)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "invalid_quantity")
        }

        let partialSummary = CatalogEntrySummary(contentID: "creature/test/partial/current", kind: .creature, name: "Partial Creature", level: 5, source: "Test", completeness: .partial, support: .unsupported, summary: "Missing required rules text.")
        let partialProvenance = CatalogProvenance(sourceTitle: "Test", upstreamPack: "test", upstreamIdentifier: "partial", sourceSHA256: String(repeating: "b", count: 64))
        let partialCatalog = SidekickCatalog(sourceRevision: "fixture", entries: [.creature(CatalogCreature(summary: partialSummary, provenance: partialProvenance))])
        let partialStore = CatalogCompositionStore(catalog: partialCatalog)
        XCTAssertThrowsError(try partialStore.addExistingCreature(contentID: partialSummary.contentID)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "catalog_entry_partial")
        }
    }

    func testCompositionRevisionUndoRedoAndReload() throws {
        let catalog = CatalogFixture.demo()
        let store = CatalogCompositionStore(catalog: catalog, draft: EncounterDraft(brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 5, size: 4))))
        let groupID = try store.addExistingCreature(contentID: "creature/monster-core/goblin-warrior/current", quantity: 2)
        XCTAssertTrue(store.canUndo)
        let encoded = store.encodedState
        try store.undo(expectedRevision: 1)
        XCTAssertTrue(store.draft.participantGroups.isEmpty)
        try store.redo(expectedRevision: 1)
        XCTAssertEqual(store.draft.participantGroups.first?.id, groupID)

        let reloaded = CatalogCompositionStore(catalog: catalog)
        try reloaded.reload(from: encoded)
        XCTAssertEqual(reloaded.draft.participantGroups, store.draft.participantGroups)
        XCTAssertEqual(reloaded.draft.revision, 1)
        XCTAssertTrue(reloaded.canUndo)
    }

    func testSharedCommandBoundaryValidatesCatalogSnapshotAndUpdatesParticipant() throws {
        let partialSummary = CatalogEntrySummary(contentID: "creature/test/partial/current", kind: .creature, name: "Partial", level: 5, source: "Test", completeness: .partial, support: .unsupported, summary: "Missing required rules text.")
        let partialProvenance = CatalogProvenance(sourceTitle: "Test", upstreamPack: "test", upstreamIdentifier: "partial", sourceSHA256: String(repeating: "b", count: 64))
        let demo = CatalogFixture.demo()
        let catalog = SidekickCatalog(sourceRevision: demo.sourceRevision, entries: demo.entries + [.creature(CatalogCreature(summary: partialSummary, provenance: partialProvenance))])
        let store = EncounterStore(draft: EncounterDraft(brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 5, size: 4))), catalog: catalog)
        let entry: [String: Any] = ["kind": "creature", "name": "Bog Strider", "level": 5, "completeness": "complete", "support": "supported"]
        try SidekickCommandExecutor.execute(["command": "sidekickdm_add_existing_participant_group", "content_id": "creature/monster-core/bog-strider/current", "catalog_entry": entry, "quantity": 2, "adjustment": "normal", "expected_revision": 0], in: store)
        XCTAssertEqual(store.draft.participantGroups.first?.name, "Bog Strider")
        XCTAssertEqual(store.budget.guaranteedXP, 80)

        let id = try XCTUnwrap(store.draft.participantGroups.first?.id)
        try SidekickCommandExecutor.execute(["command": "sidekickdm_update_participant_group", "component_id": id, "quantity": 1, "adjustment": "elite", "expected_revision": 1], in: store)
        XCTAssertEqual(store.draft.revision, 2)
        XCTAssertEqual(store.budget.guaranteedXP, 60)

        let incomplete: [String: Any] = ["kind": "creature", "name": "Partial", "level": 5, "completeness": "partial", "support": "unsupported"]
        XCTAssertThrowsError(try SidekickCommandExecutor.execute(["command": "sidekickdm_add_existing_participant_group", "content_id": "creature/test/partial/current", "catalog_entry": incomplete, "expected_revision": 2], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "catalog_entry_partial")
        }
        XCTAssertEqual(store.draft.revision, 2)
        XCTAssertEqual(store.draft.participantGroups.count, 1)
    }

    func testSharedCommandBoundaryRejectsEverySpoofedCatalogIdentityFieldAtomically() throws {
        let catalog = CatalogFixture.demo()
        let contentID = "creature/monster-core/bog-strider/current"
        let base: [String: Any] = [
            "content_id": contentID,
            "kind": "creature",
            "name": "Bog Strider",
            "level": 5,
            "completeness": "complete",
            "support": "supported",
            "provenance": [
                "source_title": "Pathfinder Monster Core",
                "edition": "current",
                "upstream": ["system": "foundryvtt-pf2e", "pack": "pathfinder-monster-core", "identifier": "bog-strider"],
                "source_sha256": String(repeating: "0", count: 64),
                "license_basis": "ORC",
                "notices": ["ORC"],
                "diagnostics": []
            ]
        ]
        let mutations: [(String, ([String: Any]) -> [String: Any])] = [
            ("content_id", { var value = $0; value["content_id"] = "creature/monster-core/goblin-warrior/current"; return value }),
            ("name", { var value = $0; value["name"] = "Spoofed Creature"; return value }),
            ("level", { var value = $0; value["level"] = 99; return value }),
            ("completeness", { var value = $0; value["completeness"] = "partial"; return value }),
            ("support", { var value = $0; value["support"] = "unsupported"; return value }),
            ("provenance", { var value = $0; value["provenance"] = ["source_title": "Spoofed Source"]; return value })
        ]

        for (field, mutate) in mutations {
            let store = EncounterStore(catalog: catalog)
            let command: [String: Any] = ["command": "sidekickdm_add_existing_participant_group", "content_id": contentID, "catalog_entry": mutate(base), "expected_revision": 0]
            XCTAssertThrowsError(try SidekickCommandExecutor.execute(command, in: store), "\(field) spoof must fail") { error in
                XCTAssertEqual((error as? SidekickDomainError)?.code, "catalog_snapshot_mismatch")
            }
            XCTAssertEqual(store.draft.revision, 0)
            XCTAssertTrue(store.draft.participantGroups.isEmpty)
            XCTAssertTrue(store.activity.isEmpty)
        }
    }
}
