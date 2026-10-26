# Contenido pendiente y datos por confirmar

El sitio muestra solo lo que ya existe. Esto falta o hay que confirmar antes de publicar.

## Datos con conflicto en el sitio actual
El sitio actual (página de agencias de Cochabamba) tiene dos tablas con datos distintos. Se usó la más nueva.
Hay que confirmar:
- WhatsApp de la agencia **Castillo** (Cochabamba): repetía el de la fábrica, no se muestra.
- WhatsApp de **Oruro Patio** (60400608 en la tabla nueva; 70415114 en la anterior) y de **Oruro Tacna** (70415110 y 70419456).
- WhatsApp de la **fábrica de Oruro** (70410344, solo figura en la tabla anterior) y su dirección (carretera Oruro–La Paz Km 31).
- WhatsApp de **Santos Dumont** y **Patio** en Santa Cruz (la tabla anterior los intercambia).
- Cada ciudad usa como WhatsApp principal el de su agencia central: Cochabamba 70750963, Santa Cruz 70009021 (Banzer), Oruro 60400608, Sucre 70213846.

## Datos que no existen todavía
- Dirección, teléfono y WhatsApp del **punto de venta PAVIC de La Paz**. Hoy la página lo menciona y deriva el WhatsApp a Oruro.
- Dirección de las **fábricas PAVIC** de Cochabamba y Santa Cruz.
- Horarios de agencias.
- **Norma ISO** y alcance; certificados de calidad y ensayos de PAVIC (el sitio los menciona y los entrega por solicitud).
- Obras de referencia de PAVIC (con ciudad, año y superficie).
- Montos y políticas de envío por ciudad.
- Precios, programa de puntos, marca de tejas, cifras de la empresa, historia y sostenibilidad: fuera de esta entrega.

## Catálogo
El sitio tiene **dos catálogos**, tal como en las tiendas actuales: Cochabamba (32 productos) y Santa Cruz (25 productos, incluidas 2 tejas).
El catálogo que se ve depende de la ciudad elegida. Oruro y Sucre no tienen tienda propia: muestran el de la fábrica más cercana con un aviso para confirmar disponibilidad.
- **Combos y promociones:** no se incluyeron. Santa Cruz tiene 47 y Cochabamba 2; son campañas temporales ("hasta agotar stock", con regalos como coolers y parlantes). Si se quieren mostrar, conviene hacerlo como sección de promociones con vigencia.
- **Existencias:** el sitio actual marca "Sin existencias" en algunos productos. No se copió porque cambia; se mostrará cuando se conecte el ERP.
- **Producto a pedido:** se muestra en las piezas decorativas y en el brick punta redonda de Santa Cruz.
- **Datos que cambian entre ciudades** (parecen fábricas distintas o errores): 18 huecos mide 25 cm de largo en Cochabamba y 24 en Santa Cruz; el PAVIC peatonal pesa 1,63 kg en Cochabamba y 2,2 kg en Santa Cruz; el nombre y el código de varios productos también difieren. Hay que confirmar los valores correctos de cada uno.
- **Correcciones hechas a mano** (ver `CORRECCIONES` en `build.js`):
  - 3 huecos económico rayado (Cochabamba): el sitio dice ancho 0,7 cm; se mostró 7 cm.
  - 6 huecos big rayado mitad (Santa Cruz): el sitio dice largo 1,2 cm; se mostró 12 cm.
- **Teja colonial canal (Santa Cruz):** su ficha repite exactamente los datos de la tapa. Se muestra sin medidas ni calculadora hasta confirmarlos.
- **Bloque cerámico 9 cm:** su foto no carga en el sitio actual (nombre de archivo con tilde). Muestra un marcador.
- Los productos de la tienda de Oruro y de Tarija no se pudieron revisar (no abrían).
- Faltan fichas técnicas en PDF y manuales de instalación.
- Los nombres de producto se normalizaron (de MAYÚSCULAS a minúsculas con tildes). Revisar ortografía.

## Para conectar después
- Formularios al CRM: poner la dirección en `config.json`.
- Precios, stock y pedidos con el ERP Seasoft: segunda etapa.

