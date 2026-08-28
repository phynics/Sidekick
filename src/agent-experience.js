export function runSessionMatchesEncounter(session, encounter) {
  return Boolean(session)
    && session.encounterID === encounter?.id
    && session.encounterRevision === Number(encounter?.revision ?? 0);
}

export function generationCancellationCommand(draft, generation) {
  return {
    command: "sidekickdm_cancel_generation",
    generation_run_id: generation?.id,
    expected_revision: Number(draft?.revision ?? 0),
    origin: "agent"
  };
}

export function generationProgress(draft, readiness = {}) {
  const packet = draft?.packetV1 ?? draft?.packet_v1 ?? draft?.packet ?? {};
  const setup = packet.setup ?? {};
  const running = packet.runningGuidance ?? packet.running_guidance ?? {};
  const outcomes = packet.outcomes ?? {};
  const has = value => Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? "").trim());
  const steps = [
    { label: "Brief", complete: has(draft?.brief?.creative?.premise) || has(packet.identity?.premise) },
    { label: "Opposition", complete: (draft?.participantGroups?.length ?? 0) > 0 },
    { label: "Run guidance", complete: has(setup.readAloud ?? setup.read_aloud) && has(running.openingTactics ?? running.opening_tactics) },
    { label: "Review", complete: readiness?.status === "ready" || readiness?.status === "complete" }
  ];
  const completed = steps.filter(step => step.complete).length;
  return { steps, completed, current: steps.find(step => !step.complete)?.label ?? "Ready to review", percent: Math.round(completed / steps.length * 100), outcomesReady: has(outcomes.victory) };
}

export function summarizeAgentCommand(command = {}, draft = {}, group = null, budget = {}) {
  const name = group?.name ?? command?.creature?.identity?.name ?? draft?.title ?? "encounter";
  const quantity = Number(group?.quantity ?? command?.quantity ?? 1);
  const summaries = {
    sidekickdm_create_encounter: `Started ${draft?.title ?? "a new encounter"}`,
    sidekickdm_begin_generation: "Started encounter generation",
    sidekickdm_set_creative_brief: "Framed the premise and tone",
    sidekickdm_update_creative_brief: "Refined the premise, place, and tone",
    sidekickdm_add_existing_participant_group: `Added ${quantity} × ${name}`,
    sidekickdm_set_packet_identity: "Wrote the objective and stakes",
    sidekickdm_set_encounter_identity: "Wrote the objective and stakes",
    sidekickdm_set_setup: "Added the opening scene",
    sidekickdm_set_battlefield: "Added battlefield features",
    sidekickdm_set_battlefield_guidance: "Added battlefield features",
    sidekickdm_set_running_guidance: "Added tactics and morale",
    sidekickdm_set_cohesion: "Connected the opposition to the scene",
    sidekickdm_set_information: "Added clues and GM information",
    sidekickdm_set_information_visibility: "Added clues and GM information",
    sidekickdm_set_outcomes: "Added encounter outcomes",
    sidekickdm_finish_generation: "Encounter ready to review",
    sidekickdm_cancel_generation: "Stopped encounter generation"
  };
  const description = summaries[command.command] ?? `Updated ${name}`;
  const detail = command.command === "sidekickdm_add_existing_participant_group" && budget?.constructionBudget != null
    ? `${budget.peakActiveXP ?? 0} of ${budget.constructionBudget} XP`
    : null;
  return { description, detail };
}
