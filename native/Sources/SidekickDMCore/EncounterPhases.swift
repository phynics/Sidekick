import Foundation

// MARK: - Structured Phase authoring

/// The condition that makes a Phase active. `explanation` is deliberately
/// retained alongside the structured value so a GM can write a runnable rule
/// for custom triggers.
public enum PhaseTriggerKind: String, Codable, CaseIterable, Sendable {
    case round
    case hitPointThreshold = "hit_point_threshold"
    case alarm
    case zoneEntry = "zone_entry"
    case hazardDisabled = "hazard_disabled"
    case objectiveCompleted = "objective_completed"
    case gmAction = "gm_action"
    case custom
}

public struct PhaseTrigger: Codable, Equatable, Sendable {
    public var kind: PhaseTriggerKind
    public var explanation: String
    public var value: String?
    public var canOverlap: Bool

    public init(kind: PhaseTriggerKind = .custom, explanation: String = "", value: String? = nil, canOverlap: Bool = true) {
        self.kind = kind
        self.explanation = explanation
        self.value = value
        self.canOverlap = canOverlap
    }
}

public struct PhaseTerrainChange: Codable, Equatable, Sendable {
    public var title: String
    public var description: String
    public var affectedArea: String?

    public init(title: String = "", description: String = "", affectedArea: String? = nil) {
        self.title = title
        self.description = description
        self.affectedArea = affectedArea
    }
}

/// A Phase is separate from the legacy flat `EncounterPhase` so adding terrain
/// and a structured trigger does not silently change the v1 core payload.
public struct PhaseAuthoring: Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var order: Int
    public var trigger: PhaseTrigger
    public var participantIDs: [String]
    public var hazardIDs: [String]
    public var terrainChanges: [PhaseTerrainChange]
    public var runningGuidance: String
    /// An explicit GM estimate. It is displayed separately and never inferred.
    public var terrainAdjustment: Int

    public init(id: String, title: String, order: Int = 0, trigger: PhaseTrigger = PhaseTrigger(), participantIDs: [String] = [], hazardIDs: [String] = [], terrainChanges: [PhaseTerrainChange] = [], runningGuidance: String = "", terrainAdjustment: Int = 0) {
        self.id = id
        self.title = title
        self.order = order
        self.trigger = trigger
        self.participantIDs = participantIDs
        self.hazardIDs = hazardIDs
        self.terrainChanges = terrainChanges
        self.runningGuidance = runningGuidance
        self.terrainAdjustment = terrainAdjustment
    }

    public init(legacy phase: EncounterPhase) {
        self.init(id: phase.id, title: phase.title, order: phase.order, trigger: PhaseTrigger(explanation: phase.trigger), participantIDs: phase.participantIDs, hazardIDs: phase.hazardIDs, runningGuidance: phase.runningGuidance)
    }

    public var legacyPhase: EncounterPhase {
        EncounterPhase(id: id, title: title, order: order, participantIDs: participantIDs, hazardIDs: hazardIDs, trigger: trigger.explanation, runningGuidance: runningGuidance)
    }
}

public typealias StructuredEncounterPhase = PhaseAuthoring
public typealias EncounterPhaseDraft = PhaseAuthoring
public typealias PhaseTriggerType = PhaseTriggerKind
public typealias TerrainChange = PhaseTerrainChange
public typealias PhaseProjection = PhaseXPProjection
public typealias EncounterPhasePacketProjection = PhasePacketProjection

public struct PhaseParticipationXP: Codable, Equatable, Sendable {
    public var mandatoryXP: Int
    public var avoidableXP: Int
    public var conditionalXP: Int
    public var reinforcementXP: Int

    public init(mandatoryXP: Int = 0, avoidableXP: Int = 0, conditionalXP: Int = 0, reinforcementXP: Int = 0) {
        self.mandatoryXP = mandatoryXP
        self.avoidableXP = avoidableXP
        self.conditionalXP = conditionalXP
        self.reinforcementXP = reinforcementXP
    }

    public var guaranteedXP: Int { mandatoryXP }
    public var conditionalOrReinforcementXP: Int { conditionalXP + reinforcementXP }
    public var totalXP: Int { mandatoryXP + avoidableXP + conditionalXP + reinforcementXP }
}

public struct PhaseXPProjection: Codable, Equatable, Sendable {
    public var phaseID: String
    public var title: String
    public var participantIDs: [String]
    public var hazardIDs: [String]
    public var participation: PhaseParticipationXP
    public var activeXP: Int
    public var terrainAdjustment: Int

