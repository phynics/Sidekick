import Foundation

public enum ThreatTargetKind: String, Codable, CaseIterable, Sendable { case trivial, low, moderate, severe, extreme, custom }
public struct ThreatTarget: Codable, Equatable, Sendable { public var kind: ThreatTargetKind; public var customXP: Int?; public init(kind: ThreatTargetKind = .moderate, customXP: Int? = nil) { self.kind = kind; self.customXP = customXP } }
public struct PartySnapshot: Codable, Equatable, Sendable { public var effectiveLevel: Int; public var size: Int; public var mixedLevelNotes: String?; public init(effectiveLevel: Int = 1, size: Int = 4, mixedLevelNotes: String? = nil) { self.effectiveLevel = effectiveLevel; self.size = size; self.mixedLevelNotes = mixedLevelNotes } }
public struct EncounterBrief: Codable, Equatable, Sendable { public var party: PartySnapshot; public var threatTarget: ThreatTarget; public var purpose: String; public var premise: String; public var environment: String; public init(party: PartySnapshot = PartySnapshot(), threatTarget: ThreatTarget = ThreatTarget(), purpose: String = "", premise: String = "", environment: String = "") { self.party = party; self.threatTarget = threatTarget; self.purpose = purpose; self.premise = premise; self.environment = environment } }

public enum CreatureAdjustment: String, Codable, CaseIterable, Sendable { case weak, normal, elite }
public enum Faction: String, Codable, CaseIterable, Sendable { case party, primaryOpposition = "primary_opposition", secondaryOpposition = "secondary_opposition", allied, neutral }
public enum ParticipationMode: String, Codable, CaseIterable, Sendable { case mandatory, avoidable, conditional, reinforcement }
public enum EncounterRole: String, Codable, CaseIterable, Sendable { case brute, defender, skirmisher, sniper, controller, support, ambusher, leader, soloBoss = "solo_boss" }
public enum NarrativeDetailTier: String, Codable, CaseIterable, Sendable { case incidental, supporting, prominent }
public enum HazardComplexity: String, Codable, CaseIterable, Sendable { case simple, complex }
public struct Participation: Codable, Equatable, Sendable { public var mode: ParticipationMode; public var condition: String?; public init(mode: ParticipationMode = .mandatory, condition: String? = nil) { self.mode = mode; self.condition = condition } }

public struct ParticipantGroup: Codable, Equatable, Sendable {
    public var id: String; public var contentID: String; public var name: String; public var level: Int; public var quantity: Int; public var adjustment: CreatureAdjustment; public var faction: Faction; public var participation: Participation; public var encounterRole: EncounterRole; public var narrativeTier: NarrativeDetailTier; public var startingArea: String; public var sharedTactics: String; public var morale: String
    public init(id: String, contentID: String, name: String, level: Int, quantity: Int = 1, adjustment: CreatureAdjustment = .normal, faction: Faction = .primaryOpposition, participation: Participation = Participation(), encounterRole: EncounterRole = .brute, narrativeTier: NarrativeDetailTier = .incidental, startingArea: String = "", sharedTactics: String = "", morale: String = "") { self.id = id; self.contentID = contentID; self.name = name; self.level = level; self.quantity = quantity; self.adjustment = adjustment; self.faction = faction; self.participation = participation; self.encounterRole = encounterRole; self.narrativeTier = narrativeTier; self.startingArea = startingArea; self.sharedTactics = sharedTactics; self.morale = morale }
}
public struct EncounterHazard: Codable, Equatable, Sendable { public var id: String; public var contentID: String; public var name: String; public var level: Int; public var complexity: HazardComplexity; public var participation: Participation; public var placement: String; public init(id: String, contentID: String, name: String, level: Int, complexity: HazardComplexity = .simple, participation: Participation = Participation(mode: .avoidable), placement: String = "") { self.id = id; self.contentID = contentID; self.name = name; self.level = level; self.complexity = complexity; self.participation = participation; self.placement = placement } }
public struct EncounterPhase: Codable, Equatable, Sendable { public var id: String; public var title: String; public var order: Int; public var participantIDs: [String]; public var hazardIDs: [String]; public var trigger: String; public var runningGuidance: String; public init(id: String, title: String, order: Int = 0, participantIDs: [String] = [], hazardIDs: [String] = [], trigger: String = "", runningGuidance: String = "") { self.id = id; self.title = title; self.order = order; self.participantIDs = participantIDs; self.hazardIDs = hazardIDs; self.trigger = trigger; self.runningGuidance = runningGuidance } }
public struct EncounterPacket: Codable, Equatable, Sendable { public var premise: String; public var objective: String; public var setup: String; public var runningGuidance: String; public var cohesion: String; public var outcomes: String; public init(premise: String = "", objective: String = "", setup: String = "", runningGuidance: String = "", cohesion: String = "", outcomes: String = "") { self.premise = premise; self.objective = objective; self.setup = setup; self.runningGuidance = runningGuidance; self.cohesion = cohesion; self.outcomes = outcomes } }
public struct ProvenanceSummary: Codable, Equatable, Sendable { public var origin: String; public var lastMutationOrigin: String; public init(origin: String = "gm", lastMutationOrigin: String = "gm") { self.origin = origin; self.lastMutationOrigin = lastMutationOrigin } }
public struct GenerationState: Codable, Equatable, Sendable { public var id: String; public var state: String; public var openingDraftJSON: String?; public var intentSummary: String; public init(id: String, state: String = "active", openingDraftJSON: String? = nil, intentSummary: String = "") { self.id = id; self.state = state; self.openingDraftJSON = openingDraftJSON; self.intentSummary = intentSummary } }

