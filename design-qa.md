# Clockify V2 — Design QA

## Artifacts

- Source visual truth:
  - `/Users/Anselmo/Downloads/Screenshot 2026-07-22 at 15.40.47.png` — timesheet, 2574 × 1306 px.
  - `/Users/Anselmo/Downloads/Screenshot 2026-07-22 at 14.48.46.png` — calendario, 2452 × 1274 px.
  - `/Users/Anselmo/Downloads/Screenshot 2026-07-22 at 14.50.06.png` — editor entry, 2816 × 1378 px.
  - `/Users/Anselmo/Downloads/Screenshot 2026-07-22 at 15.40.31.png` — Summary, 2560 × 1302 px.
- Browser-rendered implementation:
  - `.design-qa/timesheet-dark-1287x653-v2.png`
  - `.design-qa/calendar-dark-1226x637.png`
  - `.design-qa/entry-editor-dark-1408x689-v3.png`
  - `.design-qa/summary-dark-1280x651-viewport.png`
  - `.design-qa/timesheet-dark-mobile-390x844-v2.png`
  - `.design-qa/timesheet-light-tablet-834x1112-final.png`
  - `.design-qa/calendar-light-mobile-390x844.png`
- Combined comparison evidence:
  - `.design-qa/compare-timesheet-final.png`
  - `.design-qa/compare-calendar.png`
  - `.design-qa/compare-editor-final.png`
  - `.design-qa/compare-summary.png`
- Implementation URL: `http://127.0.0.1:4173/clockify/fixture`.
- State: deterministic development-only fixture, Europe/Rome, dark and light themes, no OAuth.

## Viewports and normalization

The source captures are Retina-density screenshots. They were downsampled to their approximate CSS dimensions before being placed beside browser captures. Comparisons use device-scale factor 1 in the controlled browser.

| Surface | Source pixels | CSS comparison viewport | Implementation pixels |
| --- | ---: | ---: | ---: |
| Timesheet | 2574 × 1306 | 1287 × 653 | 1265 × 643, scrollbar excluded |
| Calendar | 2452 × 1274 | 1226 × 637 | 1211 × 614, scrollbar excluded |
| Entry editor | 2816 × 1378 | 1408 × 689 | 1408 × 689 |
| Summary | 2560 × 1302 | 1280 × 651 | 1265 × 643, scrollbar excluded |
| Tablet light | n/a | 834 × 1112 | 834 × 1112 |
| Mobile | n/a | 390 × 844 | 375 × 812, scrollbar excluded |

## Full-view comparison

The implementation preserves the reference hierarchy: compact manual entry surface, week/day totals, dense activity rows, project color cues, a temporal calendar grid, duration-led entry editor, report bars and distribution. The app deliberately uses its own Inter typography, orange primary action and theme tokens. The source timer controls are intentionally absent because Clockify V2 is manual-only.

The report fixture exercises the shared report visualization components. The authenticated Report page adds the applied-filter toolbar, CSV, print, rounding and sharing controls around the same visualization.

## Focused-region comparison

- Timesheet rows: the final comparison confirms the revised compact rhythm exposes all four daily rows in one card while retaining tags, billability and lock state.
- Editor: the final comparison confirms duration, start/end, date, description, project, task and tags remain readable; the persistent footer keeps Save and Close visible.
- Calendar: hour grid, project color, day totals and entry placement retain the reference scanning pattern. Week view scrolls inside the calendar on mobile instead of widening the document.
- Summary: the green temporal bars, metric hierarchy and dark report surface map to the source; breakdown and donut continue below the captured fold.

## Required fidelity surfaces

- Fonts and typography: Inter is consistent with the host app; headings, totals, labels and tabular durations have distinct optical weights. Long descriptions and project names truncate without overlapping controls.
- Spacing and layout rhythm: 62 px activity rows restore the reference density. Desktop uses the compact quick-entry bar; tablet/mobile use a full-width New activity action. Cards and section gaps remain consistent with the existing design system.
- Colors and tokens: dark surfaces, muted separators, project colors, lock warning and the orange primary action pass visual contrast checks in both themes.
- Image quality and assets: the target contains no product imagery. All visible controls use the existing Lucide icon set; no emoji, placeholder art, CSS illustration or custom SVG substitute was introduced.
- Copy and content: labels are localized in Italian, dates use Europe/Rome, and the UI explicitly communicates manual entry with no active timer.

## Accessibility and interaction evidence

- Keyboard focus reaches calendar view controls and entry actions; Enter opens the same editor used by pointer/touch.
- The dialog has a named heading, focus trap, close control, persistent action footer and scrollable body.
- Project/filter comboboxes expose combobox and option semantics and were exercised with keyboard and touch-oriented Testing Library interactions.
- Mobile and tablet document widths equal their viewport widths after fixes; week calendar overflow is contained in its horizontal scroller.
- Fresh-page console check returned no browser errors.

## Comparison history

1. Initial pass — blocked:
   - P1: the editor action menu overlapped the close button and Save fell below the viewport.
   - P1: the desktop quick-entry form caused horizontal page overflow at tablet width.
   - P1: fixture navigation caused document-level overflow on mobile.
   - P2: timesheet rows were too tall compared with the source density.
2. Fixes:
   - Converted the editor to a fixed header/footer with an internally scrolling body and separated menu/close hit targets.
   - Moved the compact quick-entry form to the `lg` breakpoint.
   - Made fixture navigation a bounded horizontal scroller.
   - Moved tags, billability and lock state into the metadata row and reduced entry height.
3. Final pass:
   - Editor Save/Close remain visible at 1408 × 689 and 390 × 844.
   - No document-level horizontal overflow at 390 × 844 or 834 × 1112.
   - Timesheet density, calendar hierarchy and report composition have no remaining actionable P0/P1/P2 mismatch.

## Accepted differences

- Start/Stop/Resume and timer duration controls from the source are intentionally omitted.
- Required Clockify V2 task selection adds one editor row not present in the legacy source.
- Italian labels and the host app’s orange primary action replace the source product’s English/blue controls.
- The fixture header exists only for development/test navigation and is not part of Production.

## Follow-up polish

- P3: real production data may require one more truncation pass for unusually long client/project combinations.

final result: passed
