import Foundation

/// The lifecycle state persisted for a Generation Run.
public enum GenerationRunLifecycleState: String, Codable, Equatable, Sendable {
    case active
    case interrupted
}

public typealias GenerationRunState = GenerationRunLifecycleState

/// A semantic Existing Creature selection supplied by the Catalog boundary.
public struct ExistingParticipantGroupRequest: Codable, Equatable, Sendable {
    public var contentID: String
    public var name: String
    public var level: Int
    public var quantity: Int
    public var adjustment: CreatureAdjustment
    public var faction: Faction
    public var participation: Participation
    public var encounterRole: EncounterRole
    public var narrativeTier: NarrativeDetailTier
    public var startingArea: String
    public var sharedTactics: String
    public var morale: String
    public var catalogEntryComplete: Bool
    public var catalogEntrySupported: Bool

    public init(
        contentID: String,
        name: String,
        level: Int,
        quantity: Int = 1,
        adjustment: CreatureAdjustment = .normal,
        faction: Faction = .primaryOpposition,
        participation: Participation = Participation(),
        encounterRole: EncounterRole = .brute,
        narrativeTier: NarrativeDetailTier = .incidental,
        startingArea: String = "",
        sharedTactics: String = "",
        morale: String = "",
        catalogEntryComplete: Bool = true,
        catalogEntrySupported: Bool = true
    ) {
        self.contentID = contentID
        self.name = name
        self.level = level
        self.quantity = quantity
        self.adjustment = adjustment
        self.faction = faction
        self.participation = participation
        self.encounterRole = encounterRole
        self.narrativeTier = narrativeTier
        self.startingArea = startingArea
        self.sharedTactics = sharedTactics
        self.morale = morale
        self.catalogEntryComplete = catalogEntryComplete
        self.catalogEntrySupported = catalogEntrySupported
    }
}

/// Typed values for the semantic Encounter Packet section tool.
public enum GenerationPacketSectionValue: Equatable, Sendable {
    case identity(PacketIdentitySection)
    case setup(PacketSetupSection)
    case battlefield(PacketBattlefieldSection)
    case runningGuidance(PacketRunningGuidanceSection)
    case cohesion(PacketCohesionSection)
    case information(PacketInformationSection)
    case outcomes(PacketOutcomesSection)
    case rewardGuidance(String?)
    case alternativeResolutions([PacketAlternativeResolution])
}

public struct GenerationRunSnapshot: Equatable, Sendable {
    public let draft: EncounterDraft
    public let briefRevision: Int
    public let activity: [ActivityEntry]
    public let canUndo: Bool
    public let canRedo: Bool
    public let manualWritesLocked: Bool
    public let generationRunID: String?
    public let generationState: GenerationRunLifecycleState?
    public let designWarnings: [String]

    public init(draft: EncounterDraft, briefRevision: Int, activity: [ActivityEntry], canUndo: Bool, canRedo: Bool, manualWritesLocked: Bool, generationRunID: String?, generationState: GenerationRunLifecycleState?, designWarnings: [String] = []) {
        self.draft = draft
        self.briefRevision = briefRevision
        self.activity = activity
        self.canUndo = canUndo
        self.canRedo = canRedo
        self.manualWritesLocked = manualWritesLocked
        self.generationRunID = generationRunID
        self.generationState = generationState
        self.designWarnings = designWarnings
    }
}

public struct GenerationRunPersistence: Codable, Equatable, Sendable {
    public var format: String
    public var formatVersion: Int
    public var draft: EncounterDraft
    public var briefRevision: Int
    public var activity: [ActivityEntry]

    public init(draft: EncounterDraft, briefRevision: Int = 0, activity: [ActivityEntry] = []) {
        self.format = "sidekickdm-generation-run"
        self.formatVersion = 1
        self.draft = draft
        self.briefRevision = briefRevision
        self.activity = activity
    }
}

