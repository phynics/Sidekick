import Foundation
import XCTest
@testable import SidekickDMCore

final class CreatureBuilderTests: XCTestCase {
    private func completeCreature() -> OriginalCreature {
        OriginalCreature(
            id: "cre_test",
            identity: CreatureIdentity(name: "Mire Captain", level: 5, rarity: "uncommon", size: "medium", traits: ["humanoid"], concept: "A drowned shrine guard", roadmap: .soldier, encounterRole: .leader),
            perception: CreatureStatistic(band: .high, value: 22),
            senses: ["darkvision"], languages: ["Common"], skills: ["Athletics": 15],
            defenses: CreatureDefenses(ac: CreatureStatistic(band: .high, value: 22), fortitude: CreatureStatistic(band: .high, value: 15), reflex: CreatureStatistic(band: .moderate, value: 12), will: CreatureStatistic(band: .moderate, value: 12), hp: CreatureStatistic(band: .moderate, value: 75)),
            speeds: ["land": 25],
            strikes: [CreatureStrike(name: "Hooked spear", actionCost: 1, attack: CreatureStatistic(band: .high, value: 15), damage: [CreatureDamage(expression: "2d8+7", type: "piercing")])],
            tactics: "Keeps enemies at reach and protects the bell.", morale: "Flees when the bell is silenced."
        )
    }

    func testCompleteOriginalCreatureUsesBenchmarkBandsAndOriginalProvenance() {
        let result = CreatureBuilder.validate(completeCreature())
        XCTAssertTrue(result.structuralErrors.isEmpty)
        XCTAssertTrue(result.benchmarkDeviations.isEmpty)
        XCTAssertTrue(result.isStructurallyReady)
        XCTAssertEqual(completeCreature().provenance.origin, "original")
    }

    func testCreateRejectsStructuralErrorsAndRetainsHolisticWarnings() throws {
        var invalid = completeCreature()
        invalid.strikes.removeAll()
        XCTAssertThrowsError(try CreatureBuilder.create(invalid)) { error in
            guard let builderError = error as? CreatureBuilderError, case .structural(let issues) = builderError else {
                return XCTFail("Expected structural validation error")
            }
            XCTAssertTrue(issues.contains { $0.field == "strikes" })
        }

        var unusual = completeCreature()
        unusual.defenses.ac = CreatureStatistic(band: .high, value: 30)
        let created = try CreatureBuilder.create(unusual, origin: "webmcp")
        XCTAssertEqual(created.provenance.mutationOrigin, "webmcp")
    }

    func testStructuralErrorsBlockButHolisticWarningsDoNot() {
        var incomplete = completeCreature()
        incomplete.strikes = []
        let blocked = CreatureBuilder.validate(incomplete)
        XCTAssertFalse(blocked.isStructurallyReady)
        XCTAssertTrue(blocked.structuralErrors.contains { $0.field == "strikes" })

        var unusual = completeCreature()
        unusual.defenses.ac = CreatureStatistic(band: .high, value: 30)
        let warning = CreatureBuilder.validate(unusual)
        XCTAssertTrue(warning.isStructurallyReady)
        XCTAssertTrue(warning.benchmarkDeviations.contains { $0.statistic == "defenses.ac" })
        XCTAssertTrue(warning.holisticWarnings.contains { $0.code == "benchmark_deviation" })
    }

    func testXPProjectionUsesRelativeLevelTableAndQuantity() {
        let projection = CreatureBuilder.projectXP(creatureLevel: 9, partyLevel: 5, quantity: 2)
        XCTAssertEqual(projection.relativeLevel, 4)
        XCTAssertEqual(projection.xpPerCreature, 160)
        XCTAssertEqual(projection.totalXP, 320)
        XCTAssertEqual(CreatureBuilder.projectXP(creatureLevel: 0, partyLevel: 5).xpPerCreature, 0)
    }

    func testRevisionUndoRedoAndPersistence() throws {
        let store = CreatureBuilderStore(creature: completeCreature())
        var edited = completeCreature(); edited.identity.name = "Edited Captain"
        XCTAssertEqual(try store.update(edited, expectedRevision: 0, origin: "webmcp"), 1)
        XCTAssertEqual(store.creature.provenance.mutationOrigin, "webmcp")
        try store.undo(expectedRevision: 1)
        XCTAssertEqual(store.creature.identity.name, "Mire Captain")
        XCTAssertTrue(store.canRedo)
        try store.redo(expectedRevision: 2)
        XCTAssertEqual(store.creature.identity.name, "Edited Captain")

        let restored = CreatureBuilderStore()
        try restored.restore(store.encodedState)
        XCTAssertEqual(restored.creature.identity.name, "Edited Captain")
        XCTAssertEqual(restored.creature.revision, 3)
        XCTAssertTrue(restored.canUndo)
    }

