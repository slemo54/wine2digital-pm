const fs = require('fs');

let content = fs.readFileSync('app/admin/audit/page.tsx', 'utf8');

const regex = /<div className="space-y-4">[\s\S]*?Cerca nel server\n\s*<\/Button>\n\s*<\/div>\n\s*<\/div>\n\s*<div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t">/;

// I see that <div className="space-y-4"> was added but not closed. Let me add the closing div.
// Wait, I see the replacement in resolve_conflict.js didn't close <div className="space-y-4">
const brokenBlock = `
                <div>
                  <Select value={actorFilter} onValueChange={setActorFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtra per autore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti gli autori</SelectItem>
                      {uniqueActors.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
`;

content = content.replace(brokenBlock, brokenBlock + '            </div>\n');

fs.writeFileSync('app/admin/audit/page.tsx', content);
