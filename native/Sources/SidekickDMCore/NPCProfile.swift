import Foundation

// MARK: - NPC Profile schema

/// The fields an NPC Profile can disclose at each Narrative Detail Tier.
public enum NPCProfileField: String, Codable, CaseIterable, Sendable {
    case encounterPurpose = "encounter_purpose"
    case immediateGoal = "immediate_goal"
    case moraleExit = "morale_exit"
    case appearanceHook = "appearance_hook"
    case voiceManner = "voice_manner"
    case deeperMotivation = "deeper_motivation"
    case fear
    case leverage
    case combatObjective = "combat_objective"
    case attitude
    case peacefulResponse = "peaceful_response"
    case knowledge
    case futureConsequence = "future_consequence"

    public static var motivation: Self { .immediateGoal }
    public static var moraleOrExitCondition: Self { .moraleExit }
    public static var characterization: Self { .appearanceHook }
    public static var appearance: Self { .appearanceHook }
    public static var relationships: Self { .leverage }
    public static var secrets: Self { .knowledge }
    public static var voice: Self { .voiceManner }
    public static var notes: Self { .futureConsequence }
}

/// The source of an NPC Profile component. The string is kept in the DTO so
/// imported profiles can retain an origin that a future version understands.
public enum NPCProfileOrigin: String, Codable, CaseIterable, Sendable {
    case original
    case forked
    case imported
}

public typealias NPCProfileTier = NarrativeDetailTier

public enum NPCProfileMutationOrigin: String, Codable, CaseIterable, Sendable {
    case gm
    case webmcp
    case reload
}

public enum NPCKnowledgeState: String, Codable, CaseIterable, Sendable {
    case knowsAndWillTell = "knows_and_will_tell"
    case knowsButConceals = "knows_but_conceals"
    case believesIncorrectly = "believes_incorrectly"
    case doesNotKnow = "does_not_know"
}

public struct NPCKnowledgeEntry: Codable, Equatable, Sendable {
    public var topic: String
    public var state: NPCKnowledgeState
    public var text: String

    public init(topic: String = "", state: NPCKnowledgeState = .knowsAndWillTell, text: String = "") {
        self.topic = topic
        self.state = state
        self.text = text
    }
}

public struct NPCProfileProvenance: Codable, Equatable, Sendable {
    public var origin: String
    public var basedOnProfileID: String?
    public var source: String?
    public var createdAt: String
    public var lastMutationOrigin: String

    public init(
        origin: String = NPCProfileOrigin.original.rawValue,
        basedOnProfileID: String? = nil,
        source: String? = nil,
        createdAt: String = "",
        lastMutationOrigin: String = "gm"
    ) {
        self.origin = origin
        self.basedOnProfileID = basedOnProfileID
        self.source = source
        self.createdAt = createdAt
        self.lastMutationOrigin = lastMutationOrigin
    }
}

