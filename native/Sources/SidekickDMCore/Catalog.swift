import Foundation

public enum CatalogEntryKind: String, Codable, CaseIterable, Sendable {
    case creature
    case hazard
}

public enum CatalogEdition: String, Codable, CaseIterable, Sendable {
    case current
    case legacy
    case adventure
}

public enum CatalogCompleteness: String, Codable, CaseIterable, Sendable {
    case complete
    case partial
}

public enum CatalogSupport: String, Codable, CaseIterable, Sendable {
    case supported
    case unsupported
}

public struct CatalogProvenance: Codable, Equatable, Sendable {
    public var sourceTitle: String
    public var sourcePage: String?
    public var edition: CatalogEdition
    public var upstreamSystem: String
    public var upstreamPack: String
    public var upstreamIdentifier: String
    public var sourceSHA256: String
    public var licenseBasis: String
    public var notices: [String]
    public var diagnostics: [String]

    public init(
        sourceTitle: String,
        sourcePage: String? = nil,
        edition: CatalogEdition = .current,
        upstreamSystem: String = "foundryvtt-pf2e",
        upstreamPack: String,
        upstreamIdentifier: String,
        sourceSHA256: String,
        licenseBasis: String = "ORC",
        notices: [String] = [],
        diagnostics: [String] = []
    ) {
        self.sourceTitle = sourceTitle
        self.sourcePage = sourcePage
        self.edition = edition
        self.upstreamSystem = upstreamSystem
        self.upstreamPack = upstreamPack
        self.upstreamIdentifier = upstreamIdentifier
        self.sourceSHA256 = sourceSHA256
        self.licenseBasis = licenseBasis
        self.notices = notices
        self.diagnostics = diagnostics
    }
}

public struct CatalogEntrySummary: Codable, Equatable, Sendable {
    public var contentID: String
    public var kind: CatalogEntryKind
    public var name: String
    public var level: Int
    public var traits: [String]
    public var rarity: String
    public var source: String
    public var edition: CatalogEdition
    public var environments: [String]
    public var roles: [EncounterRole]
    public var spellcasting: Bool?
    public var hazardComplexity: HazardComplexity?
    public var completeness: CatalogCompleteness
    public var support: CatalogSupport
    public var summary: String

    public init(
        contentID: String,
        kind: CatalogEntryKind,
        name: String,
        level: Int,
        traits: [String] = [],
        rarity: String = "common",
        source: String,
        edition: CatalogEdition = .current,
        environments: [String] = [],
        roles: [EncounterRole] = [],
        spellcasting: Bool? = nil,
        hazardComplexity: HazardComplexity? = nil,
        completeness: CatalogCompleteness = .complete,
        support: CatalogSupport = .supported,
        summary: String
    ) {
        self.contentID = contentID
        self.kind = kind
        self.name = name
        self.level = level
        self.traits = traits.sorted()
        self.rarity = rarity
        self.source = source
        self.edition = edition
        self.environments = environments.sorted()
        self.roles = roles
        self.spellcasting = spellcasting
        self.hazardComplexity = hazardComplexity
        self.completeness = completeness
        self.support = support
        self.summary = summary
    }
}

public struct CatalogStrike: Codable, Equatable, Sendable {
    public var name: String
    public var attack: Int?
    public var damage: String?
    public var traits: [String]

    public init(name: String, attack: Int? = nil, damage: String? = nil, traits: [String] = []) {
        self.name = name
        self.attack = attack
        self.damage = damage
        self.traits = traits.sorted()
    }
}

public struct CatalogAbility: Codable, Equatable, Sendable {
    public var name: String
    public var actionCost: String?
    public var traits: [String]
    public var text: String

    public init(name: String, actionCost: String? = nil, traits: [String] = [], text: String) {
        self.name = name
        self.actionCost = actionCost
        self.traits = traits.sorted()
        self.text = text
    }
}

public struct CatalogCreature: Codable, Equatable, Sendable {
    public var summary: CatalogEntrySummary
    public var concept: String
    public var size: String
    public var perception: Int?
    public var senses: [String]
    public var languages: [String]
    public var skills: [String: Int]
    public var defenses: [String: Int]
    public var speeds: [String: Int]
    public var strikes: [CatalogStrike]
    public var abilities: [CatalogAbility]
    public var spellcastingBlocks: [String]
    public var tactics: String
    public var morale: String
    public var provenance: CatalogProvenance

