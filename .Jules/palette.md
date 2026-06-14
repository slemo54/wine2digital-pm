## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-02-28 - [AutosizeTextarea for Modal Descriptions]
**Learning:** Using a single-line `Input` for description or notes fields in modals severely limits multi-line readability and editing. Replacing it with the existing `AutosizeTextarea` component provides a significantly better micro-UX editing experience without breaking modal layout constraints.
**Action:** Prefer `AutosizeTextarea` over standard `Input` for any modal field likely to contain multiple lines of text, such as descriptions or notes.

## 2026-03-05 - [Keyboard Accessibility on Sortable Dnd-Kit Cards]
**Learning:** Adding keyboard accessibility to `dnd-kit` sortable cards requires special care to ensure the `Enter` key behavior (e.g. opening a detail modal) does not conflict with `dnd-kit` sorting actions, nor does it inadvertently trigger when inner interactive elements (like a dropdown) are focused. Checking `e.target === e.currentTarget` ensures that the card's native Enter action is isolated.
**Action:** When making `dnd-kit` elements focusable via `tabIndex={0}`, always explicitly check `e.target === e.currentTarget` in `onKeyDown` handlers to prevent unintended activations from child components.
