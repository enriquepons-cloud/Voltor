# Voltor

Proyecto DAW con una página de presentación y un prototipo FPS con Three.js.

- Página: `Informacio_web/Pagina_web/index.html`.
- Juego e instrucciones: `Informacio_web/Pagina_web/juego-threejs/README.md`.

## Ejecutar página y juego

Necesitas Node.js 20 o superior, npm y Python 3.

Desde la raíz del repositorio:

```bash
cd Informacio_web/Pagina_web/juego-threejs
npm ci
cd ..
python3 -m http.server 8000 --bind 127.0.0.1
```

Abre http://127.0.0.1:8000 y pulsa «Abrir el juego». Usa Chrome de escritorio con teclado y ratón. Ctrl+C detiene el servidor.

El juego también puede ejecutarse por separado con `npm start` desde su carpeta, en http://127.0.0.1:5173.
