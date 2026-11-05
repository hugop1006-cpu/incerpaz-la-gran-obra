// Copia solo los archivos de la app web a www/ (lo que empaqueta Capacitor). No incluye supabase/, scripts/ ni documentos.
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
const files = ['index.html', 'style.css', 'data.js', 'cloud.js', 'app.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
rmSync('www', { recursive: true, force: true }); mkdirSync('www');
for (const f of files) { if (!existsSync(f)) throw new Error('Falta ' + f); cpSync(f, 'www/' + f); }
console.log('www/ listo:', files.length, 'archivos');