## Segunda etapa (comercio)
- Precios: se usan los publicados en las tiendas actuales (lista general); falta definir los precios propios de la lista constructor y si Cochabamba y Santa Cruz comparten la condición "puesto en obra dentro del radio urbano" (hoy solo Cochabamba la declara).
- API real de Seasoft y ambiente de pruebas (ver `server/ERP.md`); el adaptador no se ha probado contra el ERP.
- Servidor interno para alojar `server/` y primeras cuentas ejecutivo/admin.

## Proyectos (tercera etapa)
- Las fórmulas de cantidades (rendimientos de cemento, arena, adhesivo, mortero refractario, alturas del hogar, etc.) son estimaciones razonables, no validadas por un técnico de INCERPAZ. Falta que un ingeniero o maestro de confianza las revise antes de publicar.
- Santa Cruz publica el enchape corto como "67 pzas/ml"; se interpreta como por m² (pieza de 20 × 7,5 cm). Confirmar.
- Biscocho y brick estándar solo existen en el catálogo de Cochabamba; en Santa Cruz el churrasquero avisa que se consulte con la agencia.
- Los esquemas son referenciales. Falta decidir si se ofrecen planos descargables en PDF (requiere dibujos de un proyectista).
- Faltan más proyectos (muro de jardín, piso de patio con PAVIC, fachada con celosía) y fotos reales de obra.

## PAVIC: recursos técnicos
- Los **certificados, informes de ensayo y la certificación ISO** no están cargados: hoy se piden por formulario. Para publicarlos como PDF descargables hacen falta los archivos (y su vigencia).
- Valores de desempeño (resistencia a la compresión, absorción, abrasión, resistencia al deslizamiento) y la norma con que se ensayan: faltan para incluirlos en la ficha y en el texto de pliegos.
- Espesores de partida de base (15 cm) y cama de arena (4 cm) de la calculadora: valores genéricos editables; confirmar con el equipo de proyectos si conviene otro valor por defecto.
- Falta el detalle del confinamiento lateral y de tránsito (peatonal, vehicular liviano, pesado) con el paquete estructural recomendado por INCERPAZ.
- Obras de referencia PAVIC (ciudad, año, superficie, fotos) y manual de instalación en PDF.
- Biblioteca BIM/CAD más completa (bloques DWG, texturas para renders, patrones de aparejo).

## Guías, exportaciones y leads
- Las 5 guías son textos nuevos escritos con los datos de las fichas del catálogo; un técnico o el área comercial debe revisarlas antes de publicar (en especial recomendaciones sobre hidrofugantes, mortero y uso estructural).
- Exportaciones: faltan países de destino atendidos, productos que se exportan, volúmenes mínimos, condiciones (Incoterms), certificaciones de exportación y el contacto responsable. Hoy la página solo capta la consulta y enlaza al sitio de exportaciones actual.
- Leads: los formularios del sitio se guardan en el servidor y se ven en Equipo → Contactos (cada ejecutivo ve los de su ciudad; los de otras ciudades y la lista de espera los ve el administrador). Falta definir quién atiende exportaciones y PAVIC, y conectar avisos por correo o WhatsApp cuando entra un contacto nuevo (hoy solo se ve el contador en el panel).
- Falta fotografía propia para las guías (hoy usan fotos de producto) y más guías (instalación de PAVIC, techos con teja, refractarios para hornos).

## Publicación pública
- Decidir las herramientas de medición (Google Analytics, Search Console, Meta Pixel) y el aviso de cookies que correspondan.
- Crear o reclamar los perfiles de Negocio de Google de cada agencia y fábrica; confirmar que dirección y teléfono coinciden con los del sitio.
- Imagen para compartir en redes (1200 × 630) propia de la marca: hoy se usa una foto de producto por página.
- Texto legal: términos de uso y política de privacidad (el sitio guarda cuentas y contactos) y el aviso de datos personales; faltan las páginas.
- Definir el momento del corte: redirecciones 301 de las tiendas (`site-src/redirecciones-tiendas.csv`) y qué pasa con `exportaciones.incerpaz.com`.
- Si se activa Cloudflare Web Analytics, actualizar el texto de `privacidad.html` (hoy dice que no hay herramientas de medición).
- Lista de registros DNS actuales de `incerpaz.com` (correo, ERP, tiendas, subdominios) antes de pasar el dominio a Cloudflare.
