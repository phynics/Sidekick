import XCTest
@testable import SidekickDMCore

final class GenerationRunTests: XCTestCase {
    private func controller() -> GenerationRunController {
        GenerationRunController(draft: EncounterDraft(id: "enc_run", constraintsRevision: 4), briefRevision: 3)
    }

    private func begin(_ store: GenerationRunController) throws -> String {
        try store.begin(encounterID: "enc_run", expectedEncounterRevision: 0, expectedBriefRevision: 3, expectedConstraintsRevision: 4, contentBoundariesAcknowledged: true, intentSummary: "Build a swamp ambush.", generationRunID: "run_test")
    }

    private func completePacket() -> EncounterPacketContentV1 {
        EncounterPacketContentV1(
            identity: PacketIdentitySection(title: "The Bell", premise: "Cultists ring a drowned bell.", objective: "Stop the ritual.", stakes: "The shrine floods."),
            setup: PacketSetupSection(trigger: "The bell sounds.", battlefieldDescription: "A flooded shrine.", startingPositions: "The party stands at the east arch.", awarenessState: "The cultists are alert.", immediateFeatures: ["Deep water"]),
            runningGuidance: PacketRunningGuidanceSection(participantRoles: "Skirmishers screen the leader.", openingTactics: "Circle isolated targets.", ongoingTactics: "Fall back through the water.", coordinationConflict: "The leader protects the bell.", triggersReinforcements: "Reinforce when the bell cracks.", moraleSummary: "Flee when the leader falls."),
            cohesion: PacketCohesionSection(participantPresence: "The cult guards the shrine.", relationships: "The leader commands the skirmishers.", hazardTerrainFit: "The flooded floor protects the cult.", theme: "Drowned devotion."),
            information: PacketInformationSection(immediatelyApparent: ["The bell is cracked."], discoverable: ["The ritual route"], gmSecret: ["The bell hides a seal."]),
            outcomes: PacketOutcomesSection(victory: "The ritual stops.", failure: "The shrine floods."))
    }

    func testBeginChecksAllRevisionsAndBoundaryAcknowledgement() throws {
        let store = controller()
        XCTAssertThrowsError(try store.begin(encounterID: "enc_run", expectedEncounterRevision: 1, expectedBriefRevision: 3, expectedConstraintsRevision: 4, contentBoundariesAcknowledged: true)) { error in
            XCTAssertEqual(error as? GenerationRunError, .staleEncounter(expected: 1, current: 0))
        }
        XCTAssertThrowsError(try store.begin(encounterID: "enc_run", expectedEncounterRevision: 0, expectedBriefRevision: 2, expectedConstraintsRevision: 4, contentBoundariesAcknowledged: true)) { error in
            XCTAssertEqual(error as? GenerationRunError, .staleBrief(expected: 2, current: 3))
        }
        XCTAssertThrowsError(try store.begin(encounterID: "enc_run", expectedEncounterRevision: 0, expectedBriefRevision: 3, expectedConstraintsRevision: 4, contentBoundariesAcknowledged: false)) { error in
            XCTAssertEqual(error as? GenerationRunError, .contentBoundaryAcknowledgementRequired)
        }
        XCTAssertEqual(try begin(store), "run_test")
        XCTAssertEqual(store.draft.revision, 1)
        XCTAssertEqual(store.generationState, .active)
        XCTAssertTrue(store.manualWritesLocked)
    }

    func testMutationsAreLiveRevisionedProvenancedAndManualWritesAreLocked() throws {
        let store = controller()
        let runID = try begin(store)
        XCTAssertThrowsError(try store.mutate(encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 1, expectedConstraintsRevision: 4, origin: "gm", description: "Manual write") { $0.title = "Blocked" }) { error in
            XCTAssertEqual(error as? GenerationRunError, .manualWriteLocked)
        }
        let groupID = try store.addExistingParticipantGroup(ExistingParticipantGroupRequest(contentID: "creature/test/bog/current", name: "Bog Strider", level: 5, quantity: 2, catalogEntryComplete: true, catalogEntrySupported: true), encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 1, expectedConstraintsRevision: 4)
        XCTAssertEqual(store.draft.participantGroups.first?.id, groupID)
        XCTAssertEqual(store.draft.revision, 2)
        XCTAssertEqual(store.draft.provenance.lastMutationOrigin, "webmcp")
        XCTAssertEqual(store.activity.first?.origin, "webmcp")
        XCTAssertEqual(store.snapshot().draft.participantGroups.count, 1)
    }

    func testSemanticPacketSectionsAndExistingParticipantRejectPartialCatalogEntries() throws {
        let store = controller()
        let runID = try begin(store)
        XCTAssertThrowsError(try store.addExistingParticipantGroup(ExistingParticipantGroupRequest(contentID: "creature/test/partial/current", name: "Partial", level: 5, catalogEntryComplete: false), encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 1, expectedConstraintsRevision: 4)) { error in
            XCTAssertEqual(error as? GenerationRunError, .catalogEntryPartial)
        }
        let identity = PacketIdentitySection(title: "Generated Encounter", premise: "A flooded ruin.", objective: "Break the seal.", stakes: "The valley floods.")
        try store.setPacketSection(.identity, value: .identity(identity), encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 1, expectedConstraintsRevision: 4)
        XCTAssertEqual(store.draft.packetV1?.identity, identity)
        XCTAssertEqual(store.draft.title, "Generated Encounter")
    }

    func testFinishPreservesWarningsAndCollapsesRunIntoOneUndoEntry() throws {
        let store = controller()
        let runID = try begin(store)
        let packet = completePacket()
        try store.mutate(encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 1, expectedConstraintsRevision: 4, description: "Authored packet") { draft in
            draft.packetV1 = packet
            draft.packet = packet.flattenedCorePacket()
        }
        let finishedRevision = try store.finish(encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 2, expectedConstraintsRevision: 4, completionNote: "Warnings remain.")
        XCTAssertEqual(finishedRevision, 3)
        XCTAssertNil(store.draft.generation)
        XCTAssertEqual(store.draft.reviewState, "needed")
        XCTAssertTrue(store.canUndo)
        try store.undo(expectedEncounterRevision: finishedRevision)
        XCTAssertTrue(store.draft.participantGroups.isEmpty)
        XCTAssertEqual(store.draft.revision, 4)
        XCTAssertFalse(store.canUndo)
    }

    func testCancelRestoresOpeningContentAndReloadMarksRunInterrupted() throws {
        let store = controller()
        let opening = store.draft
        let runID = try begin(store)
        try store.addExistingParticipantGroup(ExistingParticipantGroupRequest(contentID: "creature/test/bog/current", name: "Bog Strider", level: 5), encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 1, expectedConstraintsRevision: 4)
        let persisted = try store.autosaveData()
        let reloaded = GenerationRunController()
        try reloaded.reload(from: persisted)
        XCTAssertEqual(reloaded.generationState, .interrupted)
        XCTAssertTrue(reloaded.manualWritesLocked)
        XCTAssertThrowsError(try reloaded.finish(encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 2, expectedConstraintsRevision: 4)) { error in
            XCTAssertEqual(error as? GenerationRunError, .generationInterrupted)
        }
        try reloaded.cancel(encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 2)
        XCTAssertNil(reloaded.draft.generation)
        XCTAssertEqual(reloaded.draft.title, opening.title)
        XCTAssertTrue(reloaded.draft.participantGroups.isEmpty)
        XCTAssertEqual(reloaded.draft.revision, 3)
    }
}
