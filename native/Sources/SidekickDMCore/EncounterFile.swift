import Foundation

/// The portable Sidekick DM file contract. This layer deliberately does not
/// make the engine's `EncounterDraft` the file schema: the file uses the
/// snake-case v1 contract and carries an explicit format version.
public enum EncounterFileExportKind: String, Codable, Sendable {
    case encounter
    case components
    case library
}

public struct EncounterFileGenerator: Codable, Equatable, Sendable {
    public var product: String
    public var version: String

    public init(product: String = "Sidekick DM", version: String = "0.1.0") {
        self.product = product
        self.version = version
    }
}

public struct EncounterFileEnvelope: Codable, Equatable, Sendable {
    public var format: String
    public var formatVersion: Int
    public var exportKind: EncounterFileExportKind
    public var exportedAt: String
    public var generator: EncounterFileGenerator
    public var licenseNotices: [String]
    public var data: [String: AnyCodable]

    public init(
        format: String = "sidekickdm",
        formatVersion: Int = 1,
        exportKind: EncounterFileExportKind = .encounter,
        exportedAt: String,
        generator: EncounterFileGenerator = EncounterFileGenerator(),
        licenseNotices: [String] = [],
        data: [String: AnyCodable] = [:]
    ) {
        self.format = format
        self.formatVersion = formatVersion
        self.exportKind = exportKind
        self.exportedAt = exportedAt
        self.generator = generator
        self.licenseNotices = licenseNotices
        self.data = data
    }

    private enum CodingKeys: String, CodingKey {
        case format
        case formatVersion = "format_version"
        case exportKind = "export_kind"
        case exportedAt = "exported_at"
        case generator
        case licenseNotices = "license_notices"
        case data
    }
}

/// A small JSON value type keeps the file adapter independent of Foundation's
/// private JSON implementation details while allowing contract extensions.
public enum AnyCodable: Codable, Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([AnyCodable])
    case object([String: AnyCodable])

    public init(from decoder: Decoder) throws {
        if let container = try? decoder.singleValueContainer(), container.decodeNil() {
            self = .null
        } else if let value = try? decoder.singleValueContainer().decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? decoder.singleValueContainer().decode(Int.self) {
            self = .number(Double(value))
        } else if let value = try? decoder.singleValueContainer().decode(Double.self) {
            self = .number(value)
        } else if let value = try? decoder.singleValueContainer().decode(String.self) {
            self = .string(value)
        } else if var array = try? decoder.unkeyedContainer() {
            var values: [AnyCodable] = []
            while !array.isAtEnd { values.append(try array.decode(AnyCodable.self)) }
            self = .array(values)
        } else {
            let container = try decoder.container(keyedBy: DynamicCodingKey.self)
            var values: [String: AnyCodable] = [:]
            for key in container.allKeys { values[key.stringValue] = try container.decode(AnyCodable.self, forKey: key) }
            self = .object(values)
        }
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .null:
            var container = encoder.singleValueContainer(); try container.encodeNil()
        case let .bool(value):
            var container = encoder.singleValueContainer(); try container.encode(value)
        case let .number(value):
            var container = encoder.singleValueContainer(); try container.encode(value)
        case let .string(value):
            var container = encoder.singleValueContainer(); try container.encode(value)
        case let .array(values):
            var container = encoder.unkeyedContainer(); for value in values { try container.encode(value) }
        case let .object(values):
            var container = encoder.container(keyedBy: DynamicCodingKey.self)
            for key in values.keys.sorted() { try container.encode(values[key], forKey: DynamicCodingKey(stringValue: key)!) }
        }
    }

    fileprivate var foundationValue: Any {
        switch self {
        case .null: return NSNull()
        case let .bool(value): return value
        case let .number(value): return value
        case let .string(value): return value
        case let .array(values): return values.map(\.foundationValue)
        case let .object(values): return values.mapValues(\.foundationValue)
        }
    }

    fileprivate init(foundationValue: Any) throws {
        switch foundationValue {
        case _ as NSNull: self = .null
        case let value as NSNumber:
            if String(cString: value.objCType) == "c" { self = .bool(value.boolValue) } else { self = .number(value.doubleValue) }
        case let value as Bool: self = .bool(value)
        case let value as String: self = .string(value)
        case let value as [Any]: self = .array(try value.map(AnyCodable.init(foundationValue:)))
        case let value as [String: Any]: self = .object(try value.mapValues(AnyCodable.init(foundationValue:)))
        default: throw EncounterFileError.invalidPayload("Unsupported JSON value.")
        }
    }
}

private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int? = nil
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { stringValue = "\(intValue)" }
}

public struct EncounterFileImportResult: Equatable, Sendable {
    public var draft: EncounterDraft
    public var remappedIDs: [String: String]
    public var importedAt: String
    public var sourceFormatVersion: Int

    public init(draft: EncounterDraft, remappedIDs: [String: String] = [:], importedAt: String, sourceFormatVersion: Int = 1) {
        self.draft = draft
        self.remappedIDs = remappedIDs
        self.importedAt = importedAt
        self.sourceFormatVersion = sourceFormatVersion
    }
}

public struct EncounterFileComponents: Equatable, Sendable {
    public var creatures: [OriginalCreature]
    public var npcProfiles: [NPCProfile]
    public var hazards: [SimpleHazard]
    public var partyProfiles: [AnyCodable]
    /// Catalog records are opaque snapshots. They are kept separate from
    /// authored creature and hazard drafts, but remain in the file bundle so
    /// older browser readers can still find them in their kind-specific list.
    public var embeddedCatalogEntries: [AnyCodable]

    public init(creatures: [OriginalCreature] = [], npcProfiles: [NPCProfile] = [], hazards: [SimpleHazard] = [], partyProfiles: [AnyCodable] = [], embeddedCatalogEntries: [AnyCodable] = []) {
        self.creatures = creatures
        self.npcProfiles = npcProfiles
        self.hazards = hazards
        self.partyProfiles = partyProfiles
        self.embeddedCatalogEntries = embeddedCatalogEntries
    }
}

public struct EncounterFileComponentsImportResult: Equatable, Sendable {
    public var components: EncounterFileComponents
    public var remappedIDs: [String: String]
    public var importedAt: String
    public var sourceFormatVersion: Int

    public init(components: EncounterFileComponents, remappedIDs: [String: String] = [:], importedAt: String, sourceFormatVersion: Int = 1) {
        self.components = components
        self.remappedIDs = remappedIDs
        self.importedAt = importedAt
        self.sourceFormatVersion = sourceFormatVersion
    }
}

public struct EncounterFileLibrary: Equatable, Sendable {
    public var encounters: [EncounterDraft]
    public var components: EncounterFileComponents

    public init(encounters: [EncounterDraft] = [], components: EncounterFileComponents = EncounterFileComponents()) {
        self.encounters = encounters
        self.components = components
    }
}

public struct EncounterFileLibraryImportResult: Equatable, Sendable {
    public var library: EncounterFileLibrary
    public var remappedIDs: [String: String]
    public var importedAt: String
    public var sourceFormatVersion: Int

    public init(library: EncounterFileLibrary, remappedIDs: [String: String] = [:], importedAt: String, sourceFormatVersion: Int = 1) {
        self.library = library
        self.remappedIDs = remappedIDs
        self.importedAt = importedAt
        self.sourceFormatVersion = sourceFormatVersion
    }
}

