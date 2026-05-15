## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-02-28 - [AutosizeTextarea for Modal Descriptions]
**Learning:** Using a single-line `Input` for description or notes fields in modals severely limits multi-line readability and editing. Replacing it with the existing `AutosizeTextarea` component provides a significantly better micro-UX editing experience without breaking modal layout constraints.
**Action:** Prefer `AutosizeTextarea` over standard `Input` for any modal field likely to contain multiple lines of text, such as descriptions or notes.

## 2026-03-01 - [Standard Tooltip Pattern for Icon Buttons]
**Learning:** Icon-only buttons should always have a visible tooltip on hover to provide textual context for the action, while maintaining a clean UI. Wrapping the `Button` in `TooltipTrigger` (with `asChild`) and placing it inside a `Tooltip` alongside `TooltipContent` is the standard pattern for this application. To avoid wrapping every page in `TooltipProvider`, it should be placed in the root `Providers` component.
**Action:** Use the `Tooltip` component for all icon-only buttons. Ensure the `TooltipProvider` is present at the root of the application.
