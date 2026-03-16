
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/AdminPage.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// Line 1717 (1-indexed) is index 1716
const targetLineIdx = 1716;
const targetLine = lines[targetLineIdx];

console.log(`Original line 1717: "${targetLine}"`);

if (targetLine.includes('))}') && !targetLine.includes(')})')) {
    const fixedLine = targetLine.replace('))}', ')})}');
    lines[targetLineIdx] = fixedLine;
    console.log(`Fixed line 1717: "${fixedLine}"`);
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log('File updated successfully.');
} else {
    // Search for the line if 1716 is not the right index (e.g. CRLF issues)
    console.log('Index mismatch? Searching for pattern...');
    let found = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('setEditRegForm({ game: gamesArr') && lines[i+5] && lines[i+5].includes('))}')) {
             lines[i+5] = lines[i+5].replace('))}', ')})}');
             fs.writeFileSync(filePath, lines.join('\n'));
             console.log(`Found and fixed at line ${i+6}`);
             found = true;
             break;
        }
    }
    if (!found) console.log('Pattern not found.');
}
