import Foundation

/// The semantic sections a GM uses to author a packet. The order is also the
/// order used by the printable projection and by the browser editor.
public enum EncounterPacketSection: String, Codable, CaseIterable, Sendable {
    case identity
    case setup
    case battlefield
    case runningGuidance = "running_guidance"
    case cohesion
    case information
    case outcomes
    case rewardGuidance = "reward_guidance"
    case alternativeResolutions = "alternative_resolutions"
}

public struct PacketIdentitySection: Codable, Equatable, Sendable {
    public var title: String
    public var premise: String
    public var objective: String
    public var stakes: String

    public init(title: String = "", premise: String = "", objective: String = "", stakes: String = "") {
        self.title = title
        self.premise = premise
        self.objective = objective
        self.stakes = stakes
    }
}

public struct PacketSetupSection: Codable, Equatable, Sendable {
    public var trigger: String
    public var battlefieldDescription: String
    public var startingPositions: String
    public var awarenessState: String
    public var immediateFeatures: [String]
    public var readAloud: String?

    public init(trigger: String = "", battlefieldDescription: String = "", startingPositions: String = "", awarenessState: String = "", immediateFeatures: [String] = [], readAloud: String? = nil) {
        self.trigger = trigger
        self.battlefieldDescription = battlefieldDescription
        self.startingPositions = startingPositions
        self.awarenessState = awarenessState
        self.immediateFeatures = immediateFeatures
        self.readAloud = readAloud
    }
}

public struct PacketBattlefieldSection: Codable, Equatable, Sendable {
    public var dimensions: String
    public var zones: [String]
    public var elevations: [String]
    public var cover: [String]
    public var concealment: [String]
    public var difficultTerrain: [String]
    public var entryPoints: [String]
    public var escapeRoutes: [String]
    public var interactiveObjects: [String]
    public var hazardPlacement: [String]
    public var recommendedDistances: [String]
    public var mapGenerationPrompt: String?
    public var attachmentID: String?

    public init(dimensions: String = "", zones: [String] = [], elevations: [String] = [], cover: [String] = [], concealment: [String] = [], difficultTerrain: [String] = [], entryPoints: [String] = [], escapeRoutes: [String] = [], interactiveObjects: [String] = [], hazardPlacement: [String] = [], recommendedDistances: [String] = [], mapGenerationPrompt: String? = nil, attachmentID: String? = nil) {
        self.dimensions = dimensions
        self.zones = zones
        self.elevations = elevations
        self.cover = cover
        self.concealment = concealment
        self.difficultTerrain = difficultTerrain
        self.entryPoints = entryPoints
        self.escapeRoutes = escapeRoutes
        self.interactiveObjects = interactiveObjects
        self.hazardPlacement = hazardPlacement
        self.recommendedDistances = recommendedDistances
        self.mapGenerationPrompt = mapGenerationPrompt
        self.attachmentID = attachmentID
    }
}

public struct PacketRunningGuidanceSection: Codable, Equatable, Sendable {
    public var participantRoles: String
    public var openingTactics: String
    public var ongoingTactics: String
    public var coordinationConflict: String
    public var triggersReinforcements: String
    public var moraleSummary: String
    public var adjudicationIssues: [String]

    public init(participantRoles: String = "", openingTactics: String = "", ongoingTactics: String = "", coordinationConflict: String = "", triggersReinforcements: String = "", moraleSummary: String = "", adjudicationIssues: [String] = []) {
        self.participantRoles = participantRoles
        self.openingTactics = openingTactics
        self.ongoingTactics = ongoingTactics
        self.coordinationConflict = coordinationConflict
        self.triggersReinforcements = triggersReinforcements
        self.moraleSummary = moraleSummary
        self.adjudicationIssues = adjudicationIssues
    }
}

public struct PacketCohesionSection: Codable, Equatable, Sendable {
    public var participantPresence: String
    public var relationships: String
    public var hazardTerrainFit: String
    public var theme: String

