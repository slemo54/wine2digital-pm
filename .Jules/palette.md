## 2026-02-27 - [Contextual CTAs in Empty States]
**Learning:** Adding a "Request for this day" button in the empty state of the daily absence details view significantly improves the user flow. It transforms a dead-end into a productive interaction by pre-filling the absence request form with the selected date.
**Action:** Look for similar "dead-end" empty states in detail panels (e.g., project tasks, comments) and provide contextual actions that pre-fill relevant data.

## 2026-03-13 - [AutosizeTextarea for Descriptions]
**Learning:** Standard text inputs (`<Input />`) are often insufficient for "Description" fields where users may enter multi-line text. Replacing them with an `AutosizeTextarea` improves the UX by providing better visibility of the content as it grows, without requiring manual resizing or taking up excessive initial space.
**Action:** Always prefer `AutosizeTextarea` for any "Description", "Notes", or "Comments" fields in forms.
