import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const seedPath = path.join(repoRoot, 'constants', 'systemKnowledgeSeed.ts');
const previewDir = path.join(repoRoot, 'public', 'knowledge-previews');
const sourceDirs = [
  path.join(repoRoot, 'BIỂU MẪU HỖ TRỢ VẬN HÀNH'),
  path.join(repoRoot, 'HỆ THỐNG NỘI QUY - QUY ĐỊNH CHÍNH'),
];

const appleScript = `
on run argv
  set inputPath to item 1 of argv
  set outputPath to item 2 of argv
  tell application "Microsoft Word"
    activate
    open (POSIX file inputPath)
    save as active document file name outputPath file format format PDF
    close active document saving no
  end tell
end run
`;

const walk = dir => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.docx') && !entry.name.startsWith('~$')) {
      return [fullPath];
    }
    return [];
  });
};

const normalize = value => value.normalize('NFC').toLowerCase();
const sourceFiles = new Map(
  sourceDirs.flatMap(walk).map(filePath => [normalize(path.basename(filePath)), filePath])
);

const seedSource = fs.readFileSync(seedPath, 'utf8');
const entries = [...seedSource.matchAll(/article\(\s*["'](?:standards|workflows|templates)["']\s*,\s*["']([^"']+)["'][\s\S]*?\n\s*["']([^"']+\.docx)["']/g)]
  .map(match => ({ id: match[1], fileName: match[2] }));

if (!entries.length) {
  throw new Error('Không tìm thấy tài liệu seed trong constants/systemKnowledgeSeed.ts');
}

fs.mkdirSync(previewDir, { recursive: true });

for (const entry of entries) {
  const sourcePath = sourceFiles.get(normalize(entry.fileName));
  if (!sourcePath) {
    console.warn(`Bỏ qua ${entry.id}: không tìm thấy ${entry.fileName}`);
    continue;
  }

  const outputPath = path.join(previewDir, `${entry.id}.pdf`);
  console.log(`Tạo preview: ${entry.fileName} -> ${path.relative(repoRoot, outputPath)}`);
  execFileSync('osascript', ['-e', appleScript, sourcePath, outputPath], { stdio: 'inherit' });
}

console.log(`Đã tạo xong ${entries.length} PDF preview trong ${path.relative(repoRoot, previewDir)}`);
