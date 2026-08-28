import Foundation

// MARK: - Original Creature authoring DTOs

public enum CreatureBenchmarkBand: String, Codable, CaseIterable, Sendable {
    case terrible, low, moderate, high, extreme
}

public enum CreatureRoadmap: String, Codable, CaseIterable, Sendable {
    case brute, soldier, defender, skirmisher, sniper, controller, support, ambusher, leader, soloBoss = "solo_boss"
}

public enum CreatureAbilityKind: String, Codable, CaseIterable, Sendable {
    case action, reaction, freeAction = "free_action", passive
}

public struct CreatureStatistic: Codable, Equatable, Sendable {
    public var band: CreatureBenchmarkBand
    public var value: Int
    public init(band: CreatureBenchmarkBand = .moderate, value: Int = 0) { self.band = band; self.value = value }
}

public struct CreatureDamage: Codable, Equatable, Sendable {
    public var expression: String
    public var type: String
    public var band: CreatureBenchmarkBand?
    public init(expression: String = "", type: String = "", band: CreatureBenchmarkBand? = nil) { self.expression = expression; self.type = type; self.band = band }
}

public struct CreatureStrike: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var actionCost: Int
    public var traits: [String]
    public var attack: CreatureStatistic?
    public var damage: [CreatureDamage]
    public var effect: String

    public init(id: String = "strike_1", name: String = "", actionCost: Int = 1, traits: [String] = [], attack: CreatureStatistic? = nil, damage: [CreatureDamage] = [], effect: String = "") {
        self.id = id; self.name = name; self.actionCost = actionCost; self.traits = traits; self.attack = attack; self.damage = damage; self.effect = effect
    }
}

public struct CreatureResolution: Codable, Equatable, Sendable {
    public var type: String
    public var save: String?
    public var dc: CreatureStatistic?
    public init(type: String = "", save: String? = nil, dc: CreatureStatistic? = nil) { self.type = type; self.save = save; self.dc = dc }
}

public struct CreatureAbility: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var kind: CreatureAbilityKind
    public var actionCost: Int?
    public var traits: [String]
    public var trigger: String?
    public var requirements: String?
    public var target: String?
    public var range: String?
    public var area: String?
    public var resolution: CreatureResolution?
    public var damage: [CreatureDamage]
    public var conditions: [String]
    public var duration: String?
    public var frequency: String?
    public var effectText: String

    public init(id: String = "ability_1", name: String = "", kind: CreatureAbilityKind = .action, actionCost: Int? = nil, traits: [String] = [], trigger: String? = nil, requirements: String? = nil, target: String? = nil, range: String? = nil, area: String? = nil, resolution: CreatureResolution? = nil, damage: [CreatureDamage] = [], conditions: [String] = [], duration: String? = nil, frequency: String? = nil, effectText: String = "") {
        self.id = id; self.name = name; self.kind = kind; self.actionCost = actionCost; self.traits = traits; self.trigger = trigger; self.requirements = requirements; self.target = target; self.range = range; self.area = area; self.resolution = resolution; self.damage = damage; self.conditions = conditions; self.duration = duration; self.frequency = frequency; self.effectText = effectText
    }
}

public struct CreatureIdentity: Codable, Equatable, Sendable {
    public var name: String
    public var level: Int
    public var rarity: String
    public var size: String
    public var traits: [String]
    public var concept: String
    public var roadmap: CreatureRoadmap?
    public var encounterRole: EncounterRole

    public init(name: String = "", level: Int = 1, rarity: String = "common", size: String = "medium", traits: [String] = [], concept: String = "", roadmap: CreatureRoadmap? = nil, encounterRole: EncounterRole = .brute) {
        self.name = name; self.level = level; self.rarity = rarity; self.size = size; self.traits = traits; self.concept = concept; self.roadmap = roadmap; self.encounterRole = encounterRole
    }
}

