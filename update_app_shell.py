with open('components/app-shell.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '<Button variant="ghost" size="icon">',
    '<Button variant="ghost" size="icon" aria-label="Apri menu" title="Apri menu">'
)

with open('components/app-shell.tsx', 'w') as f:
    f.write(content)
