import Foundation

/// Errors at the semantic creature-generation boundary. The command host is
/// responsible for translating these into the protocol's native error envelope.
public enum CreatureGenerationError: Error, Equatable, Sendable {
    case unsupportedCatalogEntry
    case catalogEntryPartial
    case structural([CreatureValidationIssue])

    public var code: String {
        switch self {
        case .unsupportedCatalogEntry: return "unsupported_catalog_entry"
        case .catalogEntryPartial: return "catalog_entry_partial"
        case .structural: return "creature_structural_errors"
        }
    }

    public var message: String {
        switch self {
        case .unsupportedCatalogEntry: return "Only Creature Catalog Entries can be forked."
        case .catalogEntryPartial: return "Only complete, supported Catalog Entries can be forked."
        case .structural: return "The Creature has structural errors."
        }
    }
}

/// Pure transformations used by semantic WebMCP creature tools. Keeping
/// validation and catalog conversion here means a read-only validation call
/// cannot accidentally touch the encounter store; the host owns the eventual
/// revision-checked atomic mutation.
public enum CreatureGeneration {
    public static func validate(_ creature: OriginalCreature) -> CreatureValidationResult {
        CreatureBuilder.validate(creature)
    }

    public static func commit(_ creature: OriginalCreature, origin: String = "webmcp") throws -> OriginalCreature {
        do {
            return try CreatureBuilder.create(creature, origin: origin)
        } catch let error as CreatureBuilderError {
            if case .structural(let issues) = error { throw CreatureGenerationError.structural(issues) }
            throw error
        }
    }

    /// Creates an encounter-local Forked Creature from a complete Catalog
    /// Creature. All catalog mechanics, including existing spellcasting
    /// blocks, are copied as-is. Generation never synthesizes a spell list.
    public static func fork(
        _ catalogCreature: CatalogCreature,
        id: String? = nil,
        createdAt: String = "",
        origin: String = "webmcp"
    ) throws -> OriginalCreature {
        guard catalogCreature.summary.kind == .creature else { throw CreatureGenerationError.unsupportedCatalogEntry }
        guard catalogCreature.summary.completeness == .complete, catalogCreature.summary.support == .supported else {
            throw CreatureGenerationError.catalogEntryPartial
        }

        let role = catalogCreature.summary.roles.first ?? .brute
        let defenses = CreatureDefenses(
            ac: statistic(catalogCreature.defenses["ac"]),
            fortitude: statistic(catalogCreature.defenses["fortitude"]),
            reflex: statistic(catalogCreature.defenses["reflex"]),
            will: statistic(catalogCreature.defenses["will"]),
            hp: statistic(catalogCreature.defenses["hp"])
        )
        let strikes = catalogCreature.strikes.enumerated().map { index, strike in
            CreatureStrike(
                id: "strike_\(index + 1)",
                name: strike.name,
                actionCost: 1,
                traits: strike.traits,
                attack: statistic(strike.attack),
                damage: strike.damage.map { [CreatureDamage(expression: $0)] } ?? []
            )
        }
        let abilities = catalogCreature.abilities.enumerated().map { index, ability in
            CreatureAbility(
                id: "ability_\(index + 1)",
                name: ability.name,
                kind: abilityKind(ability.actionCost),
                actionCost: actionCost(ability.actionCost),
                traits: ability.traits,
                effectText: ability.text
            )
        }
        let blocks = catalogCreature.spellcastingBlocks
        let spellcastingStatus = blocks.isEmpty && catalogCreature.summary.spellcasting != true ? "none" : "preserved_existing"
        return OriginalCreature(
            id: id ?? "cre_forked_\(slug(catalogCreature.summary.contentID))",
            identity: CreatureIdentity(
                name: catalogCreature.summary.name,
                level: catalogCreature.summary.level,
                rarity: catalogCreature.summary.rarity,
                size: catalogCreature.size,
                traits: catalogCreature.summary.traits,
                concept: catalogCreature.concept,
                roadmap: roadmap(for: role),
                encounterRole: role
            ),
            perception: statistic(catalogCreature.perception),
            senses: catalogCreature.senses,
            languages: catalogCreature.languages,
            skills: catalogCreature.skills,
            defenses: defenses,
            speeds: catalogCreature.speeds,
            strikes: strikes,
            abilities: abilities,
            spellcastingStatus: spellcastingStatus,
            spellcastingBlocks: blocks,
            tactics: catalogCreature.tactics,
            morale: catalogCreature.morale,
            provenance: CreatureProvenance(origin: "forked", basedOnContentID: catalogCreature.summary.contentID, createdAt: createdAt, mutationOrigin: origin)
        )
    }

    private static func statistic(_ value: Int?) -> CreatureStatistic? {
        guard let value else { return nil }
        return CreatureStatistic(band: .moderate, value: value)
    }

    private static func roadmap(for role: EncounterRole) -> CreatureRoadmap? {
        CreatureRoadmap(rawValue: role.rawValue)
    }

    private static func actionCost(_ value: String?) -> Int? {
        switch value?.lowercased() {
        case "1", "one", "action": return 1
        case "2", "two": return 2
        case "3", "three": return 3
        default: return nil
        }
    }

    private static func abilityKind(_ value: String?) -> CreatureAbilityKind {
        switch value?.lowercased() {
        case "reaction": return .reaction
        case "free_action", "free action": return .freeAction
        case "passive": return .passive
        default: return .action
        }
    }

    private static func slug(_ value: String) -> String {
        let result = value.lowercased().map { character in
            character.isLetter || character.isNumber ? String(character) : "_"
        }.joined()
        return result.trimmingCharacters(in: CharacterSet(charactersIn: "_"))
    }
}