public enum GenerationRunError: Error, Equatable, Sendable {
    case staleEncounter(expected: Int, current: Int)
    case staleBrief(expected: Int, current: Int)
    case staleConstraints(expected: Int, current: Int)
    case unknownEncounter(String)
    case contentBoundaryAcknowledgementRequired
    case generationAlreadyActive
    case noActiveGeneration
    case wrongGenerationRun(expected: String, current: String)
    case generationInterrupted
    case manualWriteLocked
    case nothingToUndo
    case nothingToRedo
    case invalidQuantity
    case invalidParticipantGroup
    case catalogEntryPartial
    case invalidPacketSection
    case structuralErrors([String])
    case futureSchemaVersion
    case invalidPersistence

    public var code: String {
        switch self {
        case .staleEncounter: return "stale_revision"
        case .staleBrief: return "stale_brief_revision"
        case .staleConstraints: return "stale_constraints"
        case .unknownEncounter: return "unknown_encounter"
        case .contentBoundaryAcknowledgementRequired: return "content_constraint_not_acknowledged"
        case .generationAlreadyActive: return "generation_already_active"
        case .noActiveGeneration: return "no_active_generation"
        case .wrongGenerationRun: return "wrong_generation_run"
        case .generationInterrupted: return "generation_interrupted"
        case .manualWriteLocked: return "manual_write_locked"
        case .nothingToUndo: return "nothing_to_undo"
        case .nothingToRedo: return "nothing_to_redo"
        case .invalidQuantity: return "invalid_quantity"
        case .invalidParticipantGroup: return "invalid_participant_group"
        case .catalogEntryPartial: return "catalog_entry_partial"
        case .invalidPacketSection: return "invalid_packet_section"
        case .structuralErrors: return "generation_structural_errors"
        case .futureSchemaVersion: return "future_schema_version"
        case .invalidPersistence: return "invalid_persistence"
        }
    }

    public var message: String {
        switch self {
        case .staleEncounter(let expected, let current): return "The encounter changed after it was inspected. Expected revision \(expected), found \(current)."
        case .staleBrief(let expected, let current): return "The Encounter Brief changed after it was inspected. Expected revision \(expected), found \(current)."
        case .staleConstraints(let expected, let current): return "The Content Boundaries changed after they were inspected. Expected revision \(expected), found \(current)."
        case .unknownEncounter(let id): return "The requested Encounter Draft \(id) does not exist."
        case .contentBoundaryAcknowledgementRequired: return "The agent must acknowledge the GM's Content Boundaries before generation can begin."
        case .generationAlreadyActive: return "A Generation Run is already active."
        case .noActiveGeneration: return "There is no active Generation Run."
        case .wrongGenerationRun(let expected, let current): return "Generation Run \(expected) is not active. The active run is \(current)."
        case .generationInterrupted: return "The Generation Run was interrupted by a reload. Finish it manually or cancel it before retrying."
        case .manualWriteLocked: return "Manual writes are locked while a Generation Run is active. Reads remain available."
        case .nothingToUndo: return "There is no completed Mutation to undo."
        case .nothingToRedo: return "There is no undone Mutation to redo."
        case .invalidQuantity: return "Participant quantity must be at least 1."
        case .invalidParticipantGroup: return "The Existing Participant Group is not a complete Creature Catalog entry."
        case .catalogEntryPartial: return "Only complete, supported Catalog Entries can be added as Existing Participant Groups."
        case .invalidPacketSection: return "The Encounter Packet section payload is invalid."
        case .structuralErrors: return "The Encounter Packet has structural errors that prevent finishing the Generation Run."
        case .futureSchemaVersion: return "The saved Generation Run uses a newer schema version."
        case .invalidPersistence: return "The saved Generation Run is invalid."
        }
    }

