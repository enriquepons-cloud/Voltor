# Pistola del equipo

`Pistola.glb` se ha exportado con Blender 5.3.0 a partir de `../pistola.blend1`, añadido por Enrique Pons en el commit `9f80338` (Pistola 3D). El archivo original se conserva sin cambios.

La exportación incluye las tres mallas visibles, sus materiales y los modificadores aplicados. Usa formato GLB, eje vertical Y y no incluye cámaras, luces ni animaciones. La escala, la orientación en primera persona y el ajuste de los materiales a las luces del juego se hacen en `juego-threejs/src/scene.js`.

Para actualizarlo desde Blender: abre el original, selecciona las mallas de la pistola y usa Archivo → Exportar → glTF 2.0, formato GLB, solo objetos seleccionados y aplicar modificadores. Guarda como `Pistola.glb` en esta carpeta.
