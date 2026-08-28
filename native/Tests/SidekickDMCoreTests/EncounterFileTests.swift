import Foundation
import XCTest
@testable import SidekickDMCore

final class EncounterFileTests: XCTestCase {
    private let timestamp = "2026-08-28T12:00:00Z"

    private func fixture() -> EncounterDraft {
        var creature = OriginalCreature(name: "Mire Captain", level: 5, concept: "Drowned cult leader", encounterRole: .leader, id: "cre_1")
        creature.provenance = CreatureProvenance(origin: "forked", basedOnContentID: "creature/monster-core/goblin/current", createdAt: timestamp, mutationOrigin: "webmcp")
        var hazard = SimpleHazard(id: "haz_1", identity: HazardIdentity(name: "Bell Snare", level: 5, complexity: .simple))
        hazard.provenance = HazardProvenance(origin: "original", createdAt: timestamp, mutationOrigin: "gm")
        let group = ParticipantGroup(id: "cmp_1", contentID: "creature/custom/mire-captain/current", name: "Mire Captain", level: 5, quantity: 1, encounterRole: .leader)
        let profile = NPCProfile(id: "npc_1", participantGroupID: group.id, narrativeTier: .supporting, name: "The Mire Captain", encounterPurpose: "Keep the bell ringing.", appearanceHook: "Waterlogged regalia.", immediateGoal: "Delay the party.", moraleExit: "Flees when the bell cracks.", provenance: NPCProfileProvenance(createdAt: timestamp))
        var draft = EncounterDraft(id: "enc_1", title: "Blackwater Bell", brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 5, size: 4), threatTarget: ThreatTarget(kind: .severe), purpose: "Stop the bell", premise: "A cult rings a drowned bell.", environment: "Flooded ruin"), participantGroups: [group], hazards: [EncounterHazard(id: "ehaz_1", contentID: "hazard/custom/bell/current", name: "Bell Snare", level: 5)], phases: [EncounterPhase(id: "phase_1", title: "The bell rings", order: 1, participantIDs: ["cmp_1"], hazardIDs: ["ehaz_1"], trigger: "The party enters")], originalCreatures: [creature], customHazards: [hazard])
        draft.npcProfiles = [profile]
        draft.provenance = ProvenanceSummary(origin: "webmcp", lastMutationOrigin: "webmcp")
        return draft
    }

    private func mutateEnvelope(_ data: Data, _ mutation: (inout [String: Any]) -> Void) throws -> Data {
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        mutation(&object)
        return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    }

    func testExportIsDeterministicAndSelfContained() throws {
        let draft = fixture()
        let options = EncounterFileExportOptions(exportedAt: timestamp)
        let first = try EncounterFileCodec.exportDraft(draft, options: options)
        let second = try EncounterFileCodec.exportDraft(draft, options: options)
        XCTAssertEqual(first, second)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: first) as? [String: Any])
        let data = try XCTUnwrap(json["data"] as? [String: Any])
        let encounter = try XCTUnwrap(data["encounter"] as? [String: Any])
        let embedded = try XCTUnwrap(data["embedded_components"] as? [String: Any])
        XCTAssertEqual((embedded["creatures"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((embedded["npc_profiles"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((embedded["hazards"] as? [[String: Any]])?.count, 1)
        XCTAssertNil(encounter["budget"])
        XCTAssertNil(encounter["readiness"])
        XCTAssertEqual(encounter["object_version"] as? Int, 1)
    }

    func testRoundTripRecalculatesRuntimeState() throws {
        let draft = fixture()
        let data = try EncounterFileCodec.exportDraft(draft, options: EncounterFileExportOptions(exportedAt: timestamp))
        let imported = try EncounterFileCodec.importDraft(data, importedAt: timestamp)
        XCTAssertEqual(imported.draft.id, draft.id)
        XCTAssertEqual(imported.draft.title, draft.title)
        XCTAssertEqual(imported.draft.participantGroups, draft.participantGroups)
        XCTAssertEqual(imported.draft.npcProfiles, draft.npcProfiles)
        XCTAssertEqual(imported.draft.phases, draft.phases)
        XCTAssertEqual(imported.draft.revision, 0)
        XCTAssertEqual(EncounterMath.budget(for: imported.draft).peakActiveXP, EncounterMath.budget(for: draft).peakActiveXP)
    }

    func testPlacedHazardAndEmbeddedCustomHazardMirrorRoundTrip() throws {
        var draft = fixture()
        draft.customHazards?[0].id = draft.hazards[0].id
        let data = try EncounterFileCodec.exportDraft(draft, options: EncounterFileExportOptions(exportedAt: timestamp))
        let imported = try EncounterFileCodec.importDraft(data, existingIDs: ["ehaz_1"], importedAt: timestamp)
        XCTAssertEqual(imported.remappedIDs["ehaz_1"], "ehaz_imported")
        XCTAssertEqual(imported.draft.hazards.first?.id, "ehaz_imported")
        XCTAssertEqual(imported.draft.customHazards?.first?.id, "ehaz_imported")
    }

    func testEmbeddedCustomHazardCannotDuplicateAnotherLocalKind() throws {
        let data = try EncounterFileCodec.exportDraft(fixture(), options: EncounterFileExportOptions(exportedAt: timestamp))
        let invalid = try mutateEnvelope(data) { root in
            var payload = root["data"] as! [String: Any]
            var embedded = payload["embedded_components"] as! [String: Any]
            var hazards = embedded["hazards"] as! [[String: Any]]
            hazards[0]["id"] = "cmp_1"
            embedded["hazards"] = hazards
            payload["embedded_components"] = embedded
            root["data"] = payload
        }
        XCTAssertThrowsError(try EncounterFileCodec.importDraft(invalid, importedAt: timestamp)) { error in
            XCTAssertEqual(error as? EncounterFileError, .duplicateID("cmp_1"))
        }
    }

    func testEmbeddedCatalogEntriesSurviveDraftExportAndImport() throws {
        let snapshot: AnyCodable = .object([
            "kind": .string("creature"),
            "content_id": .string("creature/monster-core/goblin/current"),
            "name": .string("Goblin"),
            "level": .number(1),
            "detail": .object(["traits": .array([.string("goblinoid")])])
        ])
        var draft = fixture()
        draft.embeddedCatalogEntries = [snapshot]

        let data = try EncounterFileCodec.exportDraft(draft, options: EncounterFileExportOptions(exportedAt: timestamp))
        let imported = try EncounterFileCodec.importDraft(data, importedAt: timestamp)

        XCTAssertEqual(imported.draft.embeddedCatalogEntries, [snapshot])
        XCTAssertEqual(imported.draft.originalCreatures?.count, draft.originalCreatures?.count)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let encounter = try XCTUnwrap((json["data"] as? [String: Any])?["encounter"] as? [String: Any])
        XCTAssertNotNil(encounter["embedded_catalog_entries"])
        let embedded = try XCTUnwrap((json["data"] as? [String: Any])?["embedded_components"] as? [String: Any])
        XCTAssertEqual((embedded["embedded_catalog_entries"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((embedded["creatures"] as? [[String: Any]])?.count, 2)
    }

    func testCollisionRemapsIDsReferencesAndProvenance() throws {
        let data = try EncounterFileCodec.exportDraft(fixture(), options: EncounterFileExportOptions(exportedAt: timestamp))
        let result = try EncounterFileCodec.importDraft(data, existingIDs: ["enc_1", "cmp_1", "cre_1", "npc_1", "phase_1"], importedAt: timestamp)
        XCTAssertEqual(result.remappedIDs["enc_1"], "enc_imported")
        XCTAssertEqual(result.remappedIDs["cmp_1"], "cmp_imported")
        XCTAssertEqual(result.remappedIDs["cre_1"], "cre_imported")
        XCTAssertEqual(result.remappedIDs["phase_1"], "phase_imported")
        XCTAssertEqual(result.remappedIDs["npc_1"], "npc_imported")
        XCTAssertEqual(result.draft.id, "enc_imported")
        XCTAssertEqual(result.draft.participantGroups.first?.id, "cmp_imported")
        XCTAssertEqual(result.draft.phases.first?.participantIDs, ["cmp_imported"])
        XCTAssertEqual(result.draft.npcProfiles?.first?.id, "npc_imported")
        XCTAssertEqual(result.draft.npcProfiles?.first?.participantGroupID, "cmp_imported")
        XCTAssertEqual(result.draft.npcProfiles?.first?.provenance.origin, "imported")
        XCTAssertEqual(result.draft.originalCreatures?.first?.provenance.origin, "imported")
    }

    func testCollisionRemapsGenerationOpeningSnapshotForCancelRestore() throws {
        var draft = fixture()
        let openingJSON = String(data: try JSONEncoder().encode(draft), encoding: .utf8)
        draft.generation = GenerationState(id: "run_import", state: "active", openingDraftJSON: openingJSON, intentSummary: "Resume the flooded shrine.")
        draft.phases = []
        let data = try EncounterFileCodec.exportDraft(draft, options: EncounterFileExportOptions(exportedAt: timestamp))
        let result = try EncounterFileCodec.importDraft(data, existingIDs: ["enc_1", "cmp_1", "cre_1", "npc_1", "phase_1"], importedAt: timestamp)

        let encodedOpening = try XCTUnwrap(result.draft.generation?.openingDraftJSON)
        let opening = try JSONDecoder().decode(EncounterDraft.self, from: try XCTUnwrap(encodedOpening.data(using: .utf8)))
        XCTAssertEqual(opening.id, "enc_imported")
        XCTAssertEqual(opening.participantGroups.first?.id, "cmp_imported")
        XCTAssertEqual(opening.phases.first?.id, "phase_imported")
        XCTAssertEqual(opening.phases.first?.participantIDs, ["cmp_imported"])
        XCTAssertEqual(opening.npcProfiles?.first?.id, "npc_imported")
        XCTAssertEqual(opening.npcProfiles?.first?.participantGroupID, "cmp_imported")

        let controller = GenerationRunController(draft: result.draft)
        _ = try controller.cancel(encounterID: "enc_imported", generationRunID: "run_import", expectedEncounterRevision: 0)
        XCTAssertEqual(controller.draft.id, "enc_imported")
        XCTAssertEqual(controller.draft.participantGroups.first?.id, "cmp_imported")
        XCTAssertEqual(controller.draft.phases.first?.id, "phase_imported")
        XCTAssertEqual(controller.draft.phases.first?.participantIDs, ["cmp_imported"])
        XCTAssertEqual(controller.draft.npcProfiles?.first?.participantGroupID, "cmp_imported")
    }

    func testFutureVersionFailsBeforeMemoryStoreMutation() throws {
        let data = try EncounterFileCodec.exportDraft(fixture(), options: EncounterFileExportOptions(exportedAt: timestamp))
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        object["format_version"] = 2
        let future = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        let store = EncounterFileMemoryStore(encounters: ["enc_existing": fixture()])
        XCTAssertThrowsError(try store.importEncounter(future, importedAt: timestamp)) { error in
            XCTAssertEqual(error as? EncounterFileError, .futureMajorVersion(2))
        }
        XCTAssertEqual(store.encounters.count, 1)
    }

    func testNonIntegerFormatVersionFailsBeforeAnyEncounterImportWrite() throws {
        let draft = fixture()
        let encounterData = try EncounterFileCodec.exportDraft(draft, options: EncounterFileExportOptions(exportedAt: timestamp))
        let invalidEncounter = try mutateEnvelope(encounterData) { $0["format_version"] = 1.5 }
        let store = EncounterFileMemoryStore(encounters: ["enc_existing": draft])

        XCTAssertThrowsError(try store.importEncounter(invalidEncounter, importedAt: timestamp)) { error in
            XCTAssertEqual(error as? EncounterFileError, .invalidEnvelope("format_version is required"))
        }
        XCTAssertEqual(store.encounters, ["enc_existing": draft])
    }

    func testNonIntegerFormatVersionFailsForComponentsAndLibraryImports() throws {
        let draft = fixture()
        let options = EncounterFileExportOptions(exportedAt: timestamp)
        let componentsData = try EncounterFileCodec.exportComponentsFile(creatures: draft.originalCreatures ?? [], npcProfiles: draft.npcProfiles ?? [], hazards: draft.customHazards ?? [], options: options)
        let libraryData = try EncounterFileCodec.exportLibraryFile(encounters: [draft], options: options)
        let invalidComponents = try mutateEnvelope(componentsData) { $0["format_version"] = 1.5 }
        let invalidLibrary = try mutateEnvelope(libraryData) { $0["format_version"] = 1.5 }

        XCTAssertThrowsError(try EncounterFileCodec.importComponentsFile(invalidComponents)) { error in
            XCTAssertEqual(error as? EncounterFileError, .invalidEnvelope("format_version is required"))
        }
        XCTAssertThrowsError(try EncounterFileCodec.importLibraryFile(invalidLibrary)) { error in
            XCTAssertEqual(error as? EncounterFileError, .invalidEnvelope("format_version is required"))
        }
    }

    func testParticipantAndHazardShareIDFailsBeforeMemoryStoreWrite() throws {
        let draft = fixture()
        let data = try EncounterFileCodec.exportDraft(draft, options: EncounterFileExportOptions(exportedAt: timestamp))
        let invalid = try mutateEnvelope(data) { root in
            var payload = root["data"] as! [String: Any]
            var encounter = payload["encounter"] as! [String: Any]
            var hazards = encounter["hazards"] as! [[String: Any]]
            hazards[0]["id"] = "cmp_1"
            encounter["hazards"] = hazards
            payload["encounter"] = encounter
            root["data"] = payload
        }
        let store = EncounterFileMemoryStore(encounters: ["enc_existing": draft])
        XCTAssertThrowsError(try store.importEncounter(invalid, importedAt: timestamp)) { error in
            XCTAssertEqual(error as? EncounterFileError, .duplicateID("cmp_1"))
        }
        XCTAssertEqual(store.encounters, ["enc_existing": draft])
    }

    func testAttachmentAndEncounterShareIDFailsBeforeMemoryStoreWrite() throws {
        let draft = fixture()
        let data = try EncounterFileCodec.exportDraft(draft, options: EncounterFileExportOptions(exportedAt: timestamp))
        let invalid = try mutateEnvelope(data) { root in
            var payload = root["data"] as! [String: Any]
            payload["attachments"] = [["id": "enc_1"]]
            root["data"] = payload
        }
        let store = EncounterFileMemoryStore(encounters: ["enc_existing": draft])
        XCTAssertThrowsError(try store.importEncounter(invalid, importedAt: timestamp)) { error in
            XCTAssertEqual(error as? EncounterFileError, .duplicateID("enc_1"))
        }
        XCTAssertEqual(store.encounters, ["enc_existing": draft])
    }

    func testEmptyExportedAtFailsBeforeAnyEncounterImportWrite() throws {
        let draft = fixture()
        let encounterData = try EncounterFileCodec.exportDraft(draft, options: EncounterFileExportOptions(exportedAt: timestamp))
        let invalidEncounter = try mutateEnvelope(encounterData) { $0["exported_at"] = "" }
        let store = EncounterFileMemoryStore(encounters: ["enc_existing": draft])

        XCTAssertThrowsError(try store.importEncounter(invalidEncounter, importedAt: timestamp)) { error in
            XCTAssertEqual(error as? EncounterFileError, .invalidEnvelope("exported_at is required"))
        }
        XCTAssertEqual(store.encounters, ["enc_existing": draft])
    }

    func testEmptyExportedAtFailsForComponentsAndLibraryImports() throws {
        let draft = fixture()
        let options = EncounterFileExportOptions(exportedAt: timestamp)
        let componentsData = try EncounterFileCodec.exportComponentsFile(creatures: draft.originalCreatures ?? [], npcProfiles: draft.npcProfiles ?? [], hazards: draft.customHazards ?? [], options: options)
        let libraryData = try EncounterFileCodec.exportLibraryFile(encounters: [draft], options: options)
        let invalidComponents = try mutateEnvelope(componentsData) { $0["exported_at"] = "" }
        let invalidLibrary = try mutateEnvelope(libraryData) { $0["exported_at"] = "" }

        XCTAssertThrowsError(try EncounterFileCodec.importComponentsFile(invalidComponents)) { error in
            XCTAssertEqual(error as? EncounterFileError, .invalidEnvelope("exported_at is required"))
        }
        XCTAssertThrowsError(try EncounterFileCodec.importLibraryFile(invalidLibrary)) { error in
            XCTAssertEqual(error as? EncounterFileError, .invalidEnvelope("exported_at is required"))
        }
    }

    func testKnownV0EnvelopeMigratesExplicitly() throws {
        let data = try EncounterFileCodec.exportDraft(fixture(), options: EncounterFileExportOptions(exportedAt: timestamp))
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        object["version"] = 0
        object.removeValue(forKey: "format_version")
        let migrated = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        XCTAssertNoThrow(try EncounterFileCodec.validate(migrated))
    }

    func testMalformedEmbeddedSnapshotFailsBeforeMemoryStoreWrite() throws {
        let data = try EncounterFileCodec.exportDraft(fixture(), options: EncounterFileExportOptions(exportedAt: timestamp))
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        var payload = try XCTUnwrap(object["data"] as? [String: Any])
        var embedded = try XCTUnwrap(payload["embedded_components"] as? [String: Any])
        var creatures = try XCTUnwrap(embedded["creatures"] as? [[String: Any]])
        creatures[0]["identity"] = "not-a-creature-identity"
        embedded["creatures"] = creatures
        payload["embedded_components"] = embedded
        object["data"] = payload
        let malformed = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])

        let store = EncounterFileMemoryStore(encounters: ["enc_existing": fixture()])
        XCTAssertThrowsError(try store.importEncounter(malformed, importedAt: timestamp)) { error in
            guard case .invalidPayload = error as? EncounterFileError else {
                return XCTFail("Expected an invalid payload error, got \(error)")
            }
        }
        XCTAssertEqual(store.encounters.count, 1)
        XCTAssertNotNil(store.encounters["enc_existing"])
    }

    func testLibraryCollisionRemapsNestedEncounterRecordsAndReferences() throws {
        let draft = fixture()
        let data = try EncounterFileCodec.exportLibraryFile(encounters: [draft], options: EncounterFileExportOptions(exportedAt: timestamp))
        let result = try EncounterFileCodec.importLibraryFile(
            data,
            existingIDs: ["enc_1", "cmp_1", "ehaz_1", "phase_1", "cre_1", "haz_1", "npc_1"],
            importedAt: timestamp
        )
        let imported = try XCTUnwrap(result.library.encounters.first)
        XCTAssertEqual(result.remappedIDs["enc_1"], "enc_imported")
        XCTAssertEqual(result.remappedIDs["cmp_1"], "cmp_imported")
        XCTAssertEqual(result.remappedIDs["ehaz_1"], "ehaz_imported")
        XCTAssertEqual(result.remappedIDs["phase_1"], "phase_imported")
        XCTAssertEqual(result.remappedIDs["cre_1"], "cre_imported")
        XCTAssertEqual(result.remappedIDs["haz_1"], "haz_imported")
        XCTAssertEqual(result.remappedIDs["npc_1"], "npc_imported")
        XCTAssertEqual(imported.participantGroups.first?.id, "cmp_imported")
        XCTAssertEqual(imported.hazards.first?.id, "ehaz_imported")
        XCTAssertEqual(imported.phases.first?.id, "phase_imported")
        XCTAssertEqual(imported.phases.first?.participantIDs, ["cmp_imported"])
        XCTAssertEqual(imported.phases.first?.hazardIDs, ["ehaz_imported"])
        XCTAssertEqual(imported.npcProfiles?.first?.id, "npc_imported")
        XCTAssertEqual(imported.npcProfiles?.first?.participantGroupID, "cmp_imported")
        XCTAssertEqual(imported.originalCreatures?.first?.id, "cre_imported")
        XCTAssertEqual(imported.customHazards?.first?.id, "haz_imported")
    }

    func testComponentsAndLibraryRoundTripPreserveProfilesAndRemapIDs() throws {
        let draft = fixture()
        let options = EncounterFileExportOptions(exportedAt: timestamp)
        let componentsData = try EncounterFileCodec.exportComponentsFile(creatures: draft.originalCreatures ?? [], npcProfiles: draft.npcProfiles ?? [], hazards: draft.customHazards ?? [], options: options)
        let components = try EncounterFileCodec.importComponentsFile(componentsData, existingIDs: ["npc_1", "cre_1", "haz_1"], importedAt: timestamp)
        XCTAssertEqual(components.components.creatures.first?.id, "cre_imported")
        XCTAssertEqual(components.components.npcProfiles.first?.id, "npc_imported")
        XCTAssertEqual(components.components.npcProfiles.first?.participantGroupID, "cmp_1")
        XCTAssertEqual(components.components.hazards.first?.id, "haz_imported")

        let libraryData = try EncounterFileCodec.exportLibraryFile(encounters: [draft], creatures: [], npcProfiles: [], hazards: [], options: options)
        let library = try EncounterFileCodec.importLibraryFile(libraryData, importedAt: timestamp)
        XCTAssertEqual(library.library.encounters.first?.id, draft.id)
        XCTAssertEqual(library.library.encounters.first?.npcProfiles?.first?.id, "npc_1")
        XCTAssertEqual(library.library.encounters.first?.npcProfiles?.first?.participantGroupID, "cmp_1")
    }
}
