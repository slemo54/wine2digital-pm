with open('app/api/projects/[id]/import/csv/route.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'for (const record of records) {',
    'for (const record of records as Record<string, string>[]) {'
)

with open('app/api/projects/[id]/import/csv/route.ts', 'w') as f:
    f.write(content)
