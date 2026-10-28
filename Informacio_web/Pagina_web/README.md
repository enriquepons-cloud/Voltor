# Página de Voltor

Página en HTML y CSS, decorada con paneles grises y detalles rojos como el juego, para presentar el proyecto y explicar sus controles. No necesita JavaScript.

- `index.html`: historia, enlace al juego y controles.
- `styles.css`: estilos con tonos grises, bordes de panel y detalles rojos.
- `juego-threejs/`: prototipo del juego y sus instrucciones de ejecución.

Para ver solo la página puedes abrir `index.html`. Para jugar necesitas un servidor local y las dependencias instaladas: consulta el README de `juego-threejs`.

Para ver página y juego juntos, instala primero las dependencias del juego y ejecuta desde `Informacio_web/Pagina_web`:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Abre http://127.0.0.1:8000 y pulsa «Abrir el juego».