    public init(participantPresence: String = "", relationships: String = "", hazardTerrainFit: String = "", theme: String = "") {
        self.participantPresence = participantPresence
        self.relationships = relationships
        self.hazardTerrainFit = hazardTerrainFit
        self.theme = theme
    }
}

public struct PacketInformationSection: Codable, Equatable, Sendable {
    public var immediatelyApparent: [String]
    public var discoverable: [String]
    public var gmSecret: [String]

    public init(immediatelyApparent: [String] = [], discoverable: [String] = [], gmSecret: [String] = []) {
        self.immediatelyApparent = immediatelyApparent
        self.discoverable = discoverable
        self.gmSecret = gmSecret
    }
}

public struct PacketOutcomesSection: Codable, Equatable, Sendable {
    public var victory: String
    public var partialSuccess: String?
    public var failure: String?
    public var partyRetreat: String?
    public var enemySurrender: String?
    public var enemyEscape: String?
    public var longTermConsequence: String?

    public init(victory: String = "", partialSuccess: String? = nil, failure: String? = nil, partyRetreat: String? = nil, enemySurrender: String? = nil, enemyEscape: String? = nil, longTermConsequence: String? = nil) {
        self.victory = victory
        self.partialSuccess = partialSuccess
        self.failure = failure
        self.partyRetreat = partyRetreat
        self.enemySurrender = enemySurrender
        self.enemyEscape = enemyEscape
        self.longTermConsequence = longTermConsequence
    }
}

public struct PacketAlternativeResolution: Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var availability: String
    public var objective: String
    public var approaches: [String]
    public var combatImpact: String
    public var success: String
    public var failure: String

    public init(id: String, title: String, availability: String = "", objective: String = "", approaches: [String] = [], combatImpact: String = "", success: String = "", failure: String = "") {
        self.id = id
        self.title = title
        self.availability = availability
        self.objective = objective
        self.approaches = approaches
        self.combatImpact = combatImpact
        self.success = success
        self.failure = failure
    }
}

public struct EncounterPacketContentV1: Codable, Equatable, Sendable {
    public var objectVersion: Int
    public var identity: PacketIdentitySection
    public var setup: PacketSetupSection
    public var battlefield: PacketBattlefieldSection
    public var runningGuidance: PacketRunningGuidanceSection
    public var cohesion: PacketCohesionSection
    public var information: PacketInformationSection
    public var outcomes: PacketOutcomesSection
    public var rewardGuidance: String?
    public var alternativeResolutions: [PacketAlternativeResolution]

    public init(objectVersion: Int = 1, identity: PacketIdentitySection = PacketIdentitySection(), setup: PacketSetupSection = PacketSetupSection(), battlefield: PacketBattlefieldSection = PacketBattlefieldSection(), runningGuidance: PacketRunningGuidanceSection = PacketRunningGuidanceSection(), cohesion: PacketCohesionSection = PacketCohesionSection(), information: PacketInformationSection = PacketInformationSection(), outcomes: PacketOutcomesSection = PacketOutcomesSection(), rewardGuidance: String? = nil, alternativeResolutions: [PacketAlternativeResolution] = []) {
        self.objectVersion = objectVersion
        self.identity = identity
        self.setup = setup
        self.battlefield = battlefield
        self.runningGuidance = runningGuidance
        self.cohesion = cohesion
        self.information = information
        self.outcomes = outcomes
        self.rewardGuidance = rewardGuidance
        self.alternativeResolutions = alternativeResolutions
    }

    public init(corePacket: EncounterPacket, title: String = "") {
        self.init(identity: PacketIdentitySection(title: title, premise: corePacket.premise, objective: corePacket.objective), setup: PacketSetupSection(trigger: corePacket.setup), runningGuidance: PacketRunningGuidanceSection(openingTactics: corePacket.runningGuidance), cohesion: PacketCohesionSection(participantPresence: corePacket.cohesion), outcomes: PacketOutcomesSection(victory: corePacket.outcomes))
    }

    public func flattenedCorePacket() -> EncounterPacket {
        EncounterPacket(premise: identity.premise, objective: identity.objective, setup: setup.trigger, runningGuidance: runningGuidance.openingTactics, cohesion: cohesion.participantPresence, outcomes: outcomes.victory)
    }
}