/// Narrative information for one NPC. The first three fields are required at
/// every tier. Higher tiers add accepted fields to the visible projection.
public struct NPCProfile: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var objectVersion: Int
    public var revision: Int
    public var participantGroupID: String?
    public var tier: NarrativeDetailTier

    public var name: String
    public var encounterPurpose: String
    public var appearanceHook: String?
    public var voiceManner: String?
    public var immediateGoal: String
    public var deeperMotivation: String?
    public var fear: String?
    public var leverage: String?
    public var knowledge: [NPCKnowledgeEntry]
    public var attitude: String?
    public var combatObjective: String?
    public var moraleExit: String
    public var peacefulResponse: String?
    public var futureConsequence: String?
    public var provenance: NPCProfileProvenance

    private enum CodingKeys: String, CodingKey {
        case id
        case objectVersion = "object_version"
        case revision
        case participantGroupID = "participant_group_id"
        case tier
        case name
        case encounterPurpose = "encounter_purpose"
        case appearanceHook = "appearance_hook"
        case voiceManner = "voice_manner"
        case immediateGoal = "immediate_goal"
        case deeperMotivation = "deeper_motivation"
        case fear
        case leverage
        case knowledge
        case attitude
        case combatObjective = "combat_objective"
        case moraleExit = "morale_exit"
        case peacefulResponse = "peaceful_response"
        case futureConsequence = "future_consequence"
        case provenance
    }

    public init(
        id: String = "npc_profile",
        objectVersion: Int = 1,
        revision: Int = 0,
        participantGroupID: String? = nil,
        narrativeTier: NarrativeDetailTier = .incidental,
        name: String = "",
        encounterPurpose: String = "",
        motivation: String = "",
        moraleOrExitCondition: String = "",
        appearanceHook: String? = nil,
        voiceManner: String? = nil,
        immediateGoal: String? = nil,
        deeperMotivation: String? = nil,
        fear: String? = nil,
        leverage: String? = nil,
        knowledge: [NPCKnowledgeEntry] = [],
        attitude: String? = nil,
        combatObjective: String? = nil,
        moraleExit: String? = nil,
        peacefulResponse: String? = nil,
        futureConsequence: String? = nil,
        provenance: NPCProfileProvenance = NPCProfileProvenance(),
        // These aliases make the contract explicit for callers that use the
        // shorter terms from the GM-facing form.
        morale: String? = nil,
        exitCondition: String? = nil
    ) {
        self.id = id
        self.objectVersion = objectVersion
        self.revision = revision
        self.participantGroupID = participantGroupID
        self.tier = narrativeTier
        self.name = name
        self.encounterPurpose = encounterPurpose
        self.appearanceHook = appearanceHook
        self.voiceManner = voiceManner
        self.immediateGoal = [immediateGoal ?? "", motivation].first { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } ?? ""
        self.deeperMotivation = deeperMotivation
        self.fear = fear
        self.leverage = leverage
        self.knowledge = knowledge
        self.attitude = attitude
        self.combatObjective = combatObjective
        self.moraleExit = [moraleExit ?? "", moraleOrExitCondition, morale ?? "", exitCondition ?? ""].first { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } ?? ""
        self.peacefulResponse = peacefulResponse
        self.futureConsequence = futureConsequence
        self.provenance = provenance
    }

    /// Compatibility initializer for the original Sidekick narrative names.
    /// It maps characterization and appearance to appearance_hook and stores
    /// string secrets as knowledge notes.
    public init(
        id: String,
        objectVersion: Int = 1,
        revision: Int = 0,
        participantGroupID: String? = nil,
        narrativeTier: NarrativeDetailTier = .incidental,
        encounterPurpose: String = "",
        motivation: String = "",
        moraleOrExitCondition: String = "",
        peacefulResponse: String? = nil,
        knowledge: [String],
        characterization: String? = nil,
        appearance: String? = nil,
        relationships: String? = nil,
        secrets: [String] = [],
        voice: String? = nil,
        notes: String? = nil,
        provenance: NPCProfileProvenance = NPCProfileProvenance()
    ) {
        self.init(id: id, objectVersion: objectVersion, revision: revision, participantGroupID: participantGroupID, narrativeTier: narrativeTier, encounterPurpose: encounterPurpose, motivation: motivation, moraleOrExitCondition: moraleOrExitCondition, appearanceHook: appearance ?? characterization, voiceManner: voice, knowledge: knowledge.map { NPCKnowledgeEntry(text: $0) }, attitude: nil, combatObjective: nil, moraleExit: moraleOrExitCondition, peacefulResponse: peacefulResponse, futureConsequence: notes, provenance: provenance)
        if let relationships { self.leverage = relationships }
        if !secrets.isEmpty { self.knowledge.append(contentsOf: secrets.map { NPCKnowledgeEntry(topic: "secret", state: .knowsButConceals, text: $0) }) }
    }

    public init(
        id: String,
        objectVersion: Int = 1,
        revision: Int = 0,
        participantGroupID: String? = nil,
        narrativeTier: NarrativeDetailTier = .incidental,
        encounterPurpose: String = "",
        motivation: String = "",
        moraleOrExitCondition: String = "",
        peacefulResponse: String? = nil,
        knowledge: [NPCKnowledgeEntry],
        characterization: String? = nil,
        appearance: String? = nil,
        relationships: String? = nil,
        secrets: [String] = [],
        voice: String? = nil,
        notes: String? = nil,
        provenance: NPCProfileProvenance = NPCProfileProvenance()
    ) {
        self.init(id: id, objectVersion: objectVersion, revision: revision, participantGroupID: participantGroupID, narrativeTier: narrativeTier, encounterPurpose: encounterPurpose, motivation: motivation, appearanceHook: appearance ?? characterization, voiceManner: voice, knowledge: knowledge, moraleExit: moraleOrExitCondition, peacefulResponse: peacefulResponse, futureConsequence: notes, provenance: provenance)
        if let relationships { self.leverage = relationships }
        if !secrets.isEmpty { self.knowledge.append(contentsOf: secrets.map { NPCKnowledgeEntry(topic: "secret", state: .knowsButConceals, text: $0) }) }
    }

    public init(
        id: String,
        tier: NarrativeDetailTier,
        purpose: String,
        motivation: String,
        morale: String,
        peacefulResponse: String? = nil,
        knowledge: [NPCKnowledgeEntry] = [],
        characterization: String? = nil,
        provenance: NPCProfileProvenance = NPCProfileProvenance()
    ) {
        self.init(id: id, narrativeTier: tier, encounterPurpose: purpose, motivation: motivation, moraleOrExitCondition: morale, appearanceHook: characterization, knowledge: knowledge, peacefulResponse: peacefulResponse, provenance: provenance)
    }

    public init(
        id: String,
        tier: NarrativeDetailTier,
        name: String = "",
        encounterPurpose: String,
        immediateGoal: String,
        moraleExit: String,
        appearanceHook: String? = nil,
        voiceManner: String? = nil,
        deeperMotivation: String? = nil,
        fear: String? = nil,
        leverage: String? = nil,
        knowledge: [NPCKnowledgeEntry] = [],
        attitude: String? = nil,
        combatObjective: String? = nil,
        peacefulResponse: String? = nil,
        futureConsequence: String? = nil,
        provenance: NPCProfileProvenance = NPCProfileProvenance()
    ) {
        self.init(id: id, narrativeTier: tier, name: name, encounterPurpose: encounterPurpose, motivation: immediateGoal, appearanceHook: appearanceHook, voiceManner: voiceManner, immediateGoal: immediateGoal, deeperMotivation: deeperMotivation, fear: fear, leverage: leverage, knowledge: knowledge, attitude: attitude, combatObjective: combatObjective, moraleExit: moraleExit, peacefulResponse: peacefulResponse, futureConsequence: futureConsequence, provenance: provenance)
    }

    public var narrativeTier: NarrativeDetailTier {
        get { tier }
        set { tier = newValue }
    }
    public var motivation: String {
        get { immediateGoal }
        set { immediateGoal = newValue }
    }
    public var moraleOrExitCondition: String {
        get { moraleExit }
        set { moraleExit = newValue }
    }
    public var morale: String {
        get { moraleExit }
        set { moraleExit = newValue }
    }
    public var exitCondition: String {
        get { moraleExit }
        set { moraleExit = newValue }
    }
    public var purpose: String {
        get { encounterPurpose }
        set { encounterPurpose = newValue }
    }
    public var narrativeDetailTier: NarrativeDetailTier {
        get { tier }
        set { tier = newValue }
    }
    public var participantID: String? {
        get { participantGroupID }
        set { participantGroupID = newValue }
    }
    public var appearance: String? {
        get { appearanceHook }
        set { appearanceHook = newValue }
    }
    public var characterization: String? {
        get { appearanceHook }
        set { appearanceHook = newValue }
    }
    public var voice: String? {
        get { voiceManner }
        set { voiceManner = newValue }
    }
    public var relationships: String? {
        get { leverage }
        set { leverage = newValue }
    }
    public var secrets: [String] {
        get { knowledge.map(\.text) }
        set { knowledge = newValue.map { NPCKnowledgeEntry(text: $0) } }
    }
    public var notes: String? {
        get { futureConsequence }
        set { futureConsequence = newValue }
    }

    public func snapshot(capturedAt: String = "") -> NPCProfileSnapshot {
        NPCProfileSnapshot(profile: self, capturedAt: capturedAt)
    }
}

