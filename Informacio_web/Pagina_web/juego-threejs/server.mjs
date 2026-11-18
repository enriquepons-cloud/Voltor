import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const modelsRoot = resolve(root, '../../assets/Modelos 3D');
const modelsPrefix = '/assets/Modelos 3D/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
const port = Number(process.env.PORT || 5173);
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const modelRequest = pathname.startsWith(modelsPrefix);
    const base = modelRequest ? modelsRoot : root;
    const relativePath = modelRequest ? '/' + pathname.slice(modelsPrefix.length) : pathname;
    let file = resolve(base, `.${relativePath}`);
    if (file !== base && !file.startsWith(base + sep)) throw new Error('Outside root');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    file = await realpath(file);
    if (!file.startsWith(base + sep)) throw new Error('Outside root');
    const data = await readFile(file);
    const type = types[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type.startsWith('text/') || type === 'application/json' ? `${type}; charset=utf-8` : type, 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Archivo no encontrado');
  }
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Prueba: PORT=5174 npm start` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`V O L T O R · Sector 07 → http://127.0.0.1:${port}\nCtrl+C para detener el servidor.`));
