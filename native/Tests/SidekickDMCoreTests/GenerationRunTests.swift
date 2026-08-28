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

    private func validHazard(id: String = "haz_run") -> SimpleHazard {
        SimpleHazard(
            id: id,
            identity: HazardIdentity(name: "Mire Bell Snare", level: 4, type: .trap, complexity: .simple, traits: ["mechanical"]),
            description: "A submerged chain catches a creature crossing the shrine floor.",
            detection: HazardDetection(kind: "stealth_dc", band: .high, value: 22, minimumProficiency: "trained"),
            disableMethods: [HazardDisableMethod(skill: "Thievery", dc: 20, requirements: "thieves' tools")],
            defenses: HazardDefenses(ac: 21, hardness: 11, hp: 48),
            trigger: "A creature crosses the submerged chain.",
            effect: HazardEffect(resolution: HazardResolution(type: "save", save: "reflex", dc: HazardStatistic(band: .high, value: 22)), damage: [HazardDamage(expression: "2d8", type: "bludgeoning")], conditions: ["prone"], text: "The chain snaps tight and knocks the creature prone."),
            reset: "A creature can reset the chain in 10 minutes."
        )
    }

    private func phaseController() -> GenerationRunController {
        let participant = ParticipantGroup(id: "group_run", contentID: "creature/test/run/current", name: "Bog Strider", level: 5, quantity: 1)
        let hazard = EncounterHazard(id: "haz_phase", contentID: "hazard/test/run/current", name: "Mire Bell", level: 5, participation: Participation(mode: .reinforcement))
        let draft = EncounterDraft(id: "enc_run", constraintsRevision: 4, brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 5, size: 4)), participantGroups: [participant], hazards: [hazard])
        return GenerationRunController(draft: draft, briefRevision: 3)
    }

    private func draft(_ value: EncounterDraft, revision: Int) -> EncounterDraft {
        var copy = value
        copy.revision = revision
        copy.generation = nil
        return copy
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

    func testSimpleHazardValidationAndLifecycleStayInsideGenerationRun() throws {
        let store = controller()
        let incomplete = store.validateSimpleHazard(SimpleHazard())
        XCTAssertFalse(incomplete.structuralErrors.isEmpty)
        XCTAssertEqual(store.draft.revision, 0)

        let runID = try begin(store)
        let hazard = validHazard()
        let hazardID = try store.createSimpleHazard(hazard, participation: Participation(mode: .mandatory), placement: "Shrine entrance", encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 1, expectedConstraintsRevision: 4)
        XCTAssertEqual(hazardID, "haz_run")
        XCTAssertEqual(store.draft.revision, 2)
        XCTAssertEqual(store.draft.customHazards?.count, 1)
        XCTAssertEqual(store.draft.hazards.first?.participation.mode, .mandatory)
        XCTAssertEqual(EncounterMath.budget(for: store.draft).guaranteedXP, 24)

        var revised = validHazard()
        revised.identity.name = "Mire Bell Snare Revised"
        try store.updateSimpleHazard(revised, participation: Participation(mode: .avoidable), placement: "West arch", encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 2, expectedConstraintsRevision: 4)
        XCTAssertEqual(store.draft.customHazards?.first?.identity.name, "Mire Bell Snare Revised")
        XCTAssertEqual(store.draft.hazards.first?.participation.mode, .avoidable)
        XCTAssertEqual(store.draft.hazards.first?.placement, "West arch")

        try store.removeSimpleHazard(id: hazardID, encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 3, expectedConstraintsRevision: 4)
        XCTAssertTrue(store.draft.customHazards?.isEmpty == true)
        XCTAssertTrue(store.draft.hazards.isEmpty)
        XCTAssertEqual(store.draft.revision, 4)

        try store.cancel(encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 4)
        XCTAssertEqual(store.draft.hazards, [])
        XCTAssertEqual(store.draft.customHazards, [])
        XCTAssertEqual(store.draft.title, "The Bell Beneath Blackwater")
        XCTAssertEqual(store.draft.revision, 5)
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

    func testAgentAuthorsValidatedPhaseAndRecalculatesBudgetDuringRun() throws {
        let store = phaseController()
        let runID = try begin(store)
        let authored = PhaseAuthoring(id: "phase_run", title: "Bell cracks", order: 1, trigger: PhaseTrigger(kind: .alarm, explanation: "When the bell cracks"), participantIDs: ["group_run"], hazardIDs: ["haz_phase"], terrainChanges: [PhaseTerrainChange(title: "Flood", description: "Water rises")], runningGuidance: "Move to high ground")
        XCTAssertEqual(try store.upsertPhase(authored, encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 1, expectedConstraintsRevision: 4, origin: "webmcp"), 2)
        XCTAssertEqual(store.draft.structuredPhases?.first, authored)
        XCTAssertEqual(store.draft.phases.first?.trigger, "When the bell cracks")
        XCTAssertEqual(store.phaseBudget.perPhase.first?.activeXP, 48)
        XCTAssertEqual(store.phaseBudget.peakActiveXP, 48)
        XCTAssertEqual(store.phaseBudget.totalEncounterXP, 48)
        XCTAssertEqual(store.draft.provenance.lastMutationOrigin, "webmcp")

        let invalid = PhaseAuthoring(id: "phase_bad", title: "Bad", trigger: PhaseTrigger(explanation: "When bad"), participantIDs: ["missing"])
        let before = store.draft
        XCTAssertThrowsError(try store.upsertPhase(invalid, encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 2, expectedConstraintsRevision: 4, origin: "webmcp")) { error in
            XCTAssertEqual(error as? GenerationRunError, .invalidPhase(.unknownParticipant("missing")))
        }
        XCTAssertEqual(store.draft, before)
    }

    func testTargetedAgentRevisionIsSeparateFromRunAndUndoRestoresOpeningInTwoSteps() throws {
        let store = controller()
        let opening = store.draft
        let runID = try begin(store)
        try store.mutate(encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 1, expectedConstraintsRevision: 4, description: "Authored packet") { draft in
            draft.packetV1 = self.completePacket()
            draft.packet = self.completePacket().flattenedCorePacket()
        }
        let finishedRevision = try store.finish(encounterID: "enc_run", generationRunID: runID, expectedEncounterRevision: 2, expectedConstraintsRevision: 4)
        XCTAssertEqual(finishedRevision, 3)
        let runResult = store.draft
        XCTAssertEqual(try store.applyTargetedRevision(encounterID: "enc_run", expectedEncounterRevision: 3, origin: "webmcp", description: "Agent tuned outcome") { draft in
            draft.title = "The Bell Revised"
        }, 4)
        XCTAssertEqual(store.draft.title, "The Bell Revised")
        XCTAssertEqual(store.draft.provenance.lastMutationOrigin, "webmcp")
        XCTAssertEqual(store.activity.first?.origin, "webmcp")

        try store.undo(expectedEncounterRevision: 4)
        XCTAssertEqual(store.draft, draft(runResult, revision: 5))
        try store.undo(expectedEncounterRevision: 5)
        XCTAssertEqual(store.draft, draft(opening, revision: 6))
        XCTAssertFalse(store.canUndo)
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
