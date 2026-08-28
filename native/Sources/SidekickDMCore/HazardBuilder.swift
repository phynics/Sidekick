import Foundation

// MARK: - Hazard authoring DTOs

public enum HazardType: String, Codable, CaseIterable, Sendable {
    case trap
    case environmental
    case haunt
}

public enum HazardBenchmarkBand: String, Codable, CaseIterable, Sendable {
    case low
    case moderate
    case high
    case extreme
}

public struct HazardBenchmarkRange: Codable, Equatable, Sendable {
    public var minimum: Int
    public var maximum: Int

    public init(minimum: Int, maximum: Int? = nil) {
        self.minimum = minimum
        self.maximum = maximum ?? minimum
    }
}

public struct HazardStatistic: Codable, Equatable, Sendable {
    public var band: HazardBenchmarkBand
    public var value: Int

    public init(band: HazardBenchmarkBand = .moderate, value: Int = 0) {
        self.band = band
        self.value = value
    }
}

public struct HazardDetection: Codable, Equatable, Sendable {
    public var kind: String
    public var band: HazardBenchmarkBand
    public var value: Int
    public var minimumProficiency: String?

    public init(kind: String = "stealth_dc", band: HazardBenchmarkBand = .high, value: Int = 0, minimumProficiency: String? = nil) {
        self.kind = kind
        self.band = band
        self.value = value
        self.minimumProficiency = minimumProficiency
    }
}

public struct HazardDisableMethod: Codable, Equatable, Sendable {
    public var skill: String
    public var dc: Int?
    public var requirements: String?
    public var success: String?
    public var failure: String?
    public var criticalFailure: String?

    public init(skill: String = "", dc: Int? = nil, requirements: String? = nil, success: String? = nil, failure: String? = nil, criticalFailure: String? = nil) {
        self.skill = skill
        self.dc = dc
        self.requirements = requirements
        self.success = success
        self.failure = failure
        self.criticalFailure = criticalFailure
    }
}

public struct HazardDefenses: Codable, Equatable, Sendable {
    public var ac: Int?
    public var hardness: Int?
    public var hp: Int?
    public var fortitude: Int?
    public var reflex: Int?
    public var will: Int?

    public init(ac: Int? = nil, hardness: Int? = nil, hp: Int? = nil, fortitude: Int? = nil, reflex: Int? = nil, will: Int? = nil) {
        self.ac = ac
        self.hardness = hardness
        self.hp = hp
        self.fortitude = fortitude
        self.reflex = reflex
        self.will = will
    }

    public var isEmpty: Bool { ac == nil && hardness == nil && hp == nil && fortitude == nil && reflex == nil && will == nil }
}

public struct HazardResolution: Codable, Equatable, Sendable {
    public var type: String
    public var save: String?
    public var dc: HazardStatistic?
    public var attack: HazardStatistic?

    public init(type: String = "", save: String? = nil, dc: HazardStatistic? = nil, attack: HazardStatistic? = nil) {
        self.type = type
        self.save = save
        self.dc = dc
        self.attack = attack
    }
}

public struct HazardDamage: Codable, Equatable, Sendable {
    public var expression: String
    public var type: String

    public init(expression: String = "", type: String = "") {
        self.expression = expression
        self.type = type
    }
}

public struct HazardEffect: Codable, Equatable, Sendable {
    public var resolution: HazardResolution?
    public var damage: [HazardDamage]
    public var conditions: [String]
    public var text: String

    public init(resolution: HazardResolution? = nil, damage: [HazardDamage] = [], conditions: [String] = [], text: String = "") {
        self.resolution = resolution
        self.damage = damage
        self.conditions = conditions
        self.text = text
    }
}

public struct HazardIdentity: Codable, Equatable, Sendable {
    public var name: String
    public var level: Int
    public var type: HazardType
    public var complexity: HazardComplexity
    public var traits: [String]

    public init(name: String = "", level: Int = 1, type: HazardType = .trap, complexity: HazardComplexity = .simple, traits: [String] = []) {
        self.name = name
        self.level = level
        self.type = type
        self.complexity = complexity
        self.traits = traits
    }
}

