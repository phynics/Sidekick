import { projectCreatureXP } from "./creature-builder.js";
import { hazardXPForLevel } from "./encounter-phases.js?v=3";

export function participantDisplayName(group) {
  return group?.displayName ?? group?.display_name ?? group?.name ?? group?.contentID ?? group?.content_id ?? "Unnamed opposition";
}

export function projectEncounterParticipantSummary(record, catalog) {
  const partyLevel = Number(record?.brief?.party?.effectiveLevel ?? record?.brief?.party?.effective_level ?? 1);
  const groups = Array.isArray(record?.participantGroups) ? record.participantGroups : (Array.isArray(record?.participant_groups) ? record.participant_groups : []);
  const opposition = groups.filter(group => ["primary_opposition", "secondary_opposition"].includes(group.faction ?? "primary_opposition"));
  const embeddedCreatures = record?.originalCreatures ?? record?.original_creatures ?? [];
  const details = opposition.map(group => {
    const quantity = Math.max(1, Number(group.quantity ?? 1));
    const adjustmentName = group.adjustment ?? "normal";
    const adjustment = adjustmentName === "weak" ? -1 : adjustmentName === "elite" ? 1 : 0;
    const baseLevel = Number(group.level ?? partyLevel);
    const level = baseLevel + adjustment;
    const entry = catalog?.get?.(group.contentID ?? group.content_id);
    const contentID = String(group.contentID ?? group.content_id ?? "");
    const embedded = embeddedCreatures.find(creature => contentID.includes(`/${creature.id}/`));
    const traits = [...new Set([...(entry?.traits ?? []), ...(embedded?.identity?.traits ?? []), ...(group.traits ?? [])])].slice(0, 4);
    const xp = projectCreatureXP(level, partyLevel, quantity);
    return { group, quantity, baseLevel, level, adjustment: adjustmentName, traits, xp, name: participantDisplayName(group) };
  });
  const enemyCount = details.reduce((sum, detail) => sum + detail.quantity, 0);
  const hazardDetails = (record?.hazards ?? []).map(hazard => {
    const level = Number(hazard.level ?? partyLevel);
    const complexity = hazard.complexity ?? "simple";
    const xp = hazardXPForLevel(level, partyLevel, complexity);
    const participation = hazard.participation ?? {};
    return { hazard, name: hazard.name ?? hazard.contentID ?? hazard.content_id ?? "Unnamed hazard", level, complexity, xp, participation };
  });
  const hazardXP = hazardDetails.reduce((sum, detail) => sum + detail.xp, 0);
  const creatureXP = details.reduce((sum, detail) => sum + Number(detail.xp?.totalXP ?? 0), 0);
  const totalXP = creatureXP + hazardXP;
  const hazards = hazardDetails.map(detail => detail.name);
  const levels = [...new Set(details.map(detail => detail.level))].sort((a, b) => a - b);
  const allLevels = [...new Set([...levels, ...hazardDetails.map(detail => detail.level)])].sort((a, b) => a - b);
  return { partyLevel, details, enemyCount, creatureXP, hazardDetails, hazardCount: hazardDetails.length, hazardXP, totalXP, hazards, levels, allLevels };
}

export function encounterEnemyLabel(count) { return count === 1 ? "enemy" : "enemies"; }
export function encounterHazardLabel(count) { return count === 1 ? "hazard" : "hazards"; }
export function formatEncounterLevels(levels) {
  const ordered = [...new Set((levels ?? []).map(Number).filter(Number.isFinite))].sort((left, right) => left - right);
  if (!ordered.length) return "?";
  if (ordered.length === 1) return String(ordered[0]);
  return `${ordered[0]}–${ordered.at(-1)}`;
}
