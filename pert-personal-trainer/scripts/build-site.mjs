// Genera site/dist/ (listo para publicar en cualquier hosting estático) sustituyendo los datos del autor.
// Uso: copia site/config.example.json a site/config.json y edítalo, o define LEGAL_NAME y CONTACT_EMAIL.
// Se niega a generar el sitio si faltan datos, para no publicar marcadores vacíos.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
const cfgFile = 'site/config.json';
const cfg = existsSync(cfgFile) ? JSON.parse(readFileSync(cfgFile, 'utf8')) : {};
const legalName = (process.env.LEGAL_NAME ?? cfg.legalName ?? '').trim();
const email = (process.env.CONTACT_EMAIL ?? cfg.contactEmail ?? '').trim();
const fail = m => { console.error('✖ ' + m); process.exit(1); };
if (!legalName || /Tu nombre legal/i.test(legalName)) fail('Falta el nombre legal (legalName en site/config.json o variable LEGAL_NAME).');
if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) || /ejemplo\.com$/i.test(email)) fail('Falta un correo de contacto válido (contactEmail en site/config.json o variable CONTACT_EMAIL).');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
rmSync('site/dist', { recursive: true, force: true }); mkdirSync('site/dist', { recursive: true });
for (const f of readdirSync('site/src')) {
  let t = readFileSync('site/src/' + f, 'utf8');
  t = t.replaceAll('{{LEGAL_NAME}}', esc(legalName)).replaceAll('{{CONTACT_EMAIL}}', esc(email));
  if (t.includes('{{')) fail(`Quedan marcadores sin sustituir en ${f}.`);
  writeFileSync('site/dist/' + f, t);
}
console.log('✔ site/dist/ generado:', readdirSync('site/dist').join(', '));