/// The packet's constraints are deliberately immutable from this authoring
/// surface. The browser can display them, but a packet mutation cannot alter
/// lines, veils, or excluded themes.
public struct GMOwnedContentBoundaries: Codable, Equatable, Sendable {
    public let lines: [String]
    public let veils: [String]
    public let excludedThemes: [String]
    public let toneLimits: [String: String]
    public let notes: String
    public let owner: String

    public init(lines: [String] = [], veils: [String] = [], excludedThemes: [String] = [], toneLimits: [String: String] = [:], notes: String = "", owner: String = "gm") {
        self.lines = lines
        self.veils = veils
        self.excludedThemes = excludedThemes
        self.toneLimits = toneLimits
        self.notes = notes
        self.owner = owner
    }
}

public enum PacketMutationOrigin: String, Codable, Sendable {
    case gm
    case agent
    case webmcp
    case reload
}

public enum PacketReviewState: String, Codable, Sendable {
    case needed
    case reviewed
}

public enum PacketReadinessStatus: String, Codable, Sendable {
    case incompleteDraft = "incomplete draft"
    case readyWithWarnings = "ready with warnings"
    case readyToRun = "ready to run"
}

public struct PacketStructuralError: Codable, Equatable, Sendable {
    public let section: EncounterPacketSection
    public let field: String
    public let message: String

    public init(section: EncounterPacketSection, field: String, message: String) {
        self.section = section
        self.field = field
        self.message = message
    }
}

public struct PacketDesignWarning: Codable, Equatable, Sendable {
    public let section: EncounterPacketSection
    public let field: String
    public let message: String

    public init(section: EncounterPacketSection, field: String, message: String) {
        self.section = section
        self.field = field
        self.message = message
    }
}

public struct PacketReadiness: Codable, Equatable, Sendable {
    public let structuralErrors: [PacketStructuralError]
    public let designWarnings: [PacketDesignWarning]
    public let missingSections: [EncounterPacketSection]
    public let status: PacketReadinessStatus
    public let reviewState: PacketReviewState

    public init(structuralErrors: [PacketStructuralError] = [], designWarnings: [PacketDesignWarning] = [], missingSections: [EncounterPacketSection] = [], status: PacketReadinessStatus = .incompleteDraft, reviewState: PacketReviewState = .needed) {
        self.structuralErrors = structuralErrors
        self.designWarnings = designWarnings
        self.missingSections = missingSections
        self.status = status
        self.reviewState = reviewState
    }

    public var isStructurallyReady: Bool { structuralErrors.isEmpty }
}

public struct PacketRevisionMetadata: Codable, Equatable, Sendable {
    public let revision: Int
    public let constraintsRevision: Int
    public let origin: PacketMutationOrigin
    public let lastMutationOrigin: PacketMutationOrigin
    public let reviewState: PacketReviewState

    public init(revision: Int, constraintsRevision: Int, origin: PacketMutationOrigin, lastMutationOrigin: PacketMutationOrigin, reviewState: PacketReviewState) {
        self.revision = revision
        self.constraintsRevision = constraintsRevision
        self.origin = origin
        self.lastMutationOrigin = lastMutationOrigin
        self.reviewState = reviewState
    }
}

public struct PacketAutosaveEnvelope: Codable, Equatable, Sendable {
    public let format: String
    public let formatVersion: Int
    public let packet: EncounterPacketContentV1
    public let boundaries: GMOwnedContentBoundaries
    public let metadata: PacketRevisionMetadata

    public init(packet: EncounterPacketContentV1, boundaries: GMOwnedContentBoundaries, metadata: PacketRevisionMetadata) {
        format = "sidekickdm-encounter-packet"
        formatVersion = 1
        self.packet = packet
        self.boundaries = boundaries
        self.metadata = metadata
    }
}

public struct PacketRevisionEntry: Codable, Equatable, Sendable {
    public let id: String
    public let description: String
    public let origin: PacketMutationOrigin
    public let beforeRevision: Int
    public let afterRevision: Int

