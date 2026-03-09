with open('components/custom-fields/CSVImportWizard.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'Le colonne mappate come <strong>"Campo Personalizzato"</strong> verranno create automaticamente se non esistono.',
    'Le colonne mappate come <strong>&quot;Campo Personalizzato&quot;</strong> verranno create automaticamente se non esistono.'
)

with open('components/custom-fields/CSVImportWizard.tsx', 'w') as f:
    f.write(content)