// MARK: - Progressive disclosure and validation

public struct NPCProfileDisclosure: Codable, Equatable, Sendable {
    public var tier: NarrativeDetailTier
    public var fields: [NPCProfileField]
    public var encounterPurpose: String
    public var name: String
    public var appearanceHook: String?
    public var voiceManner: String?
    public var immediateGoal: String
    public var deeperMotivation: String?
    public var fear: String?
    public var leverage: String?
    public var knowledge: [NPCKnowledgeEntry]
    public var attitude: String?
    public var combatObjective: String?
    public var moraleExit: String
    public var peacefulResponse: String?
    public var futureConsequence: String?

    public var purpose: String { encounterPurpose }
    public var motivation: String { immediateGoal }
    public var moraleOrExitCondition: String { moraleExit }
    public var morale: String { moraleExit }
    public var characterization: String? { appearanceHook }
    public var appearance: String? { appearanceHook }
    public var relationships: String? { leverage }
    public var secrets: [String] { knowledge.map(\.text) }
    public var voice: String? { voiceManner }
    public var notes: String? { futureConsequence }

    public init(profile: NPCProfile) {
        self.tier = profile.tier
        self.fields = NPCProfileSchema.disclosedFields(for: profile.tier)
        self.name = profile.name
        self.encounterPurpose = profile.encounterPurpose
        self.immediateGoal = profile.immediateGoal
        self.moraleExit = profile.moraleExit
        let visible = Set(fields)
        self.appearanceHook = visible.contains(.appearanceHook) ? profile.appearanceHook : nil
        self.voiceManner = visible.contains(.voiceManner) ? profile.voiceManner : nil
        self.deeperMotivation = visible.contains(.deeperMotivation) ? profile.deeperMotivation : nil
        self.fear = visible.contains(.fear) ? profile.fear : nil
        self.leverage = visible.contains(.leverage) ? profile.leverage : nil
        self.peacefulResponse = visible.contains(.peacefulResponse) ? profile.peacefulResponse : nil
        self.knowledge = visible.contains(.knowledge) ? profile.knowledge : []
        self.attitude = visible.contains(.attitude) ? profile.attitude : nil
        self.combatObjective = visible.contains(.combatObjective) ? profile.combatObjective : nil
        self.futureConsequence = visible.contains(.futureConsequence) ? profile.futureConsequence : nil
    }
}