public struct CreatureDefenses: Codable, Equatable, Sendable {
    public var ac: CreatureStatistic?
    public var fortitude: CreatureStatistic?
    public var reflex: CreatureStatistic?
    public var will: CreatureStatistic?
    public var hp: CreatureStatistic?
    public var immunities: [String]
    public var weaknesses: [String]
    public var resistances: [String]

    public init(ac: CreatureStatistic? = nil, fortitude: CreatureStatistic? = nil, reflex: CreatureStatistic? = nil, will: CreatureStatistic? = nil, hp: CreatureStatistic? = nil, immunities: [String] = [], weaknesses: [String] = [], resistances: [String] = []) {
        self.ac = ac; self.fortitude = fortitude; self.reflex = reflex; self.will = will; self.hp = hp; self.immunities = immunities; self.weaknesses = weaknesses; self.resistances = resistances
    }
}

public struct CreatureProvenance: Codable, Equatable, Sendable {
    public var origin: String
    public var basedOnContentID: String?
    public var createdAt: String
    public var mutationOrigin: String

    public init(origin: String = "original", basedOnContentID: String? = nil, createdAt: String = "", mutationOrigin: String = "gm") {
        self.origin = origin; self.basedOnContentID = basedOnContentID; self.createdAt = createdAt; self.mutationOrigin = mutationOrigin
    }
}

public struct OriginalCreature: Codable, Equatable, Sendable {
    public var id: String
    public var revision: Int
    public var identity: CreatureIdentity
    public var perception: CreatureStatistic?
    public var senses: [String]
    public var languages: [String]
    public var skills: [String: Int]
    public var defenses: CreatureDefenses
    public var speeds: [String: Int]
    public var strikes: [CreatureStrike]
    public var abilities: [CreatureAbility]
    public var spellcastingStatus: String
    /// Existing spellcasting text is carried through a fork unchanged. The
    /// generation boundary may preserve these blocks, but never invents or
    /// rewrites a spell list.
    public var spellcastingBlocks: [String]
    public var tactics: String
    public var morale: String
    public var provenance: CreatureProvenance

    public init(id: String = "cre_original", revision: Int = 0, identity: CreatureIdentity = CreatureIdentity(), perception: CreatureStatistic? = nil, senses: [String] = [], languages: [String] = [], skills: [String: Int] = [:], defenses: CreatureDefenses = CreatureDefenses(), speeds: [String: Int] = [:], strikes: [CreatureStrike] = [], abilities: [CreatureAbility] = [], spellcastingStatus: String = "none", spellcastingBlocks: [String] = [], tactics: String = "", morale: String = "", provenance: CreatureProvenance = CreatureProvenance()) {
        self.id = id; self.revision = revision; self.identity = identity; self.perception = perception; self.senses = senses; self.languages = languages; self.skills = skills; self.defenses = defenses; self.speeds = speeds; self.strikes = strikes; self.abilities = abilities; self.spellcastingStatus = spellcastingStatus; self.spellcastingBlocks = spellcastingBlocks; self.tactics = tactics; self.morale = morale; self.provenance = provenance
    }

    public init(name: String, level: Int, concept: String = "", roadmap: CreatureRoadmap? = nil, encounterRole: EncounterRole = .brute, id: String = "cre_original") {
        self.init(id: id, identity: CreatureIdentity(name: name, level: level, concept: concept, roadmap: roadmap, encounterRole: encounterRole))
    }

    private enum CodingKeys: String, CodingKey {
        case id, revision, identity, perception, senses, languages, skills, defenses, speeds, strikes, abilities
        case spellcastingStatus, spellcastingBlocks, spellcasting, tactics, morale, provenance
    }

