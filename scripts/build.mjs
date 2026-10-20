import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const core = readFileSync(join(root, 'src/index.js'), 'utf8');
const exportStatement = /\nexport \{ init, convertReading, alignReading, toRubyHTML \};\s*$/;
if (!exportStatement.test(core)) throw new Error('Cannot locate core export statement');
const browser = `(function (global) {\n'use strict';\n${core.replace(exportStatement, '\n')}\n` +
  `global.FuriIME = Object.freeze({ init, convertReading, alignReading, toRubyHTML });\n` +
  `})(globalThis);\n`;
mkdirSync(join(root, 'dist'), { recursive: true });
mkdirSync(join(root, 'docs/assets'), { recursive: true });
writeFileSync(join(root, 'dist/furi-ime.global.js'), browser);
copyFileSync(join(root, 'src/index.js'), join(root, 'dist/index.js'));
copyFileSync(join(root, 'src/react.js'), join(root, 'dist/react.js'));
copyFileSync(join(root, 'types/index.d.ts'), join(root, 'dist/index.d.ts'));
copyFileSync(join(root, 'types/react.d.ts'), join(root, 'dist/react.d.ts'));
copyFileSync(join(root, 'dist/furi-ime.global.js'), join(root, 'docs/assets/furi-ime.global.js'));
const site = readFileSync(join(root, 'docs/index.html'), 'utf8');
const reference = '<script src="./assets/furi-ime.global.js"></script>';
if (!site.includes(reference)) throw new Error('Docs must load the browser bundle');
writeFileSync(join(root, 'demo-standalone.html'), site.replace(reference,
  '<script>\n' + browser.replace(/<\/script/gi, '<\\/script') + '\n</script>'));
console.log(`Built browser bundle (${Buffer.byteLength(browser)} bytes) and offline demo.`);