    public var details: [String: String] {
        switch self {
        case .staleEncounter(let expected, let current): return ["expected_revision": "\(expected)", "current_revision": "\(current)"]
        case .staleBrief(let expected, let current): return ["expected_brief_revision": "\(expected)", "current_brief_revision": "\(current)"]
        case .staleConstraints(let expected, let current): return ["expected_constraints_revision": "\(expected)", "current_constraints_revision": "\(current)"]
        case .unknownEncounter(let id): return ["encounter_id": id]
        case .wrongGenerationRun(let expected, let current): return ["expected_generation_run_id": expected, "current_generation_run_id": current]
        case .structuralErrors(let errors): return ["structural_errors": errors.joined(separator: " | ")]
        default: return [:]
        }
    }
}

/// Owns a visible, revision-checked, all-or-nothing Generation Run.
///
/// The controller intentionally does not depend on a browser or on the command
/// dispatcher. The host can adapt its methods to WebMCP and keep reads live
/// while manual writes are locked.
public final class GenerationRunController: @unchecked Sendable {
    public private(set) var draft: EncounterDraft
    public private(set) var briefRevision: Int
    public private(set) var activity: [ActivityEntry]

    private var history: [EncounterDraft] = []
    private var redoHistory: [EncounterDraft] = []
    private var openingSnapshot: EncounterDraft?
    public private(set) var designWarnings: [String] = []

    public init(draft: EncounterDraft = EncounterDraft(), briefRevision: Int = 0, activity: [ActivityEntry] = []) {
        self.draft = draft
        self.briefRevision = briefRevision
        self.activity = activity
        if let generation = draft.generation, let encoded = generation.openingDraftJSON, let data = encoded.data(using: .utf8) {
            openingSnapshot = try? JSONDecoder().decode(EncounterDraft.self, from: data)
        }
    }

    public var manualWritesLocked: Bool { draft.generation != nil }
    public var canUndo: Bool { !history.isEmpty }
    public var canRedo: Bool { !redoHistory.isEmpty }
    public var generationRunID: String? { draft.generation?.id }
    public var generationState: GenerationRunLifecycleState? { draft.generation.flatMap { GenerationRunLifecycleState(rawValue: $0.state) } }

    public func snapshot() -> GenerationRunSnapshot {
        GenerationRunSnapshot(draft: draft, briefRevision: briefRevision, activity: activity, canUndo: canUndo, canRedo: canRedo, manualWritesLocked: manualWritesLocked, generationRunID: generationRunID, generationState: generationState, designWarnings: designWarnings)
    }

    @discardableResult
    public func begin(
        encounterID: String,
        expectedEncounterRevision: Int,
        expectedBriefRevision: Int,
        expectedConstraintsRevision: Int,
        contentBoundariesAcknowledged: Bool,
        intentSummary: String = "",
        generationRunID: String? = nil,
        origin: String = "webmcp"
    ) throws -> String {
        try checkEncounter(encounterID, expectedRevision: expectedEncounterRevision)
        try checkBrief(expectedBriefRevision)
        try checkConstraints(expectedConstraintsRevision)
        guard contentBoundariesAcknowledged else { throw GenerationRunError.contentBoundaryAcknowledgementRequired }
        guard draft.generation == nil else { throw GenerationRunError.generationAlreadyActive }

        let opening = draft
        let runID = generationRunID ?? "run_\(UUID().uuidString.lowercased())"
        var next = draft
        let openingData = try JSONEncoder().encode(opening)
        next.generation = GenerationState(id: runID, state: GenerationRunLifecycleState.active.rawValue, openingDraftJSON: String(data: openingData, encoding: .utf8), intentSummary: intentSummary)
        next.revision = draft.revision + 1
        next.provenance.lastMutationOrigin = origin
        if origin != "gm" { next.provenance.origin = origin }
        draft = next
        openingSnapshot = opening
        record(description: "Began Generation Run", origin: origin, before: opening.revision, after: draft.revision)
        return runID
    }

