/* Contexto de navegador para las pruebas: un visitante que ya respondió la ventana
   «¿Desde qué ciudad nos visitas?», para que no tape la página en cada prueba.
   La ventana misma se prueba aparte en probar-sitio.js con un contexto nuevo (b.newContext). */
module.exports = async function visitante(b, opciones) {
  const ctx = await b.newContext(opciones);
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('incerpaz_ciudad_preguntada', '1'); } catch (e) { /* sin almacenamiento */ }
  });
  return ctx;
};