    public init(
        summary: CatalogEntrySummary,
        concept: String = "",
        size: String = "medium",
        perception: Int? = nil,
        senses: [String] = [],
        languages: [String] = [],
        skills: [String: Int] = [:],
        defenses: [String: Int] = [:],
        speeds: [String: Int] = [:],
        strikes: [CatalogStrike] = [],
        abilities: [CatalogAbility] = [],
        spellcastingBlocks: [String] = [],
        tactics: String = "",
        morale: String = "",
        provenance: CatalogProvenance
    ) {
        precondition(summary.kind == .creature, "CatalogCreature requires a creature summary")
        self.summary = summary
        self.concept = concept
        self.size = size
        self.perception = perception
        self.senses = senses.sorted()
        self.languages = languages.sorted()
        self.skills = skills
        self.defenses = defenses
        self.speeds = speeds
        self.strikes = strikes
        self.abilities = abilities
        self.spellcastingBlocks = spellcastingBlocks
        self.tactics = tactics
        self.morale = morale
        self.provenance = provenance
    }
}

public struct CatalogHazard: Codable, Equatable, Sendable {
    public var summary: CatalogEntrySummary
    public var detection: String
    public var disableMethods: [String]
    public var defenses: [String: Int]
    public var trigger: String
    public var effect: String
    public var routine: String?
    public var reset: String?
    public var provenance: CatalogProvenance

    public init(
        summary: CatalogEntrySummary,
        detection: String = "",
        disableMethods: [String] = [],
        defenses: [String: Int] = [:],
        trigger: String = "",
        effect: String = "",
        routine: String? = nil,
        reset: String? = nil,
        provenance: CatalogProvenance
    ) {
        precondition(summary.kind == .hazard, "CatalogHazard requires a hazard summary")
        self.summary = summary
        self.detection = detection
        self.disableMethods = disableMethods
        self.defenses = defenses
        self.trigger = trigger
        self.effect = effect
        self.routine = routine
        self.reset = reset
        self.provenance = provenance
    }
}

public enum CatalogEntry: Codable, Equatable, Sendable {
    case creature(CatalogCreature)
    case hazard(CatalogHazard)

    public var summary: CatalogEntrySummary {
        switch self {
        case .creature(let value): return value.summary
        case .hazard(let value): return value.summary
        }
    }

    public var provenance: CatalogProvenance {
        switch self {
        case .creature(let value): return value.provenance
        case .hazard(let value): return value.provenance
        }
    }

    private enum CodingKeys: String, CodingKey { case kind, creature, hazard }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(CatalogEntryKind.self, forKey: .kind) {
        case .creature: self = .creature(try container.decode(CatalogCreature.self, forKey: .creature))
        case .hazard: self = .hazard(try container.decode(CatalogHazard.self, forKey: .hazard))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .creature(let value):
            try container.encode(CatalogEntryKind.creature, forKey: .kind)
            try container.encode(value, forKey: .creature)
        case .hazard(let value):
            try container.encode(CatalogEntryKind.hazard, forKey: .kind)
            try container.encode(value, forKey: .hazard)
        }
    }
}

public struct CatalogSearchRequest: Sendable {
    public var query: String
    public var kind: CatalogEntryKind?
    public var levelMin: Int?
    public var levelMax: Int?
    public var traits: [String]
    public var rarity: [String]
    public var sources: [String]
    public var environments: [String]
    public var roles: [EncounterRole]
    public var edition: CatalogEdition?
    public var spellcasting: Bool?
    public var hazardComplexity: HazardComplexity?
    public var completeness: CatalogCompleteness?
    public var support: CatalogSupport?
    public var limit: Int
    public var offset: Int

    public init(
        query: String = "",
        kind: CatalogEntryKind? = nil,
        levelMin: Int? = nil,
        levelMax: Int? = nil,
        traits: [String] = [],
        rarity: [String] = [],
        sources: [String] = [],
        environments: [String] = [],
        roles: [EncounterRole] = [],
        edition: CatalogEdition? = nil,
        spellcasting: Bool? = nil,
        hazardComplexity: HazardComplexity? = nil,
        completeness: CatalogCompleteness? = nil,
        support: CatalogSupport? = nil,
        limit: Int = 20,
        offset: Int = 0
    ) {
        self.query = query
        self.kind = kind
        self.levelMin = levelMin
        self.levelMax = levelMax
        self.traits = traits
        self.rarity = rarity
        self.sources = sources
        self.environments = environments
        self.roles = roles
        self.edition = edition
        self.spellcasting = spellcasting
        self.hazardComplexity = hazardComplexity
        self.completeness = completeness
        self.support = support
        self.limit = limit
        self.offset = offset
    }
}