    @discardableResult
    public func beginGeneration(expectedEncounterRevision: Int, expectedBriefRevision: Int, expectedConstraintsRevision: Int, contentBoundariesAcknowledged: Bool, intentSummary: String = "", generationRunID: String? = nil, origin: String = "webmcp") throws -> String {
        try begin(encounterID: draft.id, expectedEncounterRevision: expectedEncounterRevision, expectedBriefRevision: expectedBriefRevision, expectedConstraintsRevision: expectedConstraintsRevision, contentBoundariesAcknowledged: contentBoundariesAcknowledged, intentSummary: intentSummary, generationRunID: generationRunID, origin: origin)
    }

    @discardableResult
    public func mutate(
        encounterID: String,
        generationRunID: String,
        expectedEncounterRevision: Int,
        expectedConstraintsRevision: Int,
        origin: String = "webmcp",
        description: String,
        operation: (inout EncounterDraft) throws -> Void
    ) throws -> Int {
        try checkActive(encounterID: encounterID, runID: generationRunID, expectedRevision: expectedEncounterRevision, expectedConstraintsRevision: expectedConstraintsRevision)
        guard origin != "gm" && origin != "manual" else { throw GenerationRunError.manualWriteLocked }
        var next = draft
        try operation(&next)
        commit(next, description: description, origin: origin)
        return draft.revision
    }

    @discardableResult
    public func addExistingParticipantGroup(
        _ request: ExistingParticipantGroupRequest,
        encounterID: String,
        generationRunID: String,
        expectedEncounterRevision: Int,
        expectedConstraintsRevision: Int,
        origin: String = "webmcp"
    ) throws -> String {
        guard !request.contentID.isEmpty, !request.name.isEmpty else { throw GenerationRunError.invalidParticipantGroup }
        guard request.catalogEntryComplete && request.catalogEntrySupported else { throw GenerationRunError.catalogEntryPartial }
        guard request.quantity > 0 else { throw GenerationRunError.invalidQuantity }
        let id = "cmp_\(UUID().uuidString.lowercased())"
        let group = ParticipantGroup(id: id, contentID: request.contentID, name: request.name, level: request.level, quantity: request.quantity, adjustment: request.adjustment, faction: request.faction, participation: request.participation, encounterRole: request.encounterRole, narrativeTier: request.narrativeTier, startingArea: request.startingArea, sharedTactics: request.sharedTactics, morale: request.morale)
        try mutate(encounterID: encounterID, generationRunID: generationRunID, expectedEncounterRevision: expectedEncounterRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin, description: "Added Existing Participant Group \(request.name)") { draft in
            guard !draft.participantGroups.contains(where: { $0.id == id }) else { throw GenerationRunError.invalidParticipantGroup }
            draft.participantGroups.append(group)
        }
        return id
    }

    @discardableResult
    public func setPacketSection(
        _ section: EncounterPacketSection,
        value: GenerationPacketSectionValue,
        encounterID: String,
        generationRunID: String,
        expectedEncounterRevision: Int,
        expectedConstraintsRevision: Int,
        origin: String = "webmcp"
    ) throws -> Int {
        try mutate(encounterID: encounterID, generationRunID: generationRunID, expectedEncounterRevision: expectedEncounterRevision, expectedConstraintsRevision: expectedConstraintsRevision, origin: origin, description: "Updated Encounter Packet \(section.rawValue)") { draft in
            var packet = draft.packetV1 ?? EncounterPacketContentV1(corePacket: draft.packet, title: draft.title)
            switch (section, value) {
            case (.identity, .identity(let section)): packet.identity = section; if !section.title.isEmpty { draft.title = section.title }
            case (.setup, .setup(let section)): packet.setup = section
            case (.battlefield, .battlefield(let section)): packet.battlefield = section
            case (.runningGuidance, .runningGuidance(let section)): packet.runningGuidance = section
            case (.cohesion, .cohesion(let section)): packet.cohesion = section
            case (.information, .information(let section)): packet.information = section
            case (.outcomes, .outcomes(let section)): packet.outcomes = section
            case (.rewardGuidance, .rewardGuidance(let value)): packet.rewardGuidance = value
            case (.alternativeResolutions, .alternativeResolutions(let value)): packet.alternativeResolutions = value
            default: throw GenerationRunError.invalidPacketSection
            }
            guard packet.objectVersion == 1 else { throw GenerationRunError.futureSchemaVersion }
            draft.packetV1 = packet
            draft.packet = packet.flattenedCorePacket()
        }
    }

