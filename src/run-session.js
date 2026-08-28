function clone(value) { return structuredClone(value); }
function number(value, fallback = null) {
  const candidate = typeof value === "object" && value !== null ? value.value : value;
  const result = Number(candidate);
  return Number.isFinite(result) ? result : fallback;
}
function array(value) { return Array.isArray(value) ? value : []; }
function creatureName(creature, fallback) { return creature?.identity?.name ?? creature?.name ?? fallback; }

function creatureForGroup(group, encounter, resolveCreature) {
  const contentID = group.contentID ?? group.content_id ?? "";
  const custom = array(encounter.originalCreatures ?? encounter.original_creatures).find(creature => contentID.includes(`/${creature.id}/`) || creature.id === contentID);
  if (custom) return custom;
  const embedded = array(encounter.embeddedCatalogEntries ?? encounter.embedded_catalog_entries).find(entry => (entry.contentID ?? entry.content_id) === contentID);
  return embedded ?? resolveCreature?.(contentID) ?? null;
}

function liveDetail(creature) { return creature?.detail ?? creature ?? {}; }

function letter(index) {
  if (index < 26) return String.fromCharCode(65 + index);
  return String(index + 1);
}

function createHero(index) {
  return {
    id: `hero_${index + 1}`,
    kind: "hero",
    groupID: null,
    sourceContentID: null,
    name: `Hero ${index + 1}`,
    initiative: null,
    currentHP: null,
    maxHP: null,
    conditions: [],
    detail: null
  };
}

function createCreatureCombatant(group, encounter, index, resolveCreature) {
  const creature = creatureForGroup(group, encounter, resolveCreature);
  const detail = liveDetail(creature);
  const quantity = Math.max(1, Number(group.quantity) || 1);
  const baseName = creatureName(creature, group.name ?? "Creature");
  const maxHP = number(detail.defenses?.hp, null);
  return {
    id: `${group.id}_${index + 1}`,
    kind: "creature",
    groupID: group.id,
    sourceContentID: group.contentID ?? group.content_id ?? null,
    name: quantity > 1 ? `${baseName} ${letter(index)}` : baseName,
    initiative: null,
    currentHP: maxHP,
    maxHP,
    conditions: [],
    adjustment: group.adjustment ?? "normal",
    level: Number(group.level ?? creature?.level ?? creature?.identity?.level ?? 0),
    detail: clone(detail)
  };
}

export function createRunSession({ encounter, resolveCreature = null, now = new Date().toISOString() } = {}) {
  if (!encounter?.id) throw new Error("An Encounter with an id is required to start a run.");
  const partySize = Math.max(0, Number(encounter.brief?.party?.size ?? 0) || 0);
  const heroes = Array.from({ length: partySize }, (_, index) => createHero(index));
  const creatures = array(encounter.participantGroups ?? encounter.participant_groups).flatMap(group => {
    const quantity = Math.max(1, Number(group.quantity) || 1);
    return Array.from({ length: quantity }, (_, index) => createCreatureCombatant(group, encounter, index, resolveCreature));
  });
  return {
    format: "sidekickdm-run-session",
    formatVersion: 1,
    id: `run_${encounter.id}`,
    encounterID: encounter.id,
    encounterRevision: Number(encounter.revision ?? 0),
    encounterTitle: encounter.title ?? "Untitled encounter",
    revision: 0,
    round: 1,
    activeCombatantID: null,
    selectedCombatantID: creatures[0]?.id ?? heroes[0]?.id ?? null,
    lastTargetID: null,
    startedAt: now,
    endedAt: null,
    combatants: [...heroes, ...creatures],
    log: []
  };
}

function orderedCombatants(session) {
  return session.combatants
    .map((combatant, index) => ({ combatant, index }))
    .filter(({ combatant }) => Number.isFinite(combatant.initiative))
    .sort((left, right) => right.combatant.initiative - left.combatant.initiative || left.index - right.index)
    .map(({ combatant }) => combatant);
}

function updateCombatant(session, combatantID, change) {
  if (!session.combatants.some(item => item.id === combatantID)) throw new Error(`Unknown combatant ${combatantID}.`);
  session.combatants = session.combatants.map(item => item.id === combatantID ? change(item) : item);
}

function appendLog(session, entry) {
  session.log.push({ id: `log_${session.revision + 1}_${session.log.length + 1}`, round: session.round, ...entry });
}

export function rollDice(expression, random = Math.random) {
  const match = /^\s*(\d{1,3})d(\d{1,4})(?:\s*([+-])\s*(\d+))?\s*$/i.exec(String(expression ?? ""));
  if (!match) throw new Error("Enter a dice expression such as 1d20+7 or 2d8+4.");
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (count < 1 || count > 100 || sides < 2) throw new Error("The dice expression is outside the supported range.");
  const modifier = match[4] ? Number(match[4]) * (match[3] === "-" ? -1 : 1) : 0;
  const rolls = Array.from({ length: count }, () => Math.floor(Math.min(0.999999999, Math.max(0, Number(random())) || 0) * sides) + 1);
  return { expression: `${count}d${sides}${modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : modifier}`, rolls, modifier, total: rolls.reduce((sum, value) => sum + value, modifier) };
}

