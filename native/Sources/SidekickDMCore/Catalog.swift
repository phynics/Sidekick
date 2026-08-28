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

/// The identity fields a caller may echo back after reading a Catalog Entry.
/// The catalog, rather than the caller, remains authoritative for every value.
public struct CatalogEntrySnapshot: Codable, Equatable, Sendable {
    public var catalogID: String
    public var sourceRevision: String
    public var summary: CatalogEntrySummary
    public var provenance: CatalogProvenance

    public var contentID: String { summary.contentID }

    public init(catalogID: String, sourceRevision: String, summary: CatalogEntrySummary, provenance: CatalogProvenance) {
        self.catalogID = catalogID
        self.sourceRevision = sourceRevision
        self.summary = summary
        self.provenance = provenance
    }

    public init(catalog: SidekickCatalog, entry: CatalogEntry) {
        self.init(catalogID: catalog.catalogID, sourceRevision: catalog.sourceRevision, summary: entry.summary, provenance: entry.provenance)
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

    /// Return the immutable identity snapshot that belongs to a ContentID.
    public func authoritativeSnapshot(for contentID: String) -> CatalogEntrySnapshot? {
        guard let entry = get(contentID) else { return nil }
        return CatalogEntrySnapshot(catalog: self, entry: entry)
    }

    /// Reject metadata echoed by an untrusted caller when it differs from the
    /// catalog identity or provenance for the requested ContentID.
    public func validate(snapshot: CatalogEntrySnapshot, for contentID: String) throws {
        guard let expected = authoritativeSnapshot(for: contentID) else {
            throw SidekickDomainError("unknown_catalog_entry", "That Catalog Entry is not in the Catalog.")
        }
        guard snapshot == expected else {
            throw SidekickDomainError("catalog_snapshot_mismatch", "The Catalog Entry metadata does not match the authoritative Catalog snapshot.", details: ["content_id": contentID])
        }
    }

    public func matches(snapshot: CatalogEntrySnapshot, for contentID: String) -> Bool {
        (try? validate(snapshot: snapshot, for: contentID)) != nil
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
    public func addExistingCreature(contentID: String, quantity: Int = 1, adjustment: CreatureAdjustment = .normal, faction: Faction = .primaryOpposition, participation: Participation = Participation(), encounterRole: EncounterRole? = nil, startingArea: String = "", sharedTactics: String = "", morale: String = "", expectedRevision: Int? = nil, catalogSnapshot: CatalogEntrySnapshot? = nil) throws -> String {
        try check(expectedRevision)
        guard quantity > 0 else { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
        if let catalogSnapshot { try catalog.validate(snapshot: catalogSnapshot, for: contentID) }
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
        var ids = Set(draft.participantGroups.map(\.id))
        ids.formUnion(draft.hazards.map(\.id))
        ids.formUnion(draft.phases.map(\.id))
        ids.formUnion((draft.originalCreatures ?? []).map(\.id))
        ids.formUnion((draft.customHazards ?? []).map(\.id))
        ids.formUnion((draft.npcProfiles ?? []).map(\.id))
        ids.formUnion((draft.structuredPhases ?? []).map(\.id))
        var index = 1
        while ids.contains("cmp_catalog_\(index)") { index += 1 }
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
        func provenance(_ sourceTitle: String, _ pack: String, _ identifier: String, _ sourceSHA256: String, diagnostics: [String] = []) -> CatalogProvenance {
            CatalogProvenance(sourceTitle: sourceTitle, upstreamPack: pack, upstreamIdentifier: identifier, sourceSHA256: sourceSHA256, notices: ["ORC"], diagnostics: diagnostics)
        }
        func creature(_ id: String, _ name: String, _ level: Int, traits: [String], environments: [String], roles: [EncounterRole], spellcasting: Bool, summary: String, provenance: CatalogProvenance) -> CatalogCreature {
            let entry = CatalogEntrySummary(contentID: id, kind: .creature, name: name, level: level, traits: traits, source: provenance.sourceTitle, environments: environments, roles: roles, spellcasting: spellcasting, summary: summary)
            return CatalogCreature(summary: entry, size: "med", spellcastingBlocks: spellcasting ? ["Spellcasting"] : [], tactics: "Use the creature's listed actions and terrain to pursue its role.", morale: "Withdraw or surrender when its stated motivation no longer holds.", provenance: provenance)
        }
        func hazard(_ id: String, _ name: String, _ level: Int, traits: [String], environments: [String], complexity: HazardComplexity, summary: String, supported: Bool = false, provenance: CatalogProvenance) -> CatalogHazard {
            let entry = CatalogEntrySummary(contentID: id, kind: .hazard, name: name, level: level, traits: traits, source: provenance.sourceTitle, environments: environments, hazardComplexity: complexity, support: supported ? .supported : .unsupported, summary: summary)
            return CatalogHazard(summary: entry, provenance: provenance)
        }

        let monsterPack = "packs/pathfinder-monster-core"
        let monsterSource = "Pathfinder Monster Core"
        let aapoph = creature("creature/monster-core/aapoph-granitescale/current", "Aapoph Granitescale", 6, traits: ["humanoid", "mutant", "serpentfolk"], environments: ["underground"], roles: [.skirmisher], spellcasting: false, summary: "The mutated aapophs dubbed granitescales have bulky frames covered in hard gray plates. These scales offer protection but shed when struck with too much force. Granitescales lik...", provenance: provenance(monsterSource, monsterPack, "MXSKccQqbQqQ77Ii", "2bf005ec5a8fd0bcd8b171dcf7b9a3b0bd0f54a1d1fdf1b73a204a418004d589"))
        let flame = creature("creature/monster-core/flame-drake/current", "Flame Drake", 5, traits: ["dragon", "fire"], environments: ["aquatic", "desert", "forest", "underground", "urban"], roles: [.brute], spellcasting: false, summary: "Flame drakes dwell near volcanoes and magma, but it's not unheard of for one to drift into nearby areas like forests or wooded hills. Their scales are usually some shade of red,...", provenance: provenance(monsterSource, monsterPack, "qlxVPpwVFw5qIVQM", "ff80d9dfbd7c99bd65931244027f8398825011550902cc1ad3c419ac20e2c8dd"))
        let pyro = creature("creature/monster-core/goblin-pyro/current", "Goblin Pyro", 1, traits: ["goblin", "humanoid"], environments: ["desert", "forest", "underground"], roles: [.controller], spellcasting: true, summary: "Some goblins take their people's admiration of fire fully into the realm of deadly obsession. These pyromaniacs can be a great boon to a band of goblin raiders eager to torch th...", provenance: provenance(monsterSource, monsterPack, "Ky5eNRvN71O0tY9l", "bdb745eb40cba6aae175a67cd2fc6b8481eaae82dd8407e8b5c8215872ddcaf4"))
        let goblin = creature("creature/monster-core/goblin-warrior/current", "Goblin Warrior", -1, traits: ["goblin", "humanoid"], environments: ["desert", "forest"], roles: [.skirmisher], spellcasting: false, summary: "The frontline fighters of goblin tribes prefer to fight in large groups—especially when they can outnumber their foes at least three to one. These small humanoids typically have...", provenance: provenance(monsterSource, monsterPack, "fLLKuOXwPq1Iq0U4", "9f0204d98f439e13ff0ad4d031ed3808cd7740315a6cd6b2455ddf6600bc88db"))
        let orc = creature("creature/monster-core/orc-veteran/current", "Orc Veteran", 1, traits: ["humanoid", "orc"], environments: ["desert", "underground"], roles: [.defender], spellcasting: false, summary: "Orc veterans have survived several bloody and chaotic conflicts, coming out the other side with scars and experience that make them even more dangerous opponents. Many orcs are...", provenance: provenance(monsterSource, monsterPack, "V90OYOMyyPLPJuod", "6e9f9cc200db1452f8bfc1bd8871421a9447589f4d075c524c146eb7fd77b4d3"))
        let phantom = creature("creature/monster-core/phantom-knight/current", "Phantom Knight", 4, traits: ["ethereal", "incorporeal", "phantom", "spirit"], environments: ["underground"], roles: [.defender], spellcasting: false, summary: "Cavaliers and knights who died for their cause make for particularly strongwilled phantoms. Though their motives vary, these phantoms often seek to continue their lifelong missi...", provenance: provenance(monsterSource, monsterPack, "9VMoTqyVaKc4ZR4H", "fa60015e8435d1ac75d1ed7e2dd4b3cf8279b2d66ed3d9d145491417435e66ad"))
        let pixie = creature("creature/monster-core/pixie/current", "Pixie", 4, traits: ["fey", "sprite"], environments: ["forest"], roles: [.controller], spellcasting: true, summary: "Insatiably curious, overly excitable, and just a bit puckish, pixies are wanderers and tricksters who use their pixie dust to create all sorts of whimsical situations, as well a...", provenance: provenance(monsterSource, monsterPack, "Ehtm5k9iBYTvSUcZ", "e43dd18cd559d89327d2178650846b78aa321a9fd6c1da288c80b586316553cd"))
        let dwarf = creature("creature/npc-core/ancestry-npcs-dwarf-dwarf-smith/current", "Dwarf Smith", 0, traits: ["dwarf", "humanoid"], environments: ["underground", "urban"], roles: [.skirmisher], spellcasting: false, summary: "Many dwarves become smiths as their attention to detail, lifestyles that keep them close to useful materials such as iron, and a pride in their work all come together to become...", provenance: provenance("Pathfinder NPC Core", "packs/pathfinder-npc-core/ancestry-npcs/dwarf", "rY3uqGq5QyvNOU91", "36c0eb72daca5d3264fb2a2397dbddc46f505e0235b7f7da63cce1062fd1d7b7"))
        let bottomlessPit = hazard("hazard/gm-core/bottomless-pit/current", "Bottomless Pit", 9, traits: ["magical", "mechanical", "trap"], environments: ["urban"], complexity: .simple, summary: "An iron trapdoor covers an infinitely deep 10-foot-square pit.", provenance: provenance("Pathfinder GM Core", "packs/hazards", "xkqjwu1ox0pQLOnb", "f80f44bece80f639e93fde9b2bef574da49abd3fd45bd10a4ee3a1a4a112c592", diagnostics: ["Nested item publication requires independent license review."]))
        let electric = hazard("hazard/gm-core/electric-latch-rune/current", "Electric Latch Rune", 3, traits: ["electricity", "magical", "trap"], environments: ["underground", "urban"], complexity: .simple, summary: "An invisible rune imprinted on a door latch releases a powerful electric discharge.", provenance: provenance("Pathfinder GM Core", "packs/hazards", "491qhVbjsHnOuMZW", "d62280cc1300d9a6dc30f20af424348cc90f4ce7770e2591ca5e2ba53d543690", diagnostics: ["Nested item publication requires independent license review."]))
        let quicksand = hazard("hazard/gm-core/quicksand/current", "Quicksand", 3, traits: ["environmental"], environments: ["aquatic", "desert"], complexity: .complex, summary: "A 15-foot-wide patch of water and sand attempts to submerge creatures that step onto it.", provenance: provenance("Pathfinder GM Core", "packs/hazards", "C6nFe8SCWJ8FmLOT", "ee56de4ac57cff87d62fe1f8a245fa2b16d472fdf4afcb15567b618f75c685d0", diagnostics: ["Nested item publication requires independent license review."]))
        return SidekickCatalog(sourceRevision: sourceRevision, entries: [.creature(aapoph), .creature(flame), .creature(pyro), .creature(goblin), .creature(orc), .creature(phantom), .creature(pixie), .creature(dwarf), .hazard(bottomlessPit), .hazard(electric), .hazard(quicksand)])
    }
}