public struct CatalogSearchResult: Codable, Equatable, Sendable {
    public var total: Int
    public var offset: Int
    public var limit: Int
    public var hasMore: Bool
    public var results: [CatalogEntrySummary]

    public init(total: Int, offset: Int, limit: Int, hasMore: Bool, results: [CatalogEntrySummary]) {
        self.total = total
        self.offset = offset
        self.limit = limit
        self.hasMore = hasMore
        self.results = results
    }
}

public struct SidekickCatalog: Codable, Equatable, Sendable {
    public var fixtureVersion: Int
    public var catalogID: String
    public var sourceRevision: String
    public var entries: [CatalogEntry]

    public init(fixtureVersion: Int = 1, catalogID: String = "sidekick-dm-p0", sourceRevision: String, entries: [CatalogEntry]) {
        self.fixtureVersion = fixtureVersion
        self.catalogID = catalogID
        self.sourceRevision = sourceRevision
        self.entries = entries.sorted { $0.summary.contentID < $1.summary.contentID }
    }

    public func get(_ contentID: String) -> CatalogEntry? {
        entries.first { $0.summary.contentID == contentID }
    }

    public func all() -> [CatalogEntry] { entries }

    public func search(_ request: CatalogSearchRequest = CatalogSearchRequest()) -> CatalogSearchResult {
        let defaultCompleteness = request.completeness ?? .complete
        let defaultSupport = request.support ?? .supported
        let defaultEdition = request.edition ?? .current
        let normalizedQuery = request.query.lowercased().split { $0.isWhitespace || $0 == "," }.map(String.init).filter { !$0.isEmpty }
        let normalizedTraits = request.traits.map { $0.lowercased() }
        let normalizedRarity = request.rarity.map { $0.lowercased() }
        let normalizedSources = request.sources.map { $0.lowercased() }
        let normalizedEnvironments = request.environments.map { $0.lowercased() }

        let matches = entries.compactMap { entry -> (CatalogEntrySummary, Int)? in
            let summary = entry.summary
            guard (request.kind == nil || summary.kind == request.kind),
                  (request.levelMin == nil || summary.level >= request.levelMin!),
                  (request.levelMax == nil || summary.level <= request.levelMax!),
                  summary.edition == defaultEdition,
                  summary.completeness == defaultCompleteness,
                  summary.support == defaultSupport,
                  (normalizedRarity.isEmpty || normalizedRarity.contains(summary.rarity.lowercased())),
                  (normalizedSources.isEmpty || normalizedSources.contains { summary.source.lowercased().contains($0) }),
                  normalizedTraits.allSatisfy({ trait in summary.traits.contains { $0.lowercased() == trait } }),
                  normalizedEnvironments.allSatisfy({ facet in summary.environments.contains { $0.lowercased() == facet } }),
                  request.roles.allSatisfy({ role in summary.roles.contains(role) }),
                  (request.spellcasting == nil || summary.spellcasting == request.spellcasting),
                  (request.hazardComplexity == nil || summary.hazardComplexity == request.hazardComplexity)
            else { return nil }

            let haystack = ([summary.name, summary.summary] + summary.traits + summary.environments + summary.roles.map(\.rawValue)).map { $0.lowercased() }
            guard normalizedQuery.allSatisfy({ token in haystack.contains { $0.contains(token) } }) else { return nil }
            let name = summary.name.lowercased()
            var score = 0
            for token in normalizedQuery {
                if name == token { score += 100 }
                else if name.hasPrefix(token) { score += 70 }
                else if name.split(separator: " ").contains(where: { $0 == token }) { score += 50 }
                else if name.contains(token) { score += 35 }
                else if summary.traits.contains(where: { $0.lowercased().contains(token) }) { score += 20 }
                else { score += 10 }
            }
            return (summary, score)
        }.sorted {
            $0.1 != $1.1 ? $0.1 > $1.1 : ($0.0.name.lowercased() != $1.0.name.lowercased() ? $0.0.name.lowercased() < $1.0.name.lowercased() : $0.0.contentID < $1.0.contentID)
        }

        let safeLimit = min(max(request.limit, 1), 50)
        let safeOffset = max(request.offset, 0)
        let page = Array(matches.dropFirst(safeOffset).prefix(safeLimit)).map(\.0)
        return CatalogSearchResult(total: matches.count, offset: safeOffset, limit: safeLimit, hasMore: safeOffset + safeLimit < matches.count, results: page)
    }
}

