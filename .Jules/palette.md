## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-02-28 - [AutosizeTextarea for Modal Descriptions]
**Learning:** Using a single-line `Input` for description or notes fields in modals severely limits multi-line readability and editing. Replacing it with the existing `AutosizeTextarea` component provides a significantly better micro-UX editing experience without breaking modal layout constraints.
**Action:** Prefer `AutosizeTextarea` over standard `Input` for any modal field likely to contain multiple lines of text, such as descriptions or notes.

## 2026-03-05 - [Keyboard Accessibility for Interactive Cards]
**Learning:** When making a container (like a TaskCard) keyboard-accessible using `tabIndex={0}` and an `onKeyDown` handler, it's critical to use `e.target === e.currentTarget` check. This prevents the card's primary action (e.g., opening a modal) from firing when the user is actually interacting with nested buttons or menus inside the card.
**Action:** Always use the `target === currentTarget` pattern in card `onKeyDown` handlers to ensure that keyboard interactions with inner elements don't inadvertently trigger the card-level action.
