import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { stores, searchStores } from './src/stores.mjs';
const [page, style, app] = await Promise.all(['page.html','style.css','app.js'].map(name => readFile(new URL('./src/' + name,import.meta.url),'utf8')));
const html = page.replace('/*STYLES*/',() => style).replace('/*SCRIPT*/',() => 'const stores = ' + JSON.stringify(stores).replaceAll('<','\\u003c') + ';\nconst searchStores = ' + JSON.stringify(searchStores).replaceAll('<','\\u003c') + ';\n' + app);
await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
await writeFile(new URL('./dist/index.html',import.meta.url),html);
for (const name of ['sw.js','push-icon.svg']) {
  await copyFile(new URL('./src/' + name,import.meta.url),new URL('./dist/' + name,import.meta.url));
}