public struct CatalogSourceRecord: Sendable {
    public var kind: CatalogEntryKind
    public var sourceSlug: String
    public var stableSlug: String
    public var edition: CatalogEdition
    public var name: String
    public var level: Int
    public var traits: [String]
    public var rarity: String
    public var source: String
    public var summary: String
    public var supported: Bool
    public var completeness: CatalogCompleteness
    public var environments: [String]
    public var roles: [EncounterRole]
    public var spellcasting: Bool?
    public var hazardComplexity: HazardComplexity?
    public var provenance: CatalogProvenance

    public init(kind: CatalogEntryKind, sourceSlug: String, stableSlug: String, edition: CatalogEdition = .current, name: String, level: Int, traits: [String] = [], rarity: String = "common", source: String, summary: String, supported: Bool = true, completeness: CatalogCompleteness = .complete, environments: [String] = [], roles: [EncounterRole] = [], spellcasting: Bool? = nil, hazardComplexity: HazardComplexity? = nil, provenance: CatalogProvenance) {
        self.kind = kind; self.sourceSlug = sourceSlug; self.stableSlug = stableSlug; self.edition = edition; self.name = name; self.level = level; self.traits = traits; self.rarity = rarity; self.source = source; self.summary = summary; self.supported = supported; self.completeness = completeness; self.environments = environments; self.roles = roles; self.spellcasting = spellcasting; self.hazardComplexity = hazardComplexity; self.provenance = provenance
    }
}

public enum CatalogGenerator {
    public static func contentID(kind: CatalogEntryKind, sourceSlug: String, stableSlug: String, edition: CatalogEdition) -> String {
        "\(kind.rawValue)/\(slug(sourceSlug))/\(slug(stableSlug))/\(edition.rawValue)"
    }

    public static func generate(_ records: [CatalogSourceRecord], sourceRevision: String, catalogID: String = "sidekick-dm-p0") -> SidekickCatalog {
        let entries = records.map { record -> CatalogEntry in
            let contentID = contentID(kind: record.kind, sourceSlug: record.sourceSlug, stableSlug: record.stableSlug, edition: record.edition)
            let support: CatalogSupport = record.supported ? .supported : .unsupported
            let summary = CatalogEntrySummary(contentID: contentID, kind: record.kind, name: record.name, level: record.level, traits: record.traits, rarity: record.rarity, source: record.source, edition: record.edition, environments: record.environments, roles: record.roles, spellcasting: record.spellcasting, hazardComplexity: record.hazardComplexity, completeness: record.completeness, support: support, summary: record.summary)
            switch record.kind {
            case .creature: return .creature(CatalogCreature(summary: summary, provenance: record.provenance))
            case .hazard: return .hazard(CatalogHazard(summary: summary, provenance: record.provenance))
            }
        }
        precondition(Set(entries.map { $0.summary.contentID }).count == entries.count, "Catalog ContentIDs must be unique")
        return SidekickCatalog(fixtureVersion: 1, catalogID: catalogID, sourceRevision: sourceRevision, entries: entries)
    }

    private static func slug(_ value: String) -> String {
        let scalars = value.lowercased().unicodeScalars.map { scalar -> Character in
            if CharacterSet.alphanumerics.contains(scalar) { return Character(String(scalar)) }
            return "-"
        }
        var value = String(scalars)
        while value.contains("--") { value = value.replacingOccurrences(of: "--", with: "-") }
        return value.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
}

public struct CatalogCompositionState: Codable, Equatable, Sendable {
    public var draft: EncounterDraft
    public var history: [EncounterDraft]
    public var redoHistory: [EncounterDraft]

    public init(draft: EncounterDraft, history: [EncounterDraft] = [], redoHistory: [EncounterDraft] = []) {
        self.draft = draft; self.history = history; self.redoHistory = redoHistory
    }
}

public final class CatalogCompositionStore: @unchecked Sendable {
    public let catalog: SidekickCatalog
    public private(set) var draft: EncounterDraft
    private var history: [EncounterDraft] = []
    private var redoHistory: [EncounterDraft] = []

    public init(catalog: SidekickCatalog, draft: EncounterDraft = EncounterDraft()) {
        self.catalog = catalog; self.draft = draft
    }

