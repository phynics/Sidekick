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
        encounter["object_version"] = .number(1)
        encounter["created_at"] = encounter["created_at"] ?? .string(options.exportedAt)
        encounter["modified_at"] = .string(options.exportedAt)
        encounter["tags"] = encounter["tags"] ?? .array([])
        encounter["npc_only_participants"] = .array([])
        encounter["generation_metadata"] = encounter["generation"] ?? .object([:])
        encounter["review_state"] = .string(draft.reviewState)

        let creatures = (draft.originalCreatures ?? []).sorted { $0.id < $1.id }.map { try? snakeCaseObject($0) }.compactMap { $0 }
        let hazards = (draft.customHazards ?? []).sorted { $0.id < $1.id }.map { try? snakeCaseObject($0) }.compactMap { $0 }
        let embedded: [String: AnyCodable] = [
            "creatures": .array(creatures.map(\.asAnyCodable)),
            "npc_profiles": .array([]),
            "hazards": .array(hazards.map(\.asAnyCodable))
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

    public static func validate(_ data: Data) throws {
        let root = try decodeObject(data)
        let migrated = try migrate(root)
        guard case let .string(format)? = migrated["format"], format == Self.format else { throw EncounterFileError.invalidEnvelope("format must be sidekickdm") }
        guard case let .number(version)? = migrated["format_version"] else { throw EncounterFileError.invalidEnvelope("format_version is required") }
        guard Int(version) == supportedVersion else { throw EncounterFileError.unsupportedVersion(Int(version)) }
        guard case let .object(dataObject)? = migrated["data"] else { throw EncounterFileError.invalidEnvelope("data is required") }
        guard case let .object(encounter)? = dataObject["encounter"] else { throw EncounterFileError.invalidPayload("encounter is required") }
        try validateReferences(encounter: encounter, embedded: dataObject["embedded_components"])
        _ = try decodeDraft(encounter: encounter)
    }

    public static func importDraft(_ data: Data, existingIDs: Set<String> = [], importedAt: String = "1970-01-01T00:00:00Z") throws -> EncounterFileImportResult {
        let root = try decodeObject(data)
        let migrated = try migrate(root)
        guard case let .number(version)? = migrated["format_version"] else { throw EncounterFileError.invalidEnvelope("format_version is required") }
        guard Int(version) == supportedVersion else { throw EncounterFileError.unsupportedVersion(Int(version)) }
        guard case let .object(dataObject)? = migrated["data"], case let .object(encounter)? = dataObject["encounter"] else { throw EncounterFileError.invalidPayload("Encounter data is required.") }
        try validateReferences(encounter: encounter, embedded: dataObject["embedded_components"])
        var draft = try decodeDraft(encounter: encounter)
        let allIDs = IDs.inEncounter(draft)
        var occupied = existingIDs
        var remapped: [String: String] = [:]
        for original in allIDs.sorted() where occupied.contains(original) {
            let replacement = freshID(for: original, occupied: occupied)
            remapped[original] = replacement
            occupied.insert(replacement)
        }
        if !remapped.isEmpty { draft = remap(draft, IDs: remapped, importedAt: importedAt) }
        draft.revision = 0
        draft.provenance.lastMutationOrigin = "import"
        return EncounterFileImportResult(draft: draft, remappedIDs: remapped, importedAt: importedAt, sourceFormatVersion: Int(version))
    }

    private static func migrate(_ root: [String: AnyCodable]) throws -> [String: AnyCodable] {
        guard case let .number(version) = root["format_version"] ?? root["version"] else { throw EncounterFileError.invalidEnvelope("format_version is required") }
        let numericVersion = Int(version)
        if numericVersion > supportedVersion { throw EncounterFileError.futureMajorVersion(numericVersion) }
        if numericVersion < 0 { throw EncounterFileError.unsupportedVersion(numericVersion) }
        if numericVersion == supportedVersion { return root }
        return try EncounterFileV0ToV1Migration().migrate(root)
    }

    private static func validateReferences(encounter: [String: AnyCodable], embedded: AnyCodable?) throws {
        guard case let .string(objectType) = encounter["object_type"] ?? .string("encounter"), objectType == "encounter" || objectType.isEmpty else { throw EncounterFileError.invalidPayload("Unsupported object type.") }
        guard case let .number(objectVersion) = encounter["object_version"] ?? .number(1), Int(objectVersion) == 1 else { throw EncounterFileError.unsupportedVersion(2) }
        guard case let .array(groups) = encounter["participant_groups"] ?? .array([]) else { throw EncounterFileError.invalidPayload("participant_groups must be an array.") }
        var ids = Set<String>()
        for group in groups {
            guard case let .object(value) = group, case let .string(id)? = value["id"] else { throw EncounterFileError.invalidPayload("Participant Group requires an id.") }
            if !ids.insert(id).inserted { throw EncounterFileError.duplicateID(id) }
        }
        guard case let .object(components) = embedded ?? .object([:]) else { throw EncounterFileError.invalidPayload("embedded_components must be an object.") }
        for key in ["creatures", "npc_profiles", "hazards"] {
            guard case let .array(values)? = components[key] else { throw EncounterFileError.invalidPayload("embedded_components.\(key) must be an array.") }
            var componentIDs = Set<String>()
            for value in values {
                guard case let .object(component) = value, case let .string(id)? = component["id"] else { throw EncounterFileError.invalidPayload("Embedded component requires an id.") }
                if !componentIDs.insert(id).inserted { throw EncounterFileError.duplicateID(id) }
            }
        }
    }

    private static func decodeDraft(encounter: [String: AnyCodable]) throws -> EncounterDraft {
        var value = encounter
        value.removeValue(forKey: "object_version"); value.removeValue(forKey: "created_at"); value.removeValue(forKey: "modified_at"); value.removeValue(forKey: "tags"); value.removeValue(forKey: "npc_only_participants"); value.removeValue(forKey: "generation_metadata")
        if let packet = value["packet_v1"] ?? value["packet_content"] { value["packet_v1"] = packet }
        let camel = camelCase(value)
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
            var ids = Set([draft.id]); ids.formUnion(draft.participantGroups.map(\.id)); ids.formUnion(draft.hazards.map(\.id)); ids.formUnion(draft.phases.map(\.id)); ids.formUnion((draft.originalCreatures ?? []).map(\.id)); ids.formUnion((draft.customHazards ?? []).map(\.id)); return ids
        }
    }

    private static func remap(_ draft: EncounterDraft, IDs: [String: String], importedAt: String) -> EncounterDraft {
        var value = draft
        if let replacement = IDs[value.id] { value.id = replacement }
        value.participantGroups = value.participantGroups.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; return item }
        value.hazards = value.hazards.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; return item }
        value.phases = value.phases.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; item.participantIDs = item.participantIDs.map { IDs[$0] ?? $0 }; item.hazardIDs = item.hazardIDs.map { IDs[$0] ?? $0 }; return item }
        value.originalCreatures = value.originalCreatures?.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; item.provenance.origin = "imported"; item.provenance.createdAt = importedAt; return item }
        value.customHazards = value.customHazards?.map { var item = $0; if let replacement = IDs[item.id] { item.id = replacement }; item.provenance.origin = "imported"; item.provenance.createdAt = importedAt; return item }
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
