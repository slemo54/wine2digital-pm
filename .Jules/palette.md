## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-03-01 - [AutosizeTextarea for Descriptions]
**Learning:** Using a single-line `Input` for task descriptions in creation/edit dialogs restricts user input and visibility. Replacing them with `AutosizeTextarea` provides a much better experience for multi-line content while maintaining a compact initial layout.
**Action:** Prefer `AutosizeTextarea` over `Input` for fields likely to contain multi-line text (descriptions, notes) to improve readability and ease of editing.
