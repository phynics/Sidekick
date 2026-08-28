import XCTest
@testable import SidekickDMCore

final class CatalogTests: XCTestCase {
    func testFixtureMatchesCheckedInCatalogIdentitySet() {
        let catalog = CatalogFixture.demo()
        let expectedIDs = [
            "creature/monster-core/aapoph-granitescale/current",
            "creature/monster-core/flame-drake/current",
            "creature/monster-core/goblin-pyro/current",
            "creature/monster-core/goblin-warrior/current",
            "creature/monster-core/orc-veteran/current",
            "creature/monster-core/phantom-knight/current",
            "creature/monster-core/pixie/current",
            "creature/npc-core/ancestry-npcs-dwarf-dwarf-smith/current",
            "hazard/gm-core/bottomless-pit/current",
            "hazard/gm-core/electric-latch-rune/current",
            "hazard/gm-core/quicksand/current"
        ]
        XCTAssertEqual(catalog.sourceRevision, "4cbdaa37d6c33e9519561bae2c59a23e0288cbce")
        XCTAssertEqual(catalog.entries.map { $0.summary.contentID }, expectedIDs)
        XCTAssertEqual(catalog.entries.filter { $0.summary.kind == .creature }.count, 8)
        XCTAssertEqual(catalog.entries.filter { $0.summary.kind == .hazard }.count, 3)
        XCTAssertTrue(catalog.entries.allSatisfy { $0.provenance.sourceSHA256.count == 64 && $0.provenance.upstreamPack.hasPrefix("packs/") })
        let expectedProvenance = [
            ("creature/monster-core/aapoph-granitescale/current", "Pathfinder Monster Core", "packs/pathfinder-monster-core", "MXSKccQqbQqQ77Ii", "2bf005ec5a8fd0bcd8b171dcf7b9a3b0bd0f54a1d1fdf1b73a204a418004d589"),
            ("creature/monster-core/flame-drake/current", "Pathfinder Monster Core", "packs/pathfinder-monster-core", "qlxVPpwVFw5qIVQM", "ff80d9dfbd7c99bd65931244027f8398825011550902cc1ad3c419ac20e2c8dd"),
            ("creature/monster-core/goblin-pyro/current", "Pathfinder Monster Core", "packs/pathfinder-monster-core", "Ky5eNRvN71O0tY9l", "bdb745eb40cba6aae175a67cd2fc6b8481eaae82dd8407e8b5c8215872ddcaf4"),
            ("creature/monster-core/goblin-warrior/current", "Pathfinder Monster Core", "packs/pathfinder-monster-core", "fLLKuOXwPq1Iq0U4", "9f0204d98f439e13ff0ad4d031ed3808cd7740315a6cd6b2455ddf6600bc88db"),
            ("creature/monster-core/orc-veteran/current", "Pathfinder Monster Core", "packs/pathfinder-monster-core", "V90OYOMyyPLPJuod", "6e9f9cc200db1452f8bfc1bd8871421a9447589f4d075c524c146eb7fd77b4d3"),
            ("creature/monster-core/phantom-knight/current", "Pathfinder Monster Core", "packs/pathfinder-monster-core", "9VMoTqyVaKc4ZR4H", "fa60015e8435d1ac75d1ed7e2dd4b3cf8279b2d66ed3d9d145491417435e66ad"),
            ("creature/monster-core/pixie/current", "Pathfinder Monster Core", "packs/pathfinder-monster-core", "Ehtm5k9iBYTvSUcZ", "e43dd18cd559d89327d2178650846b78aa321a9fd6c1da288c80b586316553cd"),
            ("creature/npc-core/ancestry-npcs-dwarf-dwarf-smith/current", "Pathfinder NPC Core", "packs/pathfinder-npc-core/ancestry-npcs/dwarf", "rY3uqGq5QyvNOU91", "36c0eb72daca5d3264fb2a2397dbddc46f505e0235b7f7da63cce1062fd1d7b7"),
            ("hazard/gm-core/bottomless-pit/current", "Pathfinder GM Core", "packs/hazards", "xkqjwu1ox0pQLOnb", "f80f44bece80f639e93fde9b2bef574da49abd3fd45bd10a4ee3a1a4a112c592"),
            ("hazard/gm-core/electric-latch-rune/current", "Pathfinder GM Core", "packs/hazards", "491qhVbjsHnOuMZW", "d62280cc1300d9a6dc30f20af424348cc90f4ce7770e2591ca5e2ba53d543690"),
            ("hazard/gm-core/quicksand/current", "Pathfinder GM Core", "packs/hazards", "C6nFe8SCWJ8FmLOT", "ee56de4ac57cff87d62fe1f8a245fa2b16d472fdf4afcb15567b618f75c685d0")
        ]
        for (contentID, sourceTitle, pack, identifier, sourceSHA256) in expectedProvenance {
            guard let entry = catalog.get(contentID) else { XCTFail("Missing content ID: " + contentID); continue }
            XCTAssertEqual(entry.provenance.sourceTitle, sourceTitle)
            XCTAssertEqual(entry.provenance.upstreamPack, pack)
            XCTAssertEqual(entry.provenance.upstreamIdentifier, identifier)
            XCTAssertEqual(entry.provenance.sourceSHA256, sourceSHA256)
        }
    }

