import Foundation

public enum ThreatTargetKind: String, Codable, CaseIterable, Sendable { case trivial, low, moderate, severe, extreme, custom }
public struct ThreatTarget: Codable, Equatable, Sendable { public var kind: ThreatTargetKind; public var customXP: Int?; public init(kind: ThreatTargetKind = .moderate, customXP: Int? = nil) { self.kind = kind; self.customXP = customXP } }
public struct PartySnapshot: Codable, Equatable, Sendable { public var effectiveLevel: Int; public var size: Int; public var mixedLevelNotes: String?; public init(effectiveLevel: Int = 1, size: Int = 4, mixedLevelNotes: String? = nil) { self.effectiveLevel = effectiveLevel; self.size = size; self.mixedLevelNotes = mixedLevelNotes } }
public struct EncounterBrief: Codable, Equatable, Sendable { public var party: PartySnapshot; public var threatTarget: ThreatTarget; public var purpose: String; public var premise: String; public var environment: String; public var theme: [String]?; public var tone: [String]?; public var desiredComplexity: String?; public var existingVsCustom: String?; public var approximatePlayMinutes: Int?; public var preferredTraits: [String]?; public var excludedTraits: [String]?; public var sourceRestrictions: [String]?; public var generationAssumptions: [String]?; public init(party: PartySnapshot = PartySnapshot(), threatTarget: ThreatTarget = ThreatTarget(), purpose: String = "", premise: String = "", environment: String = "", theme: [String]? = nil, tone: [String]? = nil, desiredComplexity: String? = nil, existingVsCustom: String? = nil, approximatePlayMinutes: Int? = nil, preferredTraits: [String]? = nil, excludedTraits: [String]? = nil, sourceRestrictions: [String]? = nil, generationAssumptions: [String]? = nil) { self.party = party; self.threatTarget = threatTarget; self.purpose = purpose; self.premise = premise; self.environment = environment; self.theme = theme; self.tone = tone; self.desiredComplexity = desiredComplexity; self.existingVsCustom = existingVsCustom; self.approximatePlayMinutes = approximatePlayMinutes; self.preferredTraits = preferredTraits; self.excludedTraits = excludedTraits; self.sourceRestrictions = sourceRestrictions; self.generationAssumptions = generationAssumptions } }

public enum CreatureAdjustment: String, Codable, CaseIterable, Sendable { case weak, normal, elite }
public enum Faction: String, Codable, CaseIterable, Sendable { case party, primaryOpposition = "primary_opposition", secondaryOpposition = "secondary_opposition", allied, neutral }
public enum ParticipationMode: String, Codable, CaseIterable, Sendable { case mandatory, avoidable, conditional, reinforcement }
public enum EncounterRole: String, Codable, CaseIterable, Sendable { case brute, defender, skirmisher, sniper, controller, support, ambusher, leader, soloBoss = "solo_boss" }
public enum NarrativeDetailTier: String, Codable, CaseIterable, Sendable { case incidental, supporting, prominent }
public enum HazardComplexity: String, Codable, CaseIterable, Sendable { case simple, complex }
public struct Participation: Codable, Equatable, Sendable { public var mode: ParticipationMode; public var condition: String?; public init(mode: ParticipationMode = .mandatory, condition: String? = nil) { self.mode = mode; self.condition = condition } }

public struct ParticipantGroup: Codable, Equatable, Sendable {
    public var id: String; public var contentID: String; public var name: String; public var displayName: String?; public var level: Int; public var quantity: Int; public var adjustment: CreatureAdjustment; public var faction: Faction; public var participation: Participation; public var encounterRole: EncounterRole; public var narrativeTier: NarrativeDetailTier; public var startingArea: String; public var sharedTactics: String; public var morale: String
    public init(id: String, contentID: String, name: String, displayName: String? = nil, level: Int, quantity: Int = 1, adjustment: CreatureAdjustment = .normal, faction: Faction = .primaryOpposition, participation: Participation = Participation(), encounterRole: EncounterRole = .brute, narrativeTier: NarrativeDetailTier = .incidental, startingArea: String = "", sharedTactics: String = "", morale: String = "") { self.id = id; self.contentID = contentID; self.name = name; self.displayName = displayName; self.level = level; self.quantity = quantity; self.adjustment = adjustment; self.faction = faction; self.participation = participation; self.encounterRole = encounterRole; self.narrativeTier = narrativeTier; self.startingArea = startingArea; self.sharedTactics = sharedTactics; self.morale = morale }
}
public struct EncounterHazard: Codable, Equatable, Sendable { public var id: String; public var contentID: String; public var name: String; public var level: Int; public var complexity: HazardComplexity; public var participation: Participation; public var placement: String; public init(id: String, contentID: String, name: String, level: Int, complexity: HazardComplexity = .simple, participation: Participation = Participation(mode: .avoidable), placement: String = "") { self.id = id; self.contentID = contentID; self.name = name; self.level = level; self.complexity = complexity; self.participation = participation; self.placement = placement } }
public struct EncounterPhase: Codable, Equatable, Sendable { public var id: String; public var title: String; public var order: Int; public var participantIDs: [String]; public var hazardIDs: [String]; public var trigger: String; public var runningGuidance: String; public init(id: String, title: String, order: Int = 0, participantIDs: [String] = [], hazardIDs: [String] = [], trigger: String = "", runningGuidance: String = "") { self.id = id; self.title = title; self.order = order; self.participantIDs = participantIDs; self.hazardIDs = hazardIDs; self.trigger = trigger; self.runningGuidance = runningGuidance } }
public struct EncounterPacket: Codable, Equatable, Sendable { public var premise: String; public var objective: String; public var setup: String; public var runningGuidance: String; public var cohesion: String; public var outcomes: String; public init(premise: String = "", objective: String = "", setup: String = "", runningGuidance: String = "", cohesion: String = "", outcomes: String = "") { self.premise = premise; self.objective = objective; self.setup = setup; self.runningGuidance = runningGuidance; self.cohesion = cohesion; self.outcomes = outcomes } }
public struct ProvenanceSummary: Codable, Equatable, Sendable { public var origin: String; public var lastMutationOrigin: String; public init(origin: String = "gm", lastMutationOrigin: String = "gm") { self.origin = origin; self.lastMutationOrigin = lastMutationOrigin } }
public struct GenerationState: Codable, Equatable, Sendable { public var id: String; public var state: String; public var openingDraftJSON: String?; public var intentSummary: String; public init(id: String, state: String = "active", openingDraftJSON: String? = nil, intentSummary: String = "") { self.id = id; self.state = state; self.openingDraftJSON = openingDraftJSON; self.intentSummary = intentSummary } }

public struct EncounterDraft: Codable, Equatable, Sendable {
    public var id: String; public var revision: Int; public var briefRevision: Int?; public var constraintsRevision: Int; public var title: String; public var swiftOwnedValue: Int; public var brief: EncounterBrief; public var participantGroups: [ParticipantGroup]; public var hazards: [EncounterHazard]; public var phases: [EncounterPhase]; public var packet: EncounterPacket; public var generation: GenerationState?; public var reviewState: String; public var provenance: ProvenanceSummary; public var originalCreatures: [OriginalCreature]?; public var customHazards: [SimpleHazard]?; public var packetV1: EncounterPacketContentV1?; public var contentBoundaries: GMOwnedContentBoundaries?; public var npcProfiles: [NPCProfile]?; public var structuredPhases: [PhaseAuthoring]?; public var embeddedCatalogEntries: [AnyCodable]?
    public init(id: String = "enc_demo", title: String = "The Bell Beneath Blackwater", swiftOwnedValue: Int = 7, revision: Int = 0, briefRevision: Int? = 0, constraintsRevision: Int = 0, brief: EncounterBrief = EncounterBrief(), participantGroups: [ParticipantGroup] = [], hazards: [EncounterHazard] = [], phases: [EncounterPhase] = [], packet: EncounterPacket = EncounterPacket(), generation: GenerationState? = nil, reviewState: String = "needed", provenance: ProvenanceSummary = ProvenanceSummary(), originalCreatures: [OriginalCreature]? = [], customHazards: [SimpleHazard]? = [], packetV1: EncounterPacketContentV1? = nil, contentBoundaries: GMOwnedContentBoundaries? = GMOwnedContentBoundaries(), npcProfiles: [NPCProfile]? = [], structuredPhases: [PhaseAuthoring]? = [], embeddedCatalogEntries: [AnyCodable]? = nil) { self.id = id; self.revision = revision; self.briefRevision = briefRevision; self.constraintsRevision = constraintsRevision; self.title = title; self.swiftOwnedValue = swiftOwnedValue; self.brief = brief; self.participantGroups = participantGroups; self.hazards = hazards; self.phases = phases; self.packet = packet; self.generation = generation; self.reviewState = reviewState; self.provenance = provenance; self.originalCreatures = originalCreatures; self.customHazards = customHazards; self.packetV1 = packetV1; self.contentBoundaries = contentBoundaries; self.npcProfiles = npcProfiles; self.structuredPhases = structuredPhases; self.embeddedCatalogEntries = embeddedCatalogEntries }
    public mutating func increment() { swiftOwnedValue += 1 }
}

public struct BudgetProjection: Codable, Equatable, Sendable { public var targetThreat: String; public var baseTargetXP: Int; public var partySizeAdjustment: Int; public var constructionBudget: Int; public var guaranteedXP: Int; public var avoidableXP: Int; public var conditionalXP: Int; public var peakActiveXP: Int; public var totalEncounterXP: Int; public var baseXPAward: Int; public var terrainAdjustment: Int; public var inferredThreat: String; public var warnings: [String] }
public struct ReadinessProjection: Codable, Equatable, Sendable { public var structuralErrors: [String]; public var designWarnings: [String]; public var missingRequiredPacketSections: [String]; public var status: String; public var generationStatus: String; public var structuralStatus: String; public var reviewStatus: String; public var briefPremise: String?; public var packetPremise: String?; public var displayPremise: String?; public init(structuralErrors: [String] = [], designWarnings: [String] = [], missingRequiredPacketSections: [String] = [], status: String = "incomplete", generationStatus: String = "idle", structuralStatus: String? = nil, reviewStatus: String = "needed", briefPremise: String? = nil, packetPremise: String? = nil, displayPremise: String? = nil) { self.structuralErrors = structuralErrors; self.designWarnings = designWarnings; self.missingRequiredPacketSections = missingRequiredPacketSections; self.status = status; self.generationStatus = generationStatus; self.structuralStatus = structuralStatus ?? (status == "incomplete" ? "incomplete" : "ready"); self.reviewStatus = reviewStatus; self.briefPremise = briefPremise; self.packetPremise = packetPremise; self.displayPremise = displayPremise } }
public struct ActivityEntry: Codable, Equatable, Sendable { public var id: String; public var description: String; public var origin: String; public var beforeRevision: Int; public var afterRevision: Int; public var time: String }