    private struct SpellcastingPayload: Codable {
        var status: String
        var blocks: [String]
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let nestedSpellcasting = try container.decodeIfPresent(SpellcastingPayload.self, forKey: .spellcasting)
        let spellcastingStatus = try container.decodeIfPresent(String.self, forKey: .spellcastingStatus) ?? "none"
        let spellcastingBlocks = try container.decodeIfPresent([String].self, forKey: .spellcastingBlocks) ?? []
        self.init(
            id: try container.decodeIfPresent(String.self, forKey: .id) ?? "cre_original",
            revision: try container.decodeIfPresent(Int.self, forKey: .revision) ?? 0,
            identity: try container.decodeIfPresent(CreatureIdentity.self, forKey: .identity) ?? CreatureIdentity(),
            perception: try container.decodeIfPresent(CreatureStatistic.self, forKey: .perception),
            senses: try container.decodeIfPresent([String].self, forKey: .senses) ?? [],
            languages: try container.decodeIfPresent([String].self, forKey: .languages) ?? [],
            skills: try container.decodeIfPresent([String: Int].self, forKey: .skills) ?? [:],
            defenses: try container.decodeIfPresent(CreatureDefenses.self, forKey: .defenses) ?? CreatureDefenses(),
            speeds: try container.decodeIfPresent([String: Int].self, forKey: .speeds) ?? [:],
            strikes: try container.decodeIfPresent([CreatureStrike].self, forKey: .strikes) ?? [],
            abilities: try container.decodeIfPresent([CreatureAbility].self, forKey: .abilities) ?? [],
            spellcastingStatus: nestedSpellcasting?.status ?? spellcastingStatus,
            spellcastingBlocks: nestedSpellcasting?.blocks ?? spellcastingBlocks,
            tactics: try container.decodeIfPresent(String.self, forKey: .tactics) ?? "",
            morale: try container.decodeIfPresent(String.self, forKey: .morale) ?? "",
            provenance: try container.decodeIfPresent(CreatureProvenance.self, forKey: .provenance) ?? CreatureProvenance()
        )
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(revision, forKey: .revision)
        try container.encode(identity, forKey: .identity)
        try container.encodeIfPresent(perception, forKey: .perception)
        try container.encode(senses, forKey: .senses)
        try container.encode(languages, forKey: .languages)
        try container.encode(skills, forKey: .skills)
        try container.encode(defenses, forKey: .defenses)
        try container.encode(speeds, forKey: .speeds)
        try container.encode(strikes, forKey: .strikes)
        try container.encode(abilities, forKey: .abilities)
        try container.encode(spellcastingStatus, forKey: .spellcastingStatus)
        try container.encode(spellcastingBlocks, forKey: .spellcastingBlocks)
        try container.encode(tactics, forKey: .tactics)
        try container.encode(morale, forKey: .morale)
        try container.encode(provenance, forKey: .provenance)
    }
}

public typealias CreatureDraft = OriginalCreature
public typealias CreatureSnapshot = OriginalCreature
public typealias OriginalCreatureDraft = OriginalCreature

public struct CreatureBenchmarkRange: Codable, Equatable, Sendable {
    public var minimum: Int
    public var maximum: Int
    public init(minimum: Int, maximum: Int? = nil) { self.minimum = minimum; self.maximum = maximum ?? minimum }
}

public struct CreatureBenchmark: Codable, Equatable, Sendable {
    public var statistic: String
    public var band: CreatureBenchmarkBand
    public var expected: CreatureBenchmarkRange
    public var actual: Int
    public var deviation: Int
    public init(statistic: String, band: CreatureBenchmarkBand, expected: CreatureBenchmarkRange, actual: Int) { self.statistic = statistic; self.band = band; self.expected = expected; self.actual = actual; self.deviation = actual < expected.minimum ? actual - expected.minimum : actual > expected.maximum ? actual - expected.maximum : 0 }
}