public struct NPCProfileValidationIssue: Codable, Equatable, Sendable {
    public var code: String
    public var field: String
    public var message: String

    public init(code: String, field: String, message: String) {
        self.code = code
        self.field = field
        self.message = message
    }
}

public struct NPCProfileValidationResult: Codable, Equatable, Sendable {
    public var structuralErrors: [NPCProfileValidationIssue]
    public var designWarnings: [NPCProfileValidationIssue]
    public var disclosedFields: [NPCProfileField]
    public var status: String
    public var isStructurallyReady: Bool { structuralErrors.isEmpty }
    public var holisticWarnings: [NPCProfileValidationIssue] { designWarnings }

    public init(
        structuralErrors: [NPCProfileValidationIssue] = [],
        designWarnings: [NPCProfileValidationIssue] = [],
        disclosedFields: [NPCProfileField] = [],
        status: String? = nil
    ) {
        self.structuralErrors = structuralErrors
        self.designWarnings = designWarnings
        self.disclosedFields = disclosedFields
        self.status = status ?? (structuralErrors.isEmpty ? (designWarnings.isEmpty ? "ready" : "ready with warnings") : "incomplete")
    }
}

public enum NPCProfileSchema {
    public static let objectVersion = 1

    public static func requiredFields(for _: NarrativeDetailTier) -> [NPCProfileField] {
        [.encounterPurpose, .immediateGoal, .moraleExit]
    }

