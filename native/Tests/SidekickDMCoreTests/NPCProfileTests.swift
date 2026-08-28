import Foundation
import XCTest
@testable import SidekickDMCore

final class NPCProfileTests: XCTestCase {
    private func completeProfile(tier: NarrativeDetailTier = .incidental) -> NPCProfile {
        NPCProfile(
            id: "npc_keeper",
            narrativeTier: tier,
            encounterPurpose: "Keep the shrine sealed.",
            motivation: "Protect the last surviving acolytes.",
            moraleOrExitCondition: "Leaves when the bell is silenced.",
            peacefulResponse: "Offers directions if the party promises to leave the shrine alone.",
            knowledge: [NPCKnowledgeEntry(topic: "bell", text: "The bell is cracked.")],
            characterization: "Speaks with careful restraint.",
            appearance: "Waterlogged robes and a bronze key.",
            relationships: "Answers to the drowned captain.",
            secrets: ["The keeper caused the first flood."],
            voice: "Quiet, clipped sentences.",
            notes: "Keep the profile distinct from the Creature stat block.",
            provenance: NPCProfileProvenance(createdAt: "2026-08-28T00:00:00Z")
        )
    }

    func testIncidentalTierRequiresOnlyTheThreeMinimumFields() {
        let result = NPCProfileSchema.validate(NPCProfile())
        XCTAssertEqual(result.structuralErrors.map(\.field), ["encounter_purpose", "immediate_goal", "morale_exit"])

        var profile = NPCProfile()
        profile.encounterPurpose = "Guard the door."
        profile.motivation = "Buy time."
        profile.moraleOrExitCondition = "Flees when wounded."
        let ready = NPCProfileSchema.validate(profile)
        XCTAssertTrue(ready.isStructurallyReady)
        XCTAssertEqual(ready.disclosedFields, [.encounterPurpose, .immediateGoal, .moraleExit])
    }

    func testSupportingAndProminentTiersProgressivelyDiscloseAcceptedFields() {
        let supporting = NPCProfileDisclosure(profile: completeProfile(tier: .supporting))
        XCTAssertTrue(supporting.fields.contains(.peacefulResponse))
        XCTAssertTrue(supporting.fields.contains(.appearanceHook))
        XCTAssertNil(supporting.knowledge.first)

        let prominent = NPCProfileDisclosure(profile: completeProfile(tier: .prominent))
        XCTAssertTrue(prominent.fields.contains(.voiceManner))
        XCTAssertTrue(prominent.fields.contains(.knowledge))
        XCTAssertEqual(prominent.knowledge.first?.text, "The bell is cracked.")
    }

    func testParticipantLinkUsesGroupIDAndSelfContainedSnapshotInPacketProjection() throws {
        let group = ParticipantGroup(id: "group_keeper", contentID: "creature/custom/keeper/current", name: "Shrine Keeper", level: 2)
        let profile = completeProfile()
        let link = try NPCProfileLinking.link(profile: profile, to: group.id, capturedAt: "2026-08-28T00:01:00Z")
        let packet = NPCProfilePacketProjection.project(links: [link], participantGroups: [group])

        XCTAssertEqual(packet.profiles.count, 1)
        XCTAssertEqual(packet.profiles[0].participantGroupID, group.id)
        XCTAssertEqual(packet.profiles[0].participantName, "Shrine Keeper")
        XCTAssertEqual(packet.profiles[0].snapshot.profileID, profile.id)
        XCTAssertEqual(packet.profiles[0].snapshot.capturedAt, "2026-08-28T00:01:00Z")
        XCTAssertEqual(packet.profiles[0].profile.fields, [.encounterPurpose, .motivation, .moraleOrExitCondition])
        XCTAssertNil(packet.profiles[0].profile.knowledge.first)
    }

    func testStoreRevisionUndoRedoAndPersistenceRetainProvenance() throws {
        let store = NPCProfileStore(profile: completeProfile())
        var edited = completeProfile()
        edited.motivation = "Recover the shrine key."
        XCTAssertEqual(try store.update(edited, expectedRevision: 0, origin: "webmcp"), 1)
        XCTAssertEqual(store.profile.provenance.lastMutationOrigin, "webmcp")
        XCTAssertEqual(try store.attach(to: "group_keeper", expectedRevision: 1, origin: "gm"), 2)
        XCTAssertEqual(store.participantGroupID, "group_keeper")

        try store.undo(expectedRevision: 2)
        XCTAssertEqual(store.profile.motivation, "Recover the shrine key.")
        XCTAssertNil(store.participantGroupID)
        try store.redo(expectedRevision: 3)
        XCTAssertEqual(store.participantGroupID, "group_keeper")

        let restored = NPCProfileStore()
        try restored.restore(store.encodedState)
        XCTAssertEqual(restored.profile, store.profile)
        XCTAssertEqual(restored.participantGroupID, "group_keeper")
        XCTAssertTrue(restored.canUndo)
    }

    func testSharedCommandAttachesValidatedProfileToExistingParticipant() throws {
        let group = ParticipantGroup(id: "group_keeper", contentID: "creature/custom/keeper/current", name: "Shrine Keeper", level: 2)
        var profile = completeProfile()
        profile.participantGroupID = group.id
        let payload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(profile)) as? [String: Any])
        let store = EncounterStore(draft: EncounterDraft(participantGroups: [group]))

        try SidekickCommandExecutor.execute(["command": "sidekickdm_upsert_npc_profile", "profile": payload, "expected_revision": 0, "origin": "gm"], in: store)
        XCTAssertEqual(store.draft.revision, 1)
        XCTAssertEqual(store.draft.npcProfiles?.first?.participantGroupID, group.id)
        XCTAssertEqual(store.draft.npcProfiles?.first?.provenance.origin, "original")

        var invalid = profile
        invalid.participantGroupID = "missing"
        let invalidPayload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(invalid)) as? [String: Any])
        XCTAssertThrowsError(try SidekickCommandExecutor.execute(["command": "sidekickdm_upsert_npc_profile", "profile": invalidPayload, "expected_revision": 1], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "unknown_component")
        }
        XCTAssertEqual(store.draft.revision, 1)
    }
}
