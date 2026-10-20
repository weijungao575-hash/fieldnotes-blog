import {readFileSync,writeFileSync} from 'node:fs';
import {bundleHTML} from './bundle-lib.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const html=bundleHTML({template:read('shell.html'),css:read('styles.css'),sources:['geography.js','data.js','store.js','content-model.js','github.js','app.js'].map(read),assets:JSON.parse(read('assets-inline.json')),content:JSON.parse(read('content.json'))});
writeFileSync(new URL('index.html',import.meta.url),html);
console.log('Built index.html. Publishing articles only updates content.json; no build command is needed.');
