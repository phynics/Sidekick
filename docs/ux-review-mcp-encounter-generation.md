# MCP encounter generation UX review

## Scope

This review covers the 3 minute 44 second recording of an agent creating **The Coins District Shakedown**. The request was a moderate mugging encounter in Absalom for a level-3 party.

The generated encounter is mechanically valid and complete. The interface does not explain the work well while it happens. The app shows live-combat controls before the encounter is ready, hides most authored content, and gives revision numbers more attention than user-facing progress.

## What the recording shows

- At 00:15, the new encounter replaces the prior encounter while **Run** remains selected. The screen contains four heroes with no HP, no statistics, and no useful actions.
- At 01:00, a large banner reports an active Generation Run and a raw run ID. The banner says that reading remains available, but the main workspace tabs appear disabled.
- At 01:30, four Orc Veterans appear at once. The selected sheet jumps from **Hero 1** to **Orc Veteran A**.
- From 01:30 to 02:45, the agent authors seven packet sections. The main workspace does not show this progress. Only the revision and readiness pill change.
- At 02:45, the encounter becomes ready, but the app still presents it as a live encounter.
- Near 03:15, the view changes to **Build**. This is the first screen that clearly communicates the moderate 80 XP composition.
- Near 03:30, the Sidekick drawer lists completed mutations. The drawer covers the budget rail and shows internal revisions instead of a useful summary of each change.

## Priority improvements

### P0. Keep encounter generation out of Run

Creating an encounter must open **Build** or a dedicated generation view. **Run** must begin only after the user selects **Start encounter**.

Do not create hero combatants, initiative fields, HP controls, or a combat log during generation. Preserve any existing live session until the user explicitly replaces or ends it.

Acceptance criteria:

- `sidekickdm_create_encounter` changes the active mode to **Build**.
- Generation never creates or resets a live run session.
- **Start encounter** creates the individual combatants after generation finishes.
- Returning to an existing live session preserves initiative, HP, conditions, and the log.

### P0. Show user-facing generation progress

Replace the static lock banner with a compact progress panel. Use product language, not protocol identifiers.

Suggested stages:

1. Framing the encounter
2. Checking the XP budget
3. Choosing opposition
4. Writing run guidance
5. Reviewing and saving

Show the current stage, completed stages, the latest meaningful change, and a cancel control. Keep the encounter title, party, threat, and XP visible throughout.

Do not display `run_c8231fe0-...` in the primary interface. Keep the ID in diagnostics.

### P0. Make authored content visible while it changes

The agent spends most of the run writing the setup, battlefield, tactics, information, and outcomes. None of that content appears in the main workspace.

Add a generation preview beside the creature composition. Each section should expand when the agent updates it and settle back after a short highlight. Preserve the user's scroll position. Do not replace the whole page after each revision.

At minimum, show:

- premise and objective;
- read-aloud text;
- battlefield features;
- opening tactics and morale;
- success, surrender, retreat, and escape outcomes.

### P1. Limit locks to the content being changed

The current Generation Run disables most of the application. The user cannot inspect the Library or switch workspaces even though the banner says reading remains available.

Keep navigation, packet inspection, catalog inspection, and export available. Disable only conflicting edits. Add **Cancel generation** and **Pause after this step** controls.

### P1. Replace page jumps with targeted updates

The roster changes from four empty heroes to eight combatants, and the selected sheet changes without user input. The jump makes the agent feel as if it took control of the table.

During generation:

- add a creature group to the Build roster, not four live combatants;
- preserve the selected object;
- animate the changed group with a 2 px lift and a 200 to 300 ms fade;
- announce the change in the Sidekick panel;
- avoid full-page rerenders.

### P1. Keep the Sidekick panel from covering encounter data

The final drawer covers the budget rail. In a split view, this removes the main proof that the encounter meets the requested difficulty.

Use one of these layouts:

- reserve space for a 320 px side panel;
- place the agent timeline below the budget on narrow widths;
- use a bottom sheet when the app has less than 1100 px of width.

The panel should never cover the threat, XP budget, primary actions, or current creature statistics.

### P1. Summarize changes in game terms

The final activity list says **Updated Encounter outcomes** and **webmcp · revision 43**. This proves that a mutation happened but does not tell the GM what changed.

Use summaries such as:

- Added four Orc Veterans, 80 XP total.
- Added a watch-bell countdown and two escape routes.
- Set morale: the gang flees after two members fall.
- Added negotiation, surrender, retreat, and escape outcomes.

Group the seven packet mutations under one item named **Wrote encounter guidance**. Keep revision numbers in an expandable diagnostic row.

### P1. End with a review decision

The flow finishes by switching to Build and opening the Sidekick drawer. The user does not receive a clear review step or save confirmation.

Show a completion card with:

- **Moderate, 80 of 80 XP**;
- four level-1 opponents;
- no structural errors or design warnings;
- assumptions, including the four-person party;
- **Review packet**, **Save encounter**, and **Start encounter** actions.

After saving, show **Saved to Library** with a link to the saved encounter.

### P2. Give catalog creatures encounter aliases

Four entries named **Orc Veteran A** through **D** satisfy the budget but do little to sell a mugging in Absalom. Keep the catalog statistics and provenance, but allow encounter-only display names and roles.

For example:

- Knife-Captain Rusk;
- Lookout;
- Alley Bruiser;
- Rear Guard.

The encounter sheet can still identify each entry as an Orc Veteran in its provenance details.

### P2. Handle missing hero data quietly

The Run view gives most of its left rail and selected sheet to heroes with no HP or statistics. Until the GM adds party combat data, represent the party as one compact group row or hide unavailable statistics.

Use a single prompt: **Add hero HP and initiative when you start the encounter.**

## Recommended target flow

1. The user asks the agent to create an encounter.
2. Sidekick opens **Build** and shows the request as a compact brief. Assumptions appear as editable chips.
3. The agent fills the budget, opposition, and packet in visible stages. Only the current target receives a subtle highlight.
4. Sidekick presents one review card with the composition, budget, warnings, and authored guidance.
5. The user saves the encounter or starts it. Only **Start encounter** creates the live combatants and opens **Run**.

## Suggested implementation order

1. Separate generation mode from the live run-session lifecycle.
2. Route new MCP encounters to Build.
3. Add the generation progress and review panels.
4. Render packet changes in the Build workspace.
5. Make the Sidekick panel responsive and replace revision-only activity text.
6. Add encounter aliases and the compact missing-party-data state.

This order fixes the misleading workflow before refining presentation. The current colors, typography, creature list, and budget card can remain. The next pass should spend its effort on state, feedback, and transitions.