    public init(phaseID: String, title: String, participantIDs: [String] = [], hazardIDs: [String] = [], participation: PhaseParticipationXP = PhaseParticipationXP(), terrainAdjustment: Int = 0) {
        self.phaseID = phaseID
        self.title = title
        self.participantIDs = participantIDs
        self.hazardIDs = hazardIDs
        self.participation = participation
        activeXP = participation.totalXP
        self.terrainAdjustment = terrainAdjustment
    }
}

public struct PhaseDesignWarning: Codable, Equatable, Sendable {
    public var phaseIDs: [String]
    public var componentIDs: [String]
    public var message: String

    public init(phaseIDs: [String], componentIDs: [String], message: String) {
        self.phaseIDs = phaseIDs
        self.componentIDs = componentIDs
        self.message = message
    }
}

public struct PhaseBudgetProjection: Codable, Equatable, Sendable {
    public var perPhase: [PhaseXPProjection]
    public var guaranteedXP: Int
    public var avoidableXP: Int
    public var conditionalXP: Int
    public var reinforcementXP: Int
    public var peakActiveXP: Int
    public var totalEncounterXP: Int
    public var terrainAdjustment: Int
    public var overlapWarnings: [PhaseDesignWarning]

    public init(perPhase: [PhaseXPProjection] = [], guaranteedXP: Int = 0, avoidableXP: Int = 0, conditionalXP: Int = 0, reinforcementXP: Int = 0, peakActiveXP: Int = 0, totalEncounterXP: Int = 0, terrainAdjustment: Int = 0, overlapWarnings: [PhaseDesignWarning] = []) {
        self.perPhase = perPhase
        self.guaranteedXP = guaranteedXP
        self.avoidableXP = avoidableXP
        self.conditionalXP = conditionalXP
        self.reinforcementXP = reinforcementXP
        self.peakActiveXP = peakActiveXP
        self.totalEncounterXP = totalEncounterXP
        self.terrainAdjustment = terrainAdjustment
        self.overlapWarnings = overlapWarnings
    }
}

public struct PhasePacketEntry: Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var order: Int
    public var trigger: PhaseTrigger
    public var participantIDs: [String]
    public var hazardIDs: [String]
    public var terrainChanges: [PhaseTerrainChange]
    public var runningGuidance: String
    public var projection: PhaseXPProjection

    public init(phase: PhaseAuthoring, projection: PhaseXPProjection) {
        id = phase.id
        title = phase.title
        order = phase.order
        trigger = phase.trigger
        participantIDs = phase.participantIDs
        hazardIDs = phase.hazardIDs
        terrainChanges = phase.terrainChanges
        runningGuidance = phase.runningGuidance
        self.projection = projection
    }
}

public struct PhasePacketProjection: Codable, Equatable, Sendable {
    public var phases: [PhasePacketEntry]
    public var budget: PhaseBudgetProjection
    public var designWarnings: [PhaseDesignWarning]

    public init(phases: [PhasePacketEntry] = [], budget: PhaseBudgetProjection = PhaseBudgetProjection()) {
        self.phases = phases
        self.budget = budget
        designWarnings = budget.overlapWarnings
    }
}

public struct PhaseAuthoringDocument: Codable, Equatable, Sendable {
    public var objectVersion: Int
    public var encounterID: String
    public var title: String
    public var revision: Int
    public var partyLevel: Int
    public var partySize: Int
    public var participantGroups: [ParticipantGroup]
    public var hazards: [EncounterHazard]
    public var phases: [PhaseAuthoring]

    public init(objectVersion: Int = 1, encounterID: String = "enc_demo", title: String = "", revision: Int = 0, partyLevel: Int = 1, partySize: Int = 4, participantGroups: [ParticipantGroup] = [], hazards: [EncounterHazard] = [], phases: [PhaseAuthoring] = []) {
        self.objectVersion = objectVersion
        self.encounterID = encounterID
        self.title = title
        self.revision = revision
        self.partyLevel = partyLevel
        self.partySize = partySize
        self.participantGroups = participantGroups
        self.hazards = hazards
        self.phases = phases
    }

    public init(encounter draft: EncounterDraft) {
        self.init(encounterID: draft.id, title: draft.title, revision: draft.revision, partyLevel: draft.brief.party.effectiveLevel, partySize: draft.brief.party.size, participantGroups: draft.participantGroups, hazards: draft.hazards, phases: draft.phases.map(PhaseAuthoring.init(legacy:)))
    }
}

