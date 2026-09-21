/**
 * Empaqueta la demo sin servidor en un único archivo HTML.
 *
 * El resultado (dist-single/hotel.html) no necesita servidor ni instalación:
 * se abre con doble clic en cualquier navegador.
 */
import { build } from 'vite';
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = 'dist-single';
const TMP_DIR = '.tmp-single';

await rm(TMP_DIR, { recursive: true, force: true });
await build({
  logLevel: 'warn',
  build: {
    outDir: TMP_DIR,
    target: 'es2022',
    // Una sola entrada produce un solo fragmento de JavaScript, que es
    // justo lo que hace falta para poder incrustarlo.
    rollupOptions: { input: 'demo.html' },
  },
});

const assets = join(TMP_DIR, 'assets');
const files = await readdir(assets);
const readAsset = async (extension) => {
  const name = files.find((file) => file.endsWith(extension));
  if (!name) throw new Error(`El empaquetado no generó ningún archivo ${extension}`);
  return readFile(join(assets, name), 'utf8');
};

const css = await readAsset('.css');
const js = await readAsset('.js');

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Hotel — demo sin servidor</title>
    <style>${css}</style>
  </head>
  <body>
    <script type="module">${js}</script>
  </body>
</html>
`;

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, 'hotel.html'), html);
await rm(TMP_DIR, { recursive: true, force: true });

const kb = (html.length / 1024).toFixed(0);
console.log(`Listo: ${OUT_DIR}/hotel.html (${kb} kB, sin dependencias externas)`);