    /// Returns the fields the GM-facing summary card may show. The profile
    /// remains self-contained, but hidden fields are omitted from this view.
    public static func disclosedFields(for tier: NarrativeDetailTier) -> [NPCProfileField] {
        switch tier {
        case .incidental:
            return [.encounterPurpose, .immediateGoal, .moraleExit]
        case .supporting:
            return [.encounterPurpose, .immediateGoal, .moraleExit, .appearanceHook, .combatObjective, .peacefulResponse]
        case .prominent:
            return [.encounterPurpose, .immediateGoal, .moraleExit, .appearanceHook, .combatObjective, .peacefulResponse, .voiceManner, .deeperMotivation, .fear, .leverage, .knowledge, .attitude, .futureConsequence]
        }
    }

    public static func acceptedFields(for tier: NarrativeDetailTier) -> [NPCProfileField] {
        disclosedFields(for: tier)
    }

    public static func fields(for tier: NarrativeDetailTier) -> [NPCProfileField] {
        disclosedFields(for: tier)
    }

    public static func disclose(_ profile: NPCProfile) -> NPCProfileDisclosure {
        NPCProfileDisclosure(profile: profile)
    }

    public static func validate(_ profile: NPCProfile) -> NPCProfileValidationResult {
        var errors: [NPCProfileValidationIssue] = []
        var warnings: [NPCProfileValidationIssue] = []
        func required(_ field: NPCProfileField, _ value: String) {
            if value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                errors.append(NPCProfileValidationIssue(code: "required", field: field.rawValue, message: "NPC Profiles require \(field.displayName)."))
            }
        }

        if profile.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errors.append(NPCProfileValidationIssue(code: "required", field: "id", message: "An NPC Profile ID is required."))
        }
        if profile.objectVersion != objectVersion {
            errors.append(NPCProfileValidationIssue(code: "unsupported_version", field: "objectVersion", message: "NPC Profile object version must be \(objectVersion)."))
        }
        required(.encounterPurpose, profile.encounterPurpose)
        required(.immediateGoal, profile.immediateGoal)
        required(.moraleExit, profile.moraleExit)

        if profile.tier != .incidental && profile.peacefulResponse?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == true {
            warnings.append(NPCProfileValidationIssue(code: "missing_progressive_detail", field: NPCProfileField.peacefulResponse.rawValue, message: "A peaceful response can make a \(profile.narrativeTier.rawValue) NPC easier to run without combat."))
        }
        if profile.tier == .prominent && profile.knowledge.isEmpty && profile.appearanceHook?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false {
            warnings.append(NPCProfileValidationIssue(code: "thin_prominent_profile", field: NPCProfileField.knowledge.rawValue, message: "A prominent NPC usually benefits from knowledge or characterization."))
        }

        return NPCProfileValidationResult(structuralErrors: errors, designWarnings: warnings, disclosedFields: disclosedFields(for: profile.narrativeTier))
    }
}

/// NPC Profile's semantic validation surface follows the other authoring
/// builders while keeping this schema independent from EncounterDraft.
public enum NPCProfileBuilder {
    public static func validate(_ profile: NPCProfile) -> NPCProfileValidationResult { NPCProfileSchema.validate(profile) }

    public static func create(_ profile: NPCProfile) throws -> NPCProfile {
        let result = validate(profile)
        guard result.structuralErrors.isEmpty else {
            throw SidekickDomainError("invalid_npc_profile", "The NPC Profile has structural errors.", details: Dictionary(uniqueKeysWithValues: result.structuralErrors.map { ($0.field, $0.message) }))
        }
        return profile
    }
}