public enum PhaseAuthoringError: Error, Equatable, Sendable {
    case unknownParticipant(String)
    case unknownHazard(String)
    case duplicateParticipantReference(String)
    case duplicateHazardReference(String)
    case emptyID
    case emptyTitle
    case emptyTrigger
    case staleRevision(expected: Int, current: Int)
    case nothingToUndo
    case nothingToRedo
    case unsupportedVersion(Int)
    case invalidPersistence

    public var code: String {
        switch self {
        case .unknownParticipant: return "unknown_participant_reference"
        case .unknownHazard: return "unknown_hazard_reference"
        case .duplicateParticipantReference: return "duplicate_participant_reference"
        case .duplicateHazardReference: return "duplicate_hazard_reference"
        case .emptyID: return "invalid_phase"
        case .emptyTitle: return "invalid_phase"
        case .emptyTrigger: return "invalid_phase"
        case .staleRevision: return "stale_revision"
        case .nothingToUndo: return "nothing_to_undo"
        case .nothingToRedo: return "nothing_to_redo"
        case .unsupportedVersion: return "future_schema_version"
        case .invalidPersistence: return "invalid_persistence"
        }
    }

    public var message: String {
        switch self {
        case let .unknownParticipant(id): return "Phase references unknown Participant Group \(id)."
        case let .unknownHazard(id): return "Phase references unknown Hazard \(id)."
        case let .duplicateParticipantReference(id): return "Phase references Participant Group \(id) more than once."
        case let .duplicateHazardReference(id): return "Phase references Hazard \(id) more than once."
        case .emptyID: return "A Phase ID is required."
        case .emptyTitle: return "A Phase title is required."
        case .emptyTrigger: return "A Phase trigger explanation is required."
        case let .staleRevision(expected, current): return "The Phase authoring changed after it was inspected (expected \(expected), current \(current))."
        case .nothingToUndo: return "There is no earlier Phase Mutation to restore."
        case .nothingToRedo: return "There is no undone Phase Mutation to restore."
        case let .unsupportedVersion(version): return "Phase authoring version \(version) is not supported."
        case .invalidPersistence: return "The saved Phase authoring state is invalid."
        }
    }
}

public enum PhaseAuthoringMath {
    public static func phaseXP(_ phase: PhaseAuthoring, participantGroups: [ParticipantGroup], hazards: [EncounterHazard], partyLevel: Int) -> PhaseXPProjection {
        var participation = PhaseParticipationXP()
        for group in participantGroups where phase.participantIDs.contains(group.id) {
            add(EncounterMath.creatureXP(componentLevel: EncounterMath.adjustedCreatureLevel(group.level, group.adjustment), partyLevel: partyLevel) * max(0, group.quantity), mode: group.participation.mode, to: &participation)
        }
        for hazard in hazards where phase.hazardIDs.contains(hazard.id) {
            add(EncounterMath.hazardXP(level: hazard.level, partyLevel: partyLevel, complexity: hazard.complexity), mode: hazard.participation.mode, to: &participation)
        }
        return PhaseXPProjection(phaseID: phase.id, title: phase.title, participantIDs: phase.participantIDs, hazardIDs: phase.hazardIDs, participation: participation, terrainAdjustment: phase.terrainAdjustment)
    }

    public static func project(document: PhaseAuthoringDocument) -> PhaseBudgetProjection {
        let perPhase = document.phases.sorted { $0.order == $1.order ? $0.id < $1.id : $0.order < $1.order }.map { phaseXP($0, participantGroups: document.participantGroups, hazards: document.hazards, partyLevel: document.partyLevel) }
        let uniqueParticipants = Set(document.participantGroups.map(\.id))
        let uniqueHazards = Set(document.hazards.map(\.id))
        var aggregate = PhaseParticipationXP()
        for group in document.participantGroups { add(EncounterMath.creatureXP(componentLevel: EncounterMath.adjustedCreatureLevel(group.level, group.adjustment), partyLevel: document.partyLevel) * max(0, group.quantity), mode: group.participation.mode, to: &aggregate) }
        for hazard in document.hazards { add(EncounterMath.hazardXP(level: hazard.level, partyLevel: document.partyLevel, complexity: hazard.complexity), mode: hazard.participation.mode, to: &aggregate) }
        let warnings = overlapWarnings(document: document, knownParticipants: uniqueParticipants, knownHazards: uniqueHazards)
        let peak = perPhase.isEmpty ? aggregate.totalXP : (perPhase.map(\.activeXP).max() ?? 0)
        return PhaseBudgetProjection(perPhase: perPhase, guaranteedXP: aggregate.mandatoryXP, avoidableXP: aggregate.avoidableXP, conditionalXP: aggregate.conditionalXP, reinforcementXP: aggregate.reinforcementXP, peakActiveXP: peak, totalEncounterXP: aggregate.totalXP, terrainAdjustment: document.phases.reduce(0) { $0 + $1.terrainAdjustment }, overlapWarnings: warnings)
    }

