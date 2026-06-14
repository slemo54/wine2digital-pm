## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-02-28 - [AutosizeTextarea for Modal Descriptions]
**Learning:** Using a single-line `Input` for description or notes fields in modals severely limits multi-line readability and editing. Replacing it with the existing `AutosizeTextarea` component provides a significantly better micro-UX editing experience without breaking modal layout constraints.
**Action:** Prefer `AutosizeTextarea` over standard `Input` for any modal field likely to contain multiple lines of text, such as descriptions or notes.

## 2026-03-29 - [Clear Button for Search Inputs]
**Learning:** Adding a conditional "Clear" button to search inputs provides a standard and intuitive way for users to reset their search state. This is especially helpful in data-heavy views like project task lists or admin logs.
**Action:** Implement a relative container with `Search` (left) and `X` (right) icons, ensuring the clear button is only visible when the search query is not empty.
