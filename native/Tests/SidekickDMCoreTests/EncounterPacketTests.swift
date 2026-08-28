import Foundation
import XCTest
@testable import SidekickDMCore

final class EncounterPacketTests: XCTestCase {
    private func completePacket(includeWarnings: Bool = true) -> EncounterPacketContent {
        EncounterPacketContent(
            identity: PacketIdentitySection(title: "Bell Beneath Blackwater", premise: "A drowned cult guards the shrine bell.", objective: "Stop the bell before it calls the flood.", stakes: "The lower district floods if the bell rings."),
            setup: PacketSetupSection(trigger: "The bell tolls when the party enters.", battlefieldDescription: "A flooded shrine with two raised walkways.", startingPositions: "The cult captain begins by the eastern pool.", awarenessState: "The sentries are alert but do not know the party's number.", immediateFeatures: ["Knee-deep water", "A cracked bell rope"], readAloud: includeWarnings ? nil : "Black water laps over the shrine steps."),
            battlefield: PacketBattlefieldSection(dimensions: "40 by 60 feet", zones: includeWarnings ? [] : ["Raised walkways"], interactiveObjects: includeWarnings ? [] : ["Bell rope"]),
            runningGuidance: PacketRunningGuidanceSection(participantRoles: "Sentries screen the captain.", openingTactics: "The sentries delay while the captain rings the bell.", ongoingTactics: "The captain pushes isolated targets toward the water.", coordinationConflict: "The sentries retreat if the captain falls.", triggersReinforcements: "A second wave arrives when the bell is struck.", moraleSummary: "The remaining cultists flee when the captain is defeated.", adjudicationIssues: includeWarnings ? [] : ["Clarify whether the water counts as difficult terrain."]),
            cohesion: PacketCohesionSection(participantPresence: "The cult needs the shrine to remain sealed.", relationships: "The captain commands the sentries through fear.", hazardTerrainFit: "The flooded walkways make the bell and water hazards relevant.", theme: includeWarnings ? "" : "Drowning and desperate devotion"),
            information: includeWarnings ? PacketInformationSection() : PacketInformationSection(immediatelyApparent: ["The bell is cracked"], discoverable: ["The cult stole the bell's key"], gmSecret: ["The bell calls a flood only when rung three times"]),
            outcomes: PacketOutcomesSection(victory: "The party silences the bell and saves the district.", failure: "The flood reaches the lower district.")
        )
    }

    func testMissingRequiredSectionsAreStructuralAndWarningsAreSeparate() {
        let readiness = PacketReadinessValidator.validate(EncounterPacketContent())

        XCTAssertFalse(readiness.isStructurallyReady)
        XCTAssertEqual(readiness.status, .incompleteDraft)
        XCTAssertTrue(readiness.structuralErrors.contains { $0.section == .identity && $0.field == "premise" })
        XCTAssertTrue(readiness.structuralErrors.contains { $0.section == .outcomes && $0.field == "failure_or_aftermath" })
        XCTAssertFalse(readiness.designWarnings.isEmpty)
        XCTAssertTrue(readiness.missingSections.contains(.setup))
    }

    func testCompletePacketReachesReadyWithWarningsWithoutBlocking() {
        let readiness = PacketReadinessValidator.validate(completePacket())

        XCTAssertTrue(readiness.structuralErrors.isEmpty)
        XCTAssertEqual(readiness.status, .readyWithWarnings)
        XCTAssertFalse(readiness.designWarnings.isEmpty)
        XCTAssertTrue(readiness.isStructurallyReady)
    }

    func testCompletePacketCanReachReadyToRun() {
        let readiness = PacketReadinessValidator.validate(completePacket(includeWarnings: false), reviewState: .reviewed)

        XCTAssertTrue(readiness.structuralErrors.isEmpty)
        XCTAssertTrue(readiness.designWarnings.isEmpty)
        XCTAssertEqual(readiness.status, .readyToRun)
        XCTAssertEqual(readiness.reviewState, .reviewed)
    }

