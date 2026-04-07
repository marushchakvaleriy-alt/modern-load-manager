const XLSX = require('xlsx');
const fs = require('fs');

const file = 'C:\\Users\\v_marushchak\\Desktop\\report (1).xls';
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const keys = Object.keys(rows[0] || {});
const out = [];

out.push('=== ALL COLUMN NAMES ===');
keys.forEach((k, i) => out.push(`  ${i}: "${k}"`));

const dirCol  = keys.find(k => /напрям|direction/i.test(k));
const catCol  = keys.find(k => /катег|вид роб/i.test(k));
const statCol = keys.find(k => /^статус$/i.test(k));

out.push(`\n=== DETECTED COLUMNS ===`);
out.push(`  DIR: "${dirCol}"`);
out.push(`  CAT: "${catCol}"`);
out.push(`  STAT: "${statCol}"`);

// Unique directions
const dirs = [...new Set(rows.map(r => String(r[dirCol]||'').trim()))];
out.push(`\n=== UNIQUE DIRECTIONS ===`);
dirs.forEach(d => out.push(`  "${d}"`));

// ED + Правки analysis
const ed = rows.filter(r => String(r[dirCol]||'').trim() === 'ED');
const edPr = ed.filter(r => String(r[catCol]||'').toLowerCase().includes('правк'));

out.push(`\n=== ED ANALYSIS ===`);
out.push(`  Total ED rows: ${ed.length}`);
out.push(`  ED + Правки (all statuses): ${edPr.length}`);

const byStatus = {};
edPr.forEach(r => {
  const s = String(r[statCol]||'unknown').trim();
  byStatus[s] = (byStatus[s]||0) + 1;
});
out.push(`\n  By status:`);
Object.entries(byStatus).forEach(([s,c]) => out.push(`    "${s}": ${c}`));

// Sample cat values
const catSamples = [...new Set(ed.map(r => String(r[catCol]||'')).filter(Boolean))];
out.push(`\n  Unique category values for ED: ${JSON.stringify(catSamples)}`);

fs.writeFileSync('debug-output.txt', out.join('\n'), 'utf8');
console.log('Done. See debug-output.txt');