public struct HazardProvenance: Codable, Equatable, Sendable {
    public var origin: String
    public var basedOnContentID: String?
    public var catalogContentID: String?
    public var createdAt: String
    public var mutationOrigin: String

    public init(origin: String = "original", basedOnContentID: String? = nil, catalogContentID: String? = nil, createdAt: String = "", mutationOrigin: String = "gm") {
        self.origin = origin
        self.basedOnContentID = basedOnContentID
        self.catalogContentID = catalogContentID
        self.createdAt = createdAt
        self.mutationOrigin = mutationOrigin
    }
}

public struct SimpleHazard: Codable, Equatable, Sendable {
    public var id: String
    public var revision: Int
    public var identity: HazardIdentity
    public var description: String
    public var detection: HazardDetection
    public var disableMethods: [HazardDisableMethod]
    public var defenses: HazardDefenses?
    public var trigger: String
    public var effect: HazardEffect
    public var reset: String?
    public var oneUse: Bool
    public var provenance: HazardProvenance

    public init(id: String = "haz_1", revision: Int = 0, identity: HazardIdentity = HazardIdentity(), description: String = "", detection: HazardDetection = HazardDetection(), disableMethods: [HazardDisableMethod] = [], defenses: HazardDefenses? = nil, trigger: String = "", effect: HazardEffect = HazardEffect(), reset: String? = nil, oneUse: Bool = false, provenance: HazardProvenance = HazardProvenance()) {
        self.id = id
        self.revision = revision
        self.identity = identity
        self.description = description
        self.detection = detection
        self.disableMethods = disableMethods
        self.defenses = defenses
        self.trigger = trigger
        self.effect = effect
        self.reset = reset
        self.oneUse = oneUse
        self.provenance = provenance
    }

    public var name: String { identity.name }
    public var level: Int { identity.level }
    public var type: HazardType { identity.type }
    public var complexity: HazardComplexity { identity.complexity }
}

public typealias HazardDraft = SimpleHazard

/// A catalog hazard retains complex-hazard running data but cannot be used to create a new custom hazard.
public struct ExistingComplexHazard: Codable, Equatable, Sendable {
    public var id: String
    public var revision: Int
    public var identity: HazardIdentity
    public var description: String
    public var detection: HazardDetection
    public var disableMethods: [HazardDisableMethod]
    public var defenses: HazardDefenses?
    public var trigger: String
    public var effect: HazardEffect
    public var reset: String?
    public var initiative: String?
    public var routine: String?
    public var actions: [String]
    public var partialDisable: String?
    public var provenance: HazardProvenance

    public init(id: String = "haz_existing", revision: Int = 0, identity: HazardIdentity, description: String = "", detection: HazardDetection = HazardDetection(), disableMethods: [HazardDisableMethod] = [], defenses: HazardDefenses? = nil, trigger: String = "", effect: HazardEffect = HazardEffect(), reset: String? = nil, initiative: String? = nil, routine: String? = nil, actions: [String] = [], partialDisable: String? = nil, provenance: HazardProvenance = HazardProvenance(origin: "existing")) {
        self.id = id
        self.revision = revision
        self.identity = identity
        self.description = description
        self.detection = detection
        self.disableMethods = disableMethods
        self.defenses = defenses
        self.trigger = trigger
        self.effect = effect
        self.reset = reset
        self.initiative = initiative
        self.routine = routine
        self.actions = actions
        self.partialDisable = partialDisable
        self.provenance = provenance
    }

    public init(catalogHazard: CatalogHazard) {
        let summary = catalogHazard.summary
        self.init(
            id: summary.contentID,
            identity: HazardIdentity(name: summary.name, level: summary.level, type: HazardType(rawValue: summary.traits.first(where: { HazardType(rawValue: $0) != nil }) ?? "trap") ?? .trap, complexity: summary.hazardComplexity ?? .complex, traits: summary.traits),
            description: summary.summary,
            detection: HazardDetection(value: Int(catalogHazard.detection.split(separator: " ").last ?? "0") ?? 0),
            disableMethods: catalogHazard.disableMethods.map { HazardDisableMethod(skill: $0) },
            defenses: HazardDefenses(ac: catalogHazard.defenses["ac"]),
            trigger: catalogHazard.trigger,
            effect: HazardEffect(text: catalogHazard.effect),
            reset: catalogHazard.reset,
            routine: catalogHazard.routine,
            provenance: HazardProvenance(origin: "existing", catalogContentID: summary.contentID)
        )
    }

