// Copia solo los archivos de la app web. Sin opciones: www/ (lo que empaqueta Capacitor, sin service worker).
// Con --pwa: dist-web/ (para subir a un hosting estático: incluye sw.js y las cabeceras de seguridad _headers).
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
const files = ['index.html', 'style.css', 'data.js', 'cloud.js', 'app.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const pwa = process.argv.includes('--pwa'), out = pwa ? 'dist-web' : 'www'; if (pwa) files.push('sw.js');
rmSync(out, { recursive: true, force: true }); mkdirSync(out);
for (const f of files) { if (!existsSync(f)) throw new Error('Falta ' + f); cpSync(f, out + '/' + f); }
if (pwa) cpSync('scripts/pwa-headers.txt', out + '/_headers');
// Si ya generaste las páginas legales (node scripts/build-site.mjs), se incluyen en el mismo sitio (no se pisa index.html).
const legal = pwa && existsSync('site/dist') ? ['privacy.html', 'delete-account.html', 'site.css'].filter(f => existsSync('site/dist/' + f)) : [];
for (const f of legal) cpSync('site/dist/' + f, out + '/' + f);
if (pwa) console.log(legal.length ? 'páginas legales incluidas: ' + legal.join(', ') : 'sin páginas legales (genera site/dist con scripts/build-site.mjs si las quieres en el mismo sitio)');
console.log(out + '/ listo:', files.length + (pwa ? 1 : 0), 'archivos');