private extension NPCProfileField {
    var displayName: String {
        switch self {
        case .encounterPurpose: return "an encounter purpose"
        case .immediateGoal: return "a one-line motivation"
        case .moraleExit: return "a morale or exit condition"
        case .appearanceHook: return "an appearance hook"
        case .voiceManner: return "a voice or manner"
        case .deeperMotivation: return "a deeper motivation"
        case .fear: return "a fear"
        case .leverage: return "leverage"
        case .combatObjective: return "a combat objective"
        case .peacefulResponse: return "a peaceful response"
        case .knowledge: return "knowledge"
        case .futureConsequence: return "a future consequence"
        case .attitude: return "an attitude"
        }
    }
}

// MARK: - Self-contained snapshots and participant links

public struct NPCProfileSnapshot: Codable, Equatable, Sendable {
    public var objectVersion: Int
    public var profileID: String
    public var profileRevision: Int
    public var capturedAt: String
    public var profile: NPCProfile
    public var provenance: NPCProfileProvenance

    public var id: String { profileID }

    public init(profile: NPCProfile, capturedAt: String = "") {
        self.objectVersion = profile.objectVersion
        self.profileID = profile.id
        self.profileRevision = profile.revision
        self.capturedAt = capturedAt
        self.profile = profile
        self.provenance = profile.provenance
    }
}

public struct NPCProfileParticipantLink: Codable, Equatable, Sendable {
    public var participantGroupID: String
    public var profileID: String
    public var snapshot: NPCProfileSnapshot

    public init(participantGroupID: String, profile: NPCProfile, capturedAt: String = "") {
        self.participantGroupID = participantGroupID
        self.profileID = profile.id
        self.snapshot = NPCProfileSnapshot(profile: profile, capturedAt: capturedAt)
    }

    public init(participantGroupID: String, profileID: String, snapshot: NPCProfileSnapshot) {
        self.participantGroupID = participantGroupID
        self.profileID = profileID
        self.snapshot = snapshot
    }
}

public typealias ParticipantNPCProfileLink = NPCProfileParticipantLink
public typealias NPCProfileDraft = NPCProfile
public typealias NPCProfileComponentSnapshot = NPCProfileSnapshot

/// A self-contained export unit for reusable NPC Profiles and their encounter
/// links. It does not depend on a live EncounterDraft or Catalog.
public struct NPCProfileCollectionSnapshot: Codable, Equatable, Sendable {
    public var objectVersion: Int
    public var capturedAt: String
    public var profiles: [NPCProfileSnapshot]
    public var links: [NPCProfileParticipantLink]

    public init(objectVersion: Int = 1, capturedAt: String = "", profiles: [NPCProfileSnapshot] = [], links: [NPCProfileParticipantLink] = []) {
        self.objectVersion = objectVersion
        self.capturedAt = capturedAt
        self.profiles = profiles
        self.links = links
    }

    public init(profiles: [NPCProfile], links: [NPCProfileParticipantLink] = [], capturedAt: String = "") {
        self.init(capturedAt: capturedAt, profiles: profiles.map { $0.snapshot(capturedAt: capturedAt) }, links: links)
    }
}

public enum NPCProfileLinkError: Error, Equatable, Sendable {
    case emptyParticipantGroupID
    case mismatchedProfileID(expected: String, actual: String)
}

public enum NPCProfileLinking {
    public static func link(profile: NPCProfile, to participantGroupID: String, capturedAt: String = "") throws -> NPCProfileParticipantLink {
        guard !participantGroupID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw NPCProfileLinkError.emptyParticipantGroupID }
        var attached = profile
        attached.participantGroupID = participantGroupID
        return NPCProfileParticipantLink(participantGroupID: participantGroupID, profile: attached, capturedAt: capturedAt)
    }

    public static func refresh(_ existingLink: NPCProfileParticipantLink, with profile: NPCProfile, capturedAt: String = "") throws -> NPCProfileParticipantLink {
        guard profile.id == existingLink.profileID else { throw NPCProfileLinkError.mismatchedProfileID(expected: existingLink.profileID, actual: profile.id) }
        return try Self.link(profile: profile, to: existingLink.participantGroupID, capturedAt: capturedAt)
    }
}

