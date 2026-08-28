import XCTest
@testable import SidekickDMCore

final class CreatureGenerationTests: XCTestCase {
    private func catalogCreature(completeness: CatalogCompleteness = .complete, support: CatalogSupport = .supported) -> CatalogCreature {
        let summary = CatalogEntrySummary(
            contentID: "creature/test/spellcaster/current",
            kind: .creature,
            name: "Bell Adept",
            level: 5,
            traits: ["humanoid", "occult"],
            rarity: "uncommon",
            source: "Test Source",
            roles: [.controller],
            spellcasting: true,
            completeness: completeness,
            support: support,
            summary: "A ritualist who shapes the battlefield."
        )
        return CatalogCreature(
            summary: summary,
            concept: "A drowned ritualist",
            size: "medium",
            perception: 13,
            senses: ["darkvision"],
            languages: ["Common"],
            skills: ["Occultism": 15],
            defenses: ["ac": 22, "fortitude": 13, "reflex": 12, "will": 16, "hp": 65],
            speeds: ["land": 25],
            strikes: [CatalogStrike(name: "Staff", attack: 15, damage: "2d6+5", traits: ["magical"])],
            abilities: [CatalogAbility(name: "Dissonant hymn", actionCost: "2", traits: ["auditory"], text: "The hymn unsettles nearby creatures.")],
            spellcastingBlocks: ["Occult innate spells", "Cantrip: daze"],
            tactics: "Keep distance and control the approach.",
            morale: "Flees when the bell is silenced.",
            provenance: CatalogProvenance(sourceTitle: "Test Source", upstreamPack: "test", upstreamIdentifier: "bell-adept", sourceSHA256: String(repeating: "0", count: 64))
        )
    }

    func testValidationIsReadOnlyAndReportsBenchmarkAndHolisticSignals() throws {
        let creature = try CreatureGeneration.fork(catalogCreature(), id: "cre_validation")
        let before = creature
        let result = CreatureGeneration.validate(creature)

        XCTAssertTrue(result.structuralErrors.isEmpty)
        XCTAssertFalse(result.benchmarkDeviations.isEmpty)
        XCTAssertTrue(result.holisticWarnings.contains { $0.code == "benchmark_deviation" })
        XCTAssertEqual(creature, before)
    }

    func testForkPreservesCatalogProvenanceAndSpellcastingBlocks() throws {
        let fork = try CreatureGeneration.fork(catalogCreature(), id: "cre_fork", createdAt: "2026-08-28T00:00:00Z")

        XCTAssertEqual(fork.id, "cre_fork")
        XCTAssertEqual(fork.provenance.origin, "forked")
        XCTAssertEqual(fork.provenance.basedOnContentID, "creature/test/spellcaster/current")
        XCTAssertEqual(fork.provenance.createdAt, "2026-08-28T00:00:00Z")
        XCTAssertEqual(fork.spellcastingStatus, "preserved_existing")
        XCTAssertEqual(fork.spellcastingBlocks, ["Occult innate spells", "Cantrip: daze"])
        XCTAssertEqual(fork.abilities.first?.actionCost, 2)
    }

    func testForkRejectsPartialCatalogAndCommitRejectsStructuralErrors() {
        XCTAssertThrowsError(try CreatureGeneration.fork(catalogCreature(completeness: .partial))) { error in
            XCTAssertEqual(error as? CreatureGenerationError, .catalogEntryPartial)
        }

        let invalid = OriginalCreature(name: "Incomplete", level: 1)
        XCTAssertThrowsError(try CreatureGeneration.commit(invalid)) { error in
            guard case .structural(let issues) = error as? CreatureGenerationError else {
                return XCTFail("Expected semantic structural error")
            }
            XCTAssertTrue(issues.contains { $0.field == "identity.concept" })
        }
    }
}