    public var encounterHazard: EncounterHazard {
        EncounterHazard(id: id, contentID: provenance.catalogContentID ?? id, name: identity.name, level: identity.level, complexity: identity.complexity, placement: "")
    }
}

public typealias ComplexHazard = ExistingComplexHazard

public enum HazardSnapshot: Codable, Equatable, Sendable {
    case simple(SimpleHazard)
    case existingComplex(ExistingComplexHazard)

    public var identity: HazardIdentity {
        switch self { case .simple(let hazard): return hazard.identity; case .existingComplex(let hazard): return hazard.identity }
    }

    public var id: String {
        switch self { case .simple(let hazard): return hazard.id; case .existingComplex(let hazard): return hazard.id }
    }

    public var complexity: HazardComplexity { identity.complexity }

    private enum CodingKeys: String, CodingKey { case kind, simple, existingComplex }
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .kind) {
        case "simple": self = .simple(try container.decode(SimpleHazard.self, forKey: .simple))
        case "existing_complex": self = .existingComplex(try container.decode(ExistingComplexHazard.self, forKey: .existingComplex))
        default: throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: "Unknown hazard snapshot kind.")
        }
    }
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .simple(let hazard): try container.encode("simple", forKey: .kind); try container.encode(hazard, forKey: .simple)
        case .existingComplex(let hazard): try container.encode("existing_complex", forKey: .kind); try container.encode(hazard, forKey: .existingComplex)
        }
    }
}

// MARK: - Validation and benchmark projections

public struct HazardBenchmark: Codable, Equatable, Sendable {
    public var statistic: String
    public var band: HazardBenchmarkBand
    public var expected: HazardBenchmarkRange
    public var actual: Int
    public var deviation: Int

    public init(statistic: String, band: HazardBenchmarkBand, expected: HazardBenchmarkRange, actual: Int) {
        self.statistic = statistic
        self.band = band
        self.expected = expected
        self.actual = actual
        self.deviation = actual < expected.minimum ? actual - expected.minimum : actual > expected.maximum ? actual - expected.maximum : 0
    }
}

public struct HazardValidationIssue: Codable, Equatable, Sendable {
    public var code: String
    public var field: String
    public var message: String
    public init(code: String, field: String, message: String) { self.code = code; self.field = field; self.message = message }
}

public struct HazardValidationResult: Codable, Equatable, Sendable {
    public var structuralErrors: [HazardValidationIssue]
    public var benchmarkDeviations: [HazardBenchmark]
    public var holisticWarnings: [HazardValidationIssue]
    public var status: String
    public var isStructurallyReady: Bool { structuralErrors.isEmpty }

    public init(structuralErrors: [HazardValidationIssue] = [], benchmarkDeviations: [HazardBenchmark] = [], holisticWarnings: [HazardValidationIssue] = []) {
        self.structuralErrors = structuralErrors
        self.benchmarkDeviations = benchmarkDeviations
        self.holisticWarnings = holisticWarnings + benchmarkDeviations.map { HazardValidationIssue(code: "benchmark_deviation", field: $0.statistic, message: "\($0.statistic) is \($0.actual) versus the \($0.band.rawValue) benchmark range \($0.expected.minimum)…\($0.expected.maximum).") }
        self.status = structuralErrors.isEmpty ? (benchmarkDeviations.isEmpty && holisticWarnings.isEmpty ? "ready" : "ready_with_warnings") : "incomplete"
    }
}