public enum EncounterFileError: Error, Equatable, Sendable {
    case invalidJSON
    case invalidEnvelope(String)
    case unsupportedVersion(Int)
    case futureMajorVersion(Int)
    case invalidPayload(String)
    case invalidReference(String)
    case duplicateID(String)

    public var code: String {
        switch self {
        case .invalidJSON: return "invalid_json"
        case .invalidEnvelope: return "invalid_envelope"
        case .unsupportedVersion: return "unsupported_schema_version"
        case .futureMajorVersion: return "future_schema_version"
        case .invalidPayload: return "invalid_payload"
        case .invalidReference: return "invalid_reference"
        case .duplicateID: return "duplicate_id"
        }
    }
}

public protocol SidekickDMMigration: Sendable {
    var fromVersion: Int { get }
    var toVersion: Int { get }
    func migrate(_ value: [String: AnyCodable]) throws -> [String: AnyCodable]
}

/// v0 was the short-lived draft envelope used by early prototypes. It had
/// `version` in place of `format_version`; migration is pure and happens
/// before any store is touched.
public struct EncounterFileV0ToV1Migration: SidekickDMMigration {
    public let fromVersion = 0
    public let toVersion = 1

    public init() {}

    public func migrate(_ value: [String: AnyCodable]) throws -> [String: AnyCodable] {
        var result = value
        if result["format_version"] == nil, let version = result.removeValue(forKey: "version") { result["format_version"] = version }
        result["format_version"] = .number(1)
        return result
    }
}

public struct EncounterFileExportOptions: Sendable {
    public var exportedAt: String
    public var generator: EncounterFileGenerator
    public var licenseNotices: [String]

    public init(exportedAt: String = "1970-01-01T00:00:00Z", generator: EncounterFileGenerator = EncounterFileGenerator(), licenseNotices: [String] = []) {
        self.exportedAt = exportedAt
        self.generator = generator
        self.licenseNotices = licenseNotices
    }
}

public enum EncounterFileCodec {
    public static let format = "sidekickdm"
    public static let supportedVersion = 1

    /// Encodes a deterministic, self-contained Encounter export. Dictionary
    /// keys are sorted and embedded components are sorted by local ID.
    public static func exportDraft(_ draft: EncounterDraft, options: EncounterFileExportOptions = EncounterFileExportOptions()) throws -> Data {
        let payload = try exportObject(draft: draft, options: options)
        return try encodeSorted(payload)
    }

    public static func exportObject(draft: EncounterDraft, options: EncounterFileExportOptions = EncounterFileExportOptions()) throws -> [String: AnyCodable] {
        var encounter = try snakeCaseObject(draft)
        // NPC Profiles are component records. Keep one canonical copy in the
        // embedded component section so imports can remap profile and group
        // IDs together without creating duplicate IDs in the envelope.
        encounter.removeValue(forKey: "npc_profiles")
        encounter["object_version"] = .number(1)
        encounter["created_at"] = encounter["created_at"] ?? .string(options.exportedAt)
        encounter["modified_at"] = .string(options.exportedAt)
        encounter["tags"] = encounter["tags"] ?? .array([])
        encounter["npc_only_participants"] = .array([])
        encounter["generation_metadata"] = encounter["generation"] ?? .object([:])
        encounter["review_state"] = .string(draft.reviewState)

        let creatures = (draft.originalCreatures ?? []).sorted { $0.id < $1.id }.map { try? snakeCaseObject($0) }.compactMap { $0 }
        let npcProfiles = (draft.npcProfiles ?? []).sorted { $0.id < $1.id }.map { try? snakeCaseObject($0) }.compactMap { $0 }
        let hazards = (draft.customHazards ?? []).sorted { $0.id < $1.id }.map { try? snakeCaseObject($0) }.compactMap { $0 }
        let catalogEntries: [AnyCodable]
        if case let .array(values)? = encounter["embedded_catalog_entries"] { catalogEntries = values } else { catalogEntries = [] }
        let catalogCreatures = catalogEntries.filter { catalogEntryKind($0) == .creature }
        let catalogHazards = catalogEntries.filter { catalogEntryKind($0) == .hazard }
        let embedded: [String: AnyCodable] = [
            // Keep catalog snapshots in the legacy kind-specific arrays for
            // browser v1 readers, and in the canonical dedicated array.
            "creatures": .array((creatures.map(\.asAnyCodable) + catalogCreatures)),
            "npc_profiles": .array(npcProfiles.map(\.asAnyCodable)),
            "hazards": .array((hazards.map(\.asAnyCodable) + catalogHazards)),
            "embedded_catalog_entries": .array(catalogEntries)
        ]
        let root: [String: AnyCodable] = [
            "format": .string(format),
            "format_version": .number(Double(supportedVersion)),
            "export_kind": .string(EncounterFileExportKind.encounter.rawValue),
            "exported_at": .string(options.exportedAt),
            "generator": .object(["product": .string(options.generator.product), "version": .string(options.generator.version)]),
            "license_notices": .array(options.licenseNotices.map(AnyCodable.string)),
            "data": .object([
                "object_type": .string("encounter"),
                "object_version": .number(1),
                "encounter": .object(encounter),
                "embedded_components": .object(embedded),
                "attachments": .array([])
            ])
        ]
        return root
    }

    public static func exportComponentsFile(
        creatures: [OriginalCreature] = [],
        npcProfiles: [NPCProfile] = [],
        hazards: [SimpleHazard] = [],
        partyProfiles: [AnyCodable] = [],
        options: EncounterFileExportOptions = EncounterFileExportOptions()
    ) throws -> Data {
        let components = try componentObjects(creatures: creatures, npcProfiles: npcProfiles, hazards: hazards, partyProfiles: partyProfiles)
        return try encodeEnvelope(exportKind: .components, data: [
            "object_type": .string("components"),
            "object_version": .number(1),
            "components": .object(components),
            "attachments": .array([])
        ], options: options)
    }

    public static func createComponentsFile(
        creatures: [OriginalCreature] = [],
        npcProfiles: [NPCProfile] = [],
        hazards: [SimpleHazard] = [],
        partyProfiles: [AnyCodable] = [],
        options: EncounterFileExportOptions = EncounterFileExportOptions()
    ) throws -> Data {
        try exportComponentsFile(creatures: creatures, npcProfiles: npcProfiles, hazards: hazards, partyProfiles: partyProfiles, options: options)
    }

    public static func exportComponents(
        creatures: [OriginalCreature] = [],
        npcProfiles: [NPCProfile] = [],
        hazards: [SimpleHazard] = [],
        partyProfiles: [AnyCodable] = [],
        options: EncounterFileExportOptions = EncounterFileExportOptions()
    ) throws -> Data {
        try exportComponentsFile(creatures: creatures, npcProfiles: npcProfiles, hazards: hazards, partyProfiles: partyProfiles, options: options)
    }

