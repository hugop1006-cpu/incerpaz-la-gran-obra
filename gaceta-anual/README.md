# gaceta-anual: memorias de empresas del rubro en la Gaceta de SEPREC

Busca una vez al año las memorias anuales que las empresas del rubro cerámico publican en la
[Gaceta Electrónica de Comercio](https://gacetadecomercio.gob.bo/) del SEPREC (Bolivia), descarga las nuevas, lee sus estados financieros y guarda las cifras
en archivos CSV para comparar a Incerco con otras empresas: márgenes, gastos, liquidez y endeudamiento.

Solo descarga documentos públicos que la ley obliga a publicar. No toca datos de Incerco ni del grupo. Es independiente del juego de la raíz del repositorio.

## Uso

```bash
python3 -I gaceta-anual/gaceta_anual.py actualizar                    # busca memorias nuevas, las descarga y lee sus cifras
python3 -I gaceta-anual/gaceta_anual.py actualizar --solo rg,gl       # solo algunas empresas (ids de empresas.json)
python3 -I gaceta-anual/gaceta_anual.py actualizar --sin-descubrir    # sin buscar empresas nuevas del rubro
python3 -I gaceta-anual/gaceta_anual.py estado                        # último ejercicio y última memoria de cada empresa
python3 -I gaceta-anual/gaceta_anual.py leer archivo.pdf              # lee un PDF suelto (por ejemplo, uno que entregó la gerencia) sin guardar nada
python3 -I gaceta-anual/gaceta_anual.py corregir --empresa rg --ejercicio 2026 --concepto neto --valor -2303238.90 --nota "leído del PDF"
python3 -I gaceta-anual/gaceta_anual.py confirmar --empresa rg --ejercicio 2026   # da por buena la lectura de un ejercicio ya revisado
python3 -I gaceta-anual/gaceta_anual.py conocer --solo nueva          # registra el historial de una empresa recién agregada, sin descargarlo
python3 -I gaceta-anual/gaceta_anual.py exportar --destino salida     # pares.json para las páginas del tablero de finanzas
python3 -I -m unittest discover -s gaceta-anual/tests                 # pruebas (no usan internet)
```

No tiene dependencias de Python: solo la biblioteca estándar. Para leer PDF necesita `pdftotext`, `pdfinfo` y `pdftoppm` (paquete `poppler-utils`) y, para las páginas
escaneadas, `tesseract` con el idioma español (`tesseract-ocr` y `tesseract-ocr-spa`). Sin tesseract descarga y lee los PDF con texto digital, y marca los demás para revisión.

Códigos de salida: `0` terminó bien (aunque no haya memorias nuevas o haya cifras por revisar), `1` alguna empresa falló, `2` error fatal.

## Qué hace en cada ejecución

1. **Pregunta a la Gaceta por las memorias de cada empresa seguida**, por número de matrícula (API pública sin clave, un pedido por segundo).
2. **Compara con lo que ya conoce** (`datos/memorias.csv`). Solo descarga las publicaciones nuevas, en PDF, a `archivo/<matrícula>/<código>.pdf`. Un error de descarga no se
   registra: se reintenta en la próxima ejecución.
3. **Lee el PDF.** Usa el texto digital cuando lo hay. Las páginas escaneadas, y las que solo tienen un encabezado digital con la tabla como imagen, se reconocen con tesseract.
4. **Busca el balance y el estado de resultados** y toma las cifras del último ejercicio (ver «Cómo se leen los estados financieros»).
5. **Comprueba** con igualdades contables y deja cada ejercicio como `ok` o `revisar`.
6. **Avisa** de empresas atrasadas (no publicaron este año pasado el plazo), de empresas nuevas del rubro que aún no están en el registro, y escribe `datos/ultimo_informe.md`.

## Dónde quedan los datos (`datos/`, se guardan en git)

| Archivo | Contenido |
|---|---|
| `memorias.csv` | Una fila por publicación conocida: matrícula, empresa, código, fecha, estado (`carga_inicial`, `leida`, `revisar`), ejercicio, páginas y las que pasaron por OCR, huella sha256 y nombre del PDF. |
| `cifras.csv` | Cifras por empresa, ejercicio y concepto (`ventas`, `costo`, `bruto`, `gastos_op`, `operativo`, `neto`, `ac`, `act`, `pc`, `pt`, `pat`, `ppe`, `dep`…). `metodo` es `manual` (verificada contra el PDF) o `auto` (leída por el programa); `estado` es `ok` o `revisar`. |
| `correcciones.csv` | Valores fijados a mano para arreglar una lectura. Mandan sobre `cifras.csv`. |
| `estado.json` | Por empresa: última revisión y última publicación. |
| `ultimo_informe.md`, `informes/AAAA-MM-DD.md` | Informe de cada ejecución. |
| `ultimo_resumen.json` | Lo mismo en forma legible por programas: empresas con memorias nuevas, por revisar, con error, atrasadas y empresas descubiertas. Lo usa el flujo de GitHub para decidir si abre un aviso. |

Los PDF (`archivo/`) no se guardan en git; en GitHub Actions quedan como artefacto de la ejecución durante 90 días.
La carga inicial (12 de noviembre de 2026) tiene las 70 memorias que las ocho empresas seguidas ya habían publicado y las cifras de 2023 a 2026 que se leyeron de los PDF y se comprobaron
con las igualdades contables. La primera ejecución programada solo descarga lo que se publique después.

## Cómo se leen los estados financieros

Las memorias son PDF muy distintos entre sí, casi siempre escaneados. El lector es una heurística, no un análisis exacto, y por eso **desconfía de sí mismo**:

- Reconoce las líneas por su nombre (ventas netas, costo de ventas, utilidad bruta, total activo, pasivo corriente…) con tolerancia a los errores típicos del reconocimiento de
  texto («Notos» por «Netos»), a los números a la boliviana (`1.234.567,89`) y a la inglesa (`1,234,567.89`), a paréntesis y signos negativos.
- **Elige la columna del ejercicio actual** mirando el encabezado de columnas («Mar-25  Mar-26» sube: la actual es la segunda; «2025  2024» baja: la actual es la primera).
  Los títulos del período («Del 1 de abril de 2025 al 31 de marzo de 2026») y el encabezado corrido de la página («MEMORIA ANUAL 2026») no cuentan. Si una página no trae años,
  hereda el orden de otra de la misma memoria; si ninguna lo trae, no adivina y pide revisión.
- **Un ejercicio queda `ok` solo si cumple las igualdades:** ventas menos costo igual a utilidad bruta, y activo igual a pasivo más patrimonio con cifras leídas por separado.
  Cuando la empresa muestra la depreciación aparte entre el costo y la utilidad bruta (Inbolteco), la suma al costo.
- **Toda lectura por OCR queda `revisar`**, aunque cuadre, porque un dígito mal leído en una línea que no entra en ninguna igualdad (el resultado neto) pasa sin que se note.
  Una persona la compara con el PDF, corrige lo que esté mal con `corregir` y la da por buena con `confirmar`.
- Las cifras en `revisar` **no entran a `exportar`** hasta que alguien las confirme o las corrija.

Lo que la lectura no resuelve: números en miles, estados con otro orden de líneas, y reexpresiones por inflación (varias empresas reexpresan el ejercicio anterior, así que las cifras del
ejercicio anterior en una memoria nueva pueden diferir de lo publicado un año antes; el programa solo guarda la columna del ejercicio actual y avisa si una memoria nueva trae un valor distinto
de uno verificado a mano).

## Empresas (`empresas.json`)

- `empresas`: las que se siguen. Cada una con `id`, `matricula`, `nombre`, `tipo` (`externa`, `grupo` u `otra`), `cierre_mes` (3 = el ejercicio cierra el 31 de marzo, como casi toda la industria) y una nota.
  `externa` es una cerámica fuera del grupo; `grupo` significa que usa las mismas cuentas que Incerco (probable empresa del grupo, por confirmar);
  `otra` es de otro rubro de materiales de construcción y se sigue como referencia del sector (Soboce, cemento). Una empresa que casi no vende (Margla) lleva `"margenes": false`:
  `exportar` solo trae sus razones de balance, porque sus márgenes no significan nada.
- `ignoradas`: las que aparecieron en la búsqueda y no sirven como referencia, con el motivo (alquila sus ambientes, está en etapa de inversión, es cemento u hormigón, etc.).
  Existen para que la búsqueda de empresas nuevas no las vuelva a mencionar cada año.
- `descubrir`: palabras que se buscan en el nombre de las empresas que publican memoria. Si aparece una empresa que no está en `empresas` ni en `ignoradas`, el informe la señala.

Para **seguir una empresa nueva**: se agrega a `empresas` con su matrícula (aparece en el informe) y se corre `conocer --solo ID`, que registra su historial de publicaciones como conocido
sin descargarlo. Si no se hace, la primera ejecución descargaría y leería todas sus memorias anteriores.

## Programación anual

`.github/workflows/gaceta-anual.yml` corre el **día 15 de cada mes de junio a diciembre (07:23 en Bolivia)**: instala poppler y tesseract, ejecuta las pruebas, busca memorias nuevas,
guarda las cifras en `gaceta-anual/datos` con un commit, sube los PDF como artefacto y abre un aviso (issue) con el informe cuando hay memorias nuevas, cifras por revisar,
empresas atrasadas, errores o empresas nuevas. El dueño del repositorio recibe un correo de GitHub. Si no hay novedades, no hace nada.
Se puede lanzar a mano desde *Actions* → *Memorias del rubro (Gaceta SEPREC)* → *Run workflow*.

Se corre todos los meses del período porque cada empresa publica en una fecha distinta: Río Grande en agosto, la mayoría el 30 de septiembre y Gladymar, en 2026, en junio y con el ejercicio que cerró en marzo de 2025.
Es seguro repetirlo: lo que ya se conoce no se vuelve a descargar.

El flujo guarda los datos con un commit en la misma rama desde la que corre (la principal). Si esa rama está protegida, hay que permitir que el bot de GitHub Actions escriba en ella,
o cambiar el paso «Guardar las cifras en el repositorio» para que use una rama aparte.

## De los datos al tablero

`exportar --destino carpeta` escribe `pares.json` con, por empresa y ejercicio, los montos y las razones (margen bruto, gastos de operación, margen operativo, resultado neto, razón corriente,
pasivo sobre activo, depreciación sobre activo fijo). Es el formato que usa la página **Directorio de finanzas** para comparar a Incerco con el rubro. El tablero no se actualiza solo:
después de confirmar las cifras nuevas hay que volver a armar y publicar la página.

## Sobre la API de la Gaceta

- Es la que usa el propio sitio: `POST /api/publicaciones` (búsqueda por matrícula, razón social, categoría) y `GET /api/publicaciones/<id>` (trae el PDF en base64).
  La categoría `3` son las memorias anuales; la `4`, los balances, es solo para emisores de bonos, así que los estados financieros de las demás vienen dentro de la memoria.
- Rechaza con `403` los pedidos que no traen los encabezados `Origin` y `Referer` del sitio de la Gaceta; el programa los envía. Si algún día falla con 403, es lo primero que hay que mirar.
- Un pedido por segundo, con identificación genérica del programa. Una ejecución completa hace unas 20 consultas más la búsqueda de empresas nuevas.

## Mantenimiento

- **La Gaceta cambió la API o el formato de la respuesta.** El informe dice «no se pudo consultar …» y la empresa queda con error; lo ya guardado no se toca.
- **Una memoria quedó por revisar.** El PDF está en el artefacto de la ejecución. Se compara con las cifras de `cifras.csv`, se corrige lo que esté mal (`corregir`) y se confirma (`confirmar`).
- **Una empresa cambió de razón social o de forma jurídica** (Río Grande pasó de S.A. a S.R.L.): no importa, se busca por matrícula.
- **Una empresa cierra el ejercicio en otro mes:** se pone su `cierre_mes`. El control de atraso solo se aplica a las que cierran en marzo.
- **Agregar un concepto:** se agrega a `PATRONES` y a `CONCEPTOS` en `gaceta_anual.py`, con una prueba.

## Qué no cubre

- Solo las sociedades anónimas están obligadas a publicar memoria; las S.R.L. y las empresas unipersonales no aparecen. Incerco mismo no figura.
- Las empresas que no publican memoria sino su balance anual para emitir bonos (categoría «Balances» de la Gaceta, como Import Export Las Lomas Ltda.) no se siguen: el programa solo consulta «Memorias».
- El control de atraso mira la fecha de publicación, no el ejercicio. Margla publica con un año de atraso (en septiembre de 2026 subió la memoria del ejercicio a marzo de 2025) y no se marca como atrasada.
- No lee las notas a los estados financieros ni el flujo de efectivo.
- No hay datos de producción por planta, salvo las unidades vendidas y producidas que Río Grande publica en gráficos; esas se cargaron a mano.
