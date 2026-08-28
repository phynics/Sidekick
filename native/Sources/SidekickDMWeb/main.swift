import Foundation
import SidekickDMCore

private struct ErrorPayload: Encodable {
    let code: String
    let message: String
    let details: [String: String]
}

private struct CommandResult: Encodable {
    let protocolVersion: Int
    let encounterRevision: Int
    let briefRevision: Int
    let constraintsRevision: Int
    let generationRunID: String?
    let ok: Bool
    let snapshot: BoundarySnapshot
    let error: ErrorPayload?
}

private nonisolated(unsafe) var store = EncounterStore()
private nonisolated(unsafe) var outputPointer: UnsafeMutablePointer<UInt8>?
private nonisolated(unsafe) var outputLength: Int32 = 0

private func replaceOutput(with bytes: [UInt8]) {
    outputPointer?.deallocate()
    outputPointer = nil
    outputLength = Int32(bytes.count)
    guard !bytes.isEmpty else { return }
    let pointer = UnsafeMutablePointer<UInt8>.allocate(capacity: bytes.count)
    bytes.withUnsafeBufferPointer { buffer in
        pointer.initialize(from: buffer.baseAddress!, count: bytes.count)
    }
    outputPointer = pointer
}

private func publish(_ value: some Encodable) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    replaceOutput(with: (try? encoder.encode(value)).map(Array.init) ?? [])
}

private func publishSnapshot(error: String? = nil) {
    publish(store.snapshot(error: error))
}

@_cdecl("sidekickdm_protocol_version")
public func sidekickDMProtocolVersion() -> Int32 { 1 }

@_cdecl("sidekickdm_alloc")
public func sidekickDMAlloc(_ length: Int32) -> UnsafeMutableRawPointer? {
    UnsafeMutableRawPointer.allocate(byteCount: max(1, Int(length)), alignment: 1)
}

@_cdecl("sidekickdm_dealloc")
public func sidekickDMDealloc(_ pointer: UnsafeMutableRawPointer?) { pointer?.deallocate() }

@_cdecl("sidekickdm_initialize")
public func sidekickDMInitialize() -> Int32 {
    store = EncounterStore()
    publishSnapshot()
    return 1
}

@_cdecl("sidekickdm_execute")
public func sidekickDMExecute(_ pointer: UnsafePointer<UInt8>?, _ length: Int32) -> Int32 {
    guard let pointer, length > 0 else {
        publish(CommandResult(protocolVersion: 1, encounterRevision: store.draft.revision, briefRevision: store.draft.briefRevision ?? 0, constraintsRevision: store.draft.constraintsRevision, generationRunID: store.draft.generation?.id, ok: false, snapshot: store.snapshot(error: "Command input is empty."), error: ErrorPayload(code: "invalid_request", message: "Command input is empty.", details: [:])))
        return 0
    }
    do {
        let value: Any
        do {
            value = try JSONSerialization.jsonObject(with: Data(bytes: pointer, count: Int(length)), options: [])
        } catch {
            throw SidekickDomainError("invalid_request", "Command input must be valid JSON.")
        }
        guard let command = value as? [String: Any] else { throw SidekickDomainError("invalid_request", "Command input must be a JSON object.") }
        try SidekickCommandExecutor.execute(command, in: store)
        publish(CommandResult(protocolVersion: 1, encounterRevision: store.draft.revision, briefRevision: store.draft.briefRevision ?? 0, constraintsRevision: store.draft.constraintsRevision, generationRunID: store.draft.generation?.id, ok: true, snapshot: store.snapshot(), error: nil))
        return 1
    } catch let error as SidekickDomainError {
        publish(CommandResult(protocolVersion: 1, encounterRevision: store.draft.revision, briefRevision: store.draft.briefRevision ?? 0, constraintsRevision: store.draft.constraintsRevision, generationRunID: store.draft.generation?.id, ok: false, snapshot: store.snapshot(error: error.message), error: ErrorPayload(code: error.code, message: error.message, details: error.details)))
        return 0
    } catch {
        publish(CommandResult(protocolVersion: 1, encounterRevision: store.draft.revision, briefRevision: store.draft.briefRevision ?? 0, constraintsRevision: store.draft.constraintsRevision, generationRunID: store.draft.generation?.id, ok: false, snapshot: store.snapshot(error: error.localizedDescription), error: ErrorPayload(code: "application_error", message: error.localizedDescription, details: [:])))
        return 0
    }
}

@_cdecl("sidekickdm_result_ptr")
public func sidekickDMResultPointer() -> UnsafePointer<UInt8>? {
    guard let outputPointer else { return nil }
    return UnsafePointer(outputPointer)
}

@_cdecl("sidekickdm_result_len")
public func sidekickDMResultLength() -> Int32 { outputLength }

@_cdecl("sidekickdm_result_copy")
public func sidekickDMResultCopy(_ destination: UnsafeMutableRawPointer?, _ capacity: Int32) -> Int32 {
    guard let destination, let outputPointer, outputLength > 0, capacity >= outputLength else { return 0 }
    destination.copyMemory(from: outputPointer, byteCount: Int(outputLength))
    return outputLength
}
