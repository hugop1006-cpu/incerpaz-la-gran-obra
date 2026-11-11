# ine-mensual: descarga mensual de datos del INE de Bolivia

Baja una vez al mes las tablas públicas del INE que usan los tableros (cemento, precios de materiales, permisos de construcción,
importaciones, población y hogares), las lee, agrega lo nuevo a una base histórica en archivos CSV y avisa si algo cambió, falló o quedó atrasado.

No toca datos de la empresa: solo descarga información pública del INE. Es independiente del juego que está en la raíz del repositorio.

## Uso

```bash
pip install -r ine-mensual/requirements.txt            # openpyxl y xlrd
python3 -I ine-mensual/ine_mensual.py actualizar        # descarga, lee y guarda todo
python3 -I ine-mensual/ine_mensual.py actualizar --solo cemento_consumo,icc_cochabamba
python3 -I ine-mensual/ine_mensual.py actualizar --sin-pesadas     # omite los microdatos de importaciones (90 MB)
python3 -I ine-mensual/ine_mensual.py estado            # último período de cada fuente
python3 -I ine-mensual/ine_mensual.py exportar --destino salida    # JSON para las páginas del tablero
python3 -I -m unittest discover -s ine-mensual/tests    # pruebas (no usan internet)
```

Códigos de salida: `0` terminó bien (aunque no haya datos nuevos o haya tablas atrasadas), `1` alguna fuente falló, `2` error fatal.

## Qué hace en cada ejecución

1. **Busca el enlace de cada tabla en la página del INE por su título**, ignorando el año que figura en el título. Si el INE cambia el enlace, lo sigue.
   Si no lo encuentra usa el último que funcionó y lo avisa.
2. **Descarga** (un pedido cada 1,5 s, con identificación genérica del programa) y comprueba que sea una planilla y no una página de error.
3. Calcula la **huella (sha256)**. Si no cambió desde la última vez, no vuelve a leer.
4. Si cambió: guarda una **copia cruda** en `archivo/<fuente>/<fecha>_<huella>.xlsx`, lee la tabla y la **fusiona** con lo guardado:
   los períodos nuevos se agregan y, si el INE corrige un valor ya publicado, se anota en `datos/revisiones.csv`
   (el valor original queda en `valor_inicial`).
5. Revisa la calidad: tabla vacía, tabla que retrocede (llega a un período anterior al ya guardado), negativos y saltos raros. Una tabla con error **no pisa** lo guardado.
6. Marca como **atrasada** la fuente cuyo último período sea más viejo de `rezago_max_meses` y escribe el informe `datos/ultimo_informe.md`.

## Dónde quedan los datos (`datos/`, se guardan en git)

| Archivo | Contenido |
|---|---|
| `series/<fuente>.csv` | `serie, periodo, valor, preliminar, valor_inicial, desde`. Períodos `AAAA-MM` (o `AAAA` en tablas anuales). `preliminar=1` si el INE lo marca con (p). `desde` es el día en que se vio por primera vez. |
| `catalogo/<fuente>.csv` | Nombre, unidad y cantidad de cada serie (por ejemplo, el producto y la unidad en los precios de materiales). |
| `revisiones.csv` | Cada corrección del INE: fecha, fuente, serie, período, valor anterior y valor nuevo. |
| `estado.json` | Por fuente: enlace que funcionó, huella, tamaño, fechas y último período. |
| `ultimo_informe.md`, `informes/AAAA-MM-DD.md` | Informe de cada ejecución. |
| `ultimo_resumen.json` | Lo mismo en forma legible por programas: fuentes con datos nuevos, con error y atrasadas. Lo usa el flujo de GitHub para decidir si avisa. |

Los CSV están ordenados de forma estable, así que `git diff` muestra exactamente qué agregó o corrigió el INE cada mes.
La carga inicial (11 de noviembre de 2026, con datos del INE hasta septiembre) ya está en `datos/`: la primera ejecución mensual se compara contra ella.
`archivo/` (copias crudas) no se guarda en git; en GitHub Actions queda como artefacto de la ejecución durante 90 días.

