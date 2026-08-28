import Foundation
import XCTest
@testable import SidekickDMCore

final class EncounterPhasesTests: XCTestCase {
    private func group(_ id: String = "group_a", mode: ParticipationMode = .mandatory) -> ParticipantGroup {
        ParticipantGroup(id: id, contentID: "creature/\(id)", name: id, level: 5, quantity: 1, participation: Participation(mode: mode))
    }

    private func hazard(_ id: String = "haz_a", mode: ParticipationMode = .avoidable) -> EncounterHazard {
        EncounterHazard(id: id, contentID: "hazard/\(id)", name: id, level: 5, participation: Participation(mode: mode))
    }

    private func phase(_ id: String, participants: [String] = ["group_a"], hazards: [String] = ["haz_a"], kind: PhaseTriggerKind = .custom) -> PhaseAuthoring {
        PhaseAuthoring(id: id, title: id, order: Int(id.split(separator: "_").last ?? "0") ?? 0, trigger: PhaseTrigger(kind: kind, explanation: "When \(id) begins"), participantIDs: participants, hazardIDs: hazards, terrainChanges: [PhaseTerrainChange(title: "Flood", description: "Water rises", affectedArea: "lower pool")], runningGuidance: "Run \(id) tactics")
    }

    func testStructuredPhaseProjectsCategoriesAndPeakWithoutRewritingTotal() throws {
        let document = PhaseAuthoringDocument(encounterID: "enc_1", title: "Shrine", partyLevel: 5, partySize: 4, participantGroups: [group(mode: .mandatory)], hazards: [hazard(mode: .reinforcement)], phases: [phase("phase_1"), phase("phase_2", participants: [], hazards: ["haz_a"])])
        let projection = PhaseAuthoringMath.project(document: document)

        XCTAssertEqual(projection.perPhase.count, 2)
        XCTAssertEqual(projection.perPhase[0].participation.mandatoryXP, 40)
        XCTAssertEqual(projection.perPhase[0].participation.reinforcementXP, 8)
        XCTAssertEqual(projection.peakActiveXP, 48)
        XCTAssertEqual(projection.totalEncounterXP, 48)
        XCTAssertEqual(projection.terrainAdjustment, 0)
        XCTAssertFalse(projection.overlapWarnings.isEmpty)
    }

    func testUnknownReferencesAreAtomic() throws {
        let store = PhaseAuthoringStore(document: PhaseAuthoringDocument(participantGroups: [group()], hazards: [hazard()]))
        let before = store.document
        XCTAssertThrowsError(try store.upsert(phase("phase_1", participants: ["does_not_exist"]), expectedRevision: 0)) { error in
            XCTAssertEqual(error as? PhaseAuthoringError, .unknownParticipant("does_not_exist"))
        }
        XCTAssertEqual(store.document, before)
        XCTAssertEqual(store.revision, 0)
        XCTAssertFalse(store.canUndo)
    }

    func testRevisionUndoRedoAndAutosaveRoundTrip() throws {
        let store = PhaseAuthoringStore(document: PhaseAuthoringDocument(encounterID: "enc_1", title: "Shrine", partyLevel: 5, participantGroups: [group()], hazards: [hazard()]))
        XCTAssertEqual(try store.upsert(phase("phase_1"), expectedRevision: 0, origin: "webmcp"), 1)
        XCTAssertEqual(store.lastMutationOrigin, "webmcp")
        XCTAssertEqual(try store.undo(expectedRevision: 1), 2)
        XCTAssertTrue(store.phases.isEmpty)
        XCTAssertEqual(try store.redo(expectedRevision: 2), 3)
        XCTAssertEqual(store.phases.first?.id, "phase_1")

        let data = try store.autosaveData()
        let restored = PhaseAuthoringStore()
        try restored.restoreAutosave(data)
        XCTAssertEqual(restored.document, store.document)
        XCTAssertEqual(restored.revision, 3)
        XCTAssertEqual(restored.lastMutationOrigin, "gm")
        XCTAssertFalse(restored.canUndo)
    }

    func testPacketProjectionContainsTerrainGuidanceAndWarnings() throws {
        let phaseValue = PhaseAuthoring(id: "phase_1", title: "Flood", trigger: PhaseTrigger(kind: .alarm, explanation: "The bell rings", value: "bell"), participantIDs: ["group_a"], hazardIDs: ["haz_a"], terrainChanges: [PhaseTerrainChange(title: "Rising water", description: "The pool becomes difficult terrain")], runningGuidance: "Move the captain to high ground", terrainAdjustment: 10)
        let store = PhaseAuthoringStore(document: PhaseAuthoringDocument(partyLevel: 5, participantGroups: [group()], hazards: [hazard()], phases: [phaseValue]))
        let packet = store.packetProjection
        XCTAssertEqual(packet.phases.first?.terrainChanges.first?.title, "Rising water")
        XCTAssertEqual(packet.phases.first?.runningGuidance, "Move the captain to high ground")
        XCTAssertEqual(packet.budget.terrainAdjustment, 10)
    }

    func testSharedCommandPersistsStructuredPhaseAndRejectsUnknownReferencesAtomically() throws {
        let draft = EncounterDraft(
            brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 5, size: 4)),
            participantGroups: [group()],
            hazards: [hazard()]
        )
        let store = EncounterStore(draft: draft)
        let first = phase("phase_1")
        let firstPayload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(first)) as? [String: Any])

        try SidekickCommandExecutor.execute([
            "command": "sidekickdm_upsert_phase",
            "phase": firstPayload,
            "expected_revision": 0,
            "origin": "gm"
        ], in: store)

        XCTAssertEqual(store.draft.revision, 1)
        XCTAssertEqual(store.draft.structuredPhases?.first?.terrainChanges.first?.description, "Water rises")
        XCTAssertEqual(store.draft.phases.first?.trigger, "When phase_1 begins")
        XCTAssertEqual(store.budget.peakActiveXP, 48)

        let invalid = phase("phase_2", participants: ["missing"])
        let invalidPayload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(invalid)) as? [String: Any])
        let before = store.draft
        XCTAssertThrowsError(try SidekickCommandExecutor.execute([
            "command": "sidekickdm_upsert_phase",
            "phase": invalidPayload,
            "expected_revision": 1,
            "origin": "gm"
        ], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "unknown_participant_reference")
        }
        XCTAssertEqual(store.draft, before)
    }
}
