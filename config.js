/* ==========================================================================
   INCERPAZ: La Gran Obra — configuración
   --------------------------------------------------------------------------
   Aquí están los COLORES DE MARCA y los parámetros principales del juego.
   Para usar el logo/colores reales de INCERPAZ basta con cambiar los valores
   de BRAND (y, si quieres, LOGO). Todo el arte se dibuja por código con estos
   colores, así que el cambio se refleja en todo el juego.
   ========================================================================== */
window.CONFIG = {
  GAME_NAME: 'INCERPAZ',
  SUBTITLE: 'LA GRAN OBRA',

  /* ---- Colores de marca (cámbialos por los del logo real) ---- */
  BRAND: {
    primary:      '#a31621', // rojo del logo INCERPAZ (también es el color del ladrillo de Ladri)
    primaryDark:  '#6b0d15', // sombra del color principal
    primaryLight: '#d23c3c', // luz del color principal
    secondary:    '#f0c928', // amarillo del logo (también casco de seguridad)
    secondaryDark:'#c99a06',
    secondaryLight:'#fff08a',
    accent:       '#1d9bd1', // azul de acento (casco reforzado, agua, botones)
    dark:         '#2b1a12', // contornos y textos oscuros
    light:        '#fff6e8', // textos claros / paredes
    gold:         '#ffc531', // teja dorada
    goldDark:     '#b97b00',
    goldLight:    '#fff2a8',
    danger:       '#e23d3d',
    good:         '#46c15a'
  },

  /* ---- Logo de la fachada y de la pantalla final ---- */
  LOGO: {
    text: 'INCERPAZ',
    tagTop: 'CERÁMICA INDUSTRIAL',
    tagBottom: 'CALIDAD TOTAL',
    background: '#f0c928', // amarillo del logo
    foreground: '#a31621', // rojo del logo
    border: '#a31621'
  },

  /* ---- Pantalla y mundo ---- */
  TILE: 16,
  VIEW_W: 480,   // resolución interna (se escala a la ventana sin perder nitidez)
  VIEW_H: 272,

  /* ---- Reglas de juego ---- */
  START_LIVES: 3,
  COINS_PER_LIFE: 50,        // cada 50 ladrillitos = 1 vida extra
  SCORE: { coin: 10, stomp: 100, teja: 500, powerup: 200, seal: 500, timeBonusPerSecond: 10, levelClear: 1000 },
  HELMET_INVULN: 1.6,        // segundos de invulnerabilidad tras perder el casco
  BARROW_TIME: 8,            // duración de la carretilla (s)
  WALL_TIME: 7,              // duración del muro instantáneo (s)
  WALL_MAX_CHARGES: 3,

  /* ---- Física (px y segundos) ---- */
  PHYS: {
    GRAVITY: 950,
    MAX_FALL: 430,
    RUN: 92,
    ACC: 700,
    ACC_AIR: 480,
    FRIC: 820,
    FRIC_AIR: 160,
    ACC_SLIP: 330,           // aceleración sobre superficie resbalosa (tejas)
    FRIC_SLIP: 70,
    ACC_POLISH: 520,         // piso brillante (nivel 4): resbala un poco
    FRIC_POLISH: 300,
    SLIDE: 150,              // resbalón en pendientes de teja
    JUMP: 330,               // velocidad inicial del salto
    JUMP_CUT: 2.6,           // gravedad extra si sueltas el botón (salto corto)
    STOMP_BOUNCE: 240,
    COYOTE: 0.10,
    JUMP_BUFFER: 0.12,
    BARROW_MULT: 1.4,
    SAND_MULT: 0.62
  },

  /* ---- Paletas por nivel (una por etapa de la obra) ---- */
  THEMES: [
    { // 1 Cimientos
      id: 'cimientos', name: 'CIMIENTOS',
      skyTop: '#7ec8f2', skyBottom: '#ffe9b8', far: '#b9a57f', mid: '#a98a5c',
      groundTop: '#6fa83a', ground: '#9a6b3f', groundDark: '#6e4727', sand: '#e6c987', sandDark: '#c9a560',
      roof: '#b8402a', roofDark: '#7a2619', tileA: '#e8d9b8', tileB: '#d1bf96', plank: '#c68a4a', plankDark: '#8d5b28'
    },
    { // 2 Muros
      id: 'muros', name: 'MUROS',
      skyTop: '#5d9fd8', skyBottom: '#f6d9a8', far: '#8a8f9c', mid: '#6d7482',
      groundTop: '#9aa0a8', ground: '#7a808a', groundDark: '#565b65', sand: '#e6c987', sandDark: '#c9a560',
      roof: '#b8402a', roofDark: '#7a2619', tileA: '#e8d9b8', tileB: '#d1bf96', plank: '#d9a050', plankDark: '#936320'
    },
    { // 3 Losa y techo
      id: 'techo', name: 'LOSA Y TECHO',
      skyTop: '#f08a5a', skyBottom: '#ffd98a', far: '#c86a58', mid: '#a34a46',
      groundTop: '#c9c3b6', ground: '#9d978a', groundDark: '#6f6a5f', sand: '#e6c987', sandDark: '#c9a560',
      roof: '#d2552b', roofDark: '#8e2f16', tileA: '#e8d9b8', tileB: '#d1bf96', plank: '#c68a4a', plankDark: '#8d5b28'
    },
    { // 4 Acabados
      id: 'acabados', name: 'ACABADOS',
      skyTop: '#f4e3c8', skyBottom: '#ead2ac', far: '#dcc4a0', mid: '#cfae82',
      groundTop: '#8fd6d0', ground: '#f3ece0', groundDark: '#b9ad98', sand: '#e6c987', sandDark: '#c9a560',
      roof: '#b8402a', roofDark: '#7a2619', tileA: '#f6efe2', tileB: '#9fd8d2', plank: '#b98652', plankDark: '#80542a'
    },
    { // 5 La Tormenta
      id: 'tormenta', name: 'LA TORMENTA',
      skyTop: '#1d2740', skyBottom: '#4a5878', far: '#2f3a55', mid: '#27304a',
      groundTop: '#5f7a52', ground: '#5a4a3c', groundDark: '#37291f', sand: '#8a7a5c', sandDark: '#6a5c44',
      roof: '#a23a26', roofDark: '#6a2417', tileA: '#9aa4b8', tileB: '#7a859c', plank: '#8a6a44', plankDark: '#5a4128'
    }
  ]
};