// MARK: - Encounter Packet projection

public struct NPCProfilePacketEntry: Codable, Equatable, Sendable {
    public var participantGroupID: String
    public var participantName: String
    public var profileID: String
    public var narrativeTier: NarrativeDetailTier
    public var profile: NPCProfileDisclosure
    public var snapshot: NPCProfileSnapshot

    public var participantID: String { participantGroupID }

    public init(participantGroupID: String, participantName: String, link: NPCProfileParticipantLink) {
        self.participantGroupID = participantGroupID
        self.participantName = participantName
        self.profileID = link.profileID
        self.narrativeTier = link.snapshot.profile.narrativeTier
        self.profile = NPCProfileDisclosure(profile: link.snapshot.profile)
        self.snapshot = link.snapshot
    }
}

public struct NPCProfilePacketProjection: Codable, Equatable, Sendable {
    public var profiles: [NPCProfilePacketEntry]

    public init(profiles: [NPCProfilePacketEntry] = []) { self.profiles = profiles }

    public var entries: [NPCProfilePacketEntry] { profiles }

    public static func project(links: [NPCProfileParticipantLink], participantGroups: [ParticipantGroup]) -> NPCProfilePacketProjection {
        let names = Dictionary(uniqueKeysWithValues: participantGroups.map { ($0.id, $0.name) })
        let entries = links.compactMap { link -> NPCProfilePacketEntry? in
            guard !link.participantGroupID.isEmpty else { return nil }
            return NPCProfilePacketEntry(participantGroupID: link.participantGroupID, participantName: names[link.participantGroupID] ?? link.participantGroupID, link: link)
        }
        return NPCProfilePacketProjection(profiles: entries)
    }

    public static func project(profile: NPCProfile, participantID: String, participantName: String = "") -> NPCProfilePacketEntry {
        let link = NPCProfileParticipantLink(participantGroupID: participantID, profile: profile)
        return NPCProfilePacketEntry(participantGroupID: participantID, participantName: participantName, link: link)
    }
}

// MARK: - Revisioned authoring and persistence

public struct NPCProfilePersistence: Codable, Equatable, Sendable {
    public var profile: NPCProfile
    public var participantGroupID: String?
    public var history: [NPCProfile]
    public var redoHistory: [NPCProfile]

    public init(profile: NPCProfile, participantGroupID: String? = nil, history: [NPCProfile] = [], redoHistory: [NPCProfile] = []) {
        self.profile = profile
        self.participantGroupID = participantGroupID ?? profile.participantGroupID
        self.history = history
        self.redoHistory = redoHistory
    }
}

public enum NPCProfileStoreError: Error, Equatable, Sendable {
    case staleRevision(expected: Int, current: Int)
    case nothingToUndo
    case nothingToRedo
    case invalidProfile([NPCProfileValidationIssue])
    case emptyParticipantGroupID
}

/// Local authoring store for one embedded NPC Profile. History stores full
/// snapshots, so undo and redo preserve provenance and all tier-specific data.
public final class NPCProfileStore: @unchecked Sendable {
    public private(set) var profile: NPCProfile
    public private(set) var participantGroupID: String?
    private var history: [NPCProfile]
    private var redoHistory: [NPCProfile]

    public init(profile: NPCProfile = NPCProfile(), participantGroupID: String? = nil) {
        self.profile = profile
        self.participantGroupID = participantGroupID ?? profile.participantGroupID
        self.history = []
        self.redoHistory = []
    }

    public var revision: Int { profile.revision }
    public var readiness: NPCProfileValidationResult { NPCProfileSchema.validate(profile) }
    public var canUndo: Bool { !history.isEmpty }
    public var canRedo: Bool { !redoHistory.isEmpty }