    public init(id: String, description: String, origin: PacketMutationOrigin, beforeRevision: Int, afterRevision: Int) {
        self.id = id
        self.description = description
        self.origin = origin
        self.beforeRevision = beforeRevision
        self.afterRevision = afterRevision
    }
}

public final class EncounterPacketAuthoringStore: @unchecked Sendable {
    public private(set) var packet: EncounterPacketContentV1
    public private(set) var contentBoundaries: GMOwnedContentBoundaries
    public private(set) var revision: Int
    public private(set) var constraintsRevision: Int
    public private(set) var origin: PacketMutationOrigin
    public private(set) var lastMutationOrigin: PacketMutationOrigin
    public private(set) var reviewState: PacketReviewState
    public private(set) var activity: [PacketRevisionEntry] = []

    private struct HistoryState {
        let packet: EncounterPacketContentV1
        let revision: Int
        let origin: PacketMutationOrigin
        let lastMutationOrigin: PacketMutationOrigin
        let reviewState: PacketReviewState
    }

    private var history: [HistoryState] = []
    private var redoHistory: [HistoryState] = []

    public init(packet: EncounterPacketContentV1 = EncounterPacketContentV1(), boundaries: GMOwnedContentBoundaries = GMOwnedContentBoundaries(), revision: Int = 0, constraintsRevision: Int = 0, origin: PacketMutationOrigin = .gm, lastMutationOrigin: PacketMutationOrigin = .gm, reviewState: PacketReviewState = .needed) {
        self.packet = packet
        contentBoundaries = boundaries
        self.revision = revision
        self.constraintsRevision = constraintsRevision
        self.origin = origin
        self.lastMutationOrigin = lastMutationOrigin
        self.reviewState = reviewState
    }

    public var readiness: PacketReadiness { PacketReadinessValidator.validate(packet, reviewState: reviewState) }
    public var canUndo: Bool { !history.isEmpty }
    public var canRedo: Bool { !redoHistory.isEmpty }

    @discardableResult
    public func setIdentity(_ value: PacketIdentitySection, expectedRevision: Int, expectedConstraintsRevision: Int? = nil, origin: PacketMutationOrigin = .gm) throws -> Int {
        try commit(description: "Updated packet identity", value: value, section: .identity, expectedRevision: expectedRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin) { $0.identity = value }
    }

    @discardableResult
    public func setSetup(_ value: PacketSetupSection, expectedRevision: Int, expectedConstraintsRevision: Int? = nil, origin: PacketMutationOrigin = .gm) throws -> Int {
        try commit(description: "Updated packet setup", value: value, section: .setup, expectedRevision: expectedRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin) { $0.setup = value }
    }

    @discardableResult
    public func setBattlefield(_ value: PacketBattlefieldSection, expectedRevision: Int, expectedConstraintsRevision: Int? = nil, origin: PacketMutationOrigin = .gm) throws -> Int {
        try commit(description: "Updated battlefield guidance", value: value, section: .battlefield, expectedRevision: expectedRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin) { $0.battlefield = value }
    }

    @discardableResult
    public func setRunningGuidance(_ value: PacketRunningGuidanceSection, expectedRevision: Int, expectedConstraintsRevision: Int? = nil, origin: PacketMutationOrigin = .gm) throws -> Int {
        try commit(description: "Updated running guidance", value: value, section: .runningGuidance, expectedRevision: expectedRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin) { $0.runningGuidance = value }
    }

    @discardableResult
    public func setCohesion(_ value: PacketCohesionSection, expectedRevision: Int, expectedConstraintsRevision: Int? = nil, origin: PacketMutationOrigin = .gm) throws -> Int {
        try commit(description: "Updated packet cohesion", value: value, section: .cohesion, expectedRevision: expectedRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin) { $0.cohesion = value }
    }

    @discardableResult
    public func setInformation(_ value: PacketInformationSection, expectedRevision: Int, expectedConstraintsRevision: Int? = nil, origin: PacketMutationOrigin = .gm) throws -> Int {
        try commit(description: "Updated information visibility", value: value, section: .information, expectedRevision: expectedRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin) { $0.information = value }
    }