    public static func exportLibraryFile(
        encounters: [EncounterDraft] = [],
        creatures: [OriginalCreature] = [],
        npcProfiles: [NPCProfile] = [],
        hazards: [SimpleHazard] = [],
        partyProfiles: [AnyCodable] = [],
        options: EncounterFileExportOptions = EncounterFileExportOptions()
    ) throws -> Data {
        let componentObjects = try componentObjects(creatures: creatures, npcProfiles: npcProfiles, hazards: hazards, partyProfiles: partyProfiles)
        let encounterObjects = try encounters.sorted { $0.id < $1.id }.map { try snakeCaseObject($0) }
        let data: [String: AnyCodable] = [
            "object_type": .string("library"),
            "object_version": .number(1),
            "encounters": .array(encounterObjects.map(\.asAnyCodable)),
            "creatures": componentObjects["creatures"] ?? .array([]),
            "npc_profiles": componentObjects["npc_profiles"] ?? .array([]),
            "hazards": componentObjects["hazards"] ?? .array([]),
            "party_profiles": componentObjects["party_profiles"] ?? .array([]),
            "attachments": .array([])
        ]
        return try encodeEnvelope(exportKind: .library, data: data, options: options)
    }

    public static func createLibraryFile(
        encounters: [EncounterDraft] = [],
        creatures: [OriginalCreature] = [],
        npcProfiles: [NPCProfile] = [],
        hazards: [SimpleHazard] = [],
        partyProfiles: [AnyCodable] = [],
        options: EncounterFileExportOptions = EncounterFileExportOptions()
    ) throws -> Data {
        try exportLibraryFile(encounters: encounters, creatures: creatures, npcProfiles: npcProfiles, hazards: hazards, partyProfiles: partyProfiles, options: options)
    }

    public static func exportLibrary(
        encounters: [EncounterDraft] = [],
        creatures: [OriginalCreature] = [],
        npcProfiles: [NPCProfile] = [],
        hazards: [SimpleHazard] = [],
        partyProfiles: [AnyCodable] = [],
        options: EncounterFileExportOptions = EncounterFileExportOptions()
    ) throws -> Data {
        try exportLibraryFile(encounters: encounters, creatures: creatures, npcProfiles: npcProfiles, hazards: hazards, partyProfiles: partyProfiles, options: options)
    }

    public static func validate(_ data: Data) throws {
        let root = try decodeObject(data)
        let migrated = try migrate(root)
        try validateEnvelope(migrated)
        guard case let .string(exportKind)? = migrated["export_kind"], let kind = EncounterFileExportKind(rawValue: exportKind), case let .object(dataObject)? = migrated["data"] else { return }
        if kind == .components {
            guard case let .object(components)? = dataObject["components"] else { throw EncounterFileError.invalidPayload("components data is required.") }
            let parsed = try decodeComponents(components)
            try validateGlobalIDs(components: parsed, attachments: dataObject["attachments"])
            return
        }
        if kind == .library {
            guard case let .array(encounters)? = dataObject["encounters"] else { throw EncounterFileError.invalidPayload("encounters must be an array.") }
            let components: [String: AnyCodable] = ["creatures": dataObject["creatures"] ?? .array([]), "npc_profiles": dataObject["npc_profiles"] ?? .array([]), "hazards": dataObject["hazards"] ?? .array([]), "party_profiles": dataObject["party_profiles"] ?? .array([])]
            let parsed = try decodeComponents(components)
            var registry = IDRegistry()
            try register(components: parsed, in: &registry)
            try register(attachments: dataObject["attachments"], in: &registry)
            for value in encounters {
                guard case let .object(encounter) = value else { throw EncounterFileError.invalidPayload("Library encounters must be objects.") }
                let draft = try decodeDraft(encounter: encounter)
                try validateReferences(draft: draft)
                try register(draft: draft, in: &registry)
                }
            return
        }
        guard case let .number(version)? = migrated["format_version"] else { throw EncounterFileError.invalidEnvelope("format_version is required") }
        guard Int(exactly: version) == supportedVersion else { throw EncounterFileError.unsupportedVersion(Int(version)) }
        guard case let .object(dataObject)? = migrated["data"] else { throw EncounterFileError.invalidEnvelope("data is required") }
        guard case let .object(encounter)? = dataObject["encounter"] else { throw EncounterFileError.invalidPayload("encounter is required") }
        _ = try validateReferences(encounter: encounter, embedded: dataObject["embedded_components"], attachments: dataObject["attachments"])
    }

    public static func importDraft(_ data: Data, existingIDs: Set<String> = [], importedAt: String = "1970-01-01T00:00:00Z") throws -> EncounterFileImportResult {
        let root = try decodeObject(data)
        let migrated = try migrate(root)
        try validateEnvelope(migrated)
        guard case let .string(exportKind)? = migrated["export_kind"], exportKind == EncounterFileExportKind.encounter.rawValue else { throw EncounterFileError.invalidPayload("Only encounter exports can be imported as an Encounter Draft.") }
        guard case let .number(version)? = migrated["format_version"] else { throw EncounterFileError.invalidEnvelope("format_version is required") }
        guard Int(exactly: version) == supportedVersion else { throw EncounterFileError.unsupportedVersion(Int(version)) }
        guard case let .object(dataObject)? = migrated["data"], case let .object(encounter)? = dataObject["encounter"] else { throw EncounterFileError.invalidPayload("Encounter data is required.") }
        let embedded = try validateReferences(encounter: encounter, embedded: dataObject["embedded_components"], attachments: dataObject["attachments"])
        var draft = try decodeDraft(encounter: encounter)
        // Decode every embedded typed record before producing a result. The
        // memory store writes only after this complete decode and validation.
        // Older durable drafts can carry the component arrays on the
        // encounter itself while leaving the embedded arrays empty. Preserve
        // those records when no canonical embedded replacement is present.
        if !embedded.creatures.isEmpty { draft.originalCreatures = embedded.creatures }
        if !embedded.hazards.isEmpty { draft.customHazards = embedded.hazards }
        if !embedded.npcProfiles.isEmpty { draft.npcProfiles = embedded.npcProfiles }
        let existingCatalogEntries = draft.embeddedCatalogEntries ?? []
        draft.embeddedCatalogEntries = mergeCatalogEntries(existingCatalogEntries + embedded.embeddedCatalogEntries)
        try validateReferences(draft: draft)
        let allIDs = IDs.inEncounter(draft)
        var occupied = existingIDs.union(allIDs)
        var remapped: [String: String] = [:]
        for original in allIDs.sorted() where existingIDs.contains(original) {
            let replacement = freshID(for: original, occupied: occupied)
            remapped[original] = replacement
            occupied.insert(replacement)
        }
        if !remapped.isEmpty { draft = remap(draft, IDs: remapped, importedAt: importedAt) }
        try validateReferences(draft: draft)
        draft.revision = 0
        draft.provenance.lastMutationOrigin = "import"
        return EncounterFileImportResult(draft: draft, remappedIDs: remapped, importedAt: importedAt, sourceFormatVersion: Int(version))
    }

    public static func importComponentsFile(_ data: Data, existingIDs: Set<String> = [], importedAt: String = "1970-01-01T00:00:00Z") throws -> EncounterFileComponentsImportResult {
        let root = try validatedRoot(data, exportKind: .components)
        guard case let .object(dataObject)? = root["data"], case let .object(components)? = dataObject["components"] else { throw EncounterFileError.invalidPayload("components data is required.") }
        let parsed = try decodeComponents(components)
        let ids = try componentIDs(parsed)
        try validateGlobalIDs(components: parsed, attachments: dataObject["attachments"])
        let remapped = remappedIDs(for: ids, existingIDs: existingIDs)
        return EncounterFileComponentsImportResult(components: remapComponents(parsed, IDs: remapped, importedAt: importedAt), remappedIDs: remapped, importedAt: importedAt, sourceFormatVersion: 1)
    }