    @discardableResult
    public func update(_ next: NPCProfile, expectedRevision: Int? = nil, origin: String = "gm", validate: Bool = false) throws -> Int {
        try check(expectedRevision)
        if validate {
            let result = NPCProfileSchema.validate(next)
            guard result.isStructurallyReady else { throw NPCProfileStoreError.invalidProfile(result.structuralErrors) }
        }
        var value = next
        value.revision = profile.revision + 1
        value.provenance.lastMutationOrigin = origin
        history.append(profile)
        redoHistory.removeAll()
        profile = value
        participantGroupID = value.participantGroupID
        return value.revision
    }

    @discardableResult
    public func update(profile next: NPCProfile, expectedRevision: Int? = nil, origin: String = "gm", validate: Bool = false) throws -> Int {
        try update(next, expectedRevision: expectedRevision, origin: origin, validate: validate)
    }

    @discardableResult
    public func attach(to participantGroupID: String, expectedRevision: Int? = nil, origin: String = "gm") throws -> Int {
        guard !participantGroupID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw NPCProfileStoreError.emptyParticipantGroupID }
        var next = profile
        next.participantGroupID = participantGroupID
        return try update(next, expectedRevision: expectedRevision, origin: origin)
    }

    @discardableResult
    public func detach(expectedRevision: Int? = nil, origin: String = "gm") throws -> Int {
        var next = profile
        next.participantGroupID = nil
        return try update(next, expectedRevision: expectedRevision, origin: origin)
    }

    public func link(capturedAt: String = "") throws -> NPCProfileParticipantLink {
        guard let participantGroupID else { throw NPCProfileStoreError.emptyParticipantGroupID }
        return NPCProfileParticipantLink(participantGroupID: participantGroupID, profile: profile, capturedAt: capturedAt)
    }

    public func packetProjection(participantName: String = "") throws -> NPCProfilePacketEntry {
        let linked = try link()
        return NPCProfilePacketEntry(participantGroupID: linked.participantGroupID, participantName: participantName, link: linked)
    }

    public func snapshot(capturedAt: String = "") -> NPCProfileSnapshot { profile.snapshot(capturedAt: capturedAt) }

    public func undo(expectedRevision: Int? = nil, origin: String = "gm") throws {
        try check(expectedRevision)
        guard let previous = history.popLast() else { throw NPCProfileStoreError.nothingToUndo }
        redoHistory.append(profile)
        var value = previous
        value.revision = profile.revision + 1
        value.provenance.lastMutationOrigin = origin
        profile = value
        participantGroupID = value.participantGroupID
    }

    public func redo(expectedRevision: Int? = nil, origin: String = "gm") throws {
        try check(expectedRevision)
        guard let next = redoHistory.popLast() else { throw NPCProfileStoreError.nothingToRedo }
        history.append(profile)
        var value = next
        value.revision = profile.revision + 1
        value.provenance.lastMutationOrigin = origin
        profile = value
        participantGroupID = value.participantGroupID
    }

    public var encodedState: Data {
        (try? JSONEncoder().encode(NPCProfilePersistence(profile: profile, participantGroupID: participantGroupID, history: history, redoHistory: redoHistory))) ?? Data()
    }

    public func restore(_ data: Data) throws {
        let state = try JSONDecoder().decode(NPCProfilePersistence.self, from: data)
        profile = state.profile
        participantGroupID = state.participantGroupID ?? state.profile.participantGroupID
        history = state.history
        redoHistory = state.redoHistory
    }

    public func restore(from data: Data) throws { try restore(data) }

    private func check(_ expected: Int?) throws {
        if let expected, expected != profile.revision { throw NPCProfileStoreError.staleRevision(expected: expected, current: profile.revision) }
    }
}

public typealias NPCProfileAuthoringStore = NPCProfileStore
public typealias NPCProfileBuilderStore = NPCProfileStore
public typealias NPCProfileProjection = NPCProfilePacketProjection
