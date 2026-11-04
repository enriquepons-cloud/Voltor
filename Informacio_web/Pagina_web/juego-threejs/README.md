# Voltor: juego básico con Three.js

Prototipo en primera persona inspirado en Doom. Está hecho con JavaScript y Three.js, con paredes lisas, colores grises y una interfaz sencilla.

La barra inferior tiene paneles de estilo clásico con munición, reserva, vida, escudo, bajas y tiempo de partida (minutos:segundos). El tiempo se detiene al pausar o terminar y vuelve a cero al reiniciar. El retrato central es un dibujo fijo hecho con rectángulos SVG.

## Ejecutarlo en Mac

Necesitas Node.js 20 o superior y Chrome de escritorio.

Desde esta carpeta:

```bash
npm ci
npm start
```

Abre http://127.0.0.1:5173 y pulsa **Jugar**. Deja la Terminal abierta. Para detener el servidor pulsa Ctrl+C.

Si el puerto está ocupado, usa `PORT=5174 npm start` y abre http://127.0.0.1:5174. No abras el HTML con doble clic: el juego necesita un servidor HTTP.

Para ver también la página principal, instala las dependencias como se indica arriba. Después, desde `Informacio_web/Pagina_web`, ejecuta:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Abre http://127.0.0.1:8000. El enlace «Abrir el juego» lleva al prototipo.

## Controles

| Acción | Control |
| --- | --- |
| Moverse | WASD o flechas |
| Mirar | Ratón |
| Disparar | Clic izquierdo |
| Recargar | R |
| Correr | Shift |
| Pausar | Escape |
| Reiniciar | Botón Reiniciar en la pausa |
| Volver a jugar al terminar | Botón o Enter |

## Reglas

- Elimina a los seis enemigos. Cada uno necesita dos impactos.
- Empiezas con 100 de vida, 0 de escudo y un máximo de 15 balas: 5 en el cargador y 10 de reserva. Pulsa R para pasar balas de la reserva al cargador, sin crear munición adicional.
- Los enemigos te persiguen y hacen daño al acercarse.
- Las paredes impiden pasar y bloquean los disparos.
- Los botiquines verdes con cruz blanca curan 25 de vida, hasta un máximo de 100. Las balas de casquillo amarillo y punta marrón rellenan el cargador (5) y la reserva (10), incluso durante una recarga. Los escudos azules suman 10 puntos, hasta un máximo de 50.
- Cada disparo muestra brevemente una estela amarilla y un punto de impacto. Se detiene en la primera pared, suelo, techo o enemigo. El daño es instantáneo; la estela es un efecto visual.
- Todos los objetos se recogen automáticamente al pasar por encima, sin pulsar una tecla. Desaparecen al recogerlos y vuelven al reiniciar; si el recurso ya está al máximo, se conservan en el suelo.
- El escudo absorbe el daño antes que la vida. Por ejemplo, con 10 de escudo, un ataque de 12 gasta el escudo y resta solo 2 de vida.
- Pierdes al quedarte sin vida o sin munición cuando ya no quedan cajas.
- Escape libera el ratón y pausa la partida. Cambiar de pestaña también la pausa.

## Archivos

- `index.html`: menú, controles e indicadores de la partida.
- `styles.css`: estilos sencillos en blanco, negro y gris.
- `src/main.js`: teclado, ratón, pausa y bucle de juego.
- `src/scene.js`: cámara, paredes, enemigos, suministros y efectos de disparo con Three.js.
- `src/core.js`: mapa, colisiones, enemigos, vida y munición.
- `server.mjs`: servidor local.
- `tests/`: pruebas de funcionamiento.

El cuerpo del jugador usa cajas 3D. Se muestran dos manos con dedos, pulgares y mangas, hechas también con cajas y dibujadas en una escena aparte para evitar que las paredes las tapen. El arma queda pendiente de implementar y no se dibuja. Los enemigos son dibujos pequeños hechos con Canvas y mostrados como sprites que miran a la cámara. Los disparos usan un Raycaster para detectar el primer obstáculo o enemigo; un cilindro fino y una esfera dibujan la estela y el impacto durante 0,14 segundos. Estos efectos se congelan en pausa y se limpian al reiniciar. El mapa se representa con un array de cadenas: `#` pared, `P` jugador, `E` enemigo, `A` munición, `H` botiquín y `S` escudo. La búsqueda de caminos permite que los enemigos rodeen las paredes.

No hay radar, sonidos, texturas de paredes, luces de colores ni animaciones decorativas. No necesita Blender ni recursos externos durante la partida. Solo la instalación de dependencias necesita Internet. No incluye controles táctiles, multijugador ni guardado.

## Pruebas

```bash
npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

El segundo comando usa el Chrome instalado. Si prefieres el Chromium de Playwright:

```bash
npx playwright install chromium
npm run test:browser
```

Las pruebas comprueban movimiento, colisiones, disparos, recarga, suministros, pausa, victoria, derrota y reinicio. Los casos de fin de partida preparan un estado cercano al final para comprobar la transición. Las capturas se guardan en `test-results/`, que está ignorado por Git.