    func testSharedCommandCreatesAndEmbedsOriginalCreatureAtomically() throws {
        let creature = completeCreature()
        let payload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(creature)) as? [String: Any])
        let store = EncounterStore(draft: EncounterDraft(brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 5, size: 4))))
        try SidekickCommandExecutor.execute(["command": "sidekickdm_create_custom_creature", "creature": payload, "expected_revision": 0, "origin": "gm"], in: store)

        XCTAssertEqual(store.draft.revision, 1)
        XCTAssertEqual(store.draft.originalCreatures?.first?.provenance.origin, "original")
        XCTAssertEqual(store.draft.participantGroups.first?.name, "Mire Captain")
        XCTAssertEqual(store.budget.guaranteedXP, 40)
        try store.undo(expectedRevision: 1, origin: "gm")
        XCTAssertTrue(store.draft.participantGroups.isEmpty)
        XCTAssertTrue(store.draft.originalCreatures?.isEmpty ?? true)
    }

    func testSharedCommandUpdatesEmbeddedCreatureAndParticipantProjectionAtomically() throws {
        let creature = completeCreature()
        let payload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(creature)) as? [String: Any])
        let store = EncounterStore(draft: EncounterDraft(brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 5, size: 4))))
        try SidekickCommandExecutor.execute(["command": "sidekickdm_create_custom_creature", "creature": payload, "expected_revision": 0, "origin": "webmcp"], in: store)

        var revised = creature
        revised.identity.name = "Revised Captain"
        revised.identity.level = 6
        revised.tactics = "Guards the flooded bell."
        revised.morale = "Withdraws at half health."
        let revisedPayload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(revised)) as? [String: Any])
        try SidekickCommandExecutor.execute(["command": "sidekickdm_update_custom_creature", "creature": revisedPayload, "expected_revision": 1, "origin": "webmcp"], in: store)

        XCTAssertEqual(store.draft.revision, 2)
        XCTAssertEqual(store.draft.originalCreatures?.first?.identity.name, "Revised Captain")
        XCTAssertEqual(store.draft.originalCreatures?.first?.revision, 1)
        XCTAssertEqual(store.draft.originalCreatures?.first?.provenance.mutationOrigin, "webmcp")
        XCTAssertEqual(store.draft.participantGroups.first?.name, "Revised Captain")
        XCTAssertEqual(store.draft.participantGroups.first?.level, 6)
        XCTAssertEqual(store.draft.participantGroups.first?.sharedTactics, "Guards the flooded bell.")
        try store.undo(expectedRevision: 2, origin: "gm")
        XCTAssertEqual(store.draft.originalCreatures?.first?.identity.name, "Mire Captain")
        XCTAssertEqual(store.draft.participantGroups.first?.name, "Mire Captain")
    }

    func testOriginalCreatureComponentIDUsesLowestAvailableSlotAfterRemoval() throws {
        let initialGroups = [
            ParticipantGroup(id: "group_original_1", contentID: "creature/original/old/current", name: "Old", level: 1),
            ParticipantGroup(id: "group_original_2", contentID: "creature/original/other/current", name: "Other", level: 1)
        ]
        let store = EncounterStore(draft: EncounterDraft(participantGroups: initialGroups))
        try SidekickCommandExecutor.execute(["command": "sidekickdm_remove_component", "component_id": "group_original_1", "expected_revision": 0], in: store)
        let payload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(completeCreature())) as? [String: Any])

        try SidekickCommandExecutor.execute(["command": "sidekickdm_create_custom_creature", "creature": payload, "expected_revision": 1], in: store)

        XCTAssertEqual(store.draft.participantGroups.map(\.id), ["group_original_2", "group_original_1"])
    }

    func testSharedReadinessCommandReportsMalformedEmbeddedCreature() throws {
        var malformed = OriginalCreature(id: "cre_malformed")
        malformed.identity.name = ""
        let store = EncounterStore(draft: EncounterDraft(originalCreatures: [malformed]))
        try SidekickCommandExecutor.execute(["command": "sidekickdm_get_readiness", "encounter_id": store.draft.id], in: store)
        XCTAssertTrue(store.readiness.structuralErrors.contains { $0.contains("Creature name is required") })
        XCTAssertEqual(store.draft.revision, 0)
    }
}
