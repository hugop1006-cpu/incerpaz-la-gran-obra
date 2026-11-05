// Valida los límites de caracteres de listing-*.md (el límite va en el encabezado: «(máx. N)»).
const fs = require('fs'), path = require('path'); let bad = 0;
for (const f of fs.readdirSync(__dirname).filter(f => /^listing-.*\.md$/.test(f))) {
  const t = fs.readFileSync(path.join(__dirname, f), 'utf8'); const re = /^### (.+?) \(máx\. (\d+)\)\s*\n```\n([\s\S]*?)\n```/gm; let m, n = 0;
  while ((m = re.exec(t))) { n++; const len = [...m[3]].length, max = +m[2], ok = len <= max; if (!ok) bad++;
    console.log(`${ok ? '✔' : '✖'} ${f} · ${m[1]}: ${len}/${max}`); }
  if (!n) { bad++; console.log('✖ ' + f + ': no se encontró ningún campo'); }
}
if (bad) { console.error(`\n${bad} campo(s) fuera de límite`); process.exit(1); } console.log('\nTodos los campos dentro de su límite.');
