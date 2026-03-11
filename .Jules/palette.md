## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-03-11 - [Keyboard Accessibility in Interactive Cards & DnD]
**Learning:** When adding keyboard navigation to cards that act as buttons (e.g., TaskCard) and contain inner interactive elements (e.g., dropdowns), it's crucial to check `e.target === e.currentTarget` in the `onKeyDown` handler. This prevents the card's primary action from firing when an inner element is activated via the Enter key. Additionally, if the card uses `dnd-kit`, avoid using the Space key for custom actions as it is reserved for dragging; use the Enter key instead.
**Action:** Use `if (e.key === "Enter" && e.target === e.currentTarget)` for card-level keyboard actions in components with nested interactivity or drag-and-drop support.