    @discardableResult
    public func finish(encounterID: String, generationRunID: String, expectedEncounterRevision: Int, expectedConstraintsRevision: Int, completionNote: String = "", origin: String = "webmcp") throws -> Int {
        try checkActive(encounterID: encounterID, runID: generationRunID, expectedRevision: expectedEncounterRevision, expectedConstraintsRevision: expectedConstraintsRevision)
        let packet = draft.packetV1 ?? EncounterPacketContentV1(corePacket: draft.packet, title: draft.title)
        let readiness = PacketReadinessValidator.validate(packet)
        guard readiness.structuralErrors.isEmpty else { throw GenerationRunError.structuralErrors(readiness.structuralErrors.map(\.message)) }
        designWarnings = readiness.designWarnings.map(\.message)
        guard let opening = openingSnapshot else { throw GenerationRunError.noActiveGeneration }
        history.append(opening)
        redoHistory.removeAll()
        var next = draft
        next.generation = nil
        next.reviewState = "needed"
        if !completionNote.isEmpty { next.provenance.lastMutationOrigin = origin }
        next.revision = draft.revision + 1
        next.provenance.lastMutationOrigin = origin
        if origin != "gm" { next.provenance.origin = origin }
        draft = next
        openingSnapshot = nil
        record(description: "Finished Generation Run", origin: origin, before: expectedEncounterRevision, after: draft.revision)
        return draft.revision
    }

    @discardableResult
    public func finishGeneration(expectedEncounterRevision: Int, expectedConstraintsRevision: Int, completionNote: String = "", origin: String = "webmcp") throws -> Int {
        guard let runID = generationRunID else { throw GenerationRunError.noActiveGeneration }
        return try finish(encounterID: draft.id, generationRunID: runID, expectedEncounterRevision: expectedEncounterRevision, expectedConstraintsRevision: expectedConstraintsRevision, completionNote: completionNote, origin: origin)
    }

    @discardableResult
    public func cancel(encounterID: String, generationRunID: String, expectedEncounterRevision: Int, origin: String = "webmcp") throws -> Int {
        try checkEncounter(encounterID, expectedRevision: expectedEncounterRevision)
        guard let active = draft.generation else { throw GenerationRunError.noActiveGeneration }
        guard active.id == generationRunID else { throw GenerationRunError.wrongGenerationRun(expected: generationRunID, current: active.id) }
        guard let opening = openingSnapshot else { throw GenerationRunError.noActiveGeneration }
        var restored = opening
        restored.revision = draft.revision + 1
        restored.generation = nil
        draft = restored
        openingSnapshot = nil
        record(description: "Cancelled Generation Run", origin: origin, before: expectedEncounterRevision, after: draft.revision)
        return draft.revision
    }

    @discardableResult
    public func cancelGeneration(expectedEncounterRevision: Int, origin: String = "webmcp") throws -> Int {
        guard let runID = generationRunID else { throw GenerationRunError.noActiveGeneration }
        return try cancel(encounterID: draft.id, generationRunID: runID, expectedEncounterRevision: expectedEncounterRevision, origin: origin)
    }

    public func undo(expectedEncounterRevision: Int, origin: String = "gm") throws {
        try checkRevision(expectedEncounterRevision)
        guard draft.generation == nil else { throw GenerationRunError.manualWriteLocked }
        guard let previous = history.popLast() else { throw GenerationRunError.nothingToUndo }
        redoHistory.append(draft)
        var restored = previous
        restored.revision = draft.revision + 1
        restored.generation = nil
        draft = restored
        record(description: "Undid the last Mutation", origin: origin, before: expectedEncounterRevision, after: draft.revision)
    }

