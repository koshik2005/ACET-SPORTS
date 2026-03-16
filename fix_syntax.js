
const fs = require('fs');
const path = require('path');

const filePath = 'e:/PET/src/AdminPage.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// Line 1717 (1-indexed) is index 1716
const targetLineIdx = 1716;
const targetLine = lines[targetLineIdx];

console.log(`Original line 1717: "${targetLine}"`);

// Expecting something like "                                            ))}"
if (targetLine.includes('))}') && !targetLine.includes(')})')) {
    const fixedLine = targetLine.replace('))}', ')})}');
    lines[targetLineIdx] = fixedLine;
    console.log(`Fixed line 1717: "${fixedLine}"`);
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log('File updated successfully.');
} else {
    console.log('Pattern not found or already fixed.');
}
