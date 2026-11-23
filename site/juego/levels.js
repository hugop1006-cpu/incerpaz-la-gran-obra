/* ==========================================================================
   INCERPAZ: La Gran Obra — niveles
   --------------------------------------------------------------------------
   Cada nivel es un objeto con un mapa de texto (una cadena por fila, 17 filas).
   Leyenda de símbolos:

     ESPACIO aire          #  terreno / piso (según la etapa)
     B  ladrillo sólido    R  teja de techo (resbala)
     S  arena (frena)      T  revestimiento cerámico sólido
     =  tablón/andamio (se atraviesa desde abajo)
     /  \\ pendientes de techo (resbalan)      ^  varillas filosas (dañan)

     P  inicio de Ladri    F  meta (base del arco, 2 tiles de ancho)
     o  ladrillito (puntos)  G  teja dorada (3 por nivel, obligatorio)
     C  punto de control   e  termita (patrulla)   d  gotera (cae del techo)
     h  humedad (nube que crece)
     H  casco reforzado    W  carretilla   M  muro instantáneo   r  bolsa de ladrillos (+3)

   Campos del nivel:
     time    segundos disponibles        bricks  ladrillos que Ladri puede apilar
     theme   paleta (índice en CONFIG.THEMES)     music  melodía (js/audio.js)
     hints   carteles: col = columna, r = radio en tiles
     movers  plataformas de grúa: x,y (tile inicial), w (ancho), dx,dy (recorrido), speed (tiles/s)
     scroll  (solo nivel 5) cámara forzada: speed px/s, stopCol = columna donde se detiene
     boss    (solo nivel 5) arena del jefe: hp, arenaCol, endCol, floorRow
   ========================================================================== */