    public func redo(expectedEncounterRevision: Int, origin: String = "gm") throws {
        try checkRevision(expectedEncounterRevision)
        guard draft.generation == nil else { throw GenerationRunError.manualWriteLocked }
        guard let next = redoHistory.popLast() else { throw GenerationRunError.nothingToRedo }
        history.append(draft)
        var restored = next
        restored.revision = draft.revision + 1
        restored.generation = nil
        draft = restored
        record(description: "Redid the last Mutation", origin: origin, before: expectedEncounterRevision, after: draft.revision)
    }

    public func autosaveData() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(GenerationRunPersistence(draft: draft, briefRevision: briefRevision, activity: activity))
    }

    public func reload(from data: Data) throws {
        if let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let version = raw["format_version"] as? NSNumber, version.intValue > 1 { throw GenerationRunError.futureSchemaVersion }
        guard let envelope = try? JSONDecoder().decode(GenerationRunPersistence.self, from: data), envelope.format == "sidekickdm-generation-run", envelope.formatVersion == 1 else { throw GenerationRunError.invalidPersistence }
        draft = envelope.draft
        briefRevision = envelope.briefRevision
        activity = envelope.activity
        designWarnings = []
        history.removeAll()
        redoHistory.removeAll()
        openingSnapshot = nil
        if let generation = draft.generation, let encoded = generation.openingDraftJSON, let openingData = encoded.data(using: .utf8), let opening = try? JSONDecoder().decode(EncounterDraft.self, from: openingData) {
            openingSnapshot = opening
            if generation.state == GenerationRunLifecycleState.active.rawValue {
                draft.generation?.state = GenerationRunLifecycleState.interrupted.rawValue
            }
        }
    }

    private func checkEncounter(_ id: String, expectedRevision: Int) throws {
        guard id == draft.id else { throw GenerationRunError.unknownEncounter(id) }
        try checkRevision(expectedRevision)
    }

    private func checkRevision(_ expected: Int) throws {
        guard expected == draft.revision else { throw GenerationRunError.staleEncounter(expected: expected, current: draft.revision) }
    }

    private func checkBrief(_ expected: Int) throws {
        guard expected == briefRevision else { throw GenerationRunError.staleBrief(expected: expected, current: briefRevision) }
    }

    private func checkConstraints(_ expected: Int) throws {
        guard expected == draft.constraintsRevision else { throw GenerationRunError.staleConstraints(expected: expected, current: draft.constraintsRevision) }
    }

    private func checkActive(encounterID: String, runID: String, expectedRevision: Int, expectedConstraintsRevision: Int) throws {
        try checkEncounter(encounterID, expectedRevision: expectedRevision)
        try checkConstraints(expectedConstraintsRevision)
        guard let active = draft.generation else { throw GenerationRunError.noActiveGeneration }
        guard active.id == runID else { throw GenerationRunError.wrongGenerationRun(expected: runID, current: active.id) }
        guard active.state == GenerationRunLifecycleState.active.rawValue else { throw GenerationRunError.generationInterrupted }
    }

    private func commit(_ next: EncounterDraft, description: String, origin: String) {
        var committed = next
        committed.revision = draft.revision + 1
        committed.provenance.lastMutationOrigin = origin
        if origin != "gm" { committed.provenance.origin = origin }
        draft = committed
        record(description: description, origin: origin, before: committed.revision - 1, after: committed.revision)
    }

    private func record(description: String, origin: String, before: Int, after: Int) {
        activity.insert(ActivityEntry(id: "generation-\(activity.count + 1)", description: description, origin: origin, beforeRevision: before, afterRevision: after, time: "session"), at: 0)
        activity = Array(activity.prefix(20))
    }
}

public typealias GenerationRunStore = GenerationRunController
public typealias GenerationRunCoordinator = GenerationRunController
