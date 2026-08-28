import XCTest
@testable import SidekickDMCore

final class EncounterMathTests: XCTestCase {
    func testGoldenThreatAndPartyAdjustments() {
        XCTAssertEqual(EncounterMath.baseBudget(for: ThreatTarget(kind: .severe)), 120)
        XCTAssertEqual(EncounterMath.partyAdjustedBudget(for: ThreatTarget(kind: .severe), partySize: 5), 150)
        XCTAssertEqual(EncounterMath.partyAdjustedBudget(for: ThreatTarget(kind: .low), partySize: 1), 0)
    }

    func testGoldenCreatureAndHazardXP() {
        XCTAssertEqual(EncounterMath.creatureXP(componentLevel: 9, partyLevel: 5), 160)
        XCTAssertEqual(EncounterMath.hazardXP(level: 9, partyLevel: 5, complexity: .simple), 30)
        XCTAssertEqual(EncounterMath.hazardXP(level: 9, partyLevel: 5, complexity: .complex), 150)
        XCTAssertEqual(EncounterMath.hazardXP(level: 0, partyLevel: 5, complexity: .simple), 0)
    }

    func testRevisionStaleUndoRedoAndRedoBranch() throws {
        let store = EncounterStore()
        try SidekickCommandExecutor.execute(["command": "sidekickdm_set_party_snapshot", "effective_level": 5, "size": 5], in: store)
        XCTAssertThrowsError(try SidekickCommandExecutor.execute(["command": "sidekickdm_set_threat_target", "kind": "severe", "expected_revision": 0], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "stale_revision")
        }
        try SidekickCommandExecutor.execute(["command": "sidekickdm_add_participant_group", "name": "Test", "level": 5, "quantity": 2, "expected_revision": 1], in: store)
        XCTAssertEqual(store.budget.guaranteedXP, 80)
        try store.undo(expectedRevision: 2, origin: "gm")
        XCTAssertTrue(store.draft.participantGroups.isEmpty)
        try store.redo(expectedRevision: 3, origin: "gm")
        XCTAssertEqual(store.draft.participantGroups.count, 1)
        try store.undo(expectedRevision: 4, origin: "gm")
        try SidekickCommandExecutor.execute(["command": "sidekickdm_set_threat_target", "kind": "low", "expected_revision": 5], in: store)
        XCTAssertThrowsError(try store.redo(expectedRevision: 6, origin: "gm")) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "nothing_to_redo")
        }
    }
}