    @discardableResult
    public func setOutcomes(_ value: PacketOutcomesSection, expectedRevision: Int, expectedConstraintsRevision: Int? = nil, origin: PacketMutationOrigin = .gm) throws -> Int {
        try commit(description: "Updated packet outcomes", value: value, section: .outcomes, expectedRevision: expectedRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin) { $0.outcomes = value }
    }

    @discardableResult
    public func setOptionalContent(rewardGuidance: String?, alternativeResolutions: [PacketAlternativeResolution], expectedRevision: Int, expectedConstraintsRevision: Int? = nil, origin: PacketMutationOrigin = .gm) throws -> Int {
        try commit(description: "Updated optional packet content", value: alternativeResolutions, section: .alternativeResolutions, expectedRevision: expectedRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin) {
            $0.rewardGuidance = rewardGuidance
            $0.alternativeResolutions = alternativeResolutions
        }
    }

    @discardableResult
    public func markReviewed(expectedRevision: Int, origin: PacketMutationOrigin = .gm) throws -> Int {
        try checkRevision(expectedRevision)
        let before = state
        history.append(before)
        redoHistory.removeAll()
        revision += 1
        reviewState = .reviewed
        lastMutationOrigin = origin
        record(description: "Marked packet reviewed", origin: origin, before: revision - 1, after: revision)
        return revision
    }

    public func undo(expectedRevision: Int, origin: PacketMutationOrigin = .gm) throws {
        try checkRevision(expectedRevision)
        guard let previous = history.popLast() else { throw SidekickPacketError.nothingToUndo }
        redoHistory.append(state)
        restore(previous, revision: revision + 1, origin: origin)
        record(description: "Undid packet mutation", origin: origin, before: revision - 1, after: revision)
    }

    public func redo(expectedRevision: Int, origin: PacketMutationOrigin = .gm) throws {
        try checkRevision(expectedRevision)
        guard let next = redoHistory.popLast() else { throw SidekickPacketError.nothingToRedo }
        history.append(state)
        restore(next, revision: revision + 1, origin: origin)
        record(description: "Redid packet mutation", origin: origin, before: revision - 1, after: revision)
    }

    public func autosaveEnvelope() -> PacketAutosaveEnvelope {
        PacketAutosaveEnvelope(packet: packet, boundaries: contentBoundaries, metadata: PacketRevisionMetadata(revision: revision, constraintsRevision: constraintsRevision, origin: origin, lastMutationOrigin: lastMutationOrigin, reviewState: reviewState))
    }

    public func autosaveData() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(autosaveEnvelope())
    }

    public func restoreAutosave(_ data: Data) throws {
        let envelope = try JSONDecoder().decode(PacketAutosaveEnvelope.self, from: data)
        guard envelope.format == "sidekickdm-encounter-packet", envelope.formatVersion == 1, envelope.packet.objectVersion == 1 else { throw SidekickPacketError.futureSchemaVersion }
        packet = envelope.packet
        contentBoundaries = envelope.boundaries
        revision = envelope.metadata.revision
        constraintsRevision = envelope.metadata.constraintsRevision
        origin = envelope.metadata.origin
        lastMutationOrigin = envelope.metadata.lastMutationOrigin
        reviewState = envelope.metadata.reviewState
        history.removeAll()
        redoHistory.removeAll()
        activity.removeAll()
    }

    private var state: HistoryState { HistoryState(packet: packet, revision: revision, origin: origin, lastMutationOrigin: lastMutationOrigin, reviewState: reviewState) }

    private func commit<Value>(description: String, value: Value, section: EncounterPacketSection, expectedRevision: Int, expectedConstraintsRevision: Int?, origin: PacketMutationOrigin, update: (inout EncounterPacketContentV1) -> Void) throws -> Int {
        try checkRevision(expectedRevision)
        if let expectedConstraintsRevision, expectedConstraintsRevision != constraintsRevision { throw SidekickPacketError.staleConstraints(expected: expectedConstraintsRevision, current: constraintsRevision) }
        var next = packet
        update(&next)
        guard next.objectVersion == 1 else { throw SidekickPacketError.futureSchemaVersion }
        history.append(state)
        redoHistory.removeAll()
        packet = next
        revision += 1
        if origin != .gm { self.origin = origin }
        lastMutationOrigin = origin
        reviewState = .needed
        record(description: description, origin: origin, before: revision - 1, after: revision)
        _ = value
        _ = section
        return revision
    }

    private func checkRevision(_ expected: Int) throws {
        guard expected == revision else { throw SidekickPacketError.staleRevision(expected: expected, current: revision) }
    }

    private func restore(_ state: HistoryState, revision nextRevision: Int, origin nextOrigin: PacketMutationOrigin) {
        packet = state.packet
        revision = nextRevision
        origin = state.origin
        lastMutationOrigin = nextOrigin
        reviewState = state.reviewState
    }

    private func record(description: String, origin: PacketMutationOrigin, before: Int, after: Int) {
        activity.insert(PacketRevisionEntry(id: "packet-(after)-(activity.count)", description: description, origin: origin, beforeRevision: before, afterRevision: after), at: 0)
        activity = Array(activity.prefix(20))
    }
}