public struct EncounterDraft: Codable, Equatable, Sendable {
    public var id: String; public var revision: Int; public var constraintsRevision: Int; public var title: String; public var swiftOwnedValue: Int; public var brief: EncounterBrief; public var participantGroups: [ParticipantGroup]; public var hazards: [EncounterHazard]; public var phases: [EncounterPhase]; public var packet: EncounterPacket; public var generation: GenerationState?; public var reviewState: String; public var provenance: ProvenanceSummary; public var originalCreatures: [OriginalCreature]?; public var customHazards: [SimpleHazard]?; public var packetV1: EncounterPacketContentV1?; public var contentBoundaries: GMOwnedContentBoundaries?; public var npcProfiles: [NPCProfile]?
    public init(id: String = "enc_demo", title: String = "The Bell Beneath Blackwater", swiftOwnedValue: Int = 7, revision: Int = 0, constraintsRevision: Int = 0, brief: EncounterBrief = EncounterBrief(), participantGroups: [ParticipantGroup] = [], hazards: [EncounterHazard] = [], phases: [EncounterPhase] = [], packet: EncounterPacket = EncounterPacket(), generation: GenerationState? = nil, reviewState: String = "needed", provenance: ProvenanceSummary = ProvenanceSummary(), originalCreatures: [OriginalCreature]? = [], customHazards: [SimpleHazard]? = [], packetV1: EncounterPacketContentV1? = nil, contentBoundaries: GMOwnedContentBoundaries? = GMOwnedContentBoundaries(), npcProfiles: [NPCProfile]? = []) { self.id = id; self.revision = revision; self.constraintsRevision = constraintsRevision; self.title = title; self.swiftOwnedValue = swiftOwnedValue; self.brief = brief; self.participantGroups = participantGroups; self.hazards = hazards; self.phases = phases; self.packet = packet; self.generation = generation; self.reviewState = reviewState; self.provenance = provenance; self.originalCreatures = originalCreatures; self.customHazards = customHazards; self.packetV1 = packetV1; self.contentBoundaries = contentBoundaries; self.npcProfiles = npcProfiles }
    public mutating func increment() { swiftOwnedValue += 1 }
}

public struct BudgetProjection: Codable, Equatable, Sendable { public var targetThreat: String; public var baseTargetXP: Int; public var partySizeAdjustment: Int; public var constructionBudget: Int; public var guaranteedXP: Int; public var avoidableXP: Int; public var conditionalXP: Int; public var peakActiveXP: Int; public var totalEncounterXP: Int; public var baseXPAward: Int; public var terrainAdjustment: Int; public var inferredThreat: String; public var warnings: [String] }
public struct ReadinessProjection: Codable, Equatable, Sendable { public var structuralErrors: [String]; public var designWarnings: [String]; public var status: String; public init(structuralErrors: [String] = [], designWarnings: [String] = [], status: String = "incomplete") { self.structuralErrors = structuralErrors; self.designWarnings = designWarnings; self.status = status } }
public struct ActivityEntry: Codable, Equatable, Sendable { public var id: String; public var description: String; public var origin: String; public var beforeRevision: Int; public var afterRevision: Int; public var time: String }