public struct BoundarySnapshot: Codable, Equatable, Sendable {
    public let protocolVersion: Int; public let engine: String; public let initialized: Bool; public let draft: EncounterDraft; public let encounter: EncounterDraft; public let encounterRevision: Int; public let briefRevision: Int; public let constraintsRevision: Int; public let budget: BudgetProjection; public let phaseBudget: PhaseBudgetProjection; public let readiness: ReadinessProjection; public let activity: [ActivityEntry]; public let canUndo: Bool; public let canRedo: Bool; public let generationRunID: String?; public let error: String?
    public init(draft: EncounterDraft, budget: BudgetProjection, readiness: ReadinessProjection, activity: [ActivityEntry] = [], canUndo: Bool = false, canRedo: Bool = false, error: String? = nil) { protocolVersion = 1; engine = "SidekickDMCore"; initialized = error == nil; self.draft = draft; encounter = draft; encounterRevision = draft.revision; briefRevision = draft.briefRevision ?? 0; constraintsRevision = draft.constraintsRevision; self.budget = budget; phaseBudget = PhaseAuthoringMath.project(document: PhaseAuthoringDocument(encounter: draft)); self.readiness = readiness; self.activity = activity; self.canUndo = canUndo; self.canRedo = canRedo; generationRunID = draft.generation?.id; self.error = error }
}

public enum EncounterMath {
    private static let threat: [ThreatTargetKind: (Int, Int)] = [.trivial: (40, 10), .low: (60, 20), .moderate: (80, 20), .severe: (120, 30), .extreme: (160, 40)]
    private static let creature = [10, 15, 20, 30, 40, 60, 80, 120, 160]; private static let simpleHazard = [2, 3, 4, 6, 8, 12, 16, 24, 30]; private static let complexHazard = [10, 15, 20, 30, 40, 60, 80, 120, 150]
    private static let bands: [ThreatTargetKind] = [.trivial, .low, .moderate, .severe, .extreme]
    public static func targetValues(_ target: ThreatTarget) -> (base: Int, adjustment: Int) { target.kind == .custom ? (max(0, target.customXP ?? 0), 0) : (threat[target.kind] ?? (80, 20)) }
    public static func baseBudget(for target: ThreatTarget) -> Int { targetValues(target).base }
    public static func partyAdjustedBudget(for target: ThreatTarget, partySize: Int) -> Int { let values = targetValues(target); return max(0, values.base + (partySize - 4) * values.adjustment) }
    public static func creatureXP(componentLevel: Int, partyLevel: Int) -> Int { tableValue(creature, relative: componentLevel - partyLevel, below: 0, above: 160) }
    public static func hazardXP(level: Int, partyLevel: Int, complexity: HazardComplexity) -> Int { tableValue(complexity == .simple ? simpleHazard : complexHazard, relative: level - partyLevel, below: 0, above: complexity == .simple ? 30 : 150) }
    public static func adjustedCreatureLevel(_ level: Int, _ adjustment: CreatureAdjustment) -> Int { level + (adjustment == .weak ? -1 : adjustment == .elite ? 1 : 0) }
    public static func budget(for draft: EncounterDraft) -> BudgetProjection {
        let target = draft.brief.threatTarget; let values = targetValues(target); var guaranteed = 0, avoidable = 0, conditional = 0
        for group in draft.participantGroups { let xp = creatureXP(componentLevel: adjustedCreatureLevel(group.level, group.adjustment), partyLevel: draft.brief.party.effectiveLevel) * max(0, group.quantity); switch group.participation.mode { case .mandatory: guaranteed += xp; case .avoidable: avoidable += xp; case .conditional, .reinforcement: conditional += xp } }
        for hazard in draft.hazards { let xp = hazardXP(level: hazard.level, partyLevel: draft.brief.party.effectiveLevel, complexity: hazard.complexity); switch hazard.participation.mode { case .mandatory: guaranteed += xp; case .avoidable: avoidable += xp; case .conditional, .reinforcement: conditional += xp } }
        let allXP = guaranteed + avoidable + conditional; var peak = allXP
        if !draft.phases.isEmpty { peak = draft.phases.map { phase in let groups = draft.participantGroups.filter { phase.participantIDs.contains($0.id) }.reduce(0) { $0 + creatureXP(componentLevel: adjustedCreatureLevel($1.level, $1.adjustment), partyLevel: draft.brief.party.effectiveLevel) * max(0, $1.quantity) }; let hazards = draft.hazards.filter { phase.hazardIDs.contains($0.id) }.reduce(0) { $0 + hazardXP(level: $1.level, partyLevel: draft.brief.party.effectiveLevel, complexity: $1.complexity) }; return groups + hazards }.max() ?? 0 }
        let construction = partyAdjustedBudget(for: target, partySize: draft.brief.party.size); let inferred = inferredThreat(xp: peak, partySize: draft.brief.party.size, target: target); var warnings = [String](); if peak > construction { warnings.append("Peak Active XP exceeds the Construction Budget.") }; if (guaranteed + avoidable + conditional) > 0 && peak < construction / 2 && construction > 0 { warnings.append("Peak Active XP is substantially below the Construction Budget.") }; if draft.participantGroups.contains(where: { abs($0.level - draft.brief.party.effectiveLevel) > 4 }) { warnings.append("A creature is outside the common relative-level range of −4 to +4.") }
        return BudgetProjection(targetThreat: target.kind.rawValue, baseTargetXP: values.base, partySizeAdjustment: (draft.brief.party.size - 4) * values.adjustment, constructionBudget: construction, guaranteedXP: guaranteed, avoidableXP: avoidable, conditionalXP: conditional, peakActiveXP: peak, totalEncounterXP: allXP, baseXPAward: values.base, terrainAdjustment: 0, inferredThreat: inferred, warnings: warnings)
    }
    public static func inferredThreat(xp: Int, partySize: Int, target: ThreatTarget) -> String { if target.kind == .custom { return xp == 0 ? "trivial" : "custom" }; let budgets = bands.map { partyAdjustedBudget(for: ThreatTarget(kind: $0), partySize: partySize) }; if xp <= budgets[0] { return "trivial" }; if xp <= budgets[1] { return "low" }; if xp <= budgets[2] { return "moderate" }; if xp <= budgets[3] { return "severe" }; return "extreme" }
    private static func tableValue(_ table: [Int], relative: Int, below: Int, above: Int) -> Int { if relative < -4 { return below }; if relative > 4 { return above }; return table[relative + 4] }
}

public struct SidekickDomainError: Error, Sendable { public let code: String; public let message: String; public let details: [String: String]; public init(_ code: String, _ message: String, details: [String: String] = [:]) { self.code = code; self.message = message; self.details = details } }

public final class EncounterStore: @unchecked Sendable {
    public private(set) var draft: EncounterDraft; public let catalog: SidekickCatalog; public private(set) var activity: [ActivityEntry] = []; private var history: [EncounterDraft] = []; private var redoHistory: [EncounterDraft] = []
    public init(draft: EncounterDraft = EncounterDraft(), catalog: SidekickCatalog = CatalogFixture.demo()) { self.draft = draft; self.catalog = catalog }
    public func load(_ loaded: EncounterDraft) {
        var restored = loaded
        if restored.generation?.state == "active" { restored.generation?.state = "interrupted" }
        draft = restored; history.removeAll(); redoHistory.removeAll(); activity.removeAll()
    }
    public var budget: BudgetProjection { EncounterMath.budget(for: draft) }
    public var readiness: ReadinessProjection {
        var errors = [String]()
        if !(1...20).contains(draft.brief.party.effectiveLevel) { errors.append("Party effective level must be between 1 and 20.") }
        if !(1...8).contains(draft.brief.party.size) { errors.append("Party size must be between 1 and 8.") }
        if draft.brief.threatTarget.kind == .custom && (draft.brief.threatTarget.customXP ?? -1) < 0 { errors.append("Custom Threat Target XP cannot be negative.") }
        for group in draft.participantGroups where group.quantity < 1 { errors.append("Participant quantity must be at least 1.") }

        let creatureValidation = (draft.originalCreatures ?? []).map(CreatureBuilder.validate)
        errors += creatureValidation.flatMap { $0.structuralErrors.map(\.message) }
        let creatureWarnings = creatureValidation.flatMap { $0.holisticWarnings.map(\.message) }
        let hazardValidation = (draft.customHazards ?? []).map(HazardBuilder.validate)
        errors += hazardValidation.flatMap { $0.structuralErrors.map(\.message) }
        let hazardWarnings = hazardValidation.flatMap { $0.holisticWarnings.map(\.message) }
        let npcValidation = (draft.npcProfiles ?? []).map(NPCProfileBuilder.validate)
        errors += npcValidation.flatMap { $0.structuralErrors.map(\.message) }
        let npcWarnings = npcValidation.flatMap { $0.designWarnings.map(\.message) }
        let packetContent = draft.packetV1 ?? EncounterPacketContentV1(corePacket: draft.packet, title: draft.title)
        let packetReadiness = PacketReadinessValidator.validate(packetContent)
        errors += packetReadiness.structuralErrors.map(\.message)
        let phaseWarnings = PhaseAuthoringMath.project(document: PhaseAuthoringDocument(encounter: draft)).overlapWarnings.map(\.message)
        let warnings = budget.warnings + creatureWarnings + hazardWarnings + npcWarnings + packetReadiness.designWarnings.map(\.message) + phaseWarnings
        let missingSections = packetReadiness.missingSections.map { section in
            switch section {
            case .identity: return "encounter_identity"
            case .battlefield: return "battlefield_guidance"
            case .information: return "information_visibility"
            default: return section.rawValue
            }
        }
        let briefPremise = draft.brief.premise.isEmpty ? nil : draft.brief.premise
        let packetPremise = packetContent.identity.premise.isEmpty ? nil : packetContent.identity.premise
        return ReadinessProjection(
            structuralErrors: errors,
            designWarnings: warnings,
            missingRequiredPacketSections: missingSections,
            status: errors.isEmpty ? (warnings.isEmpty ? "ready" : "ready_with_warnings") : "incomplete",
            generationStatus: draft.generation?.state ?? "idle",
            structuralStatus: draft.generation?.state == "interrupted" ? "blocked" : (errors.isEmpty ? "ready" : "incomplete"),
            reviewStatus: draft.reviewState,
            briefPremise: briefPremise,
            packetPremise: packetPremise,
            displayPremise: packetPremise ?? briefPremise
        )
    }
    public func snapshot(error: String? = nil) -> BoundarySnapshot { BoundarySnapshot(draft: draft, budget: budget, readiness: readiness, activity: activity, canUndo: !history.isEmpty, canRedo: !redoHistory.isEmpty, error: error) }
    @discardableResult public func mutate(description: String, origin: String, expectedRevision: Int?, operation: (inout EncounterDraft) throws -> Void) throws -> Int { try check(expectedRevision); let before = draft; let wasInGeneration = before.generation != nil; var next = draft; try operation(&next); next.revision = draft.revision + 1; next.provenance.lastMutationOrigin = origin; draft = next; if !wasInGeneration { history.append(before); redoHistory.removeAll() }; record(description: description, origin: origin, before: before.revision, after: draft.revision); return draft.revision }
    public func undo(expectedRevision: Int?, origin: String) throws { try check(expectedRevision); guard let previous = history.popLast() else { throw SidekickDomainError("nothing_to_undo", "There is no earlier Mutation in this Encounter Draft.") }; let current = draft; redoHistory.append(current); let nextRevision = draft.revision + 1; draft = previous; draft.revision = nextRevision; draft.generation = nil; record(description: "Undid the last Mutation", origin: origin, before: nextRevision - 1, after: nextRevision) }
    public func redo(expectedRevision: Int?, origin: String) throws { try check(expectedRevision); guard let next = redoHistory.popLast() else { throw SidekickDomainError("nothing_to_redo", "There is no undone Mutation in this Encounter Draft.") }; history.append(draft); let nextRevision = draft.revision + 1; draft = next; draft.revision = nextRevision; record(description: "Redid the last Mutation", origin: origin, before: nextRevision - 1, after: nextRevision) }
    public func discardGenerationHistoryAfterCancel() { _ = history.popLast(); redoHistory.removeAll() }
    private func check(_ expected: Int?) throws { if let expected, expected != draft.revision { throw SidekickDomainError("stale_revision", "The encounter changed after it was inspected.", details: ["expected_revision": "\(expected)", "current_revision": "\(draft.revision)"]) } }
    private func record(description: String, origin: String, before: Int, after: Int) { activity.insert(ActivityEntry(id: "mutation-\(after)-\(activity.count)", description: description, origin: origin, beforeRevision: before, afterRevision: after, time: "session"), at: 0); activity = Array(activity.prefix(12)) }
}