public struct CreatureBenchmarkSet: Codable, Equatable, Sendable {
    public var level: Int
    public var perception: [CreatureBenchmarkBand: CreatureBenchmarkRange]
    public var armorClass: [CreatureBenchmarkBand: CreatureBenchmarkRange]
    public var savingThrows: [CreatureBenchmarkBand: CreatureBenchmarkRange]
    public var hitPoints: [CreatureBenchmarkBand: CreatureBenchmarkRange]
    public var attack: [CreatureBenchmarkBand: CreatureBenchmarkRange]
    public var dc: [CreatureBenchmarkBand: CreatureBenchmarkRange]
    public var damage: [CreatureBenchmarkBand: String]
    public init(level: Int, perception: [CreatureBenchmarkBand: CreatureBenchmarkRange], armorClass: [CreatureBenchmarkBand: CreatureBenchmarkRange], savingThrows: [CreatureBenchmarkBand: CreatureBenchmarkRange], hitPoints: [CreatureBenchmarkBand: CreatureBenchmarkRange], attack: [CreatureBenchmarkBand: CreatureBenchmarkRange], dc: [CreatureBenchmarkBand: CreatureBenchmarkRange], damage: [CreatureBenchmarkBand: String]) { self.level = level; self.perception = perception; self.armorClass = armorClass; self.savingThrows = savingThrows; self.hitPoints = hitPoints; self.attack = attack; self.dc = dc; self.damage = damage }
}

public struct CreatureValidationIssue: Codable, Equatable, Sendable {
    public var code: String
    public var field: String
    public var message: String
    public init(code: String, field: String, message: String) { self.code = code; self.field = field; self.message = message }
}

public struct CreatureValidationResult: Codable, Equatable, Sendable {
    public var structuralErrors: [CreatureValidationIssue]
    public var benchmarkDeviations: [CreatureBenchmark]
    public var holisticWarnings: [CreatureValidationIssue]
    public var status: String
    public var isStructurallyReady: Bool { structuralErrors.isEmpty }
    public init(structuralErrors: [CreatureValidationIssue] = [], benchmarkDeviations: [CreatureBenchmark] = [], holisticWarnings: [CreatureValidationIssue] = []) { self.structuralErrors = structuralErrors; self.benchmarkDeviations = benchmarkDeviations; self.holisticWarnings = holisticWarnings; self.status = structuralErrors.isEmpty ? (benchmarkDeviations.isEmpty && holisticWarnings.isEmpty ? "ready" : "ready_with_warnings") : "incomplete" }
}
public typealias CreatureBuilderValidation = CreatureValidationResult

public struct CreatureXPProjection: Codable, Equatable, Sendable {
    public var creatureLevel: Int
    public var partyLevel: Int
    public var relativeLevel: Int
    public var quantity: Int
    public var xpPerCreature: Int
    public var totalXP: Int
    public init(creatureLevel: Int, partyLevel: Int, relativeLevel: Int, quantity: Int, xpPerCreature: Int, totalXP: Int) { self.creatureLevel = creatureLevel; self.partyLevel = partyLevel; self.relativeLevel = relativeLevel; self.quantity = quantity; self.xpPerCreature = xpPerCreature; self.totalXP = totalXP }
}

// MARK: - Benchmark-guided authoring