public struct BoundarySnapshot: Codable, Equatable, Sendable {
    public let protocolVersion: Int; public let engine: String; public let initialized: Bool; public let draft: EncounterDraft; public let encounter: EncounterDraft; public let encounterRevision: Int; public let constraintsRevision: Int; public let budget: BudgetProjection; public let readiness: ReadinessProjection; public let activity: [ActivityEntry]; public let canUndo: Bool; public let canRedo: Bool; public let generationRunID: String?; public let error: String?
    public init(draft: EncounterDraft, budget: BudgetProjection, readiness: ReadinessProjection, activity: [ActivityEntry] = [], canUndo: Bool = false, canRedo: Bool = false, error: String? = nil) { protocolVersion = 1; engine = "SidekickDMCore"; initialized = error == nil; self.draft = draft; encounter = draft; encounterRevision = draft.revision; constraintsRevision = draft.constraintsRevision; self.budget = budget; self.readiness = readiness; self.activity = activity; self.canUndo = canUndo; self.canRedo = canRedo; generationRunID = draft.generation?.id; self.error = error }
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
    public private(set) var draft: EncounterDraft; public private(set) var activity: [ActivityEntry] = []; private var history: [EncounterDraft] = []; private var redoHistory: [EncounterDraft] = []
    public init(draft: EncounterDraft = EncounterDraft()) { self.draft = draft }
    public func load(_ loaded: EncounterDraft) { draft = loaded; history.removeAll(); redoHistory.removeAll(); activity.removeAll() }
    public var budget: BudgetProjection { EncounterMath.budget(for: draft) }
    public var readiness: ReadinessProjection { var errors = [String](); if !(1...20).contains(draft.brief.party.effectiveLevel) { errors.append("Party effective level must be between 1 and 20.") }; if !(1...8).contains(draft.brief.party.size) { errors.append("Party size must be between 1 and 8.") }; if draft.brief.threatTarget.kind == .custom && (draft.brief.threatTarget.customXP ?? -1) < 0 { errors.append("Custom Threat Target XP cannot be negative.") }; for group in draft.participantGroups where group.quantity < 1 { errors.append("Participant quantity must be at least 1.") }; let creatureWarnings = (draft.originalCreatures ?? []).flatMap { CreatureBuilder.validate($0).holisticWarnings.map(\.message) }; let hazardValidation = (draft.customHazards ?? []).map(HazardBuilder.validate); errors += hazardValidation.flatMap { $0.structuralErrors.map(\.message) }; let hazardWarnings = hazardValidation.flatMap { $0.holisticWarnings.map(\.message) }; let npcValidation = (draft.npcProfiles ?? []).map(NPCProfileBuilder.validate); errors += npcValidation.flatMap { $0.structuralErrors.map(\.message) }; let npcWarnings = npcValidation.flatMap { $0.designWarnings.map(\.message) }; let packetContent = draft.packetV1 ?? EncounterPacketContentV1(corePacket: draft.packet, title: draft.title); let packetReadiness = PacketReadinessValidator.validate(packetContent); errors += packetReadiness.structuralErrors.map(\.message); let warnings = budget.warnings + creatureWarnings + hazardWarnings + npcWarnings + packetReadiness.designWarnings.map(\.message); return ReadinessProjection(structuralErrors: errors, designWarnings: warnings, status: errors.isEmpty ? (warnings.isEmpty ? "ready" : "ready_with_warnings") : "incomplete") }
    public func snapshot(error: String? = nil) -> BoundarySnapshot { BoundarySnapshot(draft: draft, budget: budget, readiness: readiness, activity: activity, canUndo: !history.isEmpty, canRedo: !redoHistory.isEmpty, error: error) }
    @discardableResult public func mutate(description: String, origin: String, expectedRevision: Int?, operation: (inout EncounterDraft) throws -> Void) throws -> Int { try check(expectedRevision); let before = draft; let wasInGeneration = before.generation != nil; var next = draft; try operation(&next); next.revision = draft.revision + 1; next.provenance.lastMutationOrigin = origin; draft = next; if !wasInGeneration { history.append(before); redoHistory.removeAll() }; record(description: description, origin: origin, before: before.revision, after: draft.revision); return draft.revision }
    public func undo(expectedRevision: Int?, origin: String) throws { try check(expectedRevision); guard let previous = history.popLast() else { throw SidekickDomainError("nothing_to_undo", "There is no earlier Mutation in this Encounter Draft.") }; let current = draft; redoHistory.append(current); let nextRevision = draft.revision + 1; draft = previous; draft.revision = nextRevision; draft.generation = nil; record(description: "Undid the last Mutation", origin: origin, before: nextRevision - 1, after: nextRevision) }
    public func redo(expectedRevision: Int?, origin: String) throws { try check(expectedRevision); guard let next = redoHistory.popLast() else { throw SidekickDomainError("nothing_to_redo", "There is no undone Mutation in this Encounter Draft.") }; history.append(draft); let nextRevision = draft.revision + 1; draft = next; draft.revision = nextRevision; record(description: "Redid the last Mutation", origin: origin, before: nextRevision - 1, after: nextRevision) }
    private func check(_ expected: Int?) throws { if let expected, expected != draft.revision { throw SidekickDomainError("stale_revision", "The encounter changed after it was inspected.", details: ["expected_revision": "\(expected)", "current_revision": "\(draft.revision)"]) } }
    private func record(description: String, origin: String, before: Int, after: Int) { activity.insert(ActivityEntry(id: "mutation-\(after)-\(activity.count)", description: description, origin: origin, beforeRevision: before, afterRevision: after, time: "session"), at: 0); activity = Array(activity.prefix(12)) }
}