public enum SidekickCommandExecutor {
    /// Commands implemented by the native boundary. Keep this list next to the
    /// dispatcher so a JavaScript adapter can refuse an incompatible engine
    /// before registering tools.
    public static let supportedCommands: Set<String> = [
        "sidekick_create_encounter", "sidekick_increment", "sidekick_load_draft", "sidekick_reset",
        "sidekickdm_create_encounter", "sidekickdm_load_draft",
        "sidekickdm_add_hazard", "sidekickdm_add_existing_hazard", "sidekickdm_add_participant_group", "sidekickdm_add_existing_participant_group", "sidekickdm_apply_generation_step",
        "sidekickdm_apply_targeted_revision", "sidekickdm_begin_generation", "sidekickdm_cancel_generation",
        "sidekickdm_create_custom_creature", "sidekickdm_create_simple_hazard", "sidekickdm_finish_generation",
        "sidekickdm_get_budget", "sidekickdm_get_encounter_summary", "sidekickdm_get_encounter_brief",
        "sidekickdm_get_readiness", "sidekickdm_redo", "sidekickdm_remove_component", "sidekickdm_resume_generation",
        "sidekickdm_set_alternative_resolutions", "sidekickdm_set_battlefield_guidance", "sidekickdm_set_cohesion",
        "sidekickdm_set_encounter_identity", "sidekickdm_set_encounter_packet", "sidekickdm_set_generation_assumptions",
        "sidekickdm_set_information_visibility", "sidekickdm_set_outcomes", "sidekickdm_set_party_snapshot", "sidekickdm_update_party_snapshot",
        "sidekickdm_set_reward_guidance", "sidekickdm_set_running_guidance", "sidekickdm_set_setup",
        "sidekickdm_set_threat_target", "sidekickdm_update_threat_target", "sidekickdm_undo", "sidekickdm_update_creative_brief",
        "sidekickdm_update_creature", "sidekickdm_update_custom_creature", "sidekickdm_update_hazard", "sidekickdm_update_participant_group",
        "sidekickdm_upsert_npc_profile", "sidekickdm_upsert_phase"
    ]

    public static let engineInterfaceVersion = 2

