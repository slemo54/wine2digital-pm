import re

with open('components/ui/task-card.tsx', 'r') as f:
    content = f.read()

# Edit button
content = content.replace(
    '<Button variant="ghost" size="icon" onClick={() => onEdit(id)}>',
    '<Button variant="ghost" size="icon" onClick={() => onEdit(id)} aria-label="Modifica task" title="Modifica task">'
)

# Delete button
content = content.replace(
    '<Button variant="ghost" size="icon" onClick={() => onDelete(id)}>',
    '<Button variant="ghost" size="icon" onClick={() => onDelete(id)} aria-label="Elimina task" title="Elimina task">'
)

with open('components/ui/task-card.tsx', 'w') as f:
    f.write(content)
