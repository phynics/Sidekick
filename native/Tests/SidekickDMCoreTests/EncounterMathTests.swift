import XCTest
@testable import SidekickDMCore

final class EncounterMathTests: XCTestCase {
    private func completePacket() -> EncounterPacketContentV1 {
        EncounterPacketContentV1(
            identity: PacketIdentitySection(title: "The Bell", premise: "Cultists ring a drowned bell.", objective: "Stop the ritual.", stakes: "The shrine floods."),
            setup: PacketSetupSection(trigger: "The bell sounds.", battlefieldDescription: "A flooded shrine.", startingPositions: "The party stands at the east arch.", awarenessState: "The cultists are alert.", immediateFeatures: ["Deep water"]),
            runningGuidance: PacketRunningGuidanceSection(participantRoles: "Skirmishers screen the leader.", openingTactics: "Circle isolated targets.", ongoingTactics: "Fall back through the water.", coordinationConflict: "The leader protects the bell.", triggersReinforcements: "Reinforce when the bell cracks.", moraleSummary: "Flee when the leader falls."),
            cohesion: PacketCohesionSection(participantPresence: "The cult guards the shrine.", relationships: "The leader commands the skirmishers.", hazardTerrainFit: "The flooded floor protects the cult.", theme: "Drowned devotion."),
            information: PacketInformationSection(immediatelyApparent: ["The bell is cracked."], discoverable: ["The ritual route"], gmSecret: ["The bell hides a seal."]),
            outcomes: PacketOutcomesSection(victory: "The ritual stops.", failure: "The shrine floods.")
        )
    }
    func testGoldenThreatAndPartyAdjustments() {
        XCTAssertEqual(EncounterMath.baseBudget(for: ThreatTarget(kind: .severe)), 120)
        XCTAssertEqual(EncounterMath.partyAdjustedBudget(for: ThreatTarget(kind: .severe), partySize: 5), 150)
        XCTAssertEqual(EncounterMath.partyAdjustedBudget(for: ThreatTarget(kind: .low), partySize: 1), 0)
    }

    func testGoldenCreatureAndHazardXP() {
        XCTAssertEqual(EncounterMath.creatureXP(componentLevel: 9, partyLevel: 5), 160)
        XCTAssertEqual(EncounterMath.hazardXP(level: 9, partyLevel: 5, complexity: .simple), 30)
        XCTAssertEqual(EncounterMath.hazardXP(level: 9, partyLevel: 5, complexity: .complex), 150)
        XCTAssertEqual(EncounterMath.hazardXP(level: 0, partyLevel: 5, complexity: .simple), 0)
    }

