import { mkdirSync, cpSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const folderName = `FuriIME-v${pkg.version}`;
const artifactDir = join(root, 'artifacts');
const stage = join(artifactDir, 'release-stage');
const target = join(stage, folderName);
mkdirSync(artifactDir, { recursive: true });
rmSync(stage, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
const folders = ['src', 'types', 'dist', 'docs', 'examples', 'tests', 'scripts', '.github'];
const files = ['package.json', 'package-lock.json', 'README.md', 'README.ja.md',
  'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', '.gitignore', 'demo-standalone.html'];
for (const name of folders) cpSync(join(root, name), join(target, name), { recursive: true });
for (const name of files) copyFileSync(join(root, name), join(target, name));
const zipPath = join(artifactDir, `${folderName}.zip`);
rmSync(zipPath, { force: true });
execFileSync('zip', ['-qr', zipPath, folderName], { cwd: stage });
copyFileSync(join(root, 'dist/furi-ime.global.js'), join(artifactDir, `furi-ime-v${pkg.version}.global.js`));
rmSync(stage, { recursive: true, force: true });
console.log(`Release bundle: ${zipPath}`);
