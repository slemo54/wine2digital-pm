## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-02-28 - [AutosizeTextarea for Modal Descriptions]
**Learning:** Using a single-line `Input` for description or notes fields in modals severely limits multi-line readability and editing. Replacing it with the existing `AutosizeTextarea` component provides a significantly better micro-UX editing experience without breaking modal layout constraints.
**Action:** Prefer `AutosizeTextarea` over standard `Input` for any modal field likely to contain multiple lines of text, such as descriptions or notes.

## 2026-03-28 - [Global TooltipProvider and Safe Access]
**Learning:** Enabling `TooltipProvider` globally in the root `Providers` component significantly reduces boilerplate and encourages the use of tooltips for better accessibility. However, when adding new UI elements to data-heavy pages like the Dashboard, it is critical to use safe accessor variables (e.g., `notificationsList.length` instead of `notifications.length`) to prevent `TypeError` during initial async data loading.
**Action:** Ensure all root-level providers are correctly configured to support micro-UX components app-wide, and always verify that conditional UI handles `undefined` data states gracefully.
