# Voltor: juego básico con Three.js

Prototipo en primera persona inspirado en Doom. Está hecho con JavaScript y Three.js, con paredes lisas, colores grises y una interfaz sencilla.

La barra inferior tiene paneles de estilo clásico con munición, reserva, vida, bajas y tiempo de partida (minutos:segundos). El tiempo se detiene al pausar o terminar y vuelve a cero al reiniciar. El retrato central es un dibujo fijo hecho con rectángulos SVG.

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
- Empiezas con 100 de vida, 8 balas en el cargador y 40 de reserva.
- Los enemigos te persiguen y hacen daño al acercarse.
- Las paredes impiden pasar y bloquean los disparos.
- Las cajas añaden 16 balas a la reserva y los botiquines recuperan 35 de vida. Se recogen caminando sobre ellos.
- Pierdes al quedarte sin vida o sin munición cuando ya no quedan cajas.
- Escape libera el ratón y pausa la partida. Cambiar de pestaña también la pausa.

## Archivos

- `index.html`: menú, controles e indicadores de la partida.
- `styles.css`: estilos sencillos en blanco, negro y gris.
- `src/main.js`: teclado, ratón, pausa y bucle de juego.
- `src/scene.js`: cámara, paredes, enemigos y arma con Three.js.
- `src/core.js`: mapa, colisiones, enemigos, vida y munición.
- `server.mjs`: servidor local.
- `tests/`: pruebas de funcionamiento.

El arma y el cuerpo son cajas 3D. Los enemigos son dibujos pequeños hechos con Canvas y mostrados como sprites que miran a la cámara. Los disparos usan un Raycaster para detectar el primer enemigo o pared. El mapa se representa con un array de cadenas: `#` pared, `P` jugador, `E` enemigo, `A` munición y `H` botiquín. La búsqueda de caminos permite que los enemigos rodeen las paredes.

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