public struct HazardBenchmarkSet: Codable, Equatable, Sendable {
    public var level: Int
    public var stealth: [HazardBenchmarkBand: HazardBenchmarkRange]
    public var disableDC: [HazardBenchmarkBand: HazardBenchmarkRange]
    public var armorClass: [HazardBenchmarkBand: HazardBenchmarkRange]
    public var saves: [HazardBenchmarkBand: HazardBenchmarkRange]
    public var hardness: HazardBenchmarkRange
    public var hitPoints: HazardBenchmarkRange
    public var simpleAttack: Int
    public var complexAttack: Int
    public var simpleDamage: String
    public var complexDamage: String
    public var extremeDC: Int
    public var hardDC: Int

    public init(level: Int, stealth: [HazardBenchmarkBand: HazardBenchmarkRange], disableDC: [HazardBenchmarkBand: HazardBenchmarkRange], armorClass: [HazardBenchmarkBand: HazardBenchmarkRange], saves: [HazardBenchmarkBand: HazardBenchmarkRange], hardness: HazardBenchmarkRange, hitPoints: HazardBenchmarkRange, simpleAttack: Int, complexAttack: Int, simpleDamage: String, complexDamage: String, extremeDC: Int, hardDC: Int) {
        self.level = level; self.stealth = stealth; self.disableDC = disableDC; self.armorClass = armorClass; self.saves = saves; self.hardness = hardness; self.hitPoints = hitPoints; self.simpleAttack = simpleAttack; self.complexAttack = complexAttack; self.simpleDamage = simpleDamage; self.complexDamage = complexDamage; self.extremeDC = extremeDC; self.hardDC = hardDC
    }
}

public struct HazardXPProjection: Codable, Equatable, Sendable {
    public var hazardLevel: Int
    public var partyLevel: Int
    public var relativeLevel: Int
    public var complexity: HazardComplexity
    public var participation: ParticipationMode
    public var xpPerHazard: Int
    public var totalXP: Int

    public init(hazardLevel: Int, partyLevel: Int, relativeLevel: Int, complexity: HazardComplexity, participation: ParticipationMode, xpPerHazard: Int, totalXP: Int) {
        self.hazardLevel = hazardLevel; self.partyLevel = partyLevel; self.relativeLevel = relativeLevel; self.complexity = complexity; self.participation = participation; self.xpPerHazard = xpPerHazard; self.totalXP = totalXP
    }
}

public enum HazardBuilder {
    private static let levels = Array(-1...13)
    private static let stealthExtreme = [18, 19, 20, 21, 23, 25, 26, 28, 30, 31, 33, 35, 36, 38, 40]
    private static let stealthHigh = [15, 16, 17, 18, 20, 22, 23, 25, 27, 28, 30, 32, 33, 35, 37]
    private static let stealthLow = [12, 13, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32]
    private static let disableLow = [11, 12, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 26, 27, 29]
    private static let acExtreme = [18, 19, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37]
    private static let acHigh = [15, 16, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34]
    private static let acLow = [12, 13, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31]
    private static let saveExtreme = [9, 10, 11, 12, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29]
    private static let saveHigh = [8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26]
    private static let saveLow = [2, 3, 4, 5, 6, 8, 9, 11, 12, 13, 15, 16, 18, 19, 20]
    private static let hardness = [(2,4),(3,5),(5,7),(7,9),(10,12),(11,13),(12,14),(13,15),(14,16),(15,17),(16,18),(17,19),(19,21),(20,22),(21,23)]
    private static let hp = [(11,13),(15,17),(23,25),(30,34),(42,46),(46,50),(50,54),(54,58),(58,62),(62,66),(66,70),(70,74),(78,82),(82,86),(86,90)]
    private static let simpleAttack = [10,11,13,14,16,17,19,20,22,23,25,26,28,29,31]
    private static let complexAttack = [8,8,9,11,12,14,15,17,18,20,21,23,24,26,27]
    private static let simpleDamage = ["2d4+1 (6)","2d6+3 (10)","2d6+5 (12)","2d10+7 (18)","2d10+13 (24)","4d8+10 (28)","4d8+14 (32)","4d8+18 (36)","4d10+18 (40)","4d10+22 (44)","4d10+26 (48)","4d12+26 (52)","4d12+30 (56)","6d10+27 (60)","6d10+31 (64)"]
    private static let complexDamage = ["1d4+1 (3)","1d6+2 (5)","1d6+3 (6)","1d10+4 (9)","1d10+6 (12)","2d8+5 (14)","2d8+7 (16)","2d8+9 (18)","2d10+9 (20)","2d10+11 (22)","2d10+13 (24)","2d12+13 (26)","2d12+15 (28)","3d10+14 (30)","3d10+16 (32)"]

