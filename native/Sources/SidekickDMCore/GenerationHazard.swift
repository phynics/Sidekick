import Foundation

/// Generation Run operations for custom Simple Hazards.
///
/// Validation runs before the shared mutation so invalid or unsupported
/// hazards never change the encounter draft.
public extension GenerationRunController {
    func validateSimpleHazard(_ hazard: SimpleHazard) -> HazardValidationResult {
        HazardBuilder.validate(hazard)
    }

    @discardableResult
    func createSimpleHazard(
        _ hazard: SimpleHazard,
        participation: Participation = Participation(mode: .avoidable),
        placement: String = "",
        encounterID: String,
        generationRunID: String,
        expectedEncounterRevision: Int,
        expectedConstraintsRevision: Int,
        origin: String = "webmcp"
    ) throws -> String {
        var snapshot = try HazardBuilder.create(hazard)
        snapshot.provenance.mutationOrigin = origin
        let id = snapshot.id
        let encounterHazard = EncounterHazard(
            id: id,
            contentID: snapshot.provenance.catalogContentID ?? "hazard/custom/\(id)/current",
            name: snapshot.identity.name,
            level: snapshot.identity.level,
            complexity: .simple,
            participation: participation,
            placement: placement
        )

        try mutate(
            encounterID: encounterID,
            generationRunID: generationRunID,
            expectedEncounterRevision: expectedEncounterRevision,
            expectedConstraintsRevision: expectedConstraintsRevision,
            origin: origin,
            description: "Created Simple Hazard \(snapshot.identity.name)"
        ) { draft in
            guard !(draft.hazards.contains { $0.id == id }) else {
                throw SidekickDomainError("duplicate_component", "That Hazard is already in the Encounter.")
            }
            var customHazards = draft.customHazards ?? []
            guard !(customHazards.contains { $0.id == id }) else {
                throw SidekickDomainError("duplicate_component", "That Hazard is already in the Encounter.")
            }
            customHazards.append(snapshot)
            draft.customHazards = customHazards
            draft.hazards.append(encounterHazard)
        }
        return id
    }

    @discardableResult
    func updateSimpleHazard(
        _ hazard: SimpleHazard,
        participation: Participation? = nil,
        placement: String? = nil,
        encounterID: String,
        generationRunID: String,
        expectedEncounterRevision: Int,
        expectedConstraintsRevision: Int,
        origin: String = "webmcp"
    ) throws -> Int {
        var snapshot = try HazardBuilder.create(hazard)
        snapshot.provenance.mutationOrigin = origin
        let id = snapshot.id
        return try mutate(
            encounterID: encounterID,
            generationRunID: generationRunID,
            expectedEncounterRevision: expectedEncounterRevision,
            expectedConstraintsRevision: expectedConstraintsRevision,
            origin: origin,
            description: "Updated Simple Hazard \(snapshot.identity.name)"
        ) { draft in
            guard let customIndex = draft.customHazards?.firstIndex(where: { $0.id == id }) else {
                throw SidekickDomainError("unknown_component", "That Simple Hazard is not in the Encounter.")
            }
            guard let encounterIndex = draft.hazards.firstIndex(where: { $0.id == id }) else {
                throw SidekickDomainError("invalid_hazard", "The Simple Hazard placement is missing from the Encounter.")
            }
            draft.customHazards?[customIndex] = snapshot
            var placed = draft.hazards[encounterIndex]
            placed.name = snapshot.identity.name
            placed.level = snapshot.identity.level
            placed.contentID = snapshot.provenance.catalogContentID ?? "hazard/custom/\(id)/current"
            if let participation { placed.participation = participation }
            if let placement { placed.placement = placement }
            draft.hazards[encounterIndex] = placed
        }
    }

    @discardableResult
    func removeSimpleHazard(
        id: String,
        encounterID: String,
        generationRunID: String,
        expectedEncounterRevision: Int,
        expectedConstraintsRevision: Int,
        origin: String = "webmcp"
    ) throws -> Int {
        try mutate(
            encounterID: encounterID,
            generationRunID: generationRunID,
            expectedEncounterRevision: expectedEncounterRevision,
            expectedConstraintsRevision: expectedConstraintsRevision,
            origin: origin,
            description: "Removed Simple Hazard \(id)"
        ) { draft in
            guard draft.customHazards?.contains(where: { $0.id == id }) == true,
                  draft.hazards.contains(where: { $0.id == id }) else {
                throw SidekickDomainError("unknown_component", "That Simple Hazard is not in the Encounter.")
            }
            draft.customHazards?.removeAll { $0.id == id }
            draft.hazards.removeAll { $0.id == id }
        }
    }
}