    func testSemanticMutationsAreRevisionedUndoableAndProvenanced() throws {
        let boundaries = GMOwnedContentBoundaries(lines: ["No harm to children"], veils: ["Graphic drowning"], excludedThemes: ["Body horror"])
        let store = EncounterPacketAuthoringStore(packet: EncounterPacketContent(), boundaries: boundaries, constraintsRevision: 4)
        let identity = completePacket().identity

        XCTAssertEqual(try store.setIdentity(identity, expectedRevision: 0, expectedConstraintsRevision: 4, origin: .agent), 1)
        XCTAssertEqual(store.lastMutationOrigin, .agent)
        XCTAssertEqual(store.packet.identity.title, identity.title)
        XCTAssertEqual(store.contentBoundaries.lines, ["No harm to children"])
        XCTAssertThrowsError(try store.setSetup(completePacket().setup, expectedRevision: 0, expectedConstraintsRevision: 4, origin: .webmcp)) { error in
            XCTAssertEqual(error as? SidekickPacketError, .staleRevision(expected: 0, current: 1))
        }

        try store.undo(expectedRevision: 1)
        XCTAssertEqual(store.revision, 2)
        XCTAssertTrue(store.packet.identity.title.isEmpty)
        XCTAssertTrue(store.canRedo)
        try store.redo(expectedRevision: 2)
        XCTAssertEqual(store.revision, 3)
        XCTAssertEqual(store.packet.identity.title, identity.title)
        XCTAssertFalse(store.canRedo)
    }

    func testAutosaveRestoresPacketAndRevisionButStartsFreshHistory() throws {
        let store = EncounterPacketAuthoringStore(packet: completePacket(), boundaries: GMOwnedContentBoundaries(lines: ["line"]), revision: 8, constraintsRevision: 3, origin: .agent, lastMutationOrigin: .webmcp)
        let data = try store.autosaveData()
        let restored = EncounterPacketAuthoringStore()

        try restored.restoreAutosave(data)

        XCTAssertEqual(restored.packet, store.packet)
        XCTAssertEqual(restored.revision, 8)
        XCTAssertEqual(restored.constraintsRevision, 3)
        XCTAssertEqual(restored.origin, .agent)
        XCTAssertEqual(restored.lastMutationOrigin, .webmcp)
        XCTAssertEqual(restored.contentBoundaries.lines, ["line"])
        XCTAssertFalse(restored.canUndo)
        XCTAssertFalse(restored.canRedo)
    }

    func testAgentMutationRejectsStaleContentBoundaryRevision() throws {
        let store = EncounterPacketAuthoringStore(constraintsRevision: 4)

        XCTAssertThrowsError(try store.setIdentity(completePacket().identity, expectedRevision: 0, expectedConstraintsRevision: 3, origin: .webmcp)) { error in
            XCTAssertEqual(error as? SidekickPacketError, .staleConstraints(expected: 3, current: 4))
        }
        XCTAssertEqual(store.revision, 0)
        XCTAssertTrue(store.packet.identity.title.isEmpty)
    }

    func testCorePacketProjectionBridgesLegacyFlatBoundary() {
        let core = EncounterPacket(premise: "premise", objective: "objective", setup: "trigger", runningGuidance: "tactics", cohesion: "cohesion", outcomes: "victory")
        let packet = EncounterPacketContent(corePacket: core, title: "title")

        XCTAssertEqual(packet.identity.title, "title")
        XCTAssertEqual(packet.setup.trigger, "trigger")
        XCTAssertEqual(packet.flattenedCorePacket(), core)
    }

    func testSharedEncounterCommandsPersistPacketSectionsAndGlobalUndo() throws {
        let packet = completePacket()
        let store = EncounterStore(draft: EncounterDraft(contentBoundaries: GMOwnedContentBoundaries(lines: ["No harm to children"])))
        func object<T: Encodable>(_ value: T) throws -> [String: Any] {
            try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as? [String: Any])
        }

        try SidekickCommandExecutor.execute(["command": "sidekickdm_set_encounter_identity", "value": try object(packet.identity), "expected_revision": 0, "expected_constraints_revision": 0, "origin": "gm"], in: store)
        try SidekickCommandExecutor.execute(["command": "sidekickdm_set_setup", "value": try object(packet.setup), "expected_revision": 1, "origin": "gm"], in: store)
        XCTAssertEqual(store.draft.revision, 2)
        XCTAssertEqual(store.draft.packetV1?.identity.title, packet.identity.title)
        XCTAssertEqual(store.draft.packetV1?.setup.trigger, packet.setup.trigger)
        XCTAssertEqual(store.draft.contentBoundaries?.lines, ["No harm to children"])

        try store.undo(expectedRevision: 2, origin: "gm")
        XCTAssertEqual(store.draft.packetV1?.identity.title, packet.identity.title)
        XCTAssertTrue(store.draft.packetV1?.setup.trigger.isEmpty ?? true)
        XCTAssertEqual(store.draft.contentBoundaries?.lines, ["No harm to children"])
    }
}
