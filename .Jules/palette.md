## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-02-28 - [AutosizeTextarea for Modal Descriptions]
**Learning:** Using a single-line `Input` for description or notes fields in modals severely limits multi-line readability and editing. Replacing it with the existing `AutosizeTextarea` component provides a significantly better micro-UX editing experience without breaking modal layout constraints.
**Action:** Prefer `AutosizeTextarea` over standard `Input` for any modal field likely to contain multiple lines of text, such as descriptions or notes.

## 2026-03-03 - [Unified Design System Select]
**Learning:** Using native `<select>` elements instead of the project's custom `<Select>` component (based on Radix UI) leads to visual inconsistency and misses out on built-in accessible styling and behaviors provided by the design system.
**Action:** Always audit for and replace native `<select>` elements with the `@/components/ui/select` components to ensure a unified UX and better keyboard/screen-reader accessibility.
