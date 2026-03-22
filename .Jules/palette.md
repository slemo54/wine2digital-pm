## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-02-28 - [AutosizeTextarea for Modal Descriptions]
**Learning:** Using a single-line `Input` for description or notes fields in modals severely limits multi-line readability and editing. Replacing it with the existing `AutosizeTextarea` component provides a significantly better micro-UX editing experience without breaking modal layout constraints.
**Action:** Prefer `AutosizeTextarea` over standard `Input` for any modal field likely to contain multiple lines of text, such as descriptions or notes.

## 2025-05-15 - [Global TooltipProvider Pattern]
**Learning:** Moving the `TooltipProvider` to the global `Providers` component ensures that all tooltips across the application share a consistent `delayDuration` and eliminates the need for redundant local providers. This reduces code duplication and prevents subtle UX inconsistencies where tooltips might behave differently on different pages.
**Action:** Always implement `TooltipProvider` at the root of the application. Remove local instances to maintain a single source of truth for tooltip configuration.