    public static func benchmarks(level: Int) -> HazardBenchmarkSet? {
        guard let index = levels.firstIndex(of: level) else { return nil }
        func bands(_ extreme: [Int], _ high: [Int], _ low: [Int]) -> [HazardBenchmarkBand: HazardBenchmarkRange] { [.extreme: HazardBenchmarkRange(minimum: extreme[index]), .high: HazardBenchmarkRange(minimum: high[index]), .moderate: HazardBenchmarkRange(minimum: high[index] - 2), .low: HazardBenchmarkRange(minimum: low[index])] }
        let hard = hardness[index]; let points = hp[index]
        return HazardBenchmarkSet(level: level, stealth: bands(stealthExtreme, stealthHigh, stealthLow), disableDC: [.extreme: HazardBenchmarkRange(minimum: stealthExtreme[index]), .high: HazardBenchmarkRange(minimum: stealthHigh[index]), .moderate: HazardBenchmarkRange(minimum: stealthHigh[index] - 2), .low: HazardBenchmarkRange(minimum: disableLow[index])], armorClass: bands(acExtreme, acHigh, acLow), saves: bands(saveExtreme, saveHigh, saveLow), hardness: HazardBenchmarkRange(minimum: hard.0, maximum: hard.1), hitPoints: HazardBenchmarkRange(minimum: points.0, maximum: points.1), simpleAttack: simpleAttack[index], complexAttack: complexAttack[index], simpleDamage: simpleDamage[index], complexDamage: complexDamage[index], extremeDC: stealthExtreme[index] + 1, hardDC: stealthHigh[index])
    }