    func testEveryCreatureFixtureAcceptsAnAuthoritativeSemanticAdd() throws {
        let catalog = CatalogFixture.demo()
        for entry in catalog.entries {
            guard case .creature = entry else { continue }
            let snapshot = try XCTUnwrap(catalog.authoritativeSnapshot(for: entry.summary.contentID))
            guard let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(snapshot)) as? [String: Any], let summary = encoded["summary"] else {
                XCTFail("Could not encode " + entry.summary.contentID)
                continue
            }
            let command: [String: Any] = [
                "command": "sidekickdm_add_existing_participant_group",
                "content_id": entry.summary.contentID,
                "catalog_entry": summary,
                "quantity": 1,
                "expected_revision": 0
            ]
            let store = EncounterStore(catalog: catalog)
            XCTAssertNoThrow(try SidekickCommandExecutor.execute(command, in: store), entry.summary.contentID)
        }
    }

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
            if entry.summary.kind == .creature {
                XCTAssertEqual(entry.summary.support, .supported)
            } else {
                XCTAssertEqual(entry.summary.support, .unsupported)
            }
        }
    }

    func testSearchUsesAcceptedFiltersRankingAndPagination() {
        let catalog = CatalogFixture.demo()
        let ranked = catalog.search(CatalogSearchRequest(query: "goblin warrior", kind: .creature))
        XCTAssertEqual(ranked.results.first?.name, "Goblin Warrior")
        XCTAssertEqual(ranked.limit, 20)

        let hazards = catalog.search(CatalogSearchRequest(query: "electric", kind: .hazard, traits: ["TRAP"], environments: ["urban"], hazardComplexity: .simple, support: .unsupported))
        XCTAssertEqual(hazards.results.map { $0.name }, ["Electric Latch Rune"])

        let capped = catalog.search(CatalogSearchRequest(limit: 999))
        XCTAssertEqual(capped.limit, 50)
        let page = catalog.search(CatalogSearchRequest(kind: .creature, limit: 1, offset: 1))
        XCTAssertEqual(page.offset, 1)
        XCTAssertEqual(page.results.count, 1)
        XCTAssertTrue(page.hasMore)
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
        let snapshot = try XCTUnwrap(catalog.authoritativeSnapshot(for: "creature/monster-core/goblin-warrior/current"))
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
        let groupID = try store.addExistingCreature(contentID: "creature/monster-core/flame-drake/current", quantity: 2)
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
        XCTAssertThrowsError(try store.addExistingCreature(contentID: "creature/monster-core/flame-drake/current", quantity: 0)) { error in
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
        let entry: [String: Any] = ["kind": "creature", "name": "Flame Drake", "level": 5, "completeness": "complete", "support": "supported"]
        try SidekickCommandExecutor.execute(["command": "sidekickdm_add_existing_participant_group", "content_id": "creature/monster-core/flame-drake/current", "catalog_entry": entry, "quantity": 2, "adjustment": "normal", "expected_revision": 0], in: store)
        XCTAssertEqual(store.draft.participantGroups.first?.name, "Flame Drake")
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
        let contentID = "creature/monster-core/goblin-warrior/current"
        let base: [String: Any] = [
            "content_id": contentID,
            "kind": "creature",
            "name": "Goblin Warrior",
            "level": -1,
            "completeness": "complete",
            "support": "supported",
            "provenance": [
                "source_title": "Pathfinder Monster Core",
                "edition": "current",
                "upstream": ["system": "foundryvtt-pf2e", "pack": "packs/pathfinder-monster-core", "identifier": "fLLKuOXwPq1Iq0U4"],
                "source_sha256": "9f0204d98f439e13ff0ad4d031ed3808cd7740315a6cd6b2455ddf6600bc88db",
                "license_basis": "ORC",
                "notices": ["ORC"],
                "diagnostics": []
            ]
        ]
        let mutations: [(String, ([String: Any]) -> [String: Any])] = [
            ("content_id", { var value = $0; value["content_id"] = "creature/monster-core/flame-drake/current"; return value }),
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

    func testCatalogCompositionIDsUseLowestAvailableSlot() throws {
        let catalog = CatalogFixture.demo()
        let existing = [
            ParticipantGroup(id: "cmp_catalog_1", contentID: "creature/test/one/current", name: "One", level: 1),
            ParticipantGroup(id: "cmp_catalog_3", contentID: "creature/test/three/current", name: "Three", level: 1)
        ]
        let store = CatalogCompositionStore(catalog: catalog, draft: EncounterDraft(participantGroups: existing))

        let id = try store.addExistingCreature(contentID: "creature/monster-core/goblin-warrior/current")

        XCTAssertEqual(id, "cmp_catalog_2")
        XCTAssertEqual(store.draft.participantGroups.map(\.id), ["cmp_catalog_1", "cmp_catalog_3", "cmp_catalog_2"])
    }

    func testSharedCommandGeneratedIDsRemainCollisionSafeAfterRemovals() throws {
        let initialGroups = [
            ParticipantGroup(id: "group_1", contentID: "creature/custom/one/current", name: "One", level: 1),
            ParticipantGroup(id: "group_2", contentID: "creature/custom/two/current", name: "Two", level: 1)
        ]
        let store = EncounterStore(draft: EncounterDraft(participantGroups: initialGroups))
        try SidekickCommandExecutor.execute(["command": "sidekickdm_remove_component", "component_id": "group_1", "expected_revision": 0], in: store)
        try SidekickCommandExecutor.execute(["command": "sidekickdm_add_participant_group", "name": "Three", "level": 1, "expected_revision": 1], in: store)

        XCTAssertEqual(store.draft.participantGroups.map(\.id), ["group_2", "group_1"])
    }

    func testExistingHazardGeneratedIDsRemainCollisionSafeAfterRemovals() throws {
        let provenance = CatalogProvenance(sourceTitle: "Test Source", upstreamPack: "packs/test", upstreamIdentifier: "hazard", sourceSHA256: String(repeating: "a", count: 64))
        let contentID = "hazard/test/bell/current"
        let summary = CatalogEntrySummary(contentID: contentID, kind: .hazard, name: "Bell Snare", level: 1, source: "Test Source", hazardComplexity: .simple, support: .supported, summary: "A test hazard.")
        let catalog = SidekickCatalog(sourceRevision: "fixture", entries: [.hazard(CatalogHazard(summary: summary, provenance: provenance))])
        let store = EncounterStore(draft: EncounterDraft(hazards: [EncounterHazard(id: contentID, contentID: contentID, name: "Bell Snare", level: 1)]), catalog: catalog)

        try SidekickCommandExecutor.execute(["command": "sidekickdm_add_existing_hazard", "content_id": contentID, "expected_revision": 0], in: store)
        XCTAssertEqual(store.draft.hazards.map(\.id), [contentID, "haz_1"])
        try SidekickCommandExecutor.execute(["command": "sidekickdm_remove_component", "component_id": "haz_1", "expected_revision": 1], in: store)
        try SidekickCommandExecutor.execute(["command": "sidekickdm_add_existing_hazard", "content_id": contentID, "expected_revision": 2], in: store)

        XCTAssertEqual(store.draft.hazards.map(\.id), [contentID, "haz_1"])
    }
}