public enum SidekickCommandExecutor {
    public static func execute(_ command: [String: Any], in store: EncounterStore) throws {
        let name = (command["command"] as? String) ?? ""; let expected = (command["expected_revision"] as? NSNumber)?.intValue ?? (command["expected_encounter_revision"] as? NSNumber)?.intValue ?? (command["expectedRevision"] as? NSNumber)?.intValue; let origin = (command["origin"] as? String) ?? "gm"; let expectedConstraints = (command["expected_constraints_revision"] as? NSNumber)?.intValue
        let isCreate = name == "sidekick_create_encounter" || name == "sidekickdm_create_encounter"
        if let encounterID = command["encounter_id"] as? String, !isCreate, encounterID != store.draft.id { throw SidekickDomainError("unknown_encounter", "The requested Encounter Draft does not exist.", details: ["encounter_id": encounterID]) }
        if let expectedConstraints, expectedConstraints != store.draft.constraintsRevision { throw SidekickDomainError("stale_constraints", "The Content Boundaries or Party Snapshot changed after it was inspected.", details: ["expected_constraints_revision": "\(expectedConstraints)", "current_constraints_revision": "\(store.draft.constraintsRevision)"]) }
        if let activeRun = store.draft.generation, !["sidekickdm_begin_generation", "sidekickdm_finish_generation", "sidekickdm_cancel_generation"].contains(name), let suppliedRun = command["generation_run_id"] as? String, suppliedRun != activeRun.id { throw SidekickDomainError("wrong_generation_run", "That Generation Run is no longer active.") }
        switch name {
        case "sidekickdm_get_budget", "sidekickdm_get_encounter_summary", "sidekickdm_get_encounter_brief", "sidekickdm_get_readiness": break
        case "sidekick_increment": try store.mutate(description: "Changed Swift-owned value", origin: origin, expectedRevision: expected) { $0.increment() }
        case "sidekick_create_encounter", "sidekickdm_create_encounter":
            let party = command["party"] as? [String: Any]
            let level = number(command, "effective_level") ?? (party.flatMap { number($0, "effective_level") }) ?? 1
            let size = number(command, "size") ?? (party.flatMap { number($0, "size") }) ?? 4
            let kindName = (command["threat_target"] as? [String: Any]).flatMap { $0["kind"] as? String } ?? (command["kind"] as? String) ?? "moderate"
            guard let kind = ThreatTargetKind(rawValue: kindName), (1...20).contains(level), (1...8).contains(size) else { throw SidekickDomainError("invalid_party_profile", "Effective party level must be 1–20 and party size 1–8.") }
            let custom = number(command, "custom_xp") ?? (command["threat_target"] as? [String: Any]).flatMap { number($0, "custom_xp") }
            guard kind != .custom || (custom ?? -1) >= 0 else { throw SidekickDomainError("invalid_threat_target", "Custom Threat Target XP must be zero or greater.") }
            let title = (command["title"] as? String) ?? "Untitled Encounter"
            let id = (command["encounter_id"] as? String) ?? "enc_\(UUID().uuidString.lowercased())"
            let brief = EncounterBrief(party: PartySnapshot(effectiveLevel: level, size: size), threatTarget: ThreatTarget(kind: kind, customXP: kind == .custom ? custom : nil))
            try store.mutate(description: "Created Encounter Draft", origin: origin, expectedRevision: expected) { $0 = EncounterDraft(id: id, title: title, brief: brief) }
        case "sidekickdm_set_party_snapshot", "sidekickdm_update_party_snapshot": let party = command["party"] as? [String: Any]; let level = number(command, "effective_level") ?? (party.flatMap { number($0, "effective_level") }) ?? store.draft.brief.party.effectiveLevel; let size = number(command, "size") ?? (party.flatMap { number($0, "size") }) ?? store.draft.brief.party.size; guard (1...20).contains(level), (1...8).contains(size) else { throw SidekickDomainError("invalid_party_profile", "Effective party level must be 1–20 and party size 1–8.") }; try store.mutate(description: "Updated Party Snapshot", origin: origin, expectedRevision: expected) { $0.brief.party.effectiveLevel = level; $0.brief.party.size = size; $0.constraintsRevision += 1 }
        case "sidekickdm_set_threat_target", "sidekickdm_update_threat_target": let target = command["threat_target"] as? [String: Any]; let kind = ThreatTargetKind(rawValue: (command["kind"] as? String) ?? (target?["kind"] as? String) ?? "moderate") ?? .moderate; let custom = number(command, "custom_xp") ?? (target.flatMap { number($0, "custom_xp") }); guard kind != .custom || (custom ?? -1) >= 0 else { throw SidekickDomainError("invalid_threat_target", "Custom Threat Target XP must be zero or greater.") }; try store.mutate(description: "Set Threat Target to \(kind.rawValue)", origin: origin, expectedRevision: expected) { $0.brief.threatTarget = ThreatTarget(kind: kind, customXP: custom) }
        case "sidekickdm_add_participant_group", "sidekickdm_add_existing_participant_group":
            let catalogEntry = command["catalog_entry"] as? [String: Any]
            if name == "sidekickdm_add_existing_participant_group" {
                guard catalogEntry?["kind"] as? String == "creature" else { throw SidekickDomainError("invalid_participant_kind", "Only Creature Catalog Entries can be added as Participant Groups.") }
                guard catalogEntry?["completeness"] as? String == "complete", catalogEntry?["support"] as? String == "supported" else { throw SidekickDomainError("catalog_entry_partial", "Only complete, supported Catalog Entries can be added to a ready Encounter.") }
            }
            let level = number(catalogEntry ?? [:], "level") ?? number(command, "level") ?? store.draft.brief.party.effectiveLevel
            let quantity = number(command, "quantity") ?? 1
            guard quantity > 0 else { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
            let id = (command["id"] as? String) ?? "group_\(store.draft.participantGroups.count + 1)"
            let content = (command["content_id"] as? String) ?? "creature/custom/\(id)/current"
            let participantName = (catalogEntry?["name"] as? String) ?? (command["name"] as? String) ?? content
            guard let adjustment = CreatureAdjustment(rawValue: (command["adjustment"] as? String) ?? "normal") else { throw SidekickDomainError("invalid_adjustment", "Adjustment must be normal, weak, or elite.") }
            let faction = Faction(rawValue: (command["faction"] as? String) ?? "primary_opposition") ?? .primaryOpposition
            let participationObject = command["participation"] as? [String: Any]
            let mode = ParticipationMode(rawValue: participationObject?["mode"] as? String ?? (command["participation_mode"] as? String) ?? "mandatory") ?? .mandatory
            let group = ParticipantGroup(id: id, contentID: content, name: participantName, level: level, quantity: quantity, adjustment: adjustment, faction: faction, participation: Participation(mode: mode), encounterRole: EncounterRole(rawValue: (command["encounter_role"] as? String) ?? "brute") ?? .brute, startingArea: (command["starting_area"] as? String) ?? "", sharedTactics: (command["shared_tactics"] as? String) ?? "", morale: (command["morale"] as? String) ?? "")
            try store.mutate(description: "Added \(quantity) × \(participantName)", origin: origin, expectedRevision: expected) { $0.participantGroups.append(group) }
        case "sidekickdm_update_participant_group":
            guard let id = command["component_id"] as? String, let index = store.draft.participantGroups.firstIndex(where: { $0.id == id }) else { throw SidekickDomainError("unknown_component", "That Participant Group is not in the Encounter.") }
            let quantity = number(command, "quantity")
            if let quantity, quantity < 1 { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
            let adjustment: CreatureAdjustment?
            if let value = command["adjustment"] as? String {
                guard let parsed = CreatureAdjustment(rawValue: value) else { throw SidekickDomainError("invalid_adjustment", "Adjustment must be normal, weak, or elite.") }
                adjustment = parsed
            } else { adjustment = nil }
            try store.mutate(description: "Updated \(store.draft.participantGroups[index].name)", origin: origin, expectedRevision: expected) {
                if let quantity { $0.participantGroups[index].quantity = quantity }
                if let adjustment { $0.participantGroups[index].adjustment = adjustment }
            }
        case "sidekickdm_create_custom_creature":
            guard let payload = command["creature"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(OriginalCreature.self, from: data) else { throw SidekickDomainError("invalid_creature", "The Original Creature payload is invalid.") }
            let validation = CreatureBuilder.validate(decoded)
            guard validation.structuralErrors.isEmpty else { throw SidekickDomainError("creature_structural_errors", "The Original Creature has structural errors.", details: ["fields": validation.structuralErrors.map(\.field).joined(separator: ",")]) }
            let snapshot = try CreatureBuilder.create(decoded, origin: origin)
            let quantity = number(command, "quantity") ?? 1
            guard quantity > 0 else { throw SidekickDomainError("invalid_quantity", "Participant quantity must be at least 1.") }
            let componentID = (command["component_id"] as? String) ?? "group_original_\(store.draft.participantGroups.count + 1)"
            let group = ParticipantGroup(id: componentID, contentID: "creature/original/\(snapshot.id)/current", name: snapshot.identity.name, level: snapshot.identity.level, quantity: quantity, adjustment: .normal, faction: .primaryOpposition, participation: Participation(), encounterRole: snapshot.identity.encounterRole, startingArea: (command["starting_area"] as? String) ?? "", sharedTactics: snapshot.tactics, morale: snapshot.morale)
            try store.mutate(description: "Created Original Creature \(snapshot.identity.name)", origin: origin, expectedRevision: expected) {
                var creatures = $0.originalCreatures ?? []
                if let index = creatures.firstIndex(where: { $0.id == snapshot.id }) { creatures[index] = snapshot } else { creatures.append(snapshot) }
                $0.originalCreatures = creatures
                $0.participantGroups.append(group)
            }
        case "sidekickdm_remove_component": guard let id = command["component_id"] as? String else { throw SidekickDomainError("unknown_component", "A component ID is required.") }; try store.mutate(description: "Removed component", origin: origin, expectedRevision: expected) { $0.participantGroups.removeAll { $0.id == id }; $0.hazards.removeAll { $0.id == id } }
        case "sidekickdm_add_hazard", "sidekickdm_add_existing_hazard":
            let id = (command["id"] as? String) ?? "haz_\(store.draft.hazards.count + 1)"
            let level = number(command, "level") ?? store.draft.brief.party.effectiveLevel
            let complexity = HazardComplexity(rawValue: (command["complexity"] as? String) ?? "simple") ?? .simple
            if name == "sidekickdm_add_hazard" && complexity == .complex { throw SidekickDomainError("unsupported_complex_hazard_generation", "Custom Complex Hazard creation is not supported. Use an Existing Complex Hazard from the Catalog.") }
            let hazardName = (command["name"] as? String) ?? "Hazard \(id)"
            let participation = Participation(mode: ParticipationMode(rawValue: (command["participation_mode"] as? String) ?? "avoidable") ?? .avoidable, condition: command["participation_condition"] as? String)
            let hazard = EncounterHazard(id: id, contentID: (command["content_id"] as? String) ?? "hazard/custom/\(id)/current", name: hazardName, level: level, complexity: complexity, participation: participation, placement: (command["placement"] as? String) ?? "")
            try store.mutate(description: "Added \(hazardName)", origin: origin, expectedRevision: expected) { $0.hazards.append(hazard) }
        case "sidekickdm_create_simple_hazard":
            guard let payload = command["hazard"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(SimpleHazard.self, from: data) else { throw SidekickDomainError("invalid_hazard", "The Simple Hazard payload is invalid.") }
            let snapshot = try HazardBuilder.create(decoded)
            guard !store.draft.hazards.contains(where: { $0.id == snapshot.id }) else { throw SidekickDomainError("duplicate_component", "That Hazard is already in the Encounter.") }
            let mode = ParticipationMode(rawValue: (command["participation_mode"] as? String) ?? "avoidable") ?? .avoidable
            let participation = Participation(mode: mode, condition: command["participation_condition"] as? String)
            let encounterHazard = EncounterHazard(id: snapshot.id, contentID: snapshot.provenance.catalogContentID ?? "hazard/custom/\(snapshot.id)/current", name: snapshot.identity.name, level: snapshot.identity.level, complexity: .simple, participation: participation, placement: (command["placement"] as? String) ?? "")
            try store.mutate(description: "Created Simple Hazard \(snapshot.identity.name)", origin: origin, expectedRevision: expected) {
                var hazards = $0.customHazards ?? []
                hazards.append(snapshot)
                $0.customHazards = hazards
                $0.hazards.append(encounterHazard)
            }
        case "sidekickdm_upsert_npc_profile":
            guard let payload = command["profile"] as? [String: Any], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(NPCProfile.self, from: data) else { throw SidekickDomainError("invalid_npc_profile", "The NPC Profile payload is invalid.") }
            let profile = try NPCProfileBuilder.create(decoded)
            guard let participantID = profile.participantGroupID, store.draft.participantGroups.contains(where: { $0.id == participantID }) else { throw SidekickDomainError("unknown_component", "The NPC Profile must link to an existing Participant Group.") }
            try store.mutate(description: "Updated NPC Profile \(profile.id)", origin: origin, expectedRevision: expected) {
                var profiles = $0.npcProfiles ?? []
                if let index = profiles.firstIndex(where: { $0.id == profile.id }) { profiles[index] = profile } else { profiles.append(profile) }
                $0.npcProfiles = profiles
            }
        case "sidekickdm_upsert_phase": let id = (command["phase_id"] as? String) ?? "phase_\(store.draft.phases.count + 1)"; let phase = EncounterPhase(id: id, title: (command["title"] as? String) ?? "Phase \(store.draft.phases.count + 1)", order: number(command, "order") ?? store.draft.phases.count, participantIDs: command["participant_ids"] as? [String] ?? [], hazardIDs: command["hazard_ids"] as? [String] ?? [], trigger: (command["trigger"] as? String) ?? "", runningGuidance: (command["running_guidance"] as? String) ?? ""); guard phase.participantIDs.allSatisfy({ id in store.draft.participantGroups.contains { $0.id == id } }) else { throw SidekickDomainError("invalid_phase", "Phase references an unknown participant.") }; try store.mutate(description: "Updated phase \(phase.title)", origin: origin, expectedRevision: expected) { if let index = $0.phases.firstIndex(where: { $0.id == id }) { $0.phases[index] = phase } else { $0.phases.append(phase) } }
        case "sidekickdm_set_encounter_identity":
            let value = try packetSection(PacketIdentitySection.self, command: command)
            try store.mutate(description: "Updated Encounter identity", origin: origin, expectedRevision: expected) {
                var packet = $0.packetV1 ?? EncounterPacketContentV1(corePacket: $0.packet, title: $0.title)
                if let value { packet.identity = value } else { if let title = command["title"] as? String { packet.identity.title = title }; if let premise = command["premise"] as? String { packet.identity.premise = premise } }
                $0.packetV1 = packet; $0.packet = packet.flattenedCorePacket(); $0.title = packet.identity.title.isEmpty ? $0.title : packet.identity.title
            }
        case "sidekickdm_set_setup": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated Encounter setup") { $0.setup = try requiredPacketSection(PacketSetupSection.self, command: command) }
        case "sidekickdm_set_battlefield_guidance": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated battlefield guidance") { $0.battlefield = try requiredPacketSection(PacketBattlefieldSection.self, command: command) }
        case "sidekickdm_set_running_guidance": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated running guidance") { $0.runningGuidance = try requiredPacketSection(PacketRunningGuidanceSection.self, command: command) }
        case "sidekickdm_set_cohesion": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated Encounter cohesion") { $0.cohesion = try requiredPacketSection(PacketCohesionSection.self, command: command) }
        case "sidekickdm_set_information_visibility": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated information visibility") { $0.information = try requiredPacketSection(PacketInformationSection.self, command: command) }
        case "sidekickdm_set_outcomes": try mutatePacketSection(command, store: store, expected: expected, origin: origin, description: "Updated Encounter outcomes") { $0.outcomes = try requiredPacketSection(PacketOutcomesSection.self, command: command) }
        case "sidekickdm_set_encounter_packet":
            let packet = try requiredPacketSection(EncounterPacketContentV1.self, command: command, keys: ["packet", "value"])
            try store.mutate(description: "Updated Encounter Packet", origin: origin, expectedRevision: expected) { $0.packetV1 = packet; $0.packet = packet.flattenedCorePacket(); if !packet.identity.title.isEmpty { $0.title = packet.identity.title } }
        case "sidekickdm_undo": try store.undo(expectedRevision: expected, origin: origin)
        case "sidekickdm_redo": try store.redo(expectedRevision: expected, origin: origin)
        case "sidekickdm_begin_generation": guard store.draft.generation == nil else { throw SidekickDomainError("generation_already_active", "A Generation Run is already active.") }; let runID = (command["generation_run_id"] as? String) ?? "run_\(UUID().uuidString.lowercased())"; try store.mutate(description: "Began Generation Run", origin: origin, expectedRevision: expected) { let encoder = JSONEncoder(); let opening = try? String(data: encoder.encode($0), encoding: .utf8); $0.generation = GenerationState(id: runID, openingDraftJSON: opening, intentSummary: (command["intent_summary"] as? String) ?? "") }
        case "sidekickdm_cancel_generation": guard let encoded = store.draft.generation?.openingDraftJSON, let bytes = encoded.data(using: .utf8), let opening = try? JSONDecoder().decode(EncounterDraft.self, from: bytes) else { throw SidekickDomainError("no_active_generation", "There is no active Generation Run.") }; try store.mutate(description: "Cancelled Generation Run", origin: origin, expectedRevision: expected) { $0 = opening; $0.generation = nil }
        case "sidekickdm_finish_generation": guard store.draft.generation != nil else { throw SidekickDomainError("no_active_generation", "There is no active Generation Run.") }; try store.mutate(description: "Finished Generation Run", origin: origin, expectedRevision: expected) { $0.generation = nil; $0.reviewState = "needed" }
        case "sidekick_load_draft", "sidekickdm_load_draft": guard let data = command["draft_json"] as? String, let bytes = data.data(using: .utf8), let loaded = try? JSONDecoder().decode(EncounterDraft.self, from: bytes) else { throw SidekickDomainError("invalid_request", "The saved Encounter Draft is invalid.") }; store.load(loaded)
        case "sidekick_reset": try store.mutate(description: "Reset Encounter Draft", origin: origin, expectedRevision: expected) { $0 = EncounterDraft() }
        default: throw SidekickDomainError("unknown_command", "Unknown semantic command: \(name).")
        }
    }
    private static func number(_ command: [String: Any], _ key: String) -> Int? { (command[key] as? NSNumber)?.intValue ?? (command[key] as? Int) }
    private static func packetSection<T: Decodable>(_ type: T.Type, command: [String: Any], keys: [String] = ["value"]) throws -> T? { for key in keys { if let payload = command[key], JSONSerialization.isValidJSONObject(payload), let data = try? JSONSerialization.data(withJSONObject: payload), let decoded = try? JSONDecoder().decode(type, from: data) { return decoded } }; return nil }
    private static func requiredPacketSection<T: Decodable>(_ type: T.Type, command: [String: Any], keys: [String] = ["value"]) throws -> T { guard let value = try packetSection(type, command: command, keys: keys) else { throw SidekickDomainError("invalid_packet_section", "The Encounter Packet section payload is invalid.") }; return value }
    private static func mutatePacketSection(_ command: [String: Any], store: EncounterStore, expected: Int?, origin: String, description: String, operation: @escaping (inout EncounterPacketContentV1) throws -> Void) throws { try store.mutate(description: description, origin: origin, expectedRevision: expected) { draft in var packet = draft.packetV1 ?? EncounterPacketContentV1(corePacket: draft.packet, title: draft.title); try operation(&packet); draft.packetV1 = packet; draft.packet = packet.flattenedCorePacket() } }
}