    public static func importComponents(_ data: Data, existingIDs: Set<String> = [], importedAt: String = "1970-01-01T00:00:00Z") throws -> EncounterFileComponentsImportResult {
        try importComponentsFile(data, existingIDs: existingIDs, importedAt: importedAt)
    }

    public static func importLibraryFile(_ data: Data, existingIDs: Set<String> = [], importedAt: String = "1970-01-01T00:00:00Z") throws -> EncounterFileLibraryImportResult {
        let root = try validatedRoot(data, exportKind: .library)
        guard case let .object(dataObject)? = root["data"] else { throw EncounterFileError.invalidPayload("library data is required.") }
        guard case let .array(encounterValues)? = dataObject["encounters"] else { throw EncounterFileError.invalidPayload("encounters must be an array.") }
        let componentValues: [String: AnyCodable] = [
            "creatures": dataObject["creatures"] ?? .array([]),
            "npc_profiles": dataObject["npc_profiles"] ?? .array([]),
            "hazards": dataObject["hazards"] ?? .array([]),
            "party_profiles": dataObject["party_profiles"] ?? .array([])
        ]
        let parsed = try decodeComponents(componentValues)
        var encounters: [EncounterDraft] = []
        for value in encounterValues {
            guard case let .object(encounter) = value else { throw EncounterFileError.invalidPayload("Library encounters must be objects.") }
            let draft = try decodeDraft(encounter: encounter)
            try validateReferences(draft: draft)
            encounters.append(draft)
        }
        var registry = IDRegistry()
        try register(components: parsed, in: &registry)
        try register(attachments: dataObject["attachments"], in: &registry)
        for encounter in encounters { try register(draft: encounter, in: &registry) }
        var allIDs = try componentIDs(parsed)
        for encounter in encounters { allIDs.formUnion(IDs.inEncounter(encounter)) }
        let remapped = remappedIDs(for: allIDs, existingIDs: existingIDs)
        let components = remapComponents(parsed, IDs: remapped, importedAt: importedAt)
        encounters = encounters.map { remap($0, IDs: remapped, importedAt: importedAt) }
        for encounter in encounters { try validateReferences(draft: encounter) }
        return EncounterFileLibraryImportResult(library: EncounterFileLibrary(encounters: encounters, components: components), remappedIDs: remapped, importedAt: importedAt, sourceFormatVersion: 1)
    }

    public static func importLibrary(_ data: Data, existingIDs: Set<String> = [], importedAt: String = "1970-01-01T00:00:00Z") throws -> EncounterFileLibraryImportResult {
        try importLibraryFile(data, existingIDs: existingIDs, importedAt: importedAt)
    }

    private static func encodeEnvelope(exportKind: EncounterFileExportKind, data: [String: AnyCodable], options: EncounterFileExportOptions) throws -> Data {
        try encodeSorted([
            "format": .string(format),
            "format_version": .number(Double(supportedVersion)),
            "export_kind": .string(exportKind.rawValue),
            "exported_at": .string(options.exportedAt),
            "generator": .object(["product": .string(options.generator.product), "version": .string(options.generator.version)]),
            "license_notices": .array(options.licenseNotices.map(AnyCodable.string)),
            "data": .object(data)
        ])
    }

    private static func componentObjects(creatures: [OriginalCreature], npcProfiles: [NPCProfile], hazards: [SimpleHazard], partyProfiles: [AnyCodable]) throws -> [String: AnyCodable] {
        let creatureObjects = try creatures.sorted { $0.id < $1.id }.map { try snakeCaseObject($0).asAnyCodable }
        let profileObjects = try npcProfiles.sorted { $0.id < $1.id }.map { try snakeCaseObject($0).asAnyCodable }
        let hazardObjects = try hazards.sorted { $0.id < $1.id }.map { try snakeCaseObject($0).asAnyCodable }
        let components: [String: AnyCodable] = [
            "creatures": .array(creatureObjects),
            "npc_profiles": .array(profileObjects),
            "hazards": .array(hazardObjects),
            "party_profiles": .array(partyProfiles)
        ]
        _ = try decodeComponents(components) // enforce object shape and global ID uniqueness before export
        return components
    }

    private static func validateEnvelope(_ root: [String: AnyCodable]) throws {
        guard case let .string(format)? = root["format"], format == Self.format else { throw EncounterFileError.invalidEnvelope("format must be sidekickdm") }
        let version = try integerVersion(root["format_version"])
        guard version == supportedVersion else { throw EncounterFileError.unsupportedVersion(version) }
        guard case let .string(kind)? = root["export_kind"], EncounterFileExportKind(rawValue: kind) != nil else { throw EncounterFileError.invalidEnvelope("export_kind must be encounter, components, or library") }
        guard case let .string(exportedAt)? = root["exported_at"], !exportedAt.isEmpty else { throw EncounterFileError.invalidEnvelope("exported_at is required") }
        guard case .object? = root["data"] else { throw EncounterFileError.invalidEnvelope("data is required") }
    }

    private static func validatedRoot(_ data: Data, exportKind: EncounterFileExportKind) throws -> [String: AnyCodable] {
        let migrated = try migrate(decodeObject(data))
        try validateEnvelope(migrated)
        guard case let .string(kind)? = migrated["export_kind"], kind == exportKind.rawValue else { throw EncounterFileError.invalidPayload("Unexpected export kind.") }
        return migrated
    }

    private static func decodeValue<T: Decodable>(_ value: AnyCodable, as type: T.Type) throws -> T {
        do { return try JSONDecoder().decode(type, from: JSONEncoder().encode(value)) }
        catch let error as DecodingError {
            throw EncounterFileError.invalidPayload("A reusable component \(String(describing: T.self)) does not match its v1 shape: \(decodingDescription(error)).")
        }
        catch { throw EncounterFileError.invalidPayload("A reusable component does not match its v1 shape: \(error.localizedDescription)") }
    }

    private static func decodingDescription(_ error: DecodingError) -> String {
        switch error {
        case let .keyNotFound(key, context): return "missing \(key.stringValue) at \(context.codingPath.map { $0.stringValue }.joined(separator: "."))"
        case let .typeMismatch(_, context): return "type mismatch at \(context.codingPath.map { $0.stringValue }.joined(separator: "."))"
        case let .valueNotFound(_, context): return "missing value at \(context.codingPath.map { $0.stringValue }.joined(separator: "."))"
        case let .dataCorrupted(context): return "corrupt data at \(context.codingPath.map { $0.stringValue }.joined(separator: "."))"
        @unknown default: return "unknown decoding error"
        }
    }

