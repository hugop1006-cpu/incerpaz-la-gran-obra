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
- Tarifas reales por ciudad y lista (general/constructor): hoy `server/data/tarifas.ejemplo.json` es ficticio.
- API real de Seasoft y ambiente de pruebas (ver `server/ERP.md`); el adaptador no se ha probado contra el ERP.
- Servidor interno para alojar `server/` y primeras cuentas ejecutivo/admin.