    public static func execute(_ command: [String: Any], in store: EncounterStore) throws {
        let name = (command["command"] as? String) ?? ""; let expected = try firstNumber(command, keys: ["expected_revision", "expected_encounter_revision", "expectedRevision"]); let origin = (command["origin"] as? String) ?? "gm"; let expectedBrief = try number(command, "expected_brief_revision"); let expectedConstraints = try number(command, "expected_constraints_revision")
        let isCreate = name == "sidekick_create_encounter" || name == "sidekickdm_create_encounter"
        if let encounterID = command["encounter_id"] as? String, !isCreate, encounterID != store.draft.id { throw SidekickDomainError("unknown_encounter", "The requested Encounter Draft does not exist.", details: ["encounter_id": encounterID]) }
        if let expectedBrief, expectedBrief != (store.draft.briefRevision ?? 0) { throw SidekickDomainError("stale_brief_revision", "The Encounter Brief changed after it was inspected.", details: ["expected_brief_revision": "\(expectedBrief)", "current_brief_revision": "\(store.draft.briefRevision ?? 0)"]) }
        if let expectedConstraints, expectedConstraints != store.draft.constraintsRevision { throw SidekickDomainError("stale_constraints", "The Content Boundaries or Party Snapshot changed after it was inspected.", details: ["expected_constraints_revision": "\(expectedConstraints)", "current_constraints_revision": "\(store.draft.constraintsRevision)"]) }
        let reads = ["sidekickdm_get_budget", "sidekickdm_get_encounter_summary", "sidekickdm_get_encounter_brief", "sidekickdm_get_readiness"]
        let generationOnly = Set(["sidekickdm_add_participant_group", "sidekickdm_add_existing_participant_group", "sidekickdm_update_participant_group", "sidekickdm_apply_generation_step", "sidekickdm_create_custom_creature", "sidekickdm_update_creature", "sidekickdm_update_custom_creature", "sidekickdm_upsert_npc_profile", "sidekickdm_add_hazard", "sidekickdm_add_existing_hazard", "sidekickdm_create_simple_hazard", "sidekickdm_update_hazard", "sidekickdm_remove_component", "sidekickdm_upsert_phase", "sidekickdm_set_encounter_identity", "sidekickdm_set_setup", "sidekickdm_set_battlefield_guidance", "sidekickdm_set_running_guidance", "sidekickdm_set_cohesion", "sidekickdm_set_information_visibility", "sidekickdm_set_outcomes", "sidekickdm_set_reward_guidance", "sidekickdm_set_alternative_resolutions", "sidekickdm_set_generation_assumptions", "sidekickdm_update_creative_brief", "sidekickdm_finish_generation"])
        let targetedForward = command["targeted_revision"] as? Bool == true
        if origin == "webmcp", generationOnly.contains(name), store.draft.generation == nil, !targetedForward {
            throw SidekickDomainError("no_active_generation", "This mutation requires an active Generation Run.")
        }
        if let activeRun = store.draft.generation {
            let activeMutation = !reads.contains(name) && name != "sidekickdm_begin_generation"
            if activeMutation {
                guard origin != "gm" && origin != "manual" else { throw SidekickDomainError("manual_write_locked", "GM writes are locked while a Generation Run is active.") }
                if activeRun.state == "interrupted", name != "sidekickdm_resume_generation", name != "sidekickdm_cancel_generation" {
                    throw SidekickDomainError("generation_interrupted", "The Generation Run was interrupted by a reload. Resume or cancel it before retrying.")
                }
                if name != "sidekickdm_cancel_generation" {
                    guard let expectedConstraints else { throw SidekickDomainError("invalid_request", "Active Generation Run mutations require the current Constraints Revision.") }
                    guard expectedConstraints == store.draft.constraintsRevision else { throw SidekickDomainError("stale_constraints", "The Content Boundaries or Party Snapshot changed after it was inspected.", details: ["expected_constraints_revision": "\(expectedConstraints)", "current_constraints_revision": "\(store.draft.constraintsRevision)"]) }
                }
                guard command["generation_run_id"] as? String == activeRun.id else { throw SidekickDomainError("wrong_generation_run", "That Generation Run is no longer active.", details: ["current_generation_run_id": activeRun.id]) }
            }
        }
        switch name {
        case "sidekickdm_get_budget", "sidekickdm_get_encounter_summary", "sidekickdm_get_encounter_brief", "sidekickdm_get_readiness": break
        case "sidekick_increment": try store.mutate(description: "Changed Swift-owned value", origin: origin, expectedRevision: expected) { $0.increment() }
        case "sidekick_create_encounter", "sidekickdm_create_encounter":
            let party = command["party"] as? [String: Any]
            let partyLevel = try party.flatMap { try number($0, "effective_level") } ?? 1
            let partySize = try party.flatMap { try number($0, "size") } ?? 4
            let level = try number(command, "effective_level") ?? partyLevel
            let size = try number(command, "size") ?? partySize
            let kindName = (command["threat_target"] as? [String: Any]).flatMap { $0["kind"] as? String } ?? (command["kind"] as? String) ?? "moderate"
            guard let kind = ThreatTargetKind(rawValue: kindName) else { throw invalidEnum(field: "kind", value: kindName, allowed: ThreatTargetKind.allCases.map(\.rawValue)) }
            guard (1...20).contains(level), (1...8).contains(size) else { throw SidekickDomainError("invalid_party_profile", "Effective party level must be 1–20 and party size 1–8.") }
            let custom = try number(command, "custom_xp") ?? (try (command["threat_target"] as? [String: Any]).flatMap { try number($0, "custom_xp") })
            guard kind != .custom || (custom ?? -1) >= 0 else { throw SidekickDomainError("invalid_threat_target", "Custom Threat Target XP must be zero or greater.") }
            let title = (command["title"] as? String) ?? "Untitled Encounter"
            let id = (command["encounter_id"] as? String) ?? "enc_\(UUID().uuidString.lowercased())"
            let brief = EncounterBrief(party: PartySnapshot(effectiveLevel: level, size: size), threatTarget: ThreatTarget(kind: kind, customXP: kind == .custom ? custom : nil))
            try store.mutate(description: "Created Encounter Draft", origin: origin, expectedRevision: expected) { $0 = EncounterDraft(id: id, title: title, brief: brief) }
        case "sidekickdm_set_party_snapshot", "sidekickdm_update_party_snapshot": let party = command["party"] as? [String: Any]; let commandLevel = try number(command, "effective_level"); let partyLevel = try party.flatMap { try number($0, "effective_level") }; let level = commandLevel ?? partyLevel ?? store.draft.brief.party.effectiveLevel; let commandSize = try number(command, "size"); let partySize = try party.flatMap { try number($0, "size") }; let size = commandSize ?? partySize ?? store.draft.brief.party.size; guard (1...20).contains(level), (1...8).contains(size) else { throw SidekickDomainError("invalid_party_profile", "Effective party level must be 1–20 and party size 1–8.") }; try store.mutate(description: "Updated Party Snapshot", origin: origin, expectedRevision: expected) { $0.brief.party.effectiveLevel = level; $0.brief.party.size = size; $0.briefRevision = ($0.briefRevision ?? 0) + 1; $0.constraintsRevision += 1 }
        case "sidekickdm_set_threat_target", "sidekickdm_update_threat_target":
            let target = command["threat_target"] as? [String: Any]
            let kindValue = (command["kind"] as? String) ?? (target?["kind"] as? String) ?? "moderate"
            guard let kind = ThreatTargetKind(rawValue: kindValue) else { throw invalidEnum(field: "kind", value: kindValue, allowed: ThreatTargetKind.allCases.map(\.rawValue)) }
            let commandCustom = try number(command, "custom_xp")
            let targetCustom = try target.flatMap { try number($0, "custom_xp") }
            let custom = commandCustom ?? targetCustom
            guard kind != .custom || (custom ?? -1) >= 0 else { throw SidekickDomainError("invalid_threat_target", "Custom Threat Target XP must be zero or greater.") }
            try store.mutate(description: "Set Threat Target to \(kind.rawValue)", origin: origin, expectedRevision: expected) { $0.brief.threatTarget = ThreatTarget(kind: kind, customXP: custom); $0.briefRevision = ($0.briefRevision ?? 0) + 1 }
        case "sidekickdm_apply_generation_step":
            let step = command["step"] as? String ?? ""
            guard step == "composition" || step == "guidance" else { throw SidekickDomainError("invalid_request", "Generation step must be composition or guidance.", details: ["field": "step"]) }
            if step == "composition" {
                let rawParticipants = command["participants"] as? [[String: Any]] ?? []
                let rawHazards = command["hazards"] as? [[String: Any]] ?? []
                guard !rawParticipants.isEmpty || !rawHazards.isEmpty else { throw SidekickDomainError("invalid_request", "A composition step must include participants or hazards.") }
                var groups = [ParticipantGroup](); var originals = [OriginalCreature]()
                for item in rawParticipants {
                    let built = try participantGroup(from: item, store: store)
                    guard !store.draft.participantGroups.contains(where: { $0.id == built.group.id }) && !groups.contains(where: { $0.id == built.group.id }) else { throw SidekickDomainError("duplicate_component", "A composition item uses an existing component ID.", details: ["component_id": built.group.id]) }
                    groups.append(built.group)
                    if let original = built.original { originals.append(original) }
                }
                var hazards = [EncounterHazard](); var customHazards = [SimpleHazard]()
                for item in rawHazards {
                    let built = try encounterHazard(from: item, store: store)
                    guard !store.draft.hazards.contains(where: { $0.id == built.hazard.id }) && !hazards.contains(where: { $0.id == built.hazard.id }) else { throw SidekickDomainError("duplicate_component", "A composition item uses an existing hazard ID.", details: ["component_id": built.hazard.id]) }
                    hazards.append(built.hazard)
                    if let custom = built.custom { customHazards.append(custom) }
                }
                try store.mutate(description: "Applied Generation composition", origin: origin, expectedRevision: expected) {
                    $0.participantGroups.append(contentsOf: groups)
                    $0.hazards.append(contentsOf: hazards)
                    if !originals.isEmpty { $0.originalCreatures = ($0.originalCreatures ?? []) + originals }
                    if !customHazards.isEmpty { $0.customHazards = ($0.customHazards ?? []) + customHazards }
                }
            } else {
                guard let sections = command["sections"] as? [String: Any], !sections.isEmpty else { throw SidekickDomainError("invalid_request", "A guidance step must include at least one packet section.") }
                var packet = store.draft.packetV1 ?? EncounterPacketContentV1(corePacket: store.draft.packet, title: store.draft.title)
                for (section, payload) in sections {
                    let sectionCommand: [String: Any] = ["value": payload]
                    switch section {
                    case "encounter_identity": packet.identity = try requiredPacketSection(PacketIdentitySection.self, command: sectionCommand)
                    case "setup": packet.setup = try requiredPacketSection(PacketSetupSection.self, command: sectionCommand)
                    case "battlefield_guidance": packet.battlefield = try requiredPacketSection(PacketBattlefieldSection.self, command: sectionCommand)
                    case "running_guidance": packet.runningGuidance = try requiredPacketSection(PacketRunningGuidanceSection.self, command: sectionCommand)
                    case "cohesion": packet.cohesion = try requiredPacketSection(PacketCohesionSection.self, command: sectionCommand)
                    case "information_visibility": packet.information = try requiredPacketSection(PacketInformationSection.self, command: sectionCommand)
                    case "outcomes": packet.outcomes = try requiredPacketSection(PacketOutcomesSection.self, command: sectionCommand)
                    case "reward_guidance": packet.rewardGuidance = payload as? String
                    case "alternative_resolutions":
                        guard let data = try? JSONSerialization.data(withJSONObject: payload), let alternatives = try? JSONDecoder().decode([PacketAlternativeResolution].self, from: data) else { throw SidekickDomainError("invalid_packet_section", "The Alternative Resolutions payload is invalid.", details: ["field": section]) }
                        packet.alternativeResolutions = alternatives
                    default: throw SidekickDomainError("invalid_request", "That packet section is not supported in a generation step.", details: ["field": section])
                    }
                }
                try store.mutate(description: "Applied Generation guidance", origin: origin, expectedRevision: expected) { $0.packetV1 = packet; $0.packet = packet.flattenedCorePacket(); if !packet.identity.title.isEmpty { $0.title = packet.identity.title } }
            }
        case "sidekickdm_add_participant_group", "sidekickdm_add_existing_participant_group":
            let requestedContentID = (command["content_id"] as? String) ?? ""
            let authoritativeEntry: CatalogEntry?
            if name == "sidekickdm_add_existing_participant_group" {
                guard !requestedContentID.isEmpty, let entry = store.catalog.get(requestedContentID) else { throw SidekickDomainError("unknown_catalog_entry", "That Catalog Entry is not in the Catalog.") }
                authoritativeEntry = entry
                try validateCatalogEntry(command["catalog_entry"] as? [String: Any], for: requestedContentID, against: entry, catalog: store.catalog)
                guard case .creature(let creature) = entry else { throw SidekickDomainError("invalid_participant_kind", "Only Creature Catalog Entries can be added as Participant Groups.") }
                guard creature.summary.completeness == .complete, creature.summary.support == .supported else { throw SidekickDomainError("catalog_entry_partial", "Only complete, supported Catalog Entries can be added to a ready Encounter.") }
            } else {
                authoritativeEntry = nil
            }
            let requestedLevel = try number(command, "level")
            let level = authoritativeEntry?.summary.level ?? requestedLevel ?? store.draft.brief.party.effectiveLevel
            let quantity = try number(command, "quantity") ?? 1
            guard quantity > 0 else { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
            let id = (command["id"] as? String) ?? Self.nextAvailableID(prefix: "group_", in: store.draft)
            let content = (command["content_id"] as? String) ?? "creature/custom/\(id)/current"
            let participantName = authoritativeEntry?.summary.name ?? (command["name"] as? String) ?? content
            let adjustmentValue = (command["adjustment"] as? String) ?? "normal"
            guard let adjustment = CreatureAdjustment(rawValue: adjustmentValue) else { throw invalidEnum(field: "adjustment", value: adjustmentValue, allowed: CreatureAdjustment.allCases.map(\.rawValue)) }
            let factionValue = (command["faction"] as? String) ?? "primary_opposition"
            guard let faction = Faction(rawValue: factionValue) else { throw invalidEnum(field: "faction", value: factionValue, allowed: Faction.allCases.map(\.rawValue)) }
            let participationObject = command["participation"] as? [String: Any]
            let modeValue = participationObject?["mode"] as? String ?? (command["participation_mode"] as? String) ?? "mandatory"
            guard let mode = ParticipationMode(rawValue: modeValue) else { throw invalidEnum(field: "participation.mode", value: modeValue, allowed: ParticipationMode.allCases.map(\.rawValue)) }
            let roleValue = (command["encounter_role"] as? String) ?? "brute"
            guard let encounterRole = EncounterRole(rawValue: roleValue) else { throw invalidEnum(field: "encounter_role", value: roleValue, allowed: EncounterRole.allCases.map(\.rawValue)) }
            let tierValue = (command["narrative_tier"] as? String) ?? "incidental"
            guard let narrativeTier = NarrativeDetailTier(rawValue: tierValue) else { throw invalidEnum(field: "narrative_tier", value: tierValue, allowed: NarrativeDetailTier.allCases.map(\.rawValue)) }
            let displayName = (command["display_name"] as? String).flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
            let condition = participationObject?["condition"] as? String ?? (command["participation_condition"] as? String)
            let group = ParticipantGroup(id: id, contentID: content, name: participantName, displayName: displayName, level: level, quantity: quantity, adjustment: adjustment, faction: faction, participation: Participation(mode: mode, condition: condition), encounterRole: encounterRole, narrativeTier: narrativeTier, startingArea: (command["starting_area"] as? String) ?? "", sharedTactics: (command["shared_tactics"] as? String) ?? "", morale: (command["morale"] as? String) ?? "")
            try store.mutate(description: "Added \(quantity) × \(participantName)", origin: origin, expectedRevision: expected) { $0.participantGroups.append(group) }
        case "sidekickdm_update_participant_group":
            guard let id = command["component_id"] as? String, let index = store.draft.participantGroups.firstIndex(where: { $0.id == id }) else { throw SidekickDomainError("unknown_component", "That Participant Group is not in the Encounter.") }
            let quantity = try number(command, "quantity")
            if let quantity, quantity < 1 { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
            let adjustment: CreatureAdjustment?
            if let value = command["adjustment"] as? String {
                guard let parsed = CreatureAdjustment(rawValue: value) else { throw invalidEnum(field: "adjustment", value: value, allowed: CreatureAdjustment.allCases.map(\.rawValue)) }
                adjustment = parsed
            } else { adjustment = nil }
            var faction: Faction?
            if let value = command["faction"] as? String { guard let parsed = Faction(rawValue: value) else { throw invalidEnum(field: "faction", value: value, allowed: Faction.allCases.map(\.rawValue)) }; faction = parsed }
            var mode: ParticipationMode?
            if let value = command["participation_mode"] as? String { guard let parsed = ParticipationMode(rawValue: value) else { throw invalidEnum(field: "participation_mode", value: value, allowed: ParticipationMode.allCases.map(\.rawValue)) }; mode = parsed }
            var role: EncounterRole?
            if let value = command["encounter_role"] as? String { guard let parsed = EncounterRole(rawValue: value) else { throw invalidEnum(field: "encounter_role", value: value, allowed: EncounterRole.allCases.map(\.rawValue)) }; role = parsed }
            var tier: NarrativeDetailTier?
            if let value = command["narrative_tier"] as? String { guard let parsed = NarrativeDetailTier(rawValue: value) else { throw invalidEnum(field: "narrative_tier", value: value, allowed: NarrativeDetailTier.allCases.map(\.rawValue)) }; tier = parsed }
            try store.mutate(description: "Updated \(store.draft.participantGroups[index].name)", origin: origin, expectedRevision: expected) {
                if let quantity { $0.participantGroups[index].quantity = quantity }
                if let adjustment { $0.participantGroups[index].adjustment = adjustment }
                if let displayName = command["display_name"] as? String { $0.participantGroups[index].displayName = displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : displayName }
                if let faction { $0.participantGroups[index].faction = faction }
                if let mode { $0.participantGroups[index].participation.mode = mode }
                if let condition = command["participation_condition"] as? String { $0.participantGroups[index].participation.condition = condition }
                if let role { $0.participantGroups[index].encounterRole = role }
                if let tier { $0.participantGroups[index].narrativeTier = tier }
            }
        case "sidekickdm_create_custom_creature":
            guard let payload = command["creature"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(OriginalCreature.self, from: data) else { throw SidekickDomainError("invalid_creature_stat_block", "The Original Creature payload is invalid.") }
            let validation = CreatureBuilder.validate(decoded)
            guard validation.structuralErrors.isEmpty else { throw SidekickDomainError("invalid_creature_stat_block", "The Original Creature has structural errors.", details: ["fields": validation.structuralErrors.map(\.field).joined(separator: ",")]) }
            let snapshot = try CreatureBuilder.create(decoded, origin: origin)
            let quantity = try number(command, "quantity") ?? 1
            guard quantity > 0 else { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
            let componentID = (command["component_id"] as? String) ?? Self.nextAvailableID(prefix: "group_original_", in: store.draft)
            let group = ParticipantGroup(id: componentID, contentID: "creature/original/\(snapshot.id)/current", name: snapshot.identity.name, level: snapshot.identity.level, quantity: quantity, adjustment: .normal, faction: .primaryOpposition, participation: Participation(), encounterRole: snapshot.identity.encounterRole, startingArea: (command["starting_area"] as? String) ?? "", sharedTactics: snapshot.tactics, morale: snapshot.morale)
            try store.mutate(description: "Created Original Creature \(snapshot.identity.name)", origin: origin, expectedRevision: expected) {
                var creatures = $0.originalCreatures ?? []
                if let index = creatures.firstIndex(where: { $0.id == snapshot.id }) { creatures[index] = snapshot } else { creatures.append(snapshot) }
                $0.originalCreatures = creatures
                $0.participantGroups.append(group)
            }
        case "sidekickdm_update_creature", "sidekickdm_update_custom_creature":
            guard let payload = command["creature"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(OriginalCreature.self, from: data) else { throw SidekickDomainError("invalid_creature_stat_block", "The Original Creature payload is invalid.") }
            guard let existingIndex = store.draft.originalCreatures?.firstIndex(where: { $0.id == decoded.id }), let existing = store.draft.originalCreatures?[existingIndex] else { throw SidekickDomainError("unknown_component", "That Original Creature is not embedded in the Encounter.") }
            let validation = CreatureBuilder.validate(decoded)
            guard validation.structuralErrors.isEmpty else { throw SidekickDomainError("invalid_creature_stat_block", "The Original Creature has structural errors.", details: ["fields": validation.structuralErrors.map(\.field).joined(separator: ",")]) }
            var snapshot = try CreatureBuilder.create(decoded, origin: origin)
            snapshot.revision = existing.revision + 1
            snapshot.provenance.origin = existing.provenance.origin
            snapshot.provenance.basedOnContentID = existing.provenance.basedOnContentID
            snapshot.provenance.createdAt = existing.provenance.createdAt
            snapshot.provenance.mutationOrigin = origin
            let contentID = "creature/original/\(snapshot.id)/current"
            try store.mutate(description: "Updated Original Creature \(snapshot.identity.name)", origin: origin, expectedRevision: expected) {
                $0.originalCreatures?[existingIndex] = snapshot
                for index in $0.participantGroups.indices where $0.participantGroups[index].contentID == contentID {
                    $0.participantGroups[index].name = snapshot.identity.name
                    $0.participantGroups[index].level = snapshot.identity.level
                    $0.participantGroups[index].encounterRole = snapshot.identity.encounterRole
                    $0.participantGroups[index].sharedTactics = snapshot.tactics
                    $0.participantGroups[index].morale = snapshot.morale
                }
            }
        case "sidekickdm_remove_component":
            guard let id = command["component_id"] as? String else { throw SidekickDomainError("unknown_component", "A component ID is required.") }
            let exists = store.draft.participantGroups.contains { $0.id == id } || store.draft.hazards.contains { $0.id == id } || store.draft.phases.contains { $0.id == id } || (store.draft.npcProfiles ?? []).contains { $0.id == id } || (store.draft.originalCreatures ?? []).contains { $0.id == id } || (store.draft.customHazards ?? []).contains { $0.id == id } || (store.draft.packetV1?.alternativeResolutions ?? []).contains { $0.id == id }
            guard exists else { throw SidekickDomainError("unknown_component", "That component is not in the Encounter.") }
            try store.mutate(description: "Removed component \(id)", origin: origin, expectedRevision: expected) {
                let removedParticipant = $0.participantGroups.contains { $0.id == id }
                let removedHazard = $0.hazards.contains { $0.id == id }
                $0.participantGroups.removeAll { $0.id == id }
                $0.hazards.removeAll { $0.id == id }
                if removedHazard { $0.customHazards?.removeAll { $0.id == id } }
                $0.phases.removeAll { $0.id == id }
                $0.phases = $0.phases.map { phase in var next = phase; next.participantIDs.removeAll { $0 == id }; next.hazardIDs.removeAll { $0 == id }; return next }
                var structured = $0.structuredPhases ?? []
                structured.removeAll { $0.id == id }
                structured = structured.map { phase in var next = phase; next.participantIDs.removeAll { $0 == id }; next.hazardIDs.removeAll { $0 == id }; return next }
                $0.structuredPhases = structured
                if removedParticipant { $0.npcProfiles?.removeAll { $0.participantGroupID == id } }
                $0.npcProfiles?.removeAll { $0.id == id }
                $0.originalCreatures?.removeAll { $0.id == id }
                $0.customHazards?.removeAll { $0.id == id }
                if var packet = $0.packetV1 { packet.alternativeResolutions.removeAll { $0.id == id }; $0.packetV1 = packet; $0.packet = packet.flattenedCorePacket() }
            }
        case "sidekickdm_add_hazard", "sidekickdm_add_existing_hazard":
            let authoritativeEntry: CatalogEntry?
            if name == "sidekickdm_add_existing_hazard" {
                let contentID = (command["content_id"] as? String) ?? ""
                guard !contentID.isEmpty, let entry = store.catalog.get(contentID) else { throw SidekickDomainError("unknown_catalog_entry", "That Catalog Entry is not in the Catalog.") }
                try validateCatalogEntry(command["catalog_entry"] as? [String: Any], for: contentID, against: entry, catalog: store.catalog)
                guard case .hazard = entry else { throw SidekickDomainError("invalid_hazard", "Only Hazard Catalog Entries can be added as Hazards.") }
                guard entry.summary.completeness == .complete, entry.summary.support == .supported else { throw SidekickDomainError("catalog_entry_partial", "Only complete, supported Catalog Entries can be added to a ready Encounter.") }
                authoritativeEntry = entry
            } else {
                authoritativeEntry = nil
            }
            let id: String
            if let requestedID = command["id"] as? String {
                id = requestedID
            } else if let authoritativeEntry {
                let catalogID = authoritativeEntry.summary.contentID
                id = Self.componentIDs(in: store.draft).contains(catalogID) ? Self.nextAvailableID(prefix: "haz_", in: store.draft) : catalogID
            } else {
                id = Self.nextAvailableID(prefix: "haz_", in: store.draft)
            }
            let requestedLevel = try number(command, "level")
            let level = authoritativeEntry?.summary.level ?? requestedLevel ?? store.draft.brief.party.effectiveLevel
            let complexityValue = (command["complexity"] as? String) ?? authoritativeEntry?.summary.hazardComplexity?.rawValue ?? "simple"
            guard let complexity = HazardComplexity(rawValue: complexityValue) else { throw invalidEnum(field: "complexity", value: complexityValue, allowed: HazardComplexity.allCases.map(\.rawValue)) }
            if name == "sidekickdm_add_hazard" && complexity == .complex { throw SidekickDomainError("unsupported_complex_hazard_generation", "Custom Complex Hazard creation is not supported. Use an Existing Complex Hazard from the Catalog.") }
            let hazardName = authoritativeEntry?.summary.name ?? (command["name"] as? String) ?? "Hazard \(id)"
            let modeValue = (command["participation_mode"] as? String) ?? "avoidable"
            guard let mode = ParticipationMode(rawValue: modeValue) else { throw invalidEnum(field: "participation_mode", value: modeValue, allowed: ParticipationMode.allCases.map(\.rawValue)) }
            let participation = Participation(mode: mode, condition: command["participation_condition"] as? String)
            let contentID = authoritativeEntry?.summary.contentID ?? (command["content_id"] as? String) ?? "hazard/custom/\(id)/current"
            let hazard = EncounterHazard(id: id, contentID: contentID, name: hazardName, level: level, complexity: complexity, participation: participation, placement: (command["placement"] as? String) ?? "")
            var phaseIDs = [String]()
            if let phaseID = command["phase_id"] as? String { phaseIDs.append(phaseID) }
            phaseIDs.append(contentsOf: command["phase_ids"] as? [String] ?? [])
            phaseIDs = Array(Set(phaseIDs)).sorted()
            let knownPhaseIDs = Set(store.draft.phases.map(\.id)).union(store.draft.structuredPhases?.map(\.id) ?? [])
            guard phaseIDs.allSatisfy(knownPhaseIDs.contains) else { throw SidekickDomainError("invalid_phase", "The Existing Hazard references an unknown Encounter Phase.") }
            try store.mutate(description: "Added \(hazardName)", origin: origin, expectedRevision: expected) {
                $0.hazards.append(hazard)
                guard !phaseIDs.isEmpty else { return }
                $0.phases = $0.phases.map { phase in
                    var next = phase
                    if phaseIDs.contains(phase.id), !next.hazardIDs.contains(id) { next.hazardIDs.append(id) }
                    return next
                }
                $0.structuredPhases = $0.structuredPhases?.map { phase in
                    var next = phase
                    if phaseIDs.contains(phase.id), !next.hazardIDs.contains(id) { next.hazardIDs.append(id) }
                    return next
                }
            }
        case "sidekickdm_create_simple_hazard":
            guard let payload = command["hazard"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(SimpleHazard.self, from: data) else { throw SidekickDomainError("invalid_hazard", "The Simple Hazard payload is invalid.") }
            var snapshot = try HazardBuilder.create(decoded)
            snapshot.provenance.mutationOrigin = origin
            guard !store.draft.hazards.contains(where: { $0.id == snapshot.id }) else { throw SidekickDomainError("duplicate_component", "That Hazard is already in the Encounter.") }
            let modeValue = (command["participation_mode"] as? String) ?? "avoidable"
            guard let mode = ParticipationMode(rawValue: modeValue) else { throw invalidEnum(field: "participation_mode", value: modeValue, allowed: ParticipationMode.allCases.map(\.rawValue)) }
            let participation = Participation(mode: mode, condition: command["participation_condition"] as? String)
            let encounterHazard = EncounterHazard(id: snapshot.id, contentID: snapshot.provenance.catalogContentID ?? "hazard/custom/\(snapshot.id)/current", name: snapshot.identity.name, level: snapshot.identity.level, complexity: .simple, participation: participation, placement: (command["placement"] as? String) ?? "")
            try store.mutate(description: "Created Simple Hazard \(snapshot.identity.name)", origin: origin, expectedRevision: expected) {
                var hazards = $0.customHazards ?? []
                hazards.append(snapshot)
                $0.customHazards = hazards
                $0.hazards.append(encounterHazard)
            }
        case "sidekickdm_update_hazard":
            guard let payload = command["hazard"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(SimpleHazard.self, from: data) else { throw SidekickDomainError("invalid_hazard", "The Simple Hazard payload is invalid.") }
            var snapshot = try HazardBuilder.create(decoded)
            snapshot.provenance.mutationOrigin = origin
            guard let customIndex = store.draft.customHazards?.firstIndex(where: { $0.id == snapshot.id }), let encounterIndex = store.draft.hazards.firstIndex(where: { $0.id == snapshot.id }) else { throw SidekickDomainError("unknown_component", "That Simple Hazard is not in the Encounter.") }
            let mode: ParticipationMode?
            if let value = command["participation_mode"] as? String {
                guard let parsed = ParticipationMode(rawValue: value) else { throw invalidEnum(field: "participation_mode", value: value, allowed: ParticipationMode.allCases.map(\.rawValue)) }
                mode = parsed
            } else {
                mode = nil
            }
            try store.mutate(description: "Updated Simple Hazard \(snapshot.identity.name)", origin: origin, expectedRevision: expected) {
                $0.customHazards?[customIndex] = snapshot
                $0.hazards[encounterIndex].name = snapshot.identity.name
                $0.hazards[encounterIndex].level = snapshot.identity.level
                if let mode { $0.hazards[encounterIndex].participation = Participation(mode: mode, condition: command["participation_condition"] as? String) }
                if let placement = command["placement"] as? String { $0.hazards[encounterIndex].placement = placement }
            }
        case "sidekickdm_upsert_npc_profile":
            guard let payload = command["profile"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(NPCProfile.self, from: data) else { throw SidekickDomainError("invalid_npc_profile", "The NPC Profile payload is invalid.") }
            let profile = try NPCProfileBuilder.create(decoded)
            if let participantID = profile.participantGroupID, !store.draft.participantGroups.contains(where: { $0.id == participantID }) { throw SidekickDomainError("unknown_component", "The NPC Profile must link to an existing Participant Group.") }
            try store.mutate(description: "Updated NPC Profile \(profile.id)", origin: origin, expectedRevision: expected) {
                var profiles = $0.npcProfiles ?? []
                if let index = profiles.firstIndex(where: { $0.id == profile.id }) { profiles[index] = profile } else { profiles.append(profile) }
                $0.npcProfiles = profiles
            }
        case "sidekickdm_upsert_phase":
            let authored: PhaseAuthoring
            if let rawPayload = command["phase"] {
                guard let payload = rawPayload as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(PhaseAuthoring.self, from: data) else {
                    throw SidekickDomainError("invalid_phase", "The Phase payload is invalid.")
                }
                authored = decoded
            } else {
                let id = (command["phase_id"] as? String) ?? "phase_\(store.draft.phases.count + 1)"
                authored = PhaseAuthoring(
                    id: id,
                    title: (command["title"] as? String) ?? "Phase \(store.draft.phases.count + 1)",
                    order: (try number(command, "order")) ?? store.draft.phases.count,
                    trigger: PhaseTrigger(explanation: (command["trigger"] as? String) ?? ""),
                    participantIDs: command["participant_ids"] as? [String] ?? [],
                    hazardIDs: command["hazard_ids"] as? [String] ?? [],
                    runningGuidance: (command["running_guidance"] as? String) ?? ""
                )
            }
            let phaseStore = PhaseAuthoringStore(document: PhaseAuthoringDocument(encounter: store.draft), origin: origin)
            do { try phaseStore.upsert(authored, origin: origin) }
            catch let error as PhaseAuthoringError { throw SidekickDomainError(error.code, error.message) }
            let phases = phaseStore.phases
            try store.mutate(description: "Updated phase \(authored.title)", origin: origin, expectedRevision: expected) {
                $0.structuredPhases = phases
                $0.phases = phases.map(\.legacyPhase)
            }
        case "sidekickdm_set_encounter_identity":
            let value = try packetSection(PacketIdentitySection.self, command: command)
            try store.mutate(description: "Updated Encounter identity", origin: origin, expectedRevision: expected) {
                var packet = $0.packetV1 ?? EncounterPacketContentV1(corePacket: $0.packet, title: $0.title)
                if let value { packet.identity = value } else { if let title = command["title"] as? String { packet.identity.title = title }; if let premise = command["premise"] as? String { packet.identity.premise = premise } }
                $0.packetV1 = packet; $0.packet = packet.flattenedCorePacket(); $0.title = packet.identity.title.isEmpty ? $0.title : packet.identity.title
            }
        case "sidekickdm_apply_targeted_revision":
            guard expected != nil else { throw SidekickDomainError("invalid_request", "A targeted revision requires the current Encounter Revision.") }
            guard store.draft.generation == nil else { throw SidekickDomainError("manual_write_locked", "Targeted revisions are available after a Generation Run finishes.") }
            guard origin != "gm" && origin != "manual" else { throw SidekickDomainError("manual_write_locked", "A targeted revision is reserved for agent-authored changes.") }
            let target = (command["target_command"] as? String) ?? ((command["section"] as? String).map { "sidekickdm_set_\($0)" } ?? "")
            let allowed = ["sidekickdm_set_encounter_identity", "sidekickdm_set_setup", "sidekickdm_set_battlefield_guidance", "sidekickdm_set_running_guidance", "sidekickdm_set_cohesion", "sidekickdm_set_information_visibility", "sidekickdm_set_outcomes"]
            guard allowed.contains(target) else { throw SidekickDomainError("invalid_request", "A supported Encounter Packet section is required for a targeted revision.") }
            var forwarded = command
            forwarded["command"] = target
            forwarded["targeted_revision"] = true
            try execute(forwarded, in: store)
        case "sidekickdm_set_setup": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated Encounter setup") { $0.setup = try requiredPacketSection(PacketSetupSection.self, command: command) }
        case "sidekickdm_set_battlefield_guidance": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated battlefield guidance") { $0.battlefield = try requiredPacketSection(PacketBattlefieldSection.self, command: command) }
        case "sidekickdm_set_running_guidance": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated running guidance") { $0.runningGuidance = try requiredPacketSection(PacketRunningGuidanceSection.self, command: command) }
        case "sidekickdm_set_cohesion": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated Encounter cohesion") { $0.cohesion = try requiredPacketSection(PacketCohesionSection.self, command: command) }
        case "sidekickdm_set_information_visibility": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated information visibility") { $0.information = try requiredPacketSection(PacketInformationSection.self, command: command) }
        case "sidekickdm_set_outcomes": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated Encounter outcomes") { $0.outcomes = try requiredPacketSection(PacketOutcomesSection.self, command: command) }
        case "sidekickdm_set_encounter_packet":
            let packet = try requiredPacketSection(EncounterPacketContentV1.self, command: command, keys: ["packet", "value"])
            try store.mutate(description: "Updated Encounter Packet", origin: origin, expectedRevision: expected) { $0.packetV1 = packet; $0.packet = packet.flattenedCorePacket(); if !packet.identity.title.isEmpty { $0.title = packet.identity.title } }
        case "sidekickdm_set_reward_guidance":
            let value = command["value"] as? String ?? command["reward_guidance"] as? String
            try store.mutate(description: "Updated reward guidance", origin: origin, expectedRevision: expected) {
                var packet = $0.packetV1 ?? EncounterPacketContentV1(corePacket: $0.packet, title: $0.title)
                packet.rewardGuidance = value
                $0.packetV1 = packet
                $0.packet = packet.flattenedCorePacket()
            }
        case "sidekickdm_set_alternative_resolutions":
            guard let payload = command["value"], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let alternatives = try? JSONDecoder().decode([PacketAlternativeResolution].self, from: data) else { throw SidekickDomainError("invalid_packet_section", "Alternative Resolutions payload is invalid.") }
            try store.mutate(description: "Updated Alternative Resolutions", origin: origin, expectedRevision: expected) {
                var packet = $0.packetV1 ?? EncounterPacketContentV1(corePacket: $0.packet, title: $0.title)
                packet.alternativeResolutions = alternatives
                $0.packetV1 = packet
                $0.packet = packet.flattenedCorePacket()
            }
        case "sidekickdm_undo": try store.undo(expectedRevision: expected, origin: origin)
        case "sidekickdm_redo": try store.redo(expectedRevision: expected, origin: origin)
        case "sidekickdm_begin_generation":
            guard let expected, expectedBrief != nil, expectedConstraints != nil else { throw SidekickDomainError("invalid_request", "Generation requires Encounter, Brief, and Constraints revisions.") }
            guard command["content_boundaries_acknowledged"] as? Bool == true else { throw SidekickDomainError("content_constraint_not_acknowledged", "Acknowledge the GM-owned Content Boundaries before generation begins.") }
            guard store.draft.generation == nil else { throw SidekickDomainError("generation_already_active", "A Generation Run is already active.") }
            let runID = (command["generation_run_id"] as? String) ?? "run_\(UUID().uuidString.lowercased())"
            try store.mutate(description: "Began Generation Run", origin: origin, expectedRevision: expected) {
                let opening = try? String(data: JSONEncoder().encode($0), encoding: .utf8)
                $0.generation = GenerationState(id: runID, openingDraftJSON: opening, intentSummary: (command["intent_summary"] as? String) ?? "")
                $0.provenance.origin = origin
            }
        case "sidekickdm_resume_generation":
            guard let generation = store.draft.generation else { throw SidekickDomainError("no_active_generation", "There is no interrupted Generation Run to resume.") }
            guard generation.state == "interrupted" else { throw SidekickDomainError("generation_not_interrupted", "Only an interrupted Generation Run can be resumed.") }
            try store.mutate(description: "Resumed Generation Run", origin: origin, expectedRevision: expected) { $0.generation?.state = "active" }
        case "sidekickdm_set_generation_assumptions":
            guard let assumptions = command["assumptions"] as? [String] else { throw SidekickDomainError("invalid_request", "Generation assumptions must be an array of strings.") }
            try store.mutate(description: "Updated Generation Run assumptions", origin: origin, expectedRevision: expected) { $0.brief.generationAssumptions = assumptions }
        case "sidekickdm_update_creative_brief":
            let changes = (command["changes"] as? [String: Any]) ?? command.filter { !["command", "origin", "encounter_id", "expected_revision", "expected_encounter_revision", "expected_constraints_revision", "expected_brief_revision", "generation_run_id"].contains($0.key) }
            let allowed = Set(["purpose", "premise", "theme", "environment", "tone", "desired_complexity", "existing_vs_custom", "approximate_play_minutes", "preferred_traits", "excluded_traits", "source_restrictions"])
            let attempted = Set(changes.keys).subtracting(allowed)
            guard attempted.isEmpty else { throw SidekickDomainError("content_constraint_not_acknowledged", "Creative Brief updates cannot modify Party Snapshot or GM-owned Content Boundaries.") }
            try store.mutate(description: "Updated creative Brief", origin: origin, expectedRevision: expected) {
                if let value = changes["purpose"] as? String { $0.brief.purpose = value }
                if let value = changes["premise"] as? String { $0.brief.premise = value }
                if let value = changes["environment"] as? String { $0.brief.environment = value }
                if let value = changes["theme"] as? [String] { $0.brief.theme = value }
                if let value = changes["tone"] as? [String] { $0.brief.tone = value }
                if let value = changes["desired_complexity"] as? String { $0.brief.desiredComplexity = value }
                if let value = changes["existing_vs_custom"] as? String { $0.brief.existingVsCustom = value }
                if let value = try number(changes, "approximate_play_minutes") { $0.brief.approximatePlayMinutes = value }
                if let value = changes["preferred_traits"] as? [String] { $0.brief.preferredTraits = value }
                if let value = changes["excluded_traits"] as? [String] { $0.brief.excludedTraits = value }
                if let value = changes["source_restrictions"] as? [String] { $0.brief.sourceRestrictions = value }
                $0.briefRevision = ($0.briefRevision ?? 0) + 1
            }
        case "sidekickdm_cancel_generation":
            guard let encoded = store.draft.generation?.openingDraftJSON, let bytes = encoded.data(using: .utf8), let opening = try? JSONDecoder().decode(EncounterDraft.self, from: bytes) else { throw SidekickDomainError("no_active_generation", "There is no active Generation Run.") }
            try store.mutate(description: "Cancelled Generation Run", origin: origin, expectedRevision: expected) { $0 = opening; $0.generation = nil }
            store.discardGenerationHistoryAfterCancel()
        case "sidekickdm_finish_generation":
            guard store.draft.generation != nil else { throw SidekickDomainError("no_active_generation", "There is no active Generation Run.") }
            let structuralErrors = store.readiness.structuralErrors
            guard structuralErrors.isEmpty else { throw SidekickDomainError("structural_errors", "Generation cannot finish while Structural Errors remain.", details: ["errors": structuralErrors.joined(separator: " | ")]) }
            try store.mutate(description: "Finished Generation Run", origin: origin, expectedRevision: expected) { $0.generation = nil; $0.reviewState = "needed"; $0.provenance.origin = origin }
        case "sidekick_load_draft", "sidekickdm_load_draft":
            guard let data = command["draft_json"] as? String else { throw SidekickDomainError("invalid_request", "The saved Encounter Draft is invalid.") }
            do { store.load(try decodeDraftJSON(data)) }
            catch let error as SidekickDomainError { throw error }
            catch { throw SidekickDomainError("invalid_request", "The saved Encounter Draft is invalid.", details: ["reason": String(describing: error)]) }
        case "sidekick_reset": try store.mutate(description: "Reset Encounter Draft", origin: origin, expectedRevision: expected) { $0 = EncounterDraft() }
        default: throw SidekickDomainError("unknown_command", "Unknown semantic command: \(name).")
        }
    }
    private static func componentIDs(in draft: EncounterDraft) -> Set<String> {
        var ids = Set(draft.participantGroups.map(\.id))
        ids.formUnion(draft.hazards.map(\.id))
        ids.formUnion(draft.phases.map(\.id))
        ids.formUnion((draft.originalCreatures ?? []).map(\.id))
        ids.formUnion((draft.customHazards ?? []).map(\.id))
        ids.formUnion((draft.npcProfiles ?? []).map(\.id))
        ids.formUnion((draft.structuredPhases ?? []).map(\.id))
        return ids
    }

    private static func participantGroup(from command: [String: Any], store: EncounterStore) throws -> (group: ParticipantGroup, original: OriginalCreature?) {
        let id = (command["id"] as? String) ?? nextAvailableID(prefix: "group_", in: store.draft)
        let quantity = try number(command, "quantity") ?? 1
        guard quantity > 0 else { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
        let adjustmentValue = (command["adjustment"] as? String) ?? "normal"
        guard let adjustment = CreatureAdjustment(rawValue: adjustmentValue) else { throw invalidEnum(field: "adjustment", value: adjustmentValue, allowed: CreatureAdjustment.allCases.map(\.rawValue)) }
        let factionValue = (command["faction"] as? String) ?? "primary_opposition"
        guard let faction = Faction(rawValue: factionValue) else { throw invalidEnum(field: "faction", value: factionValue, allowed: Faction.allCases.map(\.rawValue)) }
        let roleValue = (command["encounter_role"] as? String) ?? "brute"
        guard let role = EncounterRole(rawValue: roleValue) else { throw invalidEnum(field: "encounter_role", value: roleValue, allowed: EncounterRole.allCases.map(\.rawValue)) }
        let tierValue = (command["narrative_tier"] as? String) ?? "incidental"
        guard let tier = NarrativeDetailTier(rawValue: tierValue) else { throw invalidEnum(field: "narrative_tier", value: tierValue, allowed: NarrativeDetailTier.allCases.map(\.rawValue)) }
        let participationObject = command["participation"] as? [String: Any]
        let modeValue = participationObject?["mode"] as? String ?? (command["participation_mode"] as? String) ?? "mandatory"
        guard let mode = ParticipationMode(rawValue: modeValue) else { throw invalidEnum(field: "participation.mode", value: modeValue, allowed: ParticipationMode.allCases.map(\.rawValue)) }
        let participation = Participation(mode: mode, condition: participationObject?["condition"] as? String ?? command["participation_condition"] as? String)
        let displayName = (command["display_name"] as? String).flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
        if let payload = command["creature"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(OriginalCreature.self, from: data) {
            let validation = CreatureBuilder.validate(decoded)
            guard validation.structuralErrors.isEmpty else { throw SidekickDomainError("invalid_creature_stat_block", "The Original Creature has structural errors.", details: ["fields": validation.structuralErrors.map(\.field).joined(separator: ",")]) }
            let original = try CreatureBuilder.create(decoded, origin: "webmcp")
            let group = ParticipantGroup(id: id, contentID: "creature/original/\(original.id)/current", name: original.identity.name, displayName: displayName, level: original.identity.level, quantity: quantity, adjustment: adjustment, faction: faction, participation: participation, encounterRole: role, narrativeTier: tier, startingArea: command["starting_area"] as? String ?? "", sharedTactics: command["shared_tactics"] as? String ?? original.tactics, morale: command["morale"] as? String ?? original.morale)
            return (group, original)
        }
        let contentID = command["content_id"] as? String ?? ""
        guard let entry = store.catalog.get(contentID), case .creature(let creature) = entry else { throw SidekickDomainError("unknown_catalog_entry", "That Catalog Creature is not in the Catalog.", details: ["content_id": contentID]) }
        try validateCatalogEntry(command["catalog_entry"] as? [String: Any], for: contentID, against: entry, catalog: store.catalog)
        guard creature.summary.completeness == .complete, creature.summary.support == .supported else { throw SidekickDomainError("catalog_entry_partial", "Only complete, supported Catalog Entries can be added to a ready Encounter.") }
        let group = ParticipantGroup(id: id, contentID: contentID, name: creature.summary.name, displayName: displayName, level: creature.summary.level, quantity: quantity, adjustment: adjustment, faction: faction, participation: participation, encounterRole: role, narrativeTier: tier, startingArea: command["starting_area"] as? String ?? "", sharedTactics: command["shared_tactics"] as? String ?? "", morale: command["morale"] as? String ?? "")
        return (group, nil)
    }

    private static func encounterHazard(from command: [String: Any], store: EncounterStore) throws -> (hazard: EncounterHazard, custom: SimpleHazard?) {
        if let payload = command["hazard"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(SimpleHazard.self, from: data) {
            var snapshot = try HazardBuilder.create(decoded)
            snapshot.provenance.mutationOrigin = "webmcp"
            let id = snapshot.id
            let modeValue = command["participation_mode"] as? String ?? "avoidable"
            guard let mode = ParticipationMode(rawValue: modeValue) else { throw invalidEnum(field: "participation_mode", value: modeValue, allowed: ParticipationMode.allCases.map(\.rawValue)) }
            return (EncounterHazard(id: id, contentID: snapshot.provenance.catalogContentID ?? "hazard/custom/\(id)/current", name: snapshot.identity.name, level: snapshot.identity.level, complexity: .simple, participation: Participation(mode: mode, condition: command["participation_condition"] as? String), placement: command["placement"] as? String ?? ""), snapshot)
        }
        let contentID = command["content_id"] as? String ?? ""
        guard let entry = store.catalog.get(contentID), case .hazard(let hazard) = entry else { throw SidekickDomainError("unknown_catalog_entry", "That Catalog Hazard is not in the Catalog.", details: ["content_id": contentID]) }
        try validateCatalogEntry(command["catalog_entry"] as? [String: Any], for: contentID, against: entry, catalog: store.catalog)
        let id = command["id"] as? String ?? nextAvailableID(prefix: "hazard_", in: store.draft)
        let complexityValue = command["complexity"] as? String ?? hazard.summary.hazardComplexity?.rawValue ?? "simple"
        guard let complexity = HazardComplexity(rawValue: complexityValue) else { throw invalidEnum(field: "complexity", value: complexityValue, allowed: HazardComplexity.allCases.map(\.rawValue)) }
        let modeValue = command["participation_mode"] as? String ?? "avoidable"
        guard let mode = ParticipationMode(rawValue: modeValue) else { throw invalidEnum(field: "participation_mode", value: modeValue, allowed: ParticipationMode.allCases.map(\.rawValue)) }
        return (EncounterHazard(id: id, contentID: contentID, name: hazard.summary.name, level: hazard.summary.level, complexity: complexity, participation: Participation(mode: mode, condition: command["participation_condition"] as? String), placement: command["placement"] as? String ?? ""), nil)
    }

    private static func nextAvailableID(prefix: String, in draft: EncounterDraft) -> String {
        let ids = componentIDs(in: draft)
        var index = 1
        while ids.contains("\(prefix)\(index)") { index += 1 }
        return "\(prefix)\(index)"
    }
    private static func validateCatalogEntry(_ supplied: [String: Any]?, for contentID: String, against expected: CatalogEntry, catalog: SidekickCatalog) throws {
        guard let supplied else { return }
        let summary = expected.summary
        if hasValue(supplied, keys: ["content_id", "contentID"]) { guard let value = suppliedString(supplied, keys: ["content_id", "contentID"]), value == summary.contentID else { throw catalogSnapshotMismatch(contentID) } }
        if hasValue(supplied, keys: ["catalog_id", "catalogID"]) { guard let value = suppliedString(supplied, keys: ["catalog_id", "catalogID"]), value == catalog.catalogID else { throw catalogSnapshotMismatch(contentID) } }
        if hasValue(supplied, keys: ["source_revision", "sourceRevision"]) { guard let value = suppliedString(supplied, keys: ["source_revision", "sourceRevision"]), value == catalog.sourceRevision else { throw catalogSnapshotMismatch(contentID) } }
        if hasValue(supplied, keys: ["kind"]) { guard let value = suppliedString(supplied, keys: ["kind"]), value == summary.kind.rawValue else { throw catalogSnapshotMismatch(contentID) } }
        if hasValue(supplied, keys: ["name"]) { guard let value = suppliedString(supplied, keys: ["name"]), value == summary.name else { throw catalogSnapshotMismatch(contentID) } }
        if supplied["level"] != nil, try suppliedNumber(supplied, key: "level") != summary.level { throw catalogSnapshotMismatch(contentID) }
        if hasValue(supplied, keys: ["completeness"]) { guard let value = suppliedString(supplied, keys: ["completeness"]), value == summary.completeness.rawValue else { throw catalogSnapshotMismatch(contentID) } }
        if hasValue(supplied, keys: ["support"]) { guard let value = suppliedString(supplied, keys: ["support"]), value == summary.support.rawValue else { throw catalogSnapshotMismatch(contentID) } }
        if let rawProvenance = supplied["provenance"] {
            guard let provenance = rawProvenance as? [String: Any] else { throw catalogSnapshotMismatch(contentID) }
            let expectedProvenance = expected.provenance
            if hasValue(provenance, keys: ["source_title", "sourceTitle"]) { guard let value = suppliedString(provenance, keys: ["source_title", "sourceTitle"]), value == expectedProvenance.sourceTitle else { throw catalogSnapshotMismatch(contentID) } }
            if let value = suppliedOptionalString(provenance, keys: ["source_page", "sourcePage"]), value != expectedProvenance.sourcePage { throw catalogSnapshotMismatch(contentID) }
            if hasValue(provenance, keys: ["edition"]) { guard let value = suppliedString(provenance, keys: ["edition"]), value == expectedProvenance.edition.rawValue else { throw catalogSnapshotMismatch(contentID) } }
            let upstream = provenance["upstream"] as? [String: Any]
            if provenance["upstream"] != nil && upstream == nil { throw catalogSnapshotMismatch(contentID) }
            if hasValue(provenance, keys: ["upstream_system", "upstreamSystem"]) || upstream?.keys.contains("system") == true { guard let value = suppliedString(provenance, keys: ["upstream_system", "upstreamSystem"]) ?? upstream.flatMap({ suppliedString($0, keys: ["system"]) }), value == expectedProvenance.upstreamSystem else { throw catalogSnapshotMismatch(contentID) } }
            if hasValue(provenance, keys: ["upstream_pack", "upstreamPack"]) || upstream?.keys.contains("pack") == true { guard let value = suppliedString(provenance, keys: ["upstream_pack", "upstreamPack"]) ?? upstream.flatMap({ suppliedString($0, keys: ["pack"]) }), value == expectedProvenance.upstreamPack else { throw catalogSnapshotMismatch(contentID) } }
            if hasValue(provenance, keys: ["upstream_identifier", "upstreamIdentifier"]) || upstream?.keys.contains("identifier") == true { guard let value = suppliedString(provenance, keys: ["upstream_identifier", "upstreamIdentifier"]) ?? upstream.flatMap({ suppliedString($0, keys: ["identifier"]) }), value == expectedProvenance.upstreamIdentifier else { throw catalogSnapshotMismatch(contentID) } }
            if hasValue(provenance, keys: ["source_sha256", "sourceSHA256"]) { guard let value = suppliedString(provenance, keys: ["source_sha256", "sourceSHA256"]), value == expectedProvenance.sourceSHA256 else { throw catalogSnapshotMismatch(contentID) } }
            if hasValue(provenance, keys: ["license_basis", "licenseBasis"]) { guard let value = suppliedString(provenance, keys: ["license_basis", "licenseBasis"]), value == expectedProvenance.licenseBasis else { throw catalogSnapshotMismatch(contentID) } }
            if hasValue(provenance, keys: ["notices"]) { guard let value = suppliedStringArray(provenance, keys: ["notices"]), value == expectedProvenance.notices else { throw catalogSnapshotMismatch(contentID) } }
            if hasValue(provenance, keys: ["diagnostics"]) { guard let value = suppliedStringArray(provenance, keys: ["diagnostics"]), value == expectedProvenance.diagnostics else { throw catalogSnapshotMismatch(contentID) } }
        }
    }
    private static func catalogSnapshotMismatch(_ contentID: String) -> SidekickDomainError { SidekickDomainError("catalog_snapshot_mismatch", "The Catalog Entry metadata does not match the authoritative Catalog snapshot.", details: ["content_id": contentID]) }
    private static func hasValue(_ dictionary: [String: Any], keys: [String]) -> Bool { keys.contains { dictionary[$0] != nil } }
    private static func suppliedString(_ dictionary: [String: Any], keys: [String]) -> String? { for key in keys { if let value = dictionary[key] as? String { return value } }; return nil }
    private static func suppliedOptionalString(_ dictionary: [String: Any], keys: [String]) -> String? { for key in keys where dictionary[key] != nil { return dictionary[key] as? String }; return nil }
    private static func suppliedNumber(_ dictionary: [String: Any], key: String) throws -> Int? { try number(dictionary, key) }
    private static func suppliedStringArray(_ dictionary: [String: Any], keys: [String]) -> [String]? { for key in keys where dictionary[key] != nil { return dictionary[key] as? [String] }; return nil }
    private static func number(_ command: [String: Any], _ key: String) throws -> Int? {
        guard let raw = command[key] else { return nil }
        if raw is NSNull { return nil }
        guard let number = raw as? NSNumber else { throw invalidInteger(key) }
        let value = number.doubleValue
        guard value.isFinite, value.rounded(.towardZero) == value, let integer = Int(exactly: value) else { throw invalidInteger(key) }
        return integer
    }
    private static func firstNumber(_ command: [String: Any], keys: [String]) throws -> Int? {
        var selected: Int?
        for key in keys {
            if let value = try number(command, key) { selected = selected ?? value }
        }
        return selected
    }
    private static func invalidInteger(_ key: String) -> SidekickDomainError {
        SidekickDomainError("invalid_request", "The \(key) value must be a finite integer.", details: ["field": key])
    }
    private static func invalidEnum(field: String, value: String, allowed: [String]) -> SidekickDomainError {
        SidekickDomainError("invalid_request", "The \(field) value is not supported.", details: ["field": field, "value": value, "allowed_values": allowed.joined(separator: ",")])
    }
    private static func decodeDraftJSON(_ value: String) throws -> EncounterDraft {
        guard let bytes = value.data(using: .utf8) else { throw SidekickDomainError("invalid_request", "The saved Encounter Draft is invalid.") }
        do { return try JSONDecoder().decode(EncounterDraft.self, from: bytes) }
        catch {
            guard var object = try JSONSerialization.jsonObject(with: bytes) as? [String: Any] else { throw error }
            normalizeNativeNPCProfiles(in: &object)
            let normalized = try JSONSerialization.data(withJSONObject: object)
            do { return try JSONDecoder().decode(EncounterDraft.self, from: normalized) }
            catch { throw SidekickDomainError("invalid_request", "The saved Encounter Draft is invalid.", details: ["reason": String(describing: error)]) }
        }
    }
    private static func normalizeNativeNPCProfiles(in draft: inout [String: Any]) {
        for key in ["npcProfiles", "npc_profiles"] {
            guard let profiles = draft[key] as? [[String: Any]] else { continue }
            draft[key] = profiles.map { profile in
                var normalized = profile
                let aliases = [
                    ("object_version", ["object_version", "objectVersion"]), ("participant_group_id", ["participant_group_id", "participantGroupID"]),
                    ("encounter_purpose", ["encounter_purpose", "encounterPurpose"]), ("appearance_hook", ["appearance_hook", "appearanceHook"]),
                    ("voice_manner", ["voice_manner", "voiceManner"]), ("immediate_goal", ["immediate_goal", "immediateGoal"]),
                    ("deeper_motivation", ["deeper_motivation", "deeperMotivation"]), ("combat_objective", ["combat_objective", "combatObjective"]),
                    ("morale_exit", ["morale_exit", "moraleExit"]), ("peaceful_response", ["peaceful_response", "peacefulResponse"]),
                    ("future_consequence", ["future_consequence", "futureConsequence"]), ("tier", ["tier", "narrativeTier"])
                ]
                for (snake, names) in aliases where normalized[snake] == nil {
                    if let value = names.compactMap({ normalized[$0] }).first { normalized[snake] = value }
                }
                normalized["object_version"] = normalized["object_version"] ?? 1
                normalized["revision"] = normalized["revision"] ?? 0
                normalized["tier"] = normalized["tier"] ?? "incidental"
                normalized["name"] = normalized["name"] ?? ""
                normalized["encounter_purpose"] = normalized["encounter_purpose"] ?? ""
                normalized["immediate_goal"] = normalized["immediate_goal"] ?? ""
                normalized["morale_exit"] = normalized["morale_exit"] ?? ""
                normalized["knowledge"] = normalized["knowledge"] ?? []
                if var provenance = normalized["provenance"] as? [String: Any] {
                    if provenance["createdAt"] == nil { provenance["createdAt"] = provenance["created_at"] ?? provenance["imported_at"] ?? "" }
                    if provenance["lastMutationOrigin"] == nil { provenance["lastMutationOrigin"] = provenance["last_mutation_origin"] ?? provenance["last_changed_by"] ?? "gm" }
                    provenance.removeValue(forKey: "created_at")
                    provenance.removeValue(forKey: "imported_at")
                    provenance.removeValue(forKey: "last_mutation_origin")
                    provenance.removeValue(forKey: "last_changed_by")
                    normalized["provenance"] = provenance
                } else {
                    normalized["provenance"] = ["origin": "original", "createdAt": "", "lastMutationOrigin": "gm"]
                }
                return normalized
            }
        }
    }
    private static func packetSection<T: Decodable>(_ type: T.Type, command: [String: Any], keys: [String] = ["value"]) throws -> T? {
        for key in keys {
            guard let payload = command[key] else { continue }
            guard JSONSerialization.isValidJSONObject(payload) else { throw SidekickDomainError("invalid_packet_section", "The Encounter Packet section payload is invalid.", details: ["field": key]) }
            do {
                let data = try JSONSerialization.data(withJSONObject: payload)
                return try JSONDecoder().decode(type, from: data)
            } catch let error as DecodingError {
                let field: String
                switch error {
                case .keyNotFound(let missing, let context): field = (context.codingPath + [missing]).map(\.stringValue).joined(separator: ".")
                case .typeMismatch(_, let context), .valueNotFound(_, let context), .dataCorrupted(let context): field = context.codingPath.map(\.stringValue).joined(separator: ".")
                @unknown default: field = key
                }
                throw SidekickDomainError("invalid_packet_section", "The Encounter Packet section payload is invalid.", details: ["field": field.isEmpty ? key : field])
            } catch {
                throw SidekickDomainError("invalid_packet_section", "The Encounter Packet section payload is invalid.", details: ["field": key])
            }
        }
        return nil
    }
    private static func requiredPacketSection<T: Decodable>(_ type: T.Type, command: [String: Any], keys: [String] = ["value"]) throws -> T { guard let value = try packetSection(type, command: command, keys: keys) else { throw SidekickDomainError("invalid_packet_section", "The Encounter Packet section payload is invalid.") }; return value }
    private static func mutatePacketSection(_ command: [String: Any], store: EncounterStore, expected: Int?, origin: String, description: String, operation: @escaping (inout EncounterPacketContentV1) throws -> Void) throws { try store.mutate(description: description, origin: origin, expectedRevision: expected) { draft in var packet = draft.packetV1 ?? EncounterPacketContentV1(corePacket: draft.packet, title: draft.title); try operation(&packet); draft.packetV1 = packet; draft.packet = packet.flattenedCorePacket() } }
}
