# Cómo se comunican Claude, Luna y Hugo (GitHub como buzón)

Decisión de Hugo (24-11-2026): Claude y Luna se hablan por GitHub, sin que Hugo copie mensajes de uno a otro. Hugo decide y autoriza; no es el mensajero.

## El flujo
1. **ENCARGO = issue.** Claude crea un issue en el repositorio con las etiquetas `encargo` y `luna`. El cuerpo trae el ENCARGO completo (objetivo, criterios, archivos permitidos y prohibidos, riesgo) y el formato del REPORTE.
2. **Luna lo toma.** Revisa los issues abiertos: `gh issue list --label encargo --label luna --state open`. Trabaja en una rama `codex/...` partiendo de `main` actualizada.
3. **REPORTE = descripción del PR.** Luna abre un PR contra `main` con el REPORTE como descripción y `Closes #<número del issue>`. Las dudas o bloqueos van como comentario en el issue.
4. **Claude revisa en GitHub.** Comprueba el PR contra el ENCARGO (regenera el sitio, corre las pruebas, revisa el alcance) y publica el veredicto como comentario del PR. Máximo dos rondas de corrección; en la tercera se escala a Hugo.
5. **Hugo autoriza.** El merge y, por separado, el deploy. Merge no es deploy.

## Lo único que hace Hugo
- Decir a Luna una frase fija cuando quiera que trabaje: «Revisa los encargos pendientes y ejecútalos en orden».
- Decir a Claude «revisa luna» cuando quiera que revise lo que haya abierto.
- Autorizar merges y deploys.

## Reglas
- Un issue por tarea. Las tareas de riesgo medio o alto esperan la revisión de Claude antes de pedir el merge.
- Nada de claves, tokens ni datos personales en issues, PR o archivos.
- Si dos PR cambian `site/assets/css/site.css`, el segundo en fusionarse debe actualizarse con `main` y regenerar el sitio (`node site-src/build.js`), porque el nombre versionado del CSS cambia en todas las páginas.