public enum SidekickPacketError: Error, Equatable, Sendable {
    case staleRevision(expected: Int, current: Int)
    case staleConstraints(expected: Int, current: Int)
    case nothingToUndo
    case nothingToRedo
    case futureSchemaVersion
}

public enum PacketReadinessValidator {
    public static func validate(_ packet: EncounterPacketContentV1, reviewState: PacketReviewState = .needed) -> PacketReadiness {
        var errors: [PacketStructuralError] = []
        var warnings: [PacketDesignWarning] = []
        var missing: [EncounterPacketSection] = []

        requireText(packet.identity.title, section: .identity, field: "title", message: "Identity needs a title.", errors: &errors)
        requireText(packet.identity.premise, section: .identity, field: "premise", message: "Identity needs a premise.", errors: &errors)
        requireText(packet.identity.objective, section: .identity, field: "objective", message: "Identity needs an objective.", errors: &errors)
        requireText(packet.identity.stakes, section: .identity, field: "stakes", message: "Identity needs stakes.", errors: &errors)

        requireText(packet.setup.trigger, section: .setup, field: "trigger", message: "Setup needs an encounter trigger.", errors: &errors)
        requireText(packet.setup.battlefieldDescription, section: .setup, field: "battlefield_description", message: "Setup needs a battlefield description.", errors: &errors)
        requireText(packet.setup.startingPositions, section: .setup, field: "starting_positions", message: "Setup needs starting positions.", errors: &errors)
        requireText(packet.setup.awarenessState, section: .setup, field: "awareness_state", message: "Setup needs an awareness or detection state.", errors: &errors)
        requireList(packet.setup.immediateFeatures, section: .setup, field: "immediate_features", message: "Setup needs at least one immediate environmental feature.", errors: &errors)

        requireText(packet.runningGuidance.participantRoles, section: .runningGuidance, field: "participant_roles", message: "Running guidance needs participant roles.", errors: &errors)
        requireText(packet.runningGuidance.openingTactics, section: .runningGuidance, field: "opening_tactics", message: "Running guidance needs opening tactics.", errors: &errors)
        requireText(packet.runningGuidance.ongoingTactics, section: .runningGuidance, field: "ongoing_tactics", message: "Running guidance needs ongoing tactics.", errors: &errors)
        requireText(packet.runningGuidance.coordinationConflict, section: .runningGuidance, field: "coordination_conflict", message: "Running guidance needs coordination or conflict guidance.", errors: &errors)
        requireText(packet.runningGuidance.triggersReinforcements, section: .runningGuidance, field: "triggers_reinforcements", message: "Running guidance needs phase or reinforcement triggers.", errors: &errors)
        requireText(packet.runningGuidance.moraleSummary, section: .runningGuidance, field: "morale_summary", message: "Running guidance needs morale or exit conditions.", errors: &errors)

        requireText(packet.cohesion.participantPresence, section: .cohesion, field: "participant_presence", message: "Cohesion needs why participants are present.", errors: &errors)
        requireText(packet.cohesion.relationships, section: .cohesion, field: "relationships", message: "Cohesion needs participant relationships.", errors: &errors)
        requireText(packet.cohesion.hazardTerrainFit, section: .cohesion, field: "hazard_terrain_fit", message: "Cohesion needs why hazards and terrain fit.", errors: &errors)

        requireText(packet.outcomes.victory, section: .outcomes, field: "victory", message: "Outcomes need a success result.", errors: &errors)
        if !hasText(packet.outcomes.partialSuccess) && !hasText(packet.outcomes.failure) && !hasText(packet.outcomes.partyRetreat) && !hasText(packet.outcomes.enemySurrender) && !hasText(packet.outcomes.enemyEscape) && !hasText(packet.outcomes.longTermConsequence) {
            errors.append(PacketStructuralError(section: .outcomes, field: "failure_or_aftermath", message: "Outcomes need at least one failure, retreat, surrender, escape, or aftermath branch."))
        }

        if errors.contains(where: { $0.section == .identity }) { missing.append(.identity) }
        if errors.contains(where: { $0.section == .setup }) { missing.append(.setup) }
        if errors.contains(where: { $0.section == .runningGuidance }) { missing.append(.runningGuidance) }
        if errors.contains(where: { $0.section == .cohesion }) { missing.append(.cohesion) }
        if errors.contains(where: { $0.section == .outcomes }) { missing.append(.outcomes) }

        if !hasText(packet.setup.readAloud) { warnings.append(PacketDesignWarning(section: .setup, field: "read_aloud", message: "A short read-aloud can make the opening easier to run.")) }
        if packet.information.discoverable.isEmpty { warnings.append(PacketDesignWarning(section: .information, field: "discoverable", message: "No discoverable information is documented for investigation or successful checks.")) }
        if packet.information.gmSecret.isEmpty { warnings.append(PacketDesignWarning(section: .information, field: "gm_secret", message: "No GM-secret information is documented.")) }
        if !hasText(packet.cohesion.theme) { warnings.append(PacketDesignWarning(section: .cohesion, field: "theme", message: "A concise theme would help keep the encounter cohesive.")) }
        if packet.runningGuidance.adjudicationIssues.isEmpty { warnings.append(PacketDesignWarning(section: .runningGuidance, field: "adjudication_issues", message: "Consider noting one likely adjudication question for the GM.")) }
        if packet.battlefield.zones.isEmpty && packet.battlefield.interactiveObjects.isEmpty { warnings.append(PacketDesignWarning(section: .battlefield, field: "zones", message: "Optional zones or interactive objects could make battlefield decisions clearer.")) }

        let status: PacketReadinessStatus = errors.isEmpty ? (warnings.isEmpty ? .readyToRun : .readyWithWarnings) : .incompleteDraft
        return PacketReadiness(structuralErrors: errors, designWarnings: warnings, missingSections: missing, status: status, reviewState: reviewState)
    }

    private static func hasText(_ value: String?) -> Bool { guard let value else { return false }; return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private static func requireText(_ value: String, section: EncounterPacketSection, field: String, message: String, errors: inout [PacketStructuralError]) { if !hasText(value) { errors.append(PacketStructuralError(section: section, field: field, message: message)) } }
    private static func requireText(_ value: String?, section: EncounterPacketSection, field: String, message: String, errors: inout [PacketStructuralError]) { if !hasText(value) { errors.append(PacketStructuralError(section: section, field: field, message: message)) } }
    private static func requireList(_ value: [String], section: EncounterPacketSection, field: String, message: String, errors: inout [PacketStructuralError]) { if value.allSatisfy({ !hasText($0) }) { errors.append(PacketStructuralError(section: section, field: field, message: message)) } }
}

public typealias EncounterPacketContent = EncounterPacketContentV1
public typealias EncounterPacketDraft = EncounterPacketContentV1
