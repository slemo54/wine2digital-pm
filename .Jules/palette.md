## 2026-03-12 - [Accessible Icon Buttons in Task Details]
**Learning:** Icon-only buttons (like expand/collapse and delete) within complex interactive lists (such as the subtasks and dependencies tabs) often lack clear accessibility labels. Without `aria-label` and `title` attributes, screen readers fail to communicate their function, and sighted users lose helpful tooltips on hover.
**Action:** Always ensure that any `Button size="icon"` or similar icon-only interactive element includes explicit `aria-label` and `title` attributes, providing context about what the action affects (e.g., "Elimina subtask" instead of just "Elimina").

## 2026-03-12 - [Accessible Icon Buttons in Task Details]
**Learning:** Icon-only buttons (like expand/collapse and delete) within complex interactive lists (such as the subtasks and dependencies tabs) often lack clear accessibility labels. Without `aria-label` and `title` attributes, screen readers fail to communicate their function, and sighted users lose helpful tooltips on hover.
**Action:** Always ensure that any `Button size="icon"` or similar icon-only interactive element includes explicit `aria-label` and `title` attributes, providing context about what the action affects (e.g., "Elimina subtask" instead of just "Elimina").