export function applyRunAction(value, action, { random = Math.random } = {}) {
  const session = clone(value);
  if (!session || session.format !== "sidekickdm-run-session") throw new Error("A Sidekick DM run session is required.");
  const amount = Math.max(0, Number(action.amount) || 0);
  switch (action.type) {
    case "select":
      updateCombatant(session, action.combatantID, item => item);
      session.selectedCombatantID = action.combatantID;
      break;
    case "set_initiative":
      updateCombatant(session, action.combatantID, item => ({ ...item, initiative: action.value === "" || action.value == null ? null : Number(action.value) }));
      session.lastTargetID = action.combatantID;
      appendLog(session, { kind: "initiative", targetID: action.combatantID, value: action.value === "" ? null : Number(action.value) });
      break;
    case "next_turn": {
      const order = orderedCombatants(session);
      if (!order.length) break;
      const index = order.findIndex(item => item.id === session.activeCombatantID);
      const nextIndex = index < 0 ? 0 : (index + 1) % order.length;
      if (index >= 0 && nextIndex === 0) session.round += 1;
      session.activeCombatantID = order[nextIndex].id;
      session.selectedCombatantID = order[nextIndex].id;
      session.lastTargetID = order[nextIndex].id;
      appendLog(session, { kind: "turn", targetID: order[nextIndex].id, direction: "next" });
      break;
    }
    case "previous_turn": {
      const order = orderedCombatants(session);
      if (!order.length) break;
      const index = order.findIndex(item => item.id === session.activeCombatantID);
      const nextIndex = index < 0 ? 0 : (index - 1 + order.length) % order.length;
      if (index === 0 && session.round > 1) session.round -= 1;
      session.activeCombatantID = order[nextIndex].id;
      session.selectedCombatantID = order[nextIndex].id;
      session.lastTargetID = order[nextIndex].id;
      appendLog(session, { kind: "turn", targetID: order[nextIndex].id, direction: "previous" });
      break;
    }
    case "apply_damage":
      updateCombatant(session, action.combatantID, item => ({ ...item, currentHP: item.currentHP == null ? 0 : Math.max(0, item.currentHP - amount) }));
      session.lastTargetID = action.combatantID;
      appendLog(session, { kind: "damage", targetID: action.combatantID, amount });
      break;
    case "apply_healing":
      updateCombatant(session, action.combatantID, item => ({ ...item, currentHP: item.currentHP == null ? amount : Math.min(item.maxHP ?? Infinity, item.currentHP + amount) }));
      session.lastTargetID = action.combatantID;
      appendLog(session, { kind: "healing", targetID: action.combatantID, amount });
      break;
    case "set_hp":
      updateCombatant(session, action.combatantID, item => ({ ...item, currentHP: Math.max(0, Math.min(item.maxHP ?? Infinity, Number(action.value) || 0)) }));
      session.lastTargetID = action.combatantID;
      appendLog(session, { kind: "hp", targetID: action.combatantID, value: Number(action.value) || 0 });
      break;
    case "add_condition": {
      const condition = String(action.name ?? "").trim().toLowerCase();
      if (!condition) throw new Error("A condition name is required.");
      const conditionValue = action.value === "" || action.value == null ? null : Number(action.value);
      updateCombatant(session, action.combatantID, item => ({ ...item, conditions: [...item.conditions.filter(entry => entry.name !== condition), { name: condition, value: Number.isFinite(conditionValue) ? conditionValue : null }] }));
      session.lastTargetID = action.combatantID;
      appendLog(session, { kind: "condition", targetID: action.combatantID, condition, value: conditionValue, operation: "add" });
      break;
    }
    case "remove_condition": {
      const condition = String(action.name ?? "").trim().toLowerCase();
      updateCombatant(session, action.combatantID, item => ({ ...item, conditions: item.conditions.filter(entry => entry.name !== condition) }));
      session.lastTargetID = action.combatantID;
      appendLog(session, { kind: "condition", targetID: action.combatantID, condition, operation: "remove" });
      break;
    }
    case "roll": {
      const result = rollDice(action.expression, random);
      session.lastTargetID = action.combatantID ?? null;
      appendLog(session, { kind: "roll", targetID: action.combatantID ?? null, label: action.label ?? result.expression, ...result });
      break;
    }
    case "end":
      session.endedAt = action.at ?? new Date().toISOString();
      appendLog(session, { kind: "end" });
      break;
    default:
      throw new Error(`Unknown run action ${action.type}.`);
  }
  session.revision += 1;
  return session;
}

export function projectRunSession(session) {
  if (!session) return null;
  return clone({
    run_id: session.id,
    encounter_id: session.encounterID,
    encounter_revision: session.encounterRevision,
    revision: session.revision,
    round: session.round,
    active_combatant_id: session.activeCombatantID,
    selected_combatant_id: session.selectedCombatantID,
    ended_at: session.endedAt,
    combatants: session.combatants.map(item => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      initiative: item.initiative,
      current_hp: item.currentHP,
      max_hp: item.maxHP,
      conditions: clone(item.conditions)
    })),
    recent_log: session.log.slice(-20).map(clone)
  });
}