public enum CreatureBuilder {
    private static let levels = Array(-1...13)
    private static let acExtreme = [18, 19, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37]
    private static let acHigh = [15, 16, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34]
    private static let acModerate = [14, 15, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32, 33]
    private static let acLow = [12, 13, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31]
    private static let saveHigh = [8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26]
    private static let saveModerate = [5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 18, 19, 21, 22, 23]
    private static let hpModerate = [(7,8),(14,16),(19,21),(28,32),(42,48),(57,63),(72,78),(91,99),(111,119),(131,139),(151,159),(171,179),(191,199),(211,219),(231,239)]
    private static let hpHigh = [(9,9),(17,20),(24,26),(36,40),(53,59),(72,78),(91,97),(115,123),(140,148),(165,173),(190,198),(215,223),(240,248),(265,273),(290,298)]
    private static let hpLow = [(5,6),(11,13),(14,16),(21,25),(31,37),(42,48),(53,59),(67,75),(82,90),(97,105),(112,120),(127,135),(142,150),(157,165),(172,180)]
    private static let attackHigh = [8, 8, 9, 11, 12, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27]
    private static let dcHigh = [16, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33]
    private static let damageExtreme = ["1d6+1 (4)", "1d6+3 (6)", "1d8+4 (8)", "1d12+4 (11)", "1d12+8 (15)", "2d10+7 (18)", "2d12+7 (20)", "2d12+10 (23)", "2d12+12 (25)", "2d12+15 (28)", "2d12+17 (30)", "2d12+20 (33)", "2d12+22 (35)", "3d12+19 (38)", "3d12+21 (40)"]
    private static let damageHigh = ["1d4+1 (3)", "1d6+2 (5)", "1d6+3 (6)", "1d10+4 (9)", "1d10+6 (12)", "2d8+5 (14)", "2d8+7 (16)", "2d8+9 (18)", "2d10+9 (20)", "2d10+11 (22)", "2d10+13 (24)", "2d12+13 (26)", "2d12+15 (28)", "3d10+14 (30)", "3d10+16 (32)"]
    private static let damageModerate = ["1d4 (3)", "1d4+2 (4)", "1d6+2 (5)", "1d8+4 (8)", "1d8+6 (10)", "2d6+5 (12)", "2d6+6 (13)", "2d6+8 (15)", "2d8+8 (17)", "2d8+9 (18)", "2d8+11 (20)", "2d10+11 (22)", "2d10+12 (23)", "3d8+12 (25)", "3d8+14 (27)"]
    private static let damageLow = ["1d4 (2)", "1d4+1 (3)", "1d4+2 (4)", "1d6+3 (6)", "1d6+5 (8)", "2d4+4 (9)", "2d4+6 (11)", "2d4+7 (12)", "2d6+6 (13)", "2d6+8 (15)", "2d6+9 (16)", "2d6+10 (17)", "2d8+10 (19)", "3d6+10 (20)", "3d6+11 (21)"]

    public static func benchmarks(level: Int) -> CreatureBenchmarkSet? {
        guard let index = levels.firstIndex(of: level) else { return nil }
        func map(_ values: [Int]) -> [CreatureBenchmarkBand: CreatureBenchmarkRange] { [.high: CreatureBenchmarkRange(minimum: values[index]), .moderate: CreatureBenchmarkRange(minimum: values[index] - 2), .low: CreatureBenchmarkRange(minimum: values[index] - 4), .extreme: CreatureBenchmarkRange(minimum: values[index] + 2), .terrible: CreatureBenchmarkRange(minimum: values[index] - 6)] }
        let hp = hpModerate[index]
        return CreatureBenchmarkSet(level: level, perception: map(acHigh), armorClass: [.extreme: CreatureBenchmarkRange(minimum: acExtreme[index]), .high: CreatureBenchmarkRange(minimum: acHigh[index]), .moderate: CreatureBenchmarkRange(minimum: acModerate[index]), .low: CreatureBenchmarkRange(minimum: acLow[index]), .terrible: CreatureBenchmarkRange(minimum: max(1, acLow[index] - 2))], savingThrows: [.high: CreatureBenchmarkRange(minimum: saveHigh[index]), .moderate: CreatureBenchmarkRange(minimum: saveModerate[index]), .low: CreatureBenchmarkRange(minimum: saveModerate[index] - 3), .extreme: CreatureBenchmarkRange(minimum: saveHigh[index] + 1), .terrible: CreatureBenchmarkRange(minimum: saveModerate[index] - 5)], hitPoints: [.high: CreatureBenchmarkRange(minimum: hpHigh[index].0, maximum: hpHigh[index].1), .moderate: CreatureBenchmarkRange(minimum: hp.0, maximum: hp.1), .low: CreatureBenchmarkRange(minimum: hpLow[index].0, maximum: hpLow[index].1), .extreme: CreatureBenchmarkRange(minimum: hpHigh[index].0 + 35, maximum: hpHigh[index].1 + 35), .terrible: CreatureBenchmarkRange(minimum: max(1, hpLow[index].0 - 5), maximum: max(1, hpLow[index].1 - 5))], attack: map(attackHigh), dc: map(dcHigh), damage: [.extreme: damageExtreme[index], .high: damageHigh[index], .moderate: damageModerate[index], .low: damageLow[index]])
    }