window.LEVELS = [
  { // ===== NIVEL 1: CIMIENTOS =====
    id: 1,
    name: "Cimientos",
    theme: 0,
    music: "l1",
    time: 240,
    bricks: 4,
    intro: "Todo empieza en el terreno: zanjas, arena y mucho ladrillo por juntar. ¡Prepara los cimientos de la casa!",
    hints: [
      { col:4, text:"MUÉVETE CON ← → O A D", touch:"MUÉVETE CON LOS BOTONES DE ABAJO" },
      { col:12, text:"ESPACIO SALTA · MANTÉN PARA SALTAR MÁS ALTO", touch:"SALTO: MANTÉN PRESIONADO PARA SALTAR MÁS ALTO" },
      { col:29, text:"LAS ZANJAS SE SALTAN... Y SE ESCALAN", r:5 },
      { col:40, text:"PISA A LAS TERMITAS PARA VENCERLAS", r:5 },
      { col:58, text:"PARED ALTA: ↓ O X APILA UN LADRILLO BAJO TUS PIES", touch:"PARED ALTA: EL BOTÓN APILAR PONE UN LADRILLO", r:5 },
      { col:80, text:"LA ARENA TE FRENA", r:5 },
      { col:93, text:"¡CUIDADO CON EL VACÍO!", r:3 },
      { col:135, text:"¡LA META! ENTREGA EL TERRENO LISTO", r:4 }
    ],
    movers: [],
    map: [
      "                                                                                                                                            ",
      "                                                                                                                                            ",
      "                                                                                                                                            ",
      "                                                                                                                                            ",
      "                                                                                                                                            ",
      "                                                                                                             G                              ",
      "                                                                                                                                            ",
      "                                                              oo  G                                         oooo                            ",
      "                  oo                                              BB                             o          ====                            ",
      "                 o  o                         ooooo           BB                                o o   oooo                                  ",
      "                o    o       G                =====           BB                               o   o  ====                    BB            ",
      "        ooooo                                                 BBoooooo                                                        BB oooo       ",
      "   P              BB  ooo         ooo e    e         H        BB      r C     oooooe     e                       ooeoooooe    BB      F     ",
      "##########################       ###########################################SSSSSSSSSSSSSSS#####   #########################################",
      "########################## ooeoo ###########################################SSSSSSSSSSSSSSS#####   #########################################",
      "################################################################################################   #########################################",
      "################################################################################################   #########################################"
    ]
  },
  { // ===== NIVEL 2: MUROS =====
    id: 2,
    name: "Muros",
    theme: 1,
    music: "l2",
    time: 280,
    bricks: 5,
    intro: "Sube los andamios, súbete a las grúas y levanta las paredes. ¡Cuidado con las goteras!",
    hints: [
      { col:5, text:"LOS ANDAMIOS SE ATRAVIESAN POR DEBAJO" },
      { col:24, text:"SÚBETE A LA GRÚA PARA CRUZAR", r:4 },
      { col:43, text:"RECOGE EL MURO: C O SHIFT LO COLOCA", touch:"RECOGE EL MURO: EL BOTÓN MURO LO COLOCA", r:4 },
      { col:62, text:"PARED DE 5: ¡APILA DOS LADRILLOS!", r:4 },
      { col:80, text:"EL ASCENSOR DE LA GRÚA SUBE A LA TERRAZA", r:4 },
      { col:97, text:"LAS GOTERAS CAEN CUANDO PASAS DEBAJO", r:5 },
      { col:118, text:"VARILLAS FILOSAS: ¡SÁLTALAS!", r:3 }
    ],
    movers: [{x:27, y:13, w:3, dx:7, dy:0, speed:2.4}, {x:82, y:13, w:4, dx:0, dy:-6, speed:1.8}, {x:135, y:13, w:3, dx:8, dy:0, speed:2.4}],
    map: [
      "                                                                                                                                                                                  ",
      "                                                                                                                                                                                  ",
      "                                                      G                                               G                                                                           ",
      "                                                                                                  d  oooo d                                           d   d                       ",
      "                                                    ooooo                                            ====                                                                         ",
      "                G                                   =====                                                                                                                         ",
      "                                                                                          oooooe       e   ooooo                                                                  ",
      "              ooooo          oooooo                     =====   oo                      #########################      oo                  oooo                                   ",
      "              =====        oo      oo                ooooooo    BB                      #########################                        oo    oo                    oo           ",
      "        ooooo             o          o           oo  =======    BB                      #########################     o  o              o        o            h      BB           ",
      "        =====                                    BB             BB                      #########################                                                    BB           ",
      "                                                 BB             BB    ooooooo           #########################                                                    BB ooo       ",
      "   P ooo  e        e  H o                 M   e  BB    e     r  BB  C                   #########################   o  ^^   ooeoooeoM               oooooeooo   r    BB      F    ",
      "##########################            ###########################################       ##############################################             ###############################",
      "##########################            ###########################################       ##############################################             ###############################",
      "##########################            ###########################################       ##############################################             ###############################",
      "##########################            ###########################################       ##############################################             ###############################"
    ]
  },
  { // ===== NIVEL 3: LOSA Y TECHO =====
    id: 3,
    name: "Losa y techo",
    theme: 2,
    music: "l3",
    time: 300,
    bricks: 5,
    intro: "Los tejados resbalan y la humedad acecha. ¡Pon las tejas antes de que llegue la lluvia!",
    hints: [
      { col:6, text:"LAS TEJAS RESBALAN: FRENA CON TIEMPO", r:4 },
      { col:30, text:"ESPERA EL MOMENTO ENTRE GOTERAS", r:3 },
      { col:42, text:"LA HUMEDAD CRECE LENTAMENTE... ¡NO LA DEJES!", r:3 },
      { col:82, text:"SALTA DE TEJA EN TEJA", r:3 },
      { col:124, text:"PARED DE 4: UN LADRILLO Y SALTA", r:4 }
    ],
    movers: [],
    map: [
      "                                                                                                                                                                                ",
      "                                                                                                                                              G                                 ",
      "                                                                                                                                                                                ",
      "                                                                    G                    h                                                   oooo                               ",
      "                                                                                                                                             ====                               ",
      "                               d             h                    oooo        d                                                                         d   d                   ",
      "                       G                                          ====                                                                     oooooo                               ",
      "                    oooooo                                       oooooo                                                                   /RRRRRR\\                              ",
      "                                   o     oooB ooo               /RRRRRR\\                                           ooo        oo         /RRRRRRRR\\                             ",
      "                ooo/RRRRRR\\       o o       B                  /RRRRRRRR\\                                         /RRR\\       BB        /RRRRRRRRRR\\                            ",
      "                  /RRRRRRRR\\     o   o  /RRRRRRRR\\            /RRRRRRRRRR\\         ooo  ooo  ooo                 /RRRRR\\      BB       /RRRRRRRRRRRR\\                           ",
      "                 /RRRRRRRRRR\\          /RRRRRRRRRR\\          /RRRRRRRRRRRR\\        RRR  RRR  RRR                /RRRRRRR\\     BB      /RRRRRRRRRRRRRR\\                          ",
      "   P oooo e H   /RRRRRRRRRRRR\\        /RRRRRRRRRRRR\\   e C  /RRRRRRRRRRRRRR\\ M                    ooeoooooeoo  /RRRRRRRRR\\ r  BB  W  /RRRRRRRRRRRRRRRR\\oooeoooooo       F       ",
      "##################################   ############################################                ###############################################################################",
      "##################################   ############################################                ###############################################################################",
      "##################################   ############################################                ###############################################################################",
      "##################################   ############################################                ###############################################################################"
    ]
  },
  { // ===== NIVEL 4: ACABADOS =====
    id: 4,
    name: "Acabados",
    theme: 3,
    music: "l4",
    time: 300,
    bricks: 6,
    polished: true,
    intro: "Pisos brillantes, revestimientos y detalles finales. ¡La humedad quiere arruinar el trabajo!",
    hints: [
      { col:5, text:"LOS PISOS BRILLANTES RESBALAN UN POCO", r:4 },
      { col:12, text:"EL CASCO REFORZADO AGUANTA UN GOLPE", r:2 },
      { col:45, text:"VARILLAS A LA VISTA: ¡CUIDADO!", r:3 },
      { col:54, text:"ESQUIVA LA HUMEDAD Y LAS GOTERAS", r:4 },
      { col:94, text:"EL ABISMO SE CRUZA CON MURO O CON LAS BALDOSAS", r:4 },
      { col:122, text:"LA CARRETILLA EMBISTE ENEMIGOS", r:3 }
    ],
    movers: [],
    map: [
      "                                                                                                                                                                          ",
      "                                                                                                                                                                          ",
      "                                                                                                                                                                          ",
      "                                        G          d    d     d                                                                             d   d    G                    ",
      "                                                                                                                                                                          ",
      "                                      ooooo                                                                                                                               ",
      "                                      =====                                                                                                         ====                  ",
      "                                 ooooo        oo                                                                                               oooo                       ",
      "                                 =====                                       o           oo                                                    ====                       ",
      "              h             ooooo            o  o          h                o o          TT                            h                  oooo                            ",
      "                        T   =====                    h                     o   o         TT       ooo ooo                     T    T      ====                            ",
      "                        T                                                                TT       TTT TTT                     TooooT                                      ",
      "   P ooooo  H        e  T                     ^^   ooooooooooooo  e   C             e r  TT  MM            oeooooeooo    W    T G  T    e                 ooeoo    F      ",
      "############################################################################   #################          ################################################################",
      "############################################################################   #################          ################################################################",
      "############################################################################   #################          ################################################################",
      "############################################################################   #################          ################################################################"
    ]
  },
  { // ===== NIVEL 5: LA TORMENTA =====
    id: 5,
    name: "La Tormenta",
    theme: 4,
    music: "l5",
    time: 300,
    bricks: 6,
    scroll: {speed:36, stopCol:150},
    boss: {hp:6, arenaCol:150, endCol:179, floorRow:13},
    intro: "La lluvia avanza detrás de ti. ¡Corre y derrota a LA GRIETA sellándola con ladrillos!",
    hints: [
      { col:8, text:"¡NO TE QUEDES ATRÁS! LA LLUVIA AVANZA", r:4 },
      { col:33, text:"CAMINO ALTO: TEJA DORADA", r:3 },
      { col:140, text:"FALTA POCO: ¡LA GRIETA TE ESPERA!", r:5 },
      { col:156, text:"SELLA LAS GRIETAS CON LADRILLOS: ↓ / X", touch:"SELLA LAS GRIETAS CON EL BOTÓN APILAR", r:6 }
    ],
    movers: [],
    map: [
      "                                                                                                                                                                                    ",
      "                                                                                                                                                                                    ",
      "                                                                                                                                                                                    ",
      "                                                     d                                                     d d                                                                      ",
      "                                                                                                                                                                                    ",
      "                                                                                                                                                                                    ",
      "                                                                                                                                                                                    ",
      "                                G               oo             G                                                         G                                                          ",
      "                     o                                                                     o                          o     o                                                       ",
      "                    o o        oooo oo         o  o    h     ooooo                        o o            h     h     o ooooo o                                                      ",
      "                   o   o       ==== BB                       =====                       o   o  oo                  o   ===   o           BB                                        ",
      "                                    BB                                                          BB                                        BB                                        ",
      "    P ooooo              oeooo      BB   e      ^^                    C  H roeooooeoo           BB   W oooooooooo                 M  e    BB  e rooooo                              ",
      "####################   #######################################   #########################   ########################   ###   ######################################################",
      "####################   #######################################   #########################   ########################   ###   ######################################################",
      "####################   #######################################   #########################   ########################   ###   ######################################################",
      "####################   #######################################   #########################   ########################   ###   ######################################################"
    ]
  }
];