    public static func validate(_ hazard: SimpleHazard) -> HazardValidationResult {
        var errors: [HazardValidationIssue] = []; var deviations: [HazardBenchmark] = []; var warnings: [HazardValidationIssue] = []
        func required(_ field: String, _ message: String, _ value: String) { if value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { errors.append(HazardValidationIssue(code: "required", field: field, message: message)) } }
        required("identity.name", "A Hazard name is required.", hazard.identity.name)
        required("description", "A Hazard description is required.", hazard.description)
        if hazard.identity.traits.isEmpty { errors.append(HazardValidationIssue(code: "required", field: "identity.traits", message: "At least one Hazard trait is required.")) }
        if !( -1...20).contains(hazard.identity.level) { errors.append(HazardValidationIssue(code: "invalid_level", field: "identity.level", message: "Hazard level must be between −1 and 20.")) }
        if hazard.identity.complexity == .complex { errors.append(HazardValidationIssue(code: "unsupported_complex_hazard_generation", field: "identity.complexity", message: "Custom Complex Hazard creation is not supported. Use an Existing Complex Hazard from the Catalog.")); return finish(errors, deviations, warnings) }
        required("detection.kind", "Detection information is required.", hazard.detection.kind)
        if hazard.detection.value <= 0 { errors.append(HazardValidationIssue(code: "required", field: "detection.value", message: "Detection needs a positive Stealth or Perception DC.")) }
        guard !hazard.disableMethods.isEmpty else { errors.append(HazardValidationIssue(code: "required", field: "disable_methods", message: "At least one Disable Method is required.")); return finish(errors, deviations, warnings) }
        for (index, method) in hazard.disableMethods.enumerated() { required("disable_methods[\(index)].skill", "A Disable Method skill is required.", method.skill); if let dc = method.dc, dc <= 0 { errors.append(HazardValidationIssue(code: "invalid_dc", field: "disable_methods[\(index)].dc", message: "A Disable Method DC must be positive.")) } }
        required("trigger", "A Hazard trigger is required.", hazard.trigger)
        required("effect.text", "A runnable Hazard effect is required.", hazard.effect.text)
        if let resolution = hazard.effect.resolution {
            if resolution.type.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { errors.append(HazardValidationIssue(code: "required", field: "effect.resolution.type", message: "A resolution type is required.")) }
            if resolution.type == "save" && (resolution.save?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) { errors.append(HazardValidationIssue(code: "required", field: "effect.resolution.save", message: "A saving throw is required for a save resolution.")) }
            if let dc = resolution.dc, dc.value <= 0 { errors.append(HazardValidationIssue(code: "invalid_dc", field: "effect.resolution.dc.value", message: "The effect DC must be positive.")) }
        }
        if !hazard.oneUse { required("reset", "A reusable Hazard needs reset behavior, or mark it one-use.", hazard.reset ?? "") }
        guard let benchmark = benchmarks(level: hazard.identity.level) else { if (-1...20).contains(hazard.identity.level) { warnings.append(HazardValidationIssue(code: "unsupported_benchmark_level", field: "identity.level", message: "No bundled benchmark table is available above level 13. Review this Hazard manually.")) }; return finish(errors, deviations, warnings) }
        func check(_ field: String, _ value: Int, _ band: HazardBenchmarkBand, _ table: [HazardBenchmarkBand: HazardBenchmarkRange]) { guard let expected = table[band] else { return }; let item = HazardBenchmark(statistic: field, band: band, expected: expected, actual: value); if item.deviation != 0 { deviations.append(item) } }
        check("detection.value", hazard.detection.value, hazard.detection.band, benchmark.stealth)
        for (index, method) in hazard.disableMethods.enumerated() { if let dc = method.dc { check("disable_methods[\(index)].dc", dc, hazard.detection.band, benchmark.disableDC) } }
        if let defenses = hazard.defenses {
            if let ac = defenses.ac { check("defenses.ac", ac, .moderate, benchmark.armorClass) }
            if let hp = defenses.hp { let item = HazardBenchmark(statistic: "defenses.hp", band: .moderate, expected: benchmark.hitPoints, actual: hp); if item.deviation != 0 { deviations.append(item) } }
            if let hardness = defenses.hardness { let item = HazardBenchmark(statistic: "defenses.hardness", band: .moderate, expected: benchmark.hardness, actual: hardness); if item.deviation != 0 { deviations.append(item) } }
        }
        if let resolution = hazard.effect.resolution, let dc = resolution.dc { check("effect.resolution.dc", dc.value, dc.band, benchmark.stealth) }
        return finish(errors, deviations, warnings)
    }

    public static func create(_ hazard: SimpleHazard) throws -> SimpleHazard {
        if hazard.identity.complexity == .complex { throw SidekickDomainError("unsupported_complex_hazard_generation", "Custom Complex Hazard creation is not supported. Use an Existing Complex Hazard from the Catalog.") }
        let result = validate(hazard); guard result.structuralErrors.isEmpty else { throw SidekickDomainError("invalid_hazard", "The Simple Hazard has structural errors.", details: Dictionary(uniqueKeysWithValues: result.structuralErrors.map { ($0.field, $0.message) })) }
        return hazard
    }

    public static func representExistingComplex(_ hazard: CatalogHazard) -> ExistingComplexHazard {
        ExistingComplexHazard(catalogHazard: hazard)
    }

    public static func projectXP(hazardLevel: Int, partyLevel: Int, complexity: HazardComplexity = .simple, participation: ParticipationMode = .mandatory) -> HazardXPProjection {
        let relative = hazardLevel - partyLevel; let xp = EncounterMath.hazardXP(level: hazardLevel, partyLevel: partyLevel, complexity: complexity)
        return HazardXPProjection(hazardLevel: hazardLevel, partyLevel: partyLevel, relativeLevel: relative, complexity: complexity, participation: participation, xpPerHazard: xp, totalXP: xp)
    }