    public static func recommendedBands(for roadmap: CreatureRoadmap) -> [String: CreatureBenchmarkBand] {
        switch roadmap {
        case .brute: return ["ac": .moderate, "fortitude": .high, "reflex": .low, "will": .moderate, "hp": .high, "perception": .moderate, "attack": .high, "damage": .high, "dc": .moderate]
        case .soldier, .defender: return ["ac": .high, "fortitude": .high, "reflex": .moderate, "will": .moderate, "hp": .moderate, "perception": .high, "attack": .high, "damage": .moderate, "dc": .moderate]
        case .sniper: return ["ac": .moderate, "fortitude": .moderate, "reflex": .high, "will": .moderate, "hp": .low, "perception": .high, "attack": .high, "damage": .high, "dc": .high]
        case .controller, .support: return ["ac": .moderate, "fortitude": .low, "reflex": .moderate, "will": .high, "hp": .low, "perception": .high, "attack": .moderate, "damage": .low, "dc": .high]
        case .skirmisher, .ambusher: return ["ac": .moderate, "fortitude": .moderate, "reflex": .high, "will": .moderate, "hp": .moderate, "perception": .high, "attack": .high, "damage": .moderate, "dc": .moderate]
        case .leader: return ["ac": .high, "fortitude": .high, "reflex": .moderate, "will": .high, "hp": .high, "perception": .high, "attack": .high, "damage": .high, "dc": .high]
        case .soloBoss: return ["ac": .high, "fortitude": .high, "reflex": .high, "will": .high, "hp": .extreme, "perception": .high, "attack": .high, "damage": .high, "dc": .high]
        }
    }

    /// Commits a validated draft as an Original Creature snapshot. Holistic
    /// warnings are retained for the GM, while structural errors are blocking.
    public static func create(_ draft: OriginalCreature, origin: String = "gm") throws -> OriginalCreature {
        let result = validate(draft)
        guard result.structuralErrors.isEmpty else { throw CreatureBuilderError.structural(result.structuralErrors) }
        var snapshot = draft
        snapshot.provenance.origin = draft.provenance.origin.isEmpty ? "original" : draft.provenance.origin
        snapshot.provenance.mutationOrigin = origin
        return snapshot
    }

    public static func expectedBenchmark(level: Int, statistic: String, band: CreatureBenchmarkBand) -> CreatureBenchmarkRange? {
        guard let set = benchmarks(level: level) else { return nil }
        switch statistic {
        case "perception": return set.perception[band]
        case "ac", "armor_class", "defenses.ac": return set.armorClass[band]
        case "fortitude", "reflex", "will", "saving_throws": return set.savingThrows[band]
        case "hp", "hit_points", "defenses.hp": return set.hitPoints[band]
        case "attack", "strikes.attack": return set.attack[band]
        case "dc": return set.dc[band]
        default: return nil
        }
    }