    func testRevisionStaleUndoRedoAndRedoBranch() throws {
        let store = EncounterStore()
        try SidekickCommandExecutor.execute(["command": "sidekickdm_set_party_snapshot", "effective_level": 5, "size": 5], in: store)
        XCTAssertThrowsError(try SidekickCommandExecutor.execute(["command": "sidekickdm_set_threat_target", "kind": "severe", "expected_revision": 0], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "stale_revision")
        }
        try SidekickCommandExecutor.execute(["command": "sidekickdm_add_participant_group", "name": "Test", "level": 5, "quantity": 2, "expected_revision": 1], in: store)
        XCTAssertEqual(store.budget.guaranteedXP, 80)
        try store.undo(expectedRevision: 2, origin: "gm")
        XCTAssertTrue(store.draft.participantGroups.isEmpty)
        try store.redo(expectedRevision: 3, origin: "gm")
        XCTAssertEqual(store.draft.participantGroups.count, 1)
        try store.undo(expectedRevision: 4, origin: "gm")
        try SidekickCommandExecutor.execute(["command": "sidekickdm_set_threat_target", "kind": "low", "expected_revision": 5], in: store)
        XCTAssertThrowsError(try store.redo(expectedRevision: 6, origin: "gm")) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "nothing_to_redo")
        }
    }

    func testSharedLoadMarksPersistedActiveGenerationInterrupted() throws {
        let opening = EncounterDraft(id: "enc_reload", revision: 3)
        let openingJSON = String(data: try JSONEncoder().encode(opening), encoding: .utf8)
        var persisted = opening
        persisted.generation = GenerationState(id: "run_reload", state: "active", openingDraftJSON: openingJSON, intentSummary: "Resume the flooded shrine.")
        let persistedJSON = String(data: try JSONEncoder().encode(persisted), encoding: .utf8) ?? ""
        let store = EncounterStore()

        try SidekickCommandExecutor.execute(["command": "sidekick_load_draft", "draft_json": persistedJSON], in: store)

        XCTAssertEqual(store.draft.generation?.state, "interrupted")
        XCTAssertEqual(store.draft.generation?.id, "run_reload")
        XCTAssertEqual(store.draft.generation?.openingDraftJSON, openingJSON)
        let before = store.draft
        XCTAssertThrowsError(try SidekickCommandExecutor.execute(["command": "sidekickdm_set_party_snapshot", "effective_level": 5, "expected_revision": 3, "origin": "gm"], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "manual_write_locked")
        }
        XCTAssertEqual(store.draft, before)
    }

    func testCreateEncounterCapturesPartyAndThreatTarget() throws {
        let store = EncounterStore()
        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_create_encounter",
            "encounter_id": "enc_new",
            "title": "Flooded Shrine",
            "effective_level": 5,
            "size": 5,
            "kind": "custom",
            "custom_xp": 135
        ], in: store)

        XCTAssertEqual(store.draft.id, "enc_new")
        XCTAssertEqual(store.draft.title, "Flooded Shrine")
        XCTAssertEqual(store.draft.brief.party.effectiveLevel, 5)
        XCTAssertEqual(store.draft.brief.party.size, 5)
        XCTAssertEqual(store.draft.brief.threatTarget, ThreatTarget(kind: .custom, customXP: 135))
        XCTAssertEqual(store.draft.revision, 1)
        XCTAssertEqual(store.budget.baseTargetXP, 135)
        XCTAssertEqual(store.budget.baseXPAward, 135)
    }

    func testIntegerCommandInputsRejectFractionalAndNonFiniteValuesAtomically() throws {
        let store = EncounterStore()
        let beforeCreate = store.draft
        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekickdm_create_encounter",
            "effective_level": NSNumber(value: 4.5),
            "size": 4
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "invalid_request")
            XCTAssertEqual((error as? SidekickDomainError)?.details["field"], "effective_level")
        }
        XCTAssertEqual(store.draft, beforeCreate)

        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekickdm_add_participant_group",
            "name": "Fractional",
            "quantity": NSNumber(value: 1.5),
            "expected_revision": 0
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "invalid_request")
            XCTAssertEqual((error as? SidekickDomainError)?.details["field"], "quantity")
        }
        XCTAssertEqual(store.draft, beforeCreate)

        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekick_increment",
            "expected_revision": NSNumber(value: Double.infinity)
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "invalid_request")
            XCTAssertEqual((error as? SidekickDomainError)?.details["field"], "expected_revision")
        }
        XCTAssertEqual(store.draft, beforeCreate)
    }

    func testLoadDraftAcceptsBrowserCamelCaseNPCProfiles() throws {
        let group = ParticipantGroup(id: "group_npc", contentID: "creature/group_npc", name: "Captain", level: 5)
        let profile = NPCProfile(id: "npc_browser", participantGroupID: group.id, narrativeTier: .supporting, name: "Captain", encounterPurpose: "Guard the bell.", immediateGoal: "Delay the party.", moraleExit: "Flee when cornered.")
        var draft = EncounterDraft(id: "enc_browser", participantGroups: [group])
        draft.npcProfiles = [profile]
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(draft)) as? [String: Any])
        var profiles = try XCTUnwrap(object["npcProfiles"] as? [[String: Any]])
        var browserProfile = profiles[0]
        for (snake, camel) in [
            ("object_version", "objectVersion"), ("participant_group_id", "participantGroupID"),
            ("encounter_purpose", "encounterPurpose"), ("immediate_goal", "immediateGoal"),
            ("morale_exit", "moraleExit")
        ] {
            if let value = browserProfile.removeValue(forKey: snake) { browserProfile[camel] = value }
        }
        profiles[0] = browserProfile
        object["npcProfiles"] = profiles
        let browserJSON = String(data: try JSONSerialization.data(withJSONObject: object), encoding: .utf8)!

        let store = EncounterStore()
        XCTAssertNoThrow(try SidekickCommandExecutor.execute(["command": "sidekick_load_draft", "draft_json": browserJSON], in: store))
        XCTAssertEqual(store.draft.npcProfiles?.first?.id, "npc_browser")
        XCTAssertEqual(store.draft.npcProfiles?.first?.participantGroupID, "group_npc")
    }

    func testMalformedNestedPacketIdentityRejectsAtomically() throws {
        let packet = completePacket()
        let store = EncounterStore(draft: EncounterDraft(id: "enc_packet", packet: packet.flattenedCorePacket(), packetV1: packet))
        let before = store.draft

        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekickdm_set_encounter_identity",
            "value": ["title": "Only title"],
            "expected_revision": 0
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "invalid_packet_section")
        }
        XCTAssertEqual(store.draft, before)
    }

    func testEachSuccessfulMutationAdvancesRevisionOnce() throws {
        let store = EncounterStore()
        try SidekickCommandExecutor.execute(["command": "sidekick_increment", "expected_revision": 0], in: store)
        XCTAssertEqual(store.draft.swiftOwnedValue, 8)
        XCTAssertEqual(store.draft.revision, 1)

        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_begin_generation",
            "expected_revision": 1,
            "expected_brief_revision": 0,
            "expected_constraints_revision": 0,
            "content_boundaries_acknowledged": true,
            "origin": "webmcp",
            "generation_run_id": "run_test"
        ], in: store)
        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_add_participant_group",
            "generation_run_id": "run_test",
            "name": "Flood Cultist",
            "level": 1,
            "quantity": 1,
            "expected_revision": 2,
            "expected_constraints_revision": 0,
            "origin": "webmcp"
        ], in: store)
        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_cancel_generation",
            "generation_run_id": "run_test",
            "expected_revision": 3,
            "expected_constraints_revision": 0,
            "origin": "webmcp"
        ], in: store)

        XCTAssertEqual(store.draft.revision, 4)
        XCTAssertTrue(store.draft.participantGroups.isEmpty)
        XCTAssertNil(store.draft.generation)
    }

    func testSharedGenerationBoundaryLocksManualWritesAndKeepsTargetedAndRunUndoSeparate() throws {
        let packet = completePacket()
        let opening = EncounterDraft(id: "enc_run", briefRevision: 3, constraintsRevision: 4, packet: packet.flattenedCorePacket(), packetV1: packet)
        let store = EncounterStore(draft: opening)

        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekickdm_begin_generation",
            "encounter_id": "enc_run",
            "expected_revision": 0,
            "expected_brief_revision": 3,
            "expected_constraints_revision": 4,
            "content_boundaries_acknowledged": false,
            "origin": "webmcp"
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "content_constraint_not_acknowledged")
        }
        XCTAssertEqual(store.draft, opening)

        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_begin_generation",
            "encounter_id": "enc_run",
            "generation_run_id": "run_shared",
            "expected_revision": 0,
            "expected_brief_revision": 3,
            "expected_constraints_revision": 4,
            "content_boundaries_acknowledged": true,
            "origin": "webmcp"
        ], in: store)
        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekickdm_set_threat_target",
            "kind": "severe",
            "expected_revision": 1,
            "origin": "gm"
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "manual_write_locked")
        }

        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_add_participant_group",
            "encounter_id": "enc_run",
            "generation_run_id": "run_shared",
            "expected_revision": 1,
            "expected_constraints_revision": 4,
            "name": "Bog Strider",
            "level": 1,
            "origin": "webmcp"
        ], in: store)
        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_finish_generation",
            "encounter_id": "enc_run",
            "generation_run_id": "run_shared",
            "expected_revision": 2,
            "expected_constraints_revision": 4,
            "origin": "webmcp"
        ], in: store)
        let runResult = store.draft
        XCTAssertNil(runResult.generation)
        XCTAssertEqual(runResult.reviewState, "needed")

        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_set_encounter_identity",
            "encounter_id": "enc_run",
            "expected_revision": 3,
            "value": ["objectVersion": 1, "title": "Targeted revision", "premise": "Cultists ring a drowned bell.", "objective": "Stop the ritual.", "stakes": "The shrine floods."],
            "origin": "webmcp"
        ], in: store)
        XCTAssertEqual(store.draft.title, "Targeted revision")
        try store.undo(expectedRevision: 4, origin: "gm")
        var expectedRunResult = runResult
        expectedRunResult.revision = 5
        XCTAssertEqual(store.draft, expectedRunResult)
        try store.undo(expectedRevision: 5, origin: "gm")
        var expectedOpening = opening
        expectedOpening.revision = 6
        XCTAssertEqual(store.draft, expectedOpening)
    }

    func testSharedCommandBoundaryRequiresActiveRunAndConstraintsRevisions() throws {
        let store = EncounterStore(draft: EncounterDraft(id: "enc_guard", briefRevision: 2, constraintsRevision: 4))
        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_begin_generation", "encounter_id": "enc_guard", "generation_run_id": "run_guard",
            "expected_revision": 0, "expected_brief_revision": 2, "expected_constraints_revision": 4,
            "content_boundaries_acknowledged": true, "origin": "webmcp"
        ], in: store)

        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekickdm_add_participant_group", "encounter_id": "enc_guard",
            "expected_revision": 1, "origin": "webmcp"
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "invalid_request")
        }
        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekickdm_add_participant_group", "encounter_id": "enc_guard", "generation_run_id": "run_guard",
            "expected_revision": 1, "origin": "webmcp"
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "invalid_request")
        }
        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekickdm_add_participant_group", "encounter_id": "enc_guard", "generation_run_id": "run_guard",
            "expected_revision": 1, "expected_constraints_revision": 3, "origin": "webmcp"
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "stale_constraints")
        }
    }

    func testExplicitTargetedRevisionCommandUsesTwoUndoEntries() throws {
        let packet = completePacket()
        let store = EncounterStore(draft: EncounterDraft(id: "enc_target", briefRevision: 2, constraintsRevision: 4, packet: packet.flattenedCorePacket(), packetV1: packet))
        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_begin_generation", "encounter_id": "enc_target", "generation_run_id": "run_target",
            "expected_revision": 0, "expected_brief_revision": 2, "expected_constraints_revision": 4,
            "content_boundaries_acknowledged": true, "origin": "webmcp"
        ], in: store)
        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_finish_generation", "encounter_id": "enc_target", "generation_run_id": "run_target",
            "expected_revision": 1, "expected_constraints_revision": 4, "origin": "webmcp"
        ], in: store)
        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_apply_targeted_revision", "encounter_id": "enc_target", "expected_revision": 2,
            "section": "encounter_identity", "value": ["objectVersion": 1, "title": "Targeted", "premise": "The bell sounds.", "objective": "Stop it.", "stakes": "The flood rises."], "origin": "webmcp"
        ], in: store)
        XCTAssertEqual(store.draft.title, "Targeted")
        try store.undo(expectedRevision: 3, origin: "gm")
        XCTAssertNil(store.draft.generation)
        XCTAssertEqual(store.draft.title, "The Bell Beneath Blackwater")
        try store.undo(expectedRevision: 4, origin: "gm")
        XCTAssertEqual(store.draft.revision, 5)
        XCTAssertEqual(store.draft.title, "The Bell Beneath Blackwater")
    }
}