    private static func finish(_ errors: [HazardValidationIssue], _ deviations: [HazardBenchmark], _ warnings: [HazardValidationIssue]) -> HazardValidationResult { HazardValidationResult(structuralErrors: errors, benchmarkDeviations: deviations, holisticWarnings: warnings) }
}

// MARK: - Revisioned hazard authoring and encounter placement

public struct HazardBuilderPersistence: Codable, Equatable, Sendable {
    public var hazard: SimpleHazard
    public var history: [SimpleHazard]
    public var redoHistory: [SimpleHazard]
    public init(hazard: SimpleHazard, history: [SimpleHazard] = [], redoHistory: [SimpleHazard] = []) { self.hazard = hazard; self.history = history; self.redoHistory = redoHistory }
}

public enum HazardBuilderStoreError: Error, Equatable, Sendable {
    case staleRevision(expected: Int, current: Int)
    case nothingToUndo
    case nothingToRedo
    case invalidHazard
}

public final class HazardBuilderStore: @unchecked Sendable {
    public private(set) var hazard: SimpleHazard
    private var history: [SimpleHazard] = []
    private var redoHistory: [SimpleHazard] = []
    public init(hazard: SimpleHazard = SimpleHazard()) { self.hazard = hazard }
    public var readiness: HazardValidationResult { HazardBuilder.validate(hazard) }
    public var canUndo: Bool { !history.isEmpty }
    public var canRedo: Bool { !redoHistory.isEmpty }
    @discardableResult public func update(_ next: SimpleHazard, expectedRevision: Int? = nil, origin: String = "gm") throws -> Int { guard next.identity.complexity == .simple else { throw SidekickDomainError("unsupported_complex_hazard_generation", "Custom Complex Hazard creation is not supported. Use an Existing Complex Hazard from the Catalog.") }; try check(expectedRevision); var value = next; value.revision = hazard.revision + 1; value.provenance.mutationOrigin = origin; history.append(hazard); redoHistory.removeAll(); hazard = value; return value.revision }
    @discardableResult public func create(expectedRevision: Int? = nil, origin: String = "gm") throws -> SimpleHazard { _ = try HazardBuilder.create(hazard); _ = try update(hazard, expectedRevision: expectedRevision, origin: origin); return hazard }
    public func undo(expectedRevision: Int? = nil) throws { try check(expectedRevision); guard let previous = history.popLast() else { throw HazardBuilderStoreError.nothingToUndo }; redoHistory.append(hazard); var value = previous; value.revision = hazard.revision + 1; hazard = value }
    public func redo(expectedRevision: Int? = nil) throws { try check(expectedRevision); guard let next = redoHistory.popLast() else { throw HazardBuilderStoreError.nothingToRedo }; history.append(hazard); var value = next; value.revision = hazard.revision + 1; hazard = value }
    public var encodedState: Data { (try? JSONEncoder.sidekick.encode(HazardBuilderPersistence(hazard: hazard, history: history, redoHistory: redoHistory))) ?? Data() }
    public func restore(_ data: Data) throws { let state = try JSONDecoder().decode(HazardBuilderPersistence.self, from: data); hazard = state.hazard; history = state.history; redoHistory = state.redoHistory }
    private func check(_ expected: Int?) throws { if let expected, expected != hazard.revision { throw HazardBuilderStoreError.staleRevision(expected: expected, current: hazard.revision) } }
}

public struct HazardCompositionCheckpoint: Codable, Equatable, Sendable { public var draft: EncounterDraft; public var hazards: [HazardSnapshot]; public init(draft: EncounterDraft, hazards: [HazardSnapshot]) { self.draft = draft; self.hazards = hazards } }
public struct HazardCompositionPersistence: Codable, Equatable, Sendable { public var draft: EncounterDraft; public var hazards: [HazardSnapshot]; public var history: [HazardCompositionCheckpoint]; public var redoHistory: [HazardCompositionCheckpoint]; public init(draft: EncounterDraft, hazards: [HazardSnapshot] = [], history: [HazardCompositionCheckpoint] = [], redoHistory: [HazardCompositionCheckpoint] = []) { self.draft = draft; self.hazards = hazards; self.history = history; self.redoHistory = redoHistory } }

