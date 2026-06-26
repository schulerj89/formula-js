import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const indexHtml = await readFile(path.join(dist, 'index.html'), 'utf8');
const assetFiles = await readdir(path.join(dist, 'assets'));
const modelMaps = assetFiles.filter((file) => /^models-.*\.js\.map$/.test(file));
const gltfChunks = assetFiles.filter((file) => /^GLTFLoader-.*\.js$/.test(file));

if (indexHtml.includes('GLTFLoader-')) {
  throw new Error('Main game HTML preloads GLTFLoader; generated asset tooling should stay deferred.');
}

if (gltfChunks.length !== 1) {
  throw new Error(`Expected one deferred GLTFLoader chunk, found ${gltfChunks.length}.`);
}

if (modelMaps.length !== 1) {
  throw new Error(`Expected one shared models sourcemap, found ${modelMaps.length}.`);
}

const modelMap = await readFile(path.join(dist, 'assets', modelMaps[0]), 'utf8');
for (const source of ['GLTFLoader.js', 'BufferGeometryUtils.js']) {
  if (modelMap.includes(source)) {
    throw new Error(`Shared models chunk still includes ${source}.`);
  }
}

console.log(`Build bundle verification passed: deferred ${gltfChunks[0]}, main HTML does not preload GLTFLoader.`);
