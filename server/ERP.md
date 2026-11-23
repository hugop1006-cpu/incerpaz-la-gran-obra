# Contrato esperado con Seasoft (propuesto)

La API real de Seasoft no está verificada; `server/lib/erp/seasoft.js` implementa este contrato y debe ajustarse al ERP.

- `POST {SEASOFT_URL}/pedidos` (Authorization: Bearer SEASOFT_TOKEN): crea el pedido. Cuerpo: cliente (nombre, NIT, correo, teléfono), ciudad, agencia, lista de precios, entrega, items [{codigo, cantidad}]. Respuesta: `{ id }`.
- `GET {SEASOFT_URL}/pedidos/{id}`: devuelve `{ estado }` (recibido, confirmado, preparando, despachado, entregado, anulado).
- Si el ERP falla, el pedido queda guardado con `erp_error` y se reintenta; el cliente no ve el error.

Pendiente de INCERPAZ: URL y credenciales de un ambiente de pruebas, los códigos de producto por ciudad y las tarifas reales.