public final class HazardCompositionStore: @unchecked Sendable {
    public private(set) var draft: EncounterDraft
    public private(set) var hazards: [HazardSnapshot]
    private var history: [HazardCompositionCheckpoint] = []
    private var redoHistory: [HazardCompositionCheckpoint] = []
    public init(draft: EncounterDraft = EncounterDraft(), hazards: [HazardSnapshot] = []) { self.draft = draft; self.hazards = hazards }
    public var budget: BudgetProjection { EncounterMath.budget(for: draft) }
    public var readiness: ReadinessProjection { EncounterStore(draft: draft).readiness }
    public var canUndo: Bool { !history.isEmpty }
    public var canRedo: Bool { !redoHistory.isEmpty }
    @discardableResult public func add(_ snapshot: HazardSnapshot, participation: Participation = Participation(mode: .avoidable), placement: String = "", expectedRevision: Int? = nil, origin: String = "gm") throws -> String {
        try check(expectedRevision)
        if case .simple(let hazard) = snapshot { _ = try HazardBuilder.create(hazard) }
        let id = snapshot.id; guard !draft.hazards.contains(where: { $0.id == id }) else { throw SidekickDomainError("duplicate_component", "That Hazard is already in the Encounter.") }
        record(); let complexity = snapshot.complexity; let name = snapshot.identity.name; let encounter = EncounterHazard(id: id, contentID: snapshotContentID(snapshot), name: name, level: snapshot.identity.level, complexity: complexity, participation: participation, placement: placement); hazards.append(snapshot); draft.hazards.append(encounter); commit(origin: origin); return id
    }
    public func remove(id: String, expectedRevision: Int? = nil, origin: String = "gm") throws { try check(expectedRevision); guard let index = draft.hazards.firstIndex(where: { $0.id == id }) else { throw SidekickDomainError("unknown_component", "That Hazard is not in the Encounter.") }; record(); draft.hazards.remove(at: index); hazards.removeAll { $0.id == id }; commit(origin: origin) }
    public func undo(expectedRevision: Int? = nil) throws { try check(expectedRevision); guard let previous = history.popLast() else { throw HazardBuilderStoreError.nothingToUndo }; redoHistory.append(HazardCompositionCheckpoint(draft: draft, hazards: hazards)); restore(previous, nextRevision: draft.revision + 1) }
    public func redo(expectedRevision: Int? = nil) throws { try check(expectedRevision); guard let next = redoHistory.popLast() else { throw HazardBuilderStoreError.nothingToRedo }; history.append(HazardCompositionCheckpoint(draft: draft, hazards: hazards)); restore(next, nextRevision: draft.revision + 1) }
    public var encodedState: Data { (try? JSONEncoder.sidekick.encode(HazardCompositionPersistence(draft: draft, hazards: hazards, history: history, redoHistory: redoHistory))) ?? Data() }
    public func restore(_ data: Data) throws { let state = try JSONDecoder().decode(HazardCompositionPersistence.self, from: data); draft = state.draft; hazards = state.hazards; history = state.history; redoHistory = state.redoHistory }
    private func record() { history.append(HazardCompositionCheckpoint(draft: draft, hazards: hazards)) }
    private func commit(origin: String) { draft.revision += 1; draft.provenance.lastMutationOrigin = origin; redoHistory.removeAll() }
    private func restore(_ checkpoint: HazardCompositionCheckpoint, nextRevision: Int) { draft = checkpoint.draft; hazards = checkpoint.hazards; draft.revision = nextRevision }
    private func check(_ expected: Int?) throws { if let expected, expected != draft.revision { throw HazardBuilderStoreError.staleRevision(expected: expected, current: draft.revision) } }
    private func snapshotContentID(_ snapshot: HazardSnapshot) -> String { switch snapshot { case .simple(let hazard): return hazard.provenance.catalogContentID ?? "hazard/custom/\(hazard.id)/current"; case .existingComplex(let hazard): return hazard.provenance.catalogContentID ?? hazard.id } }
}

private extension JSONEncoder {
    static var sidekick: JSONEncoder { let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]; return encoder }
}
