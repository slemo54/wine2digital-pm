## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-02-28 - [AutosizeTextarea for Modal Descriptions]
**Learning:** Using a single-line `Input` for description or notes fields in modals severely limits multi-line readability and editing. Replacing it with the existing `AutosizeTextarea` component provides a significantly better micro-UX editing experience without breaking modal layout constraints.
**Action:** Prefer `AutosizeTextarea` over standard `Input` for any modal field likely to contain multiple lines of text, such as descriptions or notes.

## 2026-03-01 - [Keyboard Accessibility for Interactive Cards]
**Learning:** When making container elements (like TaskCards) interactive via keyboard, simply adding an `onClick` or `onKeyDown` handler is not enough. Explicitly adding `tabIndex={0}` and visual focus indicators (e.g., `focus-visible:ring-2`) is essential for keyboard-only users to discover and interact with the element. Furthermore, using `e.target === e.currentTarget` in the handler prevents accidental activation when interacting with nested buttons or menus.
**Action:** Always include `tabIndex={0}`, focus styles, and target validation when adding keyboard support to container-style interactive components.