    public static func validate(_ creature: OriginalCreature) -> CreatureValidationResult {
        var errors: [CreatureValidationIssue] = []; var deviations: [CreatureBenchmark] = []; var warnings: [CreatureValidationIssue] = []
        let required: [(String, String, Bool)] = [("identity.name", "A Creature name is required.", !creature.identity.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty), ("identity.concept", "A Creature concept is required.", !creature.identity.concept.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty), ("identity.size", "A Creature size is required.", !creature.identity.size.isEmpty), ("identity.traits", "At least one Creature trait is required.", !creature.identity.traits.isEmpty), ("identity.roadmap", "A Creature Roadmap is required.", creature.identity.roadmap != nil), ("languages", "At least one language is required.", !creature.languages.isEmpty), ("speeds", "At least one Speed is required.", !creature.speeds.isEmpty), ("tactics", "Tactics are required.", !creature.tactics.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty), ("morale", "Morale or an exit condition is required.", !creature.morale.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)]
        for (field, message, valid) in required where !valid { errors.append(CreatureValidationIssue(code: "required", field: field, message: message)) }
        if !( -1...20).contains(creature.identity.level) { errors.append(CreatureValidationIssue(code: "invalid_level", field: "identity.level", message: "Creature level must be between −1 and 20.")) }
        let benchmarkSet = benchmarks(level: creature.identity.level)
        if benchmarkSet == nil && (-1...20).contains(creature.identity.level) { warnings.append(CreatureValidationIssue(code: "unsupported_benchmark_level", field: "identity.level", message: "No bundled benchmark table is available above level 13; review this Creature manually.")) }
        func check(_ field: String, _ value: CreatureStatistic?, _ table: [CreatureBenchmarkBand: CreatureBenchmarkRange]?) { guard let value else { errors.append(CreatureValidationIssue(code: "required", field: field, message: "This statistic is required.")); return }; if value.value <= 0 { errors.append(CreatureValidationIssue(code: "invalid_value", field: field, message: "This statistic must be greater than zero.")) }; guard let table else { return }; let expected = table[value.band] ?? CreatureBenchmarkRange(minimum: 0); let item = CreatureBenchmark(statistic: field, band: value.band, expected: expected, actual: value.value); if item.deviation != 0 { deviations.append(item) } }
        check("perception", creature.perception, benchmarkSet?.perception); check("defenses.ac", creature.defenses.ac, benchmarkSet?.armorClass); check("defenses.fortitude", creature.defenses.fortitude, benchmarkSet?.savingThrows); check("defenses.reflex", creature.defenses.reflex, benchmarkSet?.savingThrows); check("defenses.will", creature.defenses.will, benchmarkSet?.savingThrows); check("defenses.hp", creature.defenses.hp, benchmarkSet?.hitPoints)
        guard let strike = creature.strikes.first else { errors.append(CreatureValidationIssue(code: "required", field: "strikes", message: "At least one Strike or offensive action is required.")); return finish(errors, deviations, warnings) }
        if strike.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { errors.append(CreatureValidationIssue(code: "required", field: "strikes[0].name", message: "A Strike name is required.")) }
        if !(1...3).contains(strike.actionCost) { errors.append(CreatureValidationIssue(code: "invalid_action_cost", field: "strikes[0].action_cost", message: "Strike action cost must be 1, 2, or 3.")) }
        if strike.damage.isEmpty || strike.damage.allSatisfy({ $0.expression.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) { errors.append(CreatureValidationIssue(code: "required", field: "strikes[0].damage", message: "A Strike needs at least one damage expression.")) }
        check("strikes[0].attack", strike.attack, benchmarkSet?.attack)
        for ability in creature.abilities { let abilityPrefix = "abilities." + ability.id; if ability.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { errors.append(CreatureValidationIssue(code: "required", field: abilityPrefix + ".name", message: "An ability name is required.")) }; if let cost = ability.actionCost, !(1...3).contains(cost) { errors.append(CreatureValidationIssue(code: "invalid_action_cost", field: abilityPrefix + ".action_cost", message: "Ability action cost must be 1, 2, or 3.")) }; if ability.resolution?.dc != nil { check(abilityPrefix + ".dc", ability.resolution?.dc, benchmarkSet?.dc) } }
        if let roadmap = creature.identity.roadmap { let bands = recommendedBands(for: roadmap); if bands["ac"] == CreatureBenchmarkBand.high && bands["hp"] == CreatureBenchmarkBand.extreme { warnings.append(CreatureValidationIssue(code: "extreme_defenses", field: "defenses", message: "High AC combined with extreme HP can make this Creature unusually durable.")) }; if roadmap == .soloBoss && creature.abilities.count < 2 { warnings.append(CreatureValidationIssue(code: "solo_action_economy", field: "abilities", message: "A solo boss usually needs additional actions or reactions to keep pace with a party.")) } }
        if creature.strikes.count > 3 || creature.abilities.count > 8 { warnings.append(CreatureValidationIssue(code: "complexity", field: "abilities", message: "A large action list may be slow to run at the table.")) }
        if creature.abilities.contains(where: { $0.conditions.count > 0 && $0.frequency == nil }) { warnings.append(CreatureValidationIssue(code: "unlimited_control", field: "abilities", message: "A control ability applies conditions without a frequency or other visible limit.")) }
        return finish(errors, deviations, warnings)
    }

    private static func finish(_ errors: [CreatureValidationIssue], _ deviations: [CreatureBenchmark], _ warnings: [CreatureValidationIssue]) -> CreatureValidationResult { CreatureValidationResult(structuralErrors: errors, benchmarkDeviations: deviations, holisticWarnings: warnings + deviations.map { CreatureValidationIssue(code: "benchmark_deviation", field: $0.statistic, message: "\($0.statistic) is \($0.actual) versus the \($0.band.rawValue) benchmark range \($0.expected.minimum)…\($0.expected.maximum).") }) }

    public static func projectXP(creatureLevel: Int, partyLevel: Int, quantity: Int = 1) -> CreatureXPProjection { let relative = creatureLevel - partyLevel; let xp: Int; switch relative { case ...(-5): xp = 0; case -4: xp = 10; case -3: xp = 15; case -2: xp = 20; case -1: xp = 30; case 0: xp = 40; case 1: xp = 60; case 2: xp = 80; case 3: xp = 120; default: xp = 160 }; let safeQuantity = max(0, quantity); return CreatureXPProjection(creatureLevel: creatureLevel, partyLevel: partyLevel, relativeLevel: relative, quantity: safeQuantity, xpPerCreature: xp, totalXP: xp * safeQuantity) }
}

// MARK: - Revisioned, undoable local authoring store

public struct CreatureBuilderPersistence: Codable, Equatable, Sendable {
    public var creature: OriginalCreature
    public var history: [OriginalCreature]
    public var redoHistory: [OriginalCreature]
    public init(creature: OriginalCreature, history: [OriginalCreature] = [], redoHistory: [OriginalCreature] = []) { self.creature = creature; self.history = history; self.redoHistory = redoHistory }
}

public final class CreatureBuilderStore: @unchecked Sendable {
    public private(set) var creature: OriginalCreature
    private var history: [OriginalCreature]
    private var redoHistory: [OriginalCreature]
    public init(creature: OriginalCreature = OriginalCreature()) { self.creature = creature; self.history = []; self.redoHistory = [] }
    public var readiness: CreatureValidationResult { CreatureBuilder.validate(creature) }
    public var canUndo: Bool { !history.isEmpty }
    public var canRedo: Bool { !redoHistory.isEmpty }
    @discardableResult public func update(_ next: OriginalCreature, expectedRevision: Int? = nil, origin: String = "gm") throws -> Int { try check(expectedRevision); var value = next; value.revision = creature.revision + 1; value.provenance.mutationOrigin = origin; history.append(creature); redoHistory.removeAll(); creature = value; return value.revision }
    public func undo(expectedRevision: Int? = nil) throws { try check(expectedRevision); guard let previous = history.popLast() else { throw CreatureBuilderStoreError.nothingToUndo }; redoHistory.append(creature); var value = previous; value.revision = creature.revision + 1; creature = value }
    public func redo(expectedRevision: Int? = nil) throws { try check(expectedRevision); guard let next = redoHistory.popLast() else { throw CreatureBuilderStoreError.nothingToRedo }; history.append(creature); var value = next; value.revision = creature.revision + 1; creature = value }
    public var encodedState: Data { (try? JSONEncoder().encode(CreatureBuilderPersistence(creature: creature, history: history, redoHistory: redoHistory))) ?? Data() }
    public func restore(_ data: Data) throws { let state = try JSONDecoder().decode(CreatureBuilderPersistence.self, from: data); creature = state.creature; history = state.history; redoHistory = state.redoHistory }
    private func check(_ expected: Int?) throws { if let expected, expected != creature.revision { throw CreatureBuilderStoreError.staleRevision(expected: expected, current: creature.revision) } }
}

public enum CreatureBuilderStoreError: Error, Equatable, Sendable {
    case staleRevision(expected: Int, current: Int)
    case nothingToUndo
    case nothingToRedo
}

public enum CreatureBuilderError: Error, Equatable, Sendable {
    case structural([CreatureValidationIssue])
}