    public static func peakActiveXP(document: PhaseAuthoringDocument) -> Int { project(document: document).peakActiveXP }
    public static func totalEncounterXP(document: PhaseAuthoringDocument) -> Int { project(document: document).totalEncounterXP }

    public static func overlapWarnings(document: PhaseAuthoringDocument, knownParticipants: Set<String>? = nil, knownHazards: Set<String>? = nil) -> [PhaseDesignWarning] {
        var warnings: [PhaseDesignWarning] = []
        let participants = knownParticipants ?? Set(document.participantGroups.map(\.id))
        let hazards = knownHazards ?? Set(document.hazards.map(\.id))
        for index in document.phases.indices {
            for otherIndex in document.phases.indices where otherIndex > index {
                let first = document.phases[index]; let second = document.phases[otherIndex]
                let sharedParticipants = Set(first.participantIDs).intersection(second.participantIDs).filter { participants.contains($0) }
                let sharedHazards = Set(first.hazardIDs).intersection(second.hazardIDs).filter { hazards.contains($0) }
                let shared = sharedParticipants.union(sharedHazards)
                guard !shared.isEmpty, (first.trigger.canOverlap || second.trigger.canOverlap) else { continue }
                warnings.append(PhaseDesignWarning(phaseIDs: [first.id, second.id], componentIDs: shared.sorted(), message: "Phases \(first.title) and \(second.title) may be active together; verify simultaneous threat. XP was not rewritten."))
            }
        }
        return warnings
    }

    private static func add(_ xp: Int, mode: ParticipationMode, to bucket: inout PhaseParticipationXP) {
        switch mode {
        case .mandatory: bucket.mandatoryXP += xp
        case .avoidable: bucket.avoidableXP += xp
        case .conditional: bucket.conditionalXP += xp
        case .reinforcement: bucket.reinforcementXP += xp
        }
    }
}

public struct PhaseAuthoringAutosave: Codable, Equatable, Sendable {
    public var format: String
    public var formatVersion: Int
    public var document: PhaseAuthoringDocument
    public var origin: String
    public var lastMutationOrigin: String

    public init(document: PhaseAuthoringDocument, origin: String = "gm", lastMutationOrigin: String? = nil) {
        format = "sidekickdm-encounter-phases"
        formatVersion = 1
        self.document = document
        self.origin = origin
        self.lastMutationOrigin = lastMutationOrigin ?? origin
    }
}

/// An atomic Phase mutation surface. The source participant and Hazard arrays
/// are snapshots; callers must explicitly reload them when composition changes.
public final class PhaseAuthoringStore: @unchecked Sendable {
    public private(set) var document: PhaseAuthoringDocument
    public private(set) var origin: String
    public private(set) var lastMutationOrigin: String
    private var history: [PhaseAuthoringDocument] = []
    private var redoHistory: [PhaseAuthoringDocument] = []

    public init(document: PhaseAuthoringDocument = PhaseAuthoringDocument(), origin: String = "gm", lastMutationOrigin: String? = nil) {
        self.document = document
        self.origin = origin
        self.lastMutationOrigin = lastMutationOrigin ?? origin
    }

    public convenience init(encounter draft: EncounterDraft, origin: String = "gm") { self.init(document: PhaseAuthoringDocument(encounter: draft), origin: origin) }
    public var revision: Int { document.revision }
    public var phases: [PhaseAuthoring] { document.phases }
    public var budget: PhaseBudgetProjection { PhaseAuthoringMath.project(document: document) }
    public var packetProjection: PhasePacketProjection { PhasePacketProjection(phases: document.phases.sorted { $0.order == $1.order ? $0.id < $1.id : $0.order < $1.order }.map { PhasePacketEntry(phase: $0, projection: PhaseAuthoringMath.phaseXP($0, participantGroups: document.participantGroups, hazards: document.hazards, partyLevel: document.partyLevel)) }, budget: budget) }
    public var canUndo: Bool { !history.isEmpty }
    public var canRedo: Bool { !redoHistory.isEmpty }