## Fuentes (`fuentes.json`)

| Grupo | Fuentes | Se lee |
|---|---|---|
| Cemento | consumo, ventas y producción por departamento | sí, desde 1991 o 2000 |
| Precios de materiales de construcción | uno por departamento (9): de 62 a 146 productos | sí, desde 2021 |
| Permisos de construcción | superficie y número, por tipo de trámite | sí, desde 2008 |
| Importaciones | por capítulo CUCI (valor y volumen) | sí, desde 1992 |
| Microdatos de importaciones | año actual y año anterior; se agregan 11 partidas de acero, cemento, ladrillos, tejas y baldosas | sí (archivos grandes) |
| Población | proyección por departamento, revisión 2025 (2024-2034) y revisión 2014 (2000-2025) | sí |
| Hogares | material de las paredes por departamento (Encuesta de Hogares) | sí |
| Archivo solamente | índice de producción industrial y capacidad instalada, déficit habitacional, diccionario de importaciones | se guardan y se avisa si cambian, pero no se leen |

Los microdatos de cada año se registran solos: en enero la herramienta busca el archivo del año nuevo y, si el INE todavía no lo publicó, lo informa como «sin publicar».

## Programación mensual

`.github/workflows/ine-mensual.yml` corre el **día 15 de cada mes (08:17 en Bolivia)**, ejecuta las pruebas, actualiza, guarda los cambios en `ine-mensual/datos`
con un commit, sube las copias crudas como artefacto y abre un aviso (issue) con el informe cuando hay datos nuevos, fuentes atrasadas o errores,
de modo que el dueño del repositorio recibe un correo de GitHub. También se puede lanzar a mano desde la pestaña
*Actions* → *INE mensual* → *Run workflow*, con la opción de limitarlo a algunas fuentes o forzar la lectura.

El flujo guarda los datos con un commit en la misma rama desde la que corre (la principal). Si esa rama está protegida, hay que permitir que el bot de GitHub Actions
escriba en ella, o cambiar el paso «Guardar los datos en el repositorio» para que use una rama aparte.

Sin GitHub, el equivalente en cualquier servidor Linux es una línea de cron:

```
17 12 15 * *  cd /ruta/al/repositorio && python3 -I ine-mensual/ine_mensual.py actualizar >> ine-mensual/ine.log 2>&1
```

## Mantenimiento

- **El INE cambió el título de una tabla.** El informe dice «no hay un enlace con ese título» y la fuente sigue con el último enlace conocido. Se corrige el `patron` en `fuentes.json`
  (se compara contra el título sin tildes, sin números y en minúsculas; para títulos que dependen del año se usa `patron_crudo`).
- **El INE cambió el formato de una tabla.** El informe dice «no se pudo leer la tabla (¿cambió su formato?)», la copia queda en `archivo/` y lo guardado no se toca.
  Se ajusta el lector en `ine_mensual.py` y se sube `LECTOR_VERSION` para que vuelva a leer todo.
- **Agregar una fuente.** Una entrada nueva en `fuentes.json` (`id`, `pagina`, `patron`, `url_fija`, `formato`, `lector`). Con `"lector": null` solo se archiva.
  Si necesita un formato nuevo, se agrega una función en la sección de lectores.
- **Una tabla atrasada** no es un error: el INE todavía no publicó. Cuando lo haga, la próxima ejecución (o una manual) la recoge.

## Qué no cubre

- **IPC (inflación):** no encontré una tabla descargable estable; hoy los porcentajes salen de la nota de prensa mensual del INE.
- **PIB trimestral de la construcción:** los enlaces de esa página fallaron con error 503 cuando se probaron.
- Las páginas del INE que cargan sus tablas con pestañas dinámicas (por ejemplo, la del PIB trimestral) no se pueden leer sin un navegador. Ninguna de las fuentes actuales lo necesita.
- Los datos se leen tal como los publica el INE: cifras preliminares incluidas.