    private static func decodeComponents(_ values: [String: AnyCodable], requirePartyProfiles: Bool = true) throws -> EncounterFileComponents {
        func array(_ key: String) throws -> [AnyCodable] {
            guard case let .array(items)? = values[key] else { throw EncounterFileError.invalidPayload("\(key) must be an array.") }
            return items
        }
        func requiredID(_ value: AnyCodable, kind: String) throws {
            guard case let .object(object) = value, case let .string(id)? = object["id"], !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw EncounterFileError.invalidPayload("\(kind) records require a non-empty id.")
            }
        }
        let creatureValues = try array("creatures")
        let npcValues = try array("npc_profiles")
        let hazardValues = try array("hazards")
        let dedicatedCatalogValues: [AnyCodable]
        if case let .array(items)? = values["embedded_catalog_entries"] { dedicatedCatalogValues = items } else { dedicatedCatalogValues = [] }
        for value in dedicatedCatalogValues {
            guard case .object = value else { throw EncounterFileError.invalidPayload("Embedded catalog entries must be objects.") }
        }
        var catalogEntries = dedicatedCatalogValues
        func decodeCatalogOr<T: Decodable>(_ value: AnyCodable, kind: String, as type: T.Type, normalize: (AnyCodable) -> AnyCodable) throws -> T? {
            if catalogEntryKind(value) != nil {
                if case let .object(object) = value, let id = object["id"] {
                    guard case let .string(id) = id, !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw EncounterFileError.invalidPayload("Catalog snapshot IDs must not be empty.") }
                }
                catalogEntries = mergeCatalogEntries(catalogEntries + [value])
                return nil
            }
            try requiredID(value, kind: kind)
            return try decodeValue(normalize(value), as: type)
        }
        let creatures = try creatureValues.compactMap { try decodeCatalogOr($0, kind: "Creature", as: OriginalCreature.self, normalize: camelCase) }
        let npcProfiles = try npcValues.map { value -> NPCProfile in
            try requiredID(value, kind: "NPC Profile")
            return try decodeValue(normalizeNPCProfile(value), as: NPCProfile.self)
        }
        let hazards = try hazardValues.compactMap { try decodeCatalogOr($0, kind: "Hazard", as: SimpleHazard.self, normalize: camelCase) }
        let partyProfiles = try values["party_profiles"] == nil && !requirePartyProfiles ? [] : array("party_profiles")
        for value in partyProfiles {
            if case let .object(object) = value, let idValue = object["id"] {
                guard case let .string(id) = idValue, !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw EncounterFileError.invalidPayload("Party Profile IDs must not be empty.") }
            }
        }
        let result = EncounterFileComponents(creatures: creatures, npcProfiles: npcProfiles, hazards: hazards, partyProfiles: partyProfiles, embeddedCatalogEntries: catalogEntries)
        _ = try componentIDs(result)
        return result
    }

    private static func componentIDs(_ components: EncounterFileComponents) throws -> Set<String> {
        var IDs = Set<String>()
        for id in components.creatures.map(\.id) + components.npcProfiles.map(\.id) + components.hazards.map(\.id) {
            guard !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw EncounterFileError.invalidPayload("Reusable component IDs must not be empty.") }
            guard IDs.insert(id).inserted else { throw EncounterFileError.duplicateID(id) }
        }
        for value in components.embeddedCatalogEntries {
            if case let .object(object) = value, case let .string(id)? = object["id"], !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                guard IDs.insert(id).inserted else { throw EncounterFileError.duplicateID(id) }
            }
        }
        for value in components.partyProfiles {
            if case let .object(object) = value, case let .string(id)? = object["id"] {
                guard IDs.insert(id).inserted else { throw EncounterFileError.duplicateID(id) }
            }
        }
        return IDs
    }

    private static func remappedIDs(for IDs: Set<String>, existingIDs: Set<String>) -> [String: String] {
        var occupied = existingIDs
        var remapped: [String: String] = [:]
        for original in IDs.sorted() {
            if occupied.contains(original) {
                let replacement = freshID(for: original, occupied: occupied)
                remapped[original] = replacement
                occupied.insert(replacement)
            } else {
                occupied.insert(original)
            }
        }
        return remapped
    }

    private static func remapComponents(_ components: EncounterFileComponents, IDs: [String: String], importedAt: String) -> EncounterFileComponents {
        let creatures = components.creatures.map { value -> OriginalCreature in
            var value = remapCodable(value, IDs: IDs)
            value.provenance.origin = "imported"
            value.provenance.createdAt = importedAt
            value.provenance.mutationOrigin = "import"
            return value
        }
        let profiles = components.npcProfiles.map { value -> NPCProfile in
            var value = remapCodable(value, IDs: IDs)
            value.provenance.origin = NPCProfileOrigin.imported.rawValue
            value.provenance.createdAt = importedAt
            value.provenance.lastMutationOrigin = "import"
            return value
        }
        let hazards = components.hazards.map { value -> SimpleHazard in
            var value = remapCodable(value, IDs: IDs)
            value.provenance.origin = "imported"
            value.provenance.createdAt = importedAt
            value.provenance.mutationOrigin = "import"
            return value
        }
        return EncounterFileComponents(
            creatures: creatures,
            npcProfiles: profiles,
            hazards: hazards,
            partyProfiles: components.partyProfiles.map { remapAnyCodable($0, IDs: IDs) },
            embeddedCatalogEntries: components.embeddedCatalogEntries.map { remapAnyCodable($0, IDs: IDs) }
        )
    }

    private static func remapCodable<T: Codable>(_ value: T, IDs: [String: String]) -> T {
        guard let data = try? JSONEncoder().encode(value), let json = try? JSONSerialization.jsonObject(with: data), let any = try? AnyCodable(foundationValue: json), let remapped = try? JSONEncoder().encode(remapAnyCodable(any, IDs: IDs)), let result = try? JSONDecoder().decode(T.self, from: remapped) else { return value }
        return result
    }

    private static func remapAnyCodable(_ value: AnyCodable, IDs: [String: String], key: String? = nil) -> AnyCodable {
        switch value {
        case let .array(values): return .array(values.map { remapAnyCodable($0, IDs: IDs, key: key) })
        case let .object(values):
            return .object(Dictionary(uniqueKeysWithValues: values.map { entry in
                if isReferenceKey(entry.key), case let .string(id) = entry.value { return (entry.key, AnyCodable.string(IDs[id] ?? id)) }
                return (entry.key, remapAnyCodable(entry.value, IDs: IDs, key: entry.key))
            }))
        case let .string(id) where key.map(isReferenceKey) == true: return .string(IDs[id] ?? id)
        default: return value
        }
    }

    private static func isReferenceKey(_ key: String) -> Bool {
        let normalized = key.lowercased()
        if normalized.contains("content") { return false }
        return normalized == "id" || normalized.hasSuffix("_id") || normalized.hasSuffix("ids") || normalized.hasSuffix("_ids") || key.hasSuffix("ID") || key.hasSuffix("Id")
    }

    private static func decodeNPCProfiles(from embedded: AnyCodable?) throws -> [NPCProfile] {
        guard case let .object(components) = embedded ?? .object([:]), case let .array(values)? = components["npc_profiles"] else { return [] }
        return try values.map { try decodeValue(normalizeNPCProfile($0), as: NPCProfile.self) }
    }

    private static func normalizeNPCProfile(_ value: AnyCodable) -> AnyCodable {
        guard case let .object(object) = value else { return value }
        var normalized = object
        if let provenance = object["provenance"] { normalized["provenance"] = camelCase(provenance) }
        return .object(normalized)
    }

    private static func normalizeCamelNPCProfile(_ value: AnyCodable) -> AnyCodable {
        guard case let .object(object) = value else { return value }
        return .object(object.reduce(into: [String: AnyCodable]()) { result, item in
            result[item.key == "provenance" ? item.key : camelToSnake(item.key)] = item.value
        })
    }

    private static func catalogEntryKind(_ value: AnyCodable) -> CatalogEntryKind? {
        guard case let .object(object) = value else { return nil }
        if case let .string(kind)? = object["snapshot_kind"], kind == "catalog" { return catalogKind(object) }
        if case let .string(kind)? = object["snapshotKind"], kind == "catalog" { return catalogKind(object) }
        if case let .string(kind)? = object["kind"], let result = CatalogEntryKind(rawValue: kind), object["detail"] != nil { return result }
        if case let .object(summary)? = object["summary"], case let .string(kind)? = summary["kind"] { return CatalogEntryKind(rawValue: kind) }
        return nil
    }

    private static func catalogKind(_ object: [String: AnyCodable]) -> CatalogEntryKind? {
        if case let .string(kind)? = object["kind"] { return CatalogEntryKind(rawValue: kind) }
        if case let .object(summary)? = object["summary"], case let .string(kind)? = summary["kind"] { return CatalogEntryKind(rawValue: kind) }
        return nil
    }

    private static func mergeCatalogEntries(_ values: [AnyCodable]) -> [AnyCodable] {
        var result: [AnyCodable] = []
        for value in values where !result.contains(value) { result.append(value) }
        return result
    }

    private static func integerVersion(_ value: AnyCodable?) throws -> Int {
        guard case let .number(number)? = value, let version = Int(exactly: number) else {
            throw EncounterFileError.invalidEnvelope("format_version is required")
        }
        return version
    }

    private static func migrate(_ root: [String: AnyCodable]) throws -> [String: AnyCodable] {
        let numericVersion = try integerVersion(root["format_version"] ?? root["version"])
        if numericVersion > supportedVersion { throw EncounterFileError.futureMajorVersion(numericVersion) }
        if numericVersion < 0 { throw EncounterFileError.unsupportedVersion(numericVersion) }
        if numericVersion == supportedVersion { return root }
        return try EncounterFileV0ToV1Migration().migrate(root)
    }

    private struct IDRegistry {
        private var ids = Set<String>()

        mutating func insert(_ id: String, kind: String) throws {
            guard !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw EncounterFileError.invalidPayload("\(kind) requires a non-empty id.")
            }
            guard ids.insert(id).inserted else { throw EncounterFileError.duplicateID(id) }
        }
    }

    private static func register(draft: EncounterDraft, in registry: inout IDRegistry) throws {
        try registry.insert(draft.id, kind: "Encounter")
        for item in draft.participantGroups { try registry.insert(item.id, kind: "Participant Group") }
        let placedHazardIDs = Set(draft.hazards.map(\.id))
        for item in draft.hazards { try registry.insert(item.id, kind: "Encounter Hazard") }
        // The structured phase array is the richer representation of the
        // legacy phase array.  Exported drafts may contain both mirrors with
        // the same IDs; register that logical phase only once while still
        // rejecting duplicate IDs within either representation and across all
        // other kinds.
        var phaseIDs = Set<String>()
        for item in draft.phases {
            try registry.insert(item.id, kind: "Phase")
            phaseIDs.insert(item.id)
        }
        for item in draft.structuredPhases ?? [] where !phaseIDs.contains(item.id) {
            try registry.insert(item.id, kind: "Structured Phase")
        }
        for item in draft.originalCreatures ?? [] { try registry.insert(item.id, kind: "Original Creature") }
        var customHazardIDs = Set<String>()
        for item in draft.customHazards ?? [] {
            guard customHazardIDs.insert(item.id).inserted else { throw EncounterFileError.duplicateID(item.id) }
            // A self-contained Encounter stores the authored custom Hazard
            // beside its placed Encounter Hazard. They are one logical
            // record and intentionally share an ID.
            if !placedHazardIDs.contains(item.id) { try registry.insert(item.id, kind: "Simple Hazard") }
        }
        for item in draft.npcProfiles ?? [] { try registry.insert(item.id, kind: "NPC Profile") }
        for value in draft.embeddedCatalogEntries ?? [] {
            guard case let .object(object) = value else { throw EncounterFileError.invalidPayload("Embedded catalog entries must be objects.") }
            if case let .string(id)? = object["id"] { try registry.insert(id, kind: "Catalog Entry") }
        }
    }

    private static func register(components: EncounterFileComponents, in registry: inout IDRegistry) throws {
        for item in components.creatures { try registry.insert(item.id, kind: "Creature") }
        for item in components.npcProfiles { try registry.insert(item.id, kind: "NPC Profile") }
        for item in components.hazards { try registry.insert(item.id, kind: "Hazard") }
        for value in components.embeddedCatalogEntries {
            guard case let .object(object) = value else { throw EncounterFileError.invalidPayload("Embedded catalog entries must be objects.") }
            if case let .string(id)? = object["id"] { try registry.insert(id, kind: "Catalog Entry") }
        }
        for value in components.partyProfiles {
            if case let .object(object) = value, case let .string(id)? = object["id"] { try registry.insert(id, kind: "Party Profile") }
        }
    }

    private static func register(attachments value: AnyCodable?, in registry: inout IDRegistry) throws {
        guard case let .array(attachments) = value ?? .array([]) else { throw EncounterFileError.invalidPayload("attachments must be an array.") }
        for attachment in attachments {
            guard case let .object(object) = attachment, case let .string(id)? = object["id"] else {
                throw EncounterFileError.invalidPayload("Attachment metadata requires an id.")
            }
            try registry.insert(id, kind: "Attachment")
        }
    }

    private static func validateGlobalIDs(components: EncounterFileComponents, attachments: AnyCodable?) throws {
        var registry = IDRegistry()
        try register(components: components, in: &registry)
        try register(attachments: attachments, in: &registry)
    }

    private static func validateReferences(encounter: [String: AnyCodable], embedded: AnyCodable?, attachments: AnyCodable? = nil) throws -> EncounterFileComponents {
        guard case let .string(objectType) = encounter["object_type"] ?? .string("encounter"), objectType == "encounter" || objectType.isEmpty else { throw EncounterFileError.invalidPayload("Unsupported object type.") }
        guard case let .number(objectVersion) = encounter["object_version"] ?? .number(1), Int(exactly: objectVersion) == 1 else { throw EncounterFileError.unsupportedVersion(2) }
        guard case let .array(groups) = encounter["participant_groups"] ?? .array([]) else { throw EncounterFileError.invalidPayload("participant_groups must be an array.") }
        guard case let .array(hazards) = encounter["hazards"] ?? .array([]) else { throw EncounterFileError.invalidPayload("hazards must be an array.") }
        guard case let .array(phases) = encounter["phases"] ?? .array([]) else { throw EncounterFileError.invalidPayload("phases must be an array.") }
        var ids = Set<String>()
        var groupIDs = Set<String>()
        var hazardIDs = Set<String>()
        var phaseIDs = Set<String>()
        func objectID(_ value: AnyCodable, kind: String) throws -> String {
            guard case let .object(object) = value, case let .string(id)? = object["id"], !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw EncounterFileError.invalidPayload("\(kind) requires a non-empty id.") }
            return id
        }
        for group in groups {
            let id = try objectID(group, kind: "Participant Group")
            if !ids.insert(id).inserted { throw EncounterFileError.duplicateID(id) }
            groupIDs.insert(id)
        }
        for hazard in hazards {
            let id = try objectID(hazard, kind: "Encounter Hazard")
            if !ids.insert(id).inserted { throw EncounterFileError.duplicateID(id) }
            hazardIDs.insert(id)
        }
        for phase in phases {
            let id = try objectID(phase, kind: "Phase")
            if !ids.insert(id).inserted { throw EncounterFileError.duplicateID(id) }
            phaseIDs.insert(id)
        }
        let embeddedValues: [String: AnyCodable]
        guard case let .object(values) = embedded ?? .object([:]) else { throw EncounterFileError.invalidPayload("embedded_components must be an object.") }
        embeddedValues = values
        let decodedComponents = try decodeComponents(embeddedValues, requirePartyProfiles: false)
        let embeddedCustomHazardIDs = Set(decodedComponents.hazards.map(\.id))
        let placedHazardIDs = hazardIDs
        for id in try componentIDs(decodedComponents) where !(placedHazardIDs.contains(id) && embeddedCustomHazardIDs.contains(id)) && !ids.insert(id).inserted {
            // A catalog snapshot may be repeated in both its legacy
            // kind-specific list and embedded_catalog_entries. The decoder
            // deduplicates those records before IDs are checked.
            throw EncounterFileError.duplicateID(id)
        }
        for profile in decodedComponents.npcProfiles {
            if let participantID = profile.participantGroupID, !groupIDs.contains(participantID) {
                throw EncounterFileError.invalidReference("NPC Profile \(profile.id) references unknown Participant Group \(participantID).")
            }
        }
        for phase in phases {
            guard case let .object(value) = phase else { throw EncounterFileError.invalidPayload("Phase must be an object.") }
            let participantReferences = value["active_participant_group_ids"] ?? value["participant_ids"] ?? .array([])
            let hazardReferences = value["active_hazard_ids"] ?? value["hazard_ids"] ?? .array([])
            try validateReferenceArray(participantReferences, validIDs: groupIDs, label: "Participant Group")
            try validateReferenceArray(hazardReferences, validIDs: hazardIDs, label: "Hazard")
        }
        for group in groups {
            guard case let .object(value) = group else { continue }
            let references = value["phase_ids"] ?? value["active_phase_ids"] ?? .array([])
            try validateReferenceArray(references, validIDs: phaseIDs, label: "Phase")
        }
        if case let .array(nestedProfiles)? = encounter["npc_profiles"] {
            for value in nestedProfiles {
                let profile = try decodeValue(normalizeNPCProfile(value), as: NPCProfile.self)
                if let participantID = profile.participantGroupID, !groupIDs.contains(participantID) {
                    throw EncounterFileError.invalidReference("NPC Profile \(profile.id) references unknown Participant Group \(participantID).")
                }
            }
        }
        var draft = try decodeDraft(encounter: encounter)
        if !decodedComponents.creatures.isEmpty { draft.originalCreatures = decodedComponents.creatures }
        if !decodedComponents.hazards.isEmpty { draft.customHazards = decodedComponents.hazards }
        if !decodedComponents.npcProfiles.isEmpty { draft.npcProfiles = decodedComponents.npcProfiles }
        draft.embeddedCatalogEntries = mergeCatalogEntries((draft.embeddedCatalogEntries ?? []) + decodedComponents.embeddedCatalogEntries)
        try validateReferences(draft: draft)
        var registry = IDRegistry()
        try register(draft: draft, in: &registry)
        try register(attachments: attachments, in: &registry)
        return decodedComponents
    }

    private static func validateReferenceArray(_ value: AnyCodable, validIDs: Set<String>, label: String) throws {
        guard case let .array(references) = value else { throw EncounterFileError.invalidPayload("References to \(label) must be an array.") }
        for reference in references {
            guard case let .string(id) = reference, validIDs.contains(id) else { throw EncounterFileError.invalidReference("Reference to unknown \(label).") }
        }
    }

    private static func validateReferences(draft: EncounterDraft) throws {
        var registry = IDRegistry()
        try register(draft: draft, in: &registry)
        let groupIDs = Set(draft.participantGroups.map(\.id))
        let hazardIDs = Set(draft.hazards.map(\.id))
        for phase in draft.phases {
            guard phase.participantIDs.allSatisfy(groupIDs.contains) else { throw EncounterFileError.invalidReference("Phase \(phase.id) references an unknown Participant Group.") }
            guard phase.hazardIDs.allSatisfy(hazardIDs.contains) else { throw EncounterFileError.invalidReference("Phase \(phase.id) references an unknown Hazard.") }
        }
        for phase in draft.structuredPhases ?? [] {
            guard phase.participantIDs.allSatisfy(groupIDs.contains) else { throw EncounterFileError.invalidReference("Phase \(phase.id) references an unknown Participant Group.") }
            guard phase.hazardIDs.allSatisfy(hazardIDs.contains) else { throw EncounterFileError.invalidReference("Phase \(phase.id) references an unknown Hazard.") }
        }
        for profile in draft.npcProfiles ?? [] {
            if let participantID = profile.participantGroupID, !groupIDs.contains(participantID) {
                throw EncounterFileError.invalidReference("NPC Profile \(profile.id) references unknown Participant Group \(participantID).")
            }
        }
    }

    private static func decodeDraft(encounter: [String: AnyCodable]) throws -> EncounterDraft {
        var value = encounter
        value.removeValue(forKey: "object_version"); value.removeValue(forKey: "created_at"); value.removeValue(forKey: "modified_at"); value.removeValue(forKey: "tags"); value.removeValue(forKey: "npc_only_participants"); value.removeValue(forKey: "generation_metadata")
        if let packet = value["packet_v1"] ?? value["packet_content"] { value["packet_v1"] = packet }
        // Catalog snapshots are opaque browser-facing JSON. Preserve their
        // internal keys (for example `content_id`) while adapting the draft's
        // own snake-case keys for synthesized Codable decoding.
        let embeddedCatalogEntries = value.removeValue(forKey: "embedded_catalog_entries")
        var camel = camelCase(value)
        if case let .array(profiles)? = camel["npcProfiles"] {
            camel["npcProfiles"] = .array(profiles.map(normalizeCamelNPCProfile))
        }
        if let embeddedCatalogEntries { camel["embeddedCatalogEntries"] = embeddedCatalogEntries }
        let bytes = try encodeSorted(camel)
        do { return try JSONDecoder().decode(EncounterDraft.self, from: bytes) }
        catch {
            if case let DecodingError.keyNotFound(key, context) = error {
                let path = context.codingPath.map { $0.stringValue }.joined(separator: ".")
                throw EncounterFileError.invalidPayload("Encounter is missing \(key.stringValue) at \(path).")
            }
            throw EncounterFileError.invalidPayload("Encounter does not match the v1 draft shape: \(error.localizedDescription)")
        }
    }

    private static func encodeSorted(_ value: [String: AnyCodable]) throws -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(AnyCodable.object(value))
    }

    private static func decodeObject(_ data: Data) throws -> [String: AnyCodable] {
        do {
            guard let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw EncounterFileError.invalidJSON }
            guard let result = try? AnyCodable(foundationValue: value), case let .object(object) = result else { throw EncounterFileError.invalidJSON }
            return object
        } catch let error as EncounterFileError { throw error } catch { throw EncounterFileError.invalidJSON }
    }

    private static func snakeCaseObject<T: Encodable>(_ value: T) throws -> [String: AnyCodable] {
        let data = try JSONEncoder().encode(value)
        let object = try JSONSerialization.jsonObject(with: data)
        guard let dictionary = object as? [String: Any] else { throw EncounterFileError.invalidPayload("Expected an object.") }
        return try convert(dictionary, keyTransform: camelToSnake)
    }

    private static func convert(_ value: Any, keyTransform: (String) -> String) throws -> [String: AnyCodable] {
        guard let object = value as? [String: Any] else { throw EncounterFileError.invalidPayload("Expected an object.") }
        return try object.reduce(into: [String: AnyCodable]()) { result, item in
            result[keyTransform(item.key)] = try convertAny(item.value, keyTransform: keyTransform)
        }
    }

    private static func convertAny(_ value: Any, keyTransform: (String) -> String) throws -> AnyCodable {
        if let object = value as? [String: Any] { return .object(try convert(object, keyTransform: keyTransform)) }
        if let array = value as? [Any] { return .array(try array.map { try convertAny($0, keyTransform: keyTransform) }) }
        return try AnyCodable(foundationValue: value)
    }

    private static func camelToSnake(_ value: String) -> String {
        let characters = Array(value)
        var output = ""
        for index in characters.indices {
            let character = characters[index]
            let previous = index > characters.startIndex ? characters[index - 1] : nil
            let next = index + 1 < characters.endIndex ? characters[index + 1] : nil
            let startsAcronymBoundary = character.isUppercase && index > characters.startIndex && (previous?.isLowercase == true || previous?.isNumber == true || (previous?.isUppercase == true && next?.isLowercase == true))
            if startsAcronymBoundary { output.append("_") }
            output.append(contentsOf: character.lowercased())
        }
        return output
    }

    private static func camelCase(_ value: [String: AnyCodable]) -> [String: AnyCodable] {
        value.reduce(into: [String: AnyCodable]()) { result, item in result[snakeToCamel(item.key)] = camelCase(item.value) }
    }

    private static func camelCase(_ value: AnyCodable) -> AnyCodable {
        switch value {
        case let .array(values): return .array(values.map(camelCase))
        case let .object(values): return .object(camelCase(values))
        default: return value
        }
    }

    private static func snakeToCamel(_ value: String) -> String {
        var result = ""; var uppercase = false
        for character in value {
            if character == "_" { uppercase = true } else if uppercase { result.append(contentsOf: character.uppercased()); uppercase = false } else { result.append(character) }
        }
        if result.hasSuffix("Id") { return String(result.dropLast(2)) + "ID" }
        if result.hasSuffix("Json") { return String(result.dropLast(4)) + "JSON" }
        return result
    }

    private static func freshID(for original: String, occupied: Set<String>) -> String {
        let prefix = original.split(separator: "_", maxSplits: 1).first.map(String.init) ?? "id"
        var index = 2
        var candidate = "\(prefix)_imported"
        while occupied.contains(candidate) { candidate = "\(prefix)_imported_\(index)"; index += 1 }
        return candidate
    }

    private enum IDs {
        static func inEncounter(_ draft: EncounterDraft) -> Set<String> {
            inEncounter(draft, includeOpeningSnapshot: true)
        }

        private static func inEncounter(_ draft: EncounterDraft, includeOpeningSnapshot: Bool) -> Set<String> {
            var ids = Set([draft.id]); ids.formUnion(draft.participantGroups.map(\.id)); ids.formUnion(draft.hazards.map(\.id)); ids.formUnion(draft.phases.map(\.id)); ids.formUnion((draft.structuredPhases ?? []).map(\.id)); ids.formUnion((draft.originalCreatures ?? []).map(\.id)); ids.formUnion((draft.customHazards ?? []).map(\.id)); ids.formUnion((draft.npcProfiles ?? []).map(\.id));
            for value in draft.embeddedCatalogEntries ?? [] { collectIDs(from: value, into: &ids) }
            if includeOpeningSnapshot, let encoded = draft.generation?.openingDraftJSON, let data = encoded.data(using: .utf8), let opening = try? JSONDecoder().decode(EncounterDraft.self, from: data) {
                ids.formUnion(inEncounter(opening, includeOpeningSnapshot: false))
            }
            return ids
        }

        private static func collectIDs(from value: AnyCodable, into ids: inout Set<String>) {
            switch value {
            case let .array(values):
                for value in values { collectIDs(from: value, into: &ids) }
            case let .object(values):
                if case let .string(id)? = values["id"], !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { ids.insert(id) }
                for value in values.values { collectIDs(from: value, into: &ids) }
            default: break
            }
        }
    }

    private static func remap(_ draft: EncounterDraft, IDs: [String: String], importedAt: String) -> EncounterDraft {
        remap(draft, IDs: IDs, importedAt: importedAt, remapOpeningSnapshot: true)
    }

    private static func remap(_ draft: EncounterDraft, IDs: [String: String], importedAt: String, remapOpeningSnapshot: Bool) -> EncounterDraft {
        var value = draft
        if let replacement = IDs[value.id] { value.id = replacement }
        value.participantGroups = value.participantGroups.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; return item }
        value.hazards = value.hazards.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; return item }
        value.phases = value.phases.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; item.participantIDs = item.participantIDs.map { IDs[$0] ?? $0 }; item.hazardIDs = item.hazardIDs.map { IDs[$0] ?? $0 }; return item }
        value.structuredPhases = value.structuredPhases?.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; item.participantIDs = item.participantIDs.map { IDs[$0] ?? $0 }; item.hazardIDs = item.hazardIDs.map { IDs[$0] ?? $0 }; return item }
        value.originalCreatures = value.originalCreatures?.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; item.provenance.origin = "imported"; item.provenance.createdAt = importedAt; return item }
        value.customHazards = value.customHazards?.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; item.provenance.origin = "imported"; item.provenance.createdAt = importedAt; return item }
        value.npcProfiles = value.npcProfiles?.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; if let participantID = item.participantGroupID { item.participantGroupID = IDs[participantID] ?? participantID }; item.provenance.origin = NPCProfileOrigin.imported.rawValue; item.provenance.createdAt = importedAt; item.provenance.lastMutationOrigin = "import"; return item }
        value.embeddedCatalogEntries = value.embeddedCatalogEntries?.map { remapAnyCodable($0, IDs: IDs) }
        if remapOpeningSnapshot, !IDs.isEmpty, var generation = value.generation, let encoded = generation.openingDraftJSON, let data = encoded.data(using: .utf8), let opening = try? JSONDecoder().decode(EncounterDraft.self, from: data) {
            let remappedOpening = remap(opening, IDs: IDs, importedAt: importedAt, remapOpeningSnapshot: false)
            if let remappedData = try? JSONEncoder().encode(remappedOpening), let remappedJSON = String(data: remappedData, encoding: .utf8) {
                generation.openingDraftJSON = remappedJSON
                value.generation = generation
            }
        }
        value.provenance.origin = "imported"; value.provenance.lastMutationOrigin = "import"
        return value
    }
}

private extension Dictionary where Key == String, Value == AnyCodable {
    var asAnyCodable: AnyCodable { .object(self) }
}

/// An atomic in-memory adapter used by native callers and tests. A browser
/// implementation should provide the same all-or-nothing semantics using one
/// IndexedDB readwrite transaction (see `src/encounter-file.js`).
public final class EncounterFileMemoryStore: @unchecked Sendable {
    public private(set) var encounters: [String: EncounterDraft]

    public init(encounters: [String: EncounterDraft] = [:]) { self.encounters = encounters }

    @discardableResult
    public func importEncounter(_ data: Data, importedAt: String = "1970-01-01T00:00:00Z") throws -> EncounterFileImportResult {
        let existing = Set(encounters.keys)
        let result = try EncounterFileCodec.importDraft(data, existingIDs: existing, importedAt: importedAt)
        // No mutation occurred until validation, migration, decoding, and ID
        // remapping all succeeded above.
        encounters[result.draft.id] = result.draft
        return result
    }
}
