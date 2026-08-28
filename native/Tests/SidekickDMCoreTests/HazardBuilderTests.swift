import XCTest
@testable import SidekickDMCore

final class HazardBuilderTests: XCTestCase {
    private func validHazard(complexity: HazardComplexity = .simple) -> SimpleHazard {
        SimpleHazard(
            identity: HazardIdentity(name: "Mire Bell Snare", level: 4, type: .trap, complexity: complexity, traits: ["mechanical"]),
            description: "A submerged chain catches a creature crossing the shrine floor.",
            detection: HazardDetection(kind: "stealth_dc", band: .high, value: 22, minimumProficiency: "trained"),
            disableMethods: [HazardDisableMethod(skill: "Thievery", dc: 20, requirements: "thieves' tools")],
            defenses: HazardDefenses(ac: 21, hardness: 11, hp: 48),
            trigger: "A creature crosses the submerged chain.",
            effect: HazardEffect(resolution: HazardResolution(type: "save", save: "reflex", dc: HazardStatistic(band: .high, value: 22)), damage: [HazardDamage(expression: "2d8", type: "bludgeoning")], conditions: ["prone"], text: "The chain snaps tight and knocks the creature prone."),
            reset: "A creature can reset the chain in 10 minutes."
        )
    }

    func testHazardBenchmarksMatchGoldenFixture() {
        let benchmark = HazardBuilder.benchmarks(level: 4)
        XCTAssertEqual(benchmark?.stealth[.high]?.minimum, 22)
        XCTAssertEqual(benchmark?.disableDC[.low]?.minimum, 17)
        XCTAssertEqual(benchmark?.hardness, HazardBenchmarkRange(minimum: 11, maximum: 13))
        XCTAssertEqual(benchmark?.hitPoints, HazardBenchmarkRange(minimum: 46, maximum: 50))
    }

    func testMissingMechanicsBlockButBenchmarkDeviationOnlyWarns() {
        var hazard = validHazard()
        hazard.detection.value = 99
        let warning = HazardBuilder.validate(hazard)
        XCTAssertTrue(warning.structuralErrors.isEmpty)
        XCTAssertEqual(warning.status, "ready_with_warnings")
        XCTAssertTrue(warning.benchmarkDeviations.contains { $0.statistic == "detection.value" })

        hazard.trigger = ""
        let incomplete = HazardBuilder.validate(hazard)
        XCTAssertTrue(incomplete.structuralErrors.contains { $0.field == "trigger" })
        XCTAssertEqual(incomplete.status, "incomplete")
    }

    func testCustomComplexHazardRejectedAndExistingComplexRepresented() throws {
        XCTAssertThrowsError(try HazardBuilder.create(validHazard(complexity: .complex))) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "unsupported_complex_hazard_generation")
        }
        let catalog = CatalogFixture.demo()
        guard case .hazard(let quicksand)? = catalog.get("hazard/gm-core/quicksand/current") else { return XCTFail("Missing complex fixture") }
        let existing = ExistingComplexHazard(catalogHazard: quicksand)
        XCTAssertEqual(existing.identity.complexity, .complex)
        XCTAssertEqual(existing.routine, "Pull creatures down on its initiative.")
    }

    func testPlacementUsesParticipationCategoriesAndRevisionedUndoPersistence() throws {
        let draft = EncounterDraft(brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 4, size: 4)))
        let store = HazardCompositionStore(draft: draft)
        let hazard = validHazard()
        try store.add(.simple(hazard), participation: Participation(mode: .mandatory), placement: "At the shrine entrance")
        XCTAssertEqual(store.budget.guaranteedXP, 8)
        XCTAssertEqual(store.draft.revision, 1)
        XCTAssertTrue(store.canUndo)

        let persisted = store.encodedState
        try store.undo(expectedRevision: 1)
        XCTAssertTrue(store.draft.hazards.isEmpty)
        try store.redo(expectedRevision: 2)
        XCTAssertEqual(store.budget.guaranteedXP, 8)

        let reloaded = HazardCompositionStore()
        try reloaded.restore(persisted)
        XCTAssertEqual(reloaded.draft.hazards.count, 1)
        XCTAssertEqual(reloaded.hazards.count, 1)
        XCTAssertEqual(reloaded.draft.hazards.first?.placement, "At the shrine entrance")
    }

    func testSharedCommandCreatesSimpleHazardAtomicallyAndRejectsComplex() throws {
        let payload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(validHazard())) as? [String: Any])
        let store = EncounterStore(draft: EncounterDraft(brief: EncounterBrief(party: PartySnapshot(effectiveLevel: 4, size: 4))))
        try SidekickCommandExecutor.execute(["command": "sidekickdm_create_simple_hazard", "hazard": payload, "participation_mode": "mandatory", "placement": "Shrine entrance", "expected_revision": 0, "origin": "gm"], in: store)
        XCTAssertEqual(store.draft.revision, 1)
        XCTAssertEqual(store.draft.customHazards?.first?.provenance.origin, "original")
        XCTAssertEqual(store.draft.hazards.first?.placement, "Shrine entrance")
        XCTAssertEqual(store.budget.guaranteedXP, 8)

        var complex = validHazard(complexity: .complex)
        complex.id = "haz_complex"
        let complexPayload = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(complex)) as? [String: Any])
        XCTAssertThrowsError(try SidekickCommandExecutor.execute(["command": "sidekickdm_create_simple_hazard", "hazard": complexPayload, "expected_revision": 1], in: store)) { error in
            XCTAssertEqual((error as? SidekickDomainError)?.code, "unsupported_complex_hazard_generation")
        }
        XCTAssertEqual(store.draft.revision, 1)
        XCTAssertEqual(store.draft.hazards.count, 1)
    }
}