    public var budget: BudgetProjection { EncounterMath.budget(for: draft) }
    public var canUndo: Bool { !history.isEmpty }
    public var canRedo: Bool { !redoHistory.isEmpty }

    @discardableResult
    public func addExistingCreature(contentID: String, quantity: Int = 1, adjustment: CreatureAdjustment = .normal, faction: Faction = .primaryOpposition, participation: Participation = Participation(), encounterRole: EncounterRole? = nil, startingArea: String = "", sharedTactics: String = "", morale: String = "", expectedRevision: Int? = nil) throws -> String {
        try check(expectedRevision)
        guard quantity > 0 else { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
        guard let entry = catalog.get(contentID) else { throw SidekickDomainError("unknown_catalog_entry", "That Catalog Entry is not in the Catalog.") }
        guard case .creature(let creature) = entry else { throw SidekickDomainError("invalid_participant_kind", "Only Creature Catalog Entries can be added as Participant Groups.") }
        guard creature.summary.completeness == .complete, creature.summary.support == .supported else { throw SidekickDomainError("catalog_entry_partial", "Only complete, supported Catalog Entries can be added to a ready Encounter.") }
        let id = nextComponentID()
        let group = ParticipantGroup(id: id, contentID: contentID, name: creature.summary.name, level: creature.summary.level, quantity: quantity, adjustment: adjustment, faction: faction, participation: participation, encounterRole: encounterRole ?? creature.summary.roles.first ?? .brute, startingArea: startingArea, sharedTactics: sharedTactics, morale: morale)
        record(before: draft)
        draft.participantGroups.append(group)
        draft.revision += 1
        draft.provenance.lastMutationOrigin = "catalog"
        redoHistory.removeAll()
        return id
    }

    public func updateParticipantGroup(id: String, quantity: Int? = nil, adjustment: CreatureAdjustment? = nil, expectedRevision: Int? = nil) throws {
        try check(expectedRevision)
        guard let index = draft.participantGroups.firstIndex(where: { $0.id == id }) else { throw SidekickDomainError("unknown_component", "That Participant Group is not in the Encounter.") }
        if let quantity, quantity < 1 { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
        record(before: draft)
        if let quantity { draft.participantGroups[index].quantity = quantity }
        if let adjustment { draft.participantGroups[index].adjustment = adjustment }
        draft.revision += 1
        draft.provenance.lastMutationOrigin = "catalog"
        redoHistory.removeAll()
    }

    public func undo(expectedRevision: Int? = nil) throws {
        try check(expectedRevision)
        guard let previous = history.popLast() else { throw SidekickDomainError("nothing_to_undo", "There is no earlier Catalog composition to restore.") }
        redoHistory.append(draft)
        draft = previous; draft.revision += 1
    }

    public func redo(expectedRevision: Int? = nil) throws {
        try check(expectedRevision)
        guard let next = redoHistory.popLast() else { throw SidekickDomainError("nothing_to_redo", "There is no undone Catalog composition to restore.") }
        history.append(draft)
        draft = next; draft.revision += 1
    }

    public var encodedState: String {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        return String(data: (try? encoder.encode(CatalogCompositionState(draft: draft, history: history, redoHistory: redoHistory))) ?? Data(), encoding: .utf8) ?? ""
    }

    public var encodedDraft: String {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        return String(data: (try? encoder.encode(draft)) ?? Data(), encoding: .utf8) ?? ""
    }

    public func reload(from json: String) throws {
        guard let data = json.data(using: .utf8) else { throw SidekickDomainError("invalid_request", "The saved Catalog composition is not UTF-8 JSON.") }
        let decoder = JSONDecoder()
        if let state = try? decoder.decode(CatalogCompositionState.self, from: data) { draft = state.draft; history = state.history; redoHistory = state.redoHistory; return }
        guard let loaded = try? decoder.decode(EncounterDraft.self, from: data) else { throw SidekickDomainError("invalid_request", "The saved Catalog composition is invalid.") }
        draft = loaded; history.removeAll(); redoHistory.removeAll()
    }

    private func nextComponentID() -> String {
        var index = draft.participantGroups.count + 1
        while draft.participantGroups.contains(where: { $0.id == "cmp_catalog_\(index)" }) { index += 1 }
        return "cmp_catalog_\(index)"
    }

    private func record(before: EncounterDraft) { history.append(before) }
    private func check(_ expectedRevision: Int?) throws {
        if let expectedRevision, expectedRevision != draft.revision { throw SidekickDomainError("stale_revision", "The Encounter changed after it was inspected.", details: ["expected_revision": "\(expectedRevision)", "current_revision": "\(draft.revision)"]) }
    }
}

public enum CatalogFixture {
    public static func demo() -> SidekickCatalog {
        let sourceRevision = "4cbdaa37d6c33e9519561bae2c59a23e0288cbce"
        func provenance(_ pack: String, _ identifier: String) -> CatalogProvenance {
            CatalogProvenance(sourceTitle: pack == "pathfinder-monster-core" ? "Pathfinder Monster Core" : "Pathfinder GM Core", upstreamPack: pack, upstreamIdentifier: identifier, sourceSHA256: String(repeating: "0", count: 64), notices: ["ORC"])
        }
        let goblinID = "creature/monster-core/goblin-warrior/current"
        let goblinSummary = CatalogEntrySummary(contentID: goblinID, kind: .creature, name: "Goblin Warrior", level: -1, traits: ["goblin", "humanoid"], source: "Pathfinder Monster Core", environments: ["forest", "underground"], roles: [.skirmisher], spellcasting: false, summary: "A quick-footed goblin that fights best with allies.")
        let goblin = CatalogCreature(summary: goblinSummary, concept: "A frontline goblin raider", size: "small", perception: 2, senses: ["darkvision"], languages: ["common", "goblin"], defenses: ["ac": 16, "hp": 6, "fortitude": 5, "reflex": 7, "will": 3], speeds: ["land": 25], strikes: [CatalogStrike(name: "Dogslicer", attack: 5, damage: "1d6+1", traits: ["agile", "finesse"])], abilities: [CatalogAbility(name: "Goblin Scuttle", actionCost: "reaction", text: "Step when a goblin ally ends a move adjacent.")], tactics: "Use cover and numbers.", morale: "Flee when outnumbered.", provenance: provenance("pathfinder-monster-core", "goblin-warrior"))
        let bogID = "creature/monster-core/bog-strider/current"
        let bogSummary = CatalogEntrySummary(contentID: bogID, kind: .creature, name: "Bog Strider", level: 5, traits: ["amphibious", "fey"], source: "Pathfinder Monster Core", environments: ["aquatic", "forest"], roles: [.skirmisher], spellcasting: false, summary: "A mobile swamp skirmisher that uses difficult terrain.")
        let bog = CatalogCreature(summary: bogSummary, concept: "A mobile swamp skirmisher", size: "medium", defenses: ["ac": 22, "hp": 80], speeds: ["land": 25, "swim": 30], tactics: "Circle isolated targets through the water.", morale: "Withdraw when badly wounded.", provenance: provenance("pathfinder-monster-core", "bog-strider"))
        let hazardID = "hazard/gm-core/electric-latch-rune/current"
        let hazardSummary = CatalogEntrySummary(contentID: hazardID, kind: .hazard, name: "Electric Latch Rune", level: 3, traits: ["electricity", "magical", "trap"], source: "Pathfinder GM Core", environments: ["urban", "underground"], hazardComplexity: .simple, summary: "An invisible rune discharges when a latch is grasped.")
        let hazard = CatalogHazard(summary: hazardSummary, detection: "Stealth DC 20", disableMethods: ["Thievery DC 20", "Dispel Magic"], defenses: ["ac": 10], trigger: "A creature grasps the latch.", effect: "The rune deals electricity damage.", provenance: provenance("hazards", "electric-latch-rune"))
        let quickID = "hazard/gm-core/quicksand/current"
        let quickSummary = CatalogEntrySummary(contentID: quickID, kind: .hazard, name: "Quicksand", level: 3, traits: ["environmental"], source: "Pathfinder GM Core", environments: ["aquatic", "desert"], hazardComplexity: .complex, summary: "A patch of sand and water pulls creatures below the surface.")
        let quick = CatalogHazard(summary: quickSummary, detection: "Stealth DC 22", disableMethods: ["Survival DC 18"], defenses: ["ac": 10], trigger: "A creature walks onto the patch.", effect: "The creature sinks.", routine: "Pull creatures down on its initiative.", reset: "The surface settles after 24 hours.", provenance: provenance("hazards", "quicksand"))
        return SidekickCatalog(sourceRevision: sourceRevision, entries: [.creature(goblin), .creature(bog), .hazard(hazard), .hazard(quick)])
    }
}