    @discardableResult public func upsert(_ phase: PhaseAuthoring, expectedRevision: Int? = nil, origin: String = "gm") throws -> Int {
        try check(expectedRevision)
        try validate(phase)
        let before = document
        var next = document
        if let index = next.phases.firstIndex(where: { $0.id == phase.id }) { next.phases[index] = phase } else { next.phases.append(phase) }
        next.revision += 1
        document = next
        history.append(before)
        redoHistory.removeAll()
        self.lastMutationOrigin = origin
        return document.revision
    }

    @discardableResult public func remove(phaseID: String, expectedRevision: Int? = nil, origin: String = "gm") throws -> Int {
        try check(expectedRevision)
        guard document.phases.contains(where: { $0.id == phaseID }) else { throw PhaseAuthoringError.unknownParticipant(phaseID) }
        let before = document; document.phases.removeAll { $0.id == phaseID }; document.revision += 1
        history.append(before); redoHistory.removeAll(); lastMutationOrigin = origin; return document.revision
    }

    @discardableResult public func undo(expectedRevision: Int? = nil, origin: String = "gm") throws -> Int {
        try check(expectedRevision); guard let previous = history.popLast() else { throw PhaseAuthoringError.nothingToUndo }
        redoHistory.append(document); let nextRevision = document.revision + 1; document = previous; document.revision = nextRevision; lastMutationOrigin = origin; return document.revision
    }

    @discardableResult public func redo(expectedRevision: Int? = nil, origin: String = "gm") throws -> Int {
        try check(expectedRevision); guard let next = redoHistory.popLast() else { throw PhaseAuthoringError.nothingToRedo }
        history.append(document); let nextRevision = document.revision + 1; document = next; document.revision = nextRevision; lastMutationOrigin = origin; return document.revision
    }

    public func autosaveData() throws -> Data { try JSONEncoder().encode(PhaseAuthoringAutosave(document: document, origin: origin, lastMutationOrigin: lastMutationOrigin)) }

    public func restoreAutosave(_ data: Data) throws {
        guard let envelope = try? JSONDecoder().decode(PhaseAuthoringAutosave.self, from: data) else { throw PhaseAuthoringError.invalidPersistence }
        guard envelope.format == "sidekickdm-encounter-phases", envelope.formatVersion == 1, envelope.document.objectVersion == 1 else { throw PhaseAuthoringError.unsupportedVersion(envelope.formatVersion) }
        for phase in envelope.document.phases { try validate(phase, in: envelope.document) }
        document = envelope.document; origin = envelope.origin; lastMutationOrigin = envelope.lastMutationOrigin; history.removeAll(); redoHistory.removeAll()
    }

    public func encounterDraftProjection() -> EncounterDraft {
        var draft = EncounterDraft(id: document.encounterID, title: document.title, brief: EncounterBrief(party: PartySnapshot(effectiveLevel: document.partyLevel, size: document.partySize)), participantGroups: document.participantGroups, hazards: document.hazards, phases: document.phases.map(\.legacyPhase))
        draft.revision = document.revision
        return draft
    }

    private func check(_ expected: Int?) throws { if let expected, expected != document.revision { throw PhaseAuthoringError.staleRevision(expected: expected, current: document.revision) } }
    private func validate(_ phase: PhaseAuthoring) throws { try validate(phase, in: document) }
    private func validate(_ phase: PhaseAuthoring, in source: PhaseAuthoringDocument) throws {
        guard !phase.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw PhaseAuthoringError.emptyID }
        guard !phase.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw PhaseAuthoringError.emptyTitle }
        guard !phase.trigger.explanation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw PhaseAuthoringError.emptyTrigger }
        var participants = Set<String>(); for id in phase.participantIDs { guard source.participantGroups.contains(where: { $0.id == id }) else { throw PhaseAuthoringError.unknownParticipant(id) }; guard participants.insert(id).inserted else { throw PhaseAuthoringError.duplicateParticipantReference(id) } }
        var hazards = Set<String>(); for id in phase.hazardIDs { guard source.hazards.contains(where: { $0.id == id }) else { throw PhaseAuthoringError.unknownHazard(id) }; guard hazards.insert(id).inserted else { throw PhaseAuthoringError.duplicateHazardReference(id) } }
    }
}

public extension EncounterDraft {
    /// A derived Phase authoring view that retains richer trigger/terrain data
    /// without changing the legacy EncounterDraft wire shape.
    func phaseAuthoringStore() -> PhaseAuthoringStore { PhaseAuthoringStore(encounter: self) }
}
