const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Find xlsx file
const searchDirs = [
  'C:\\Users\\v_marushchak\\Desktop',
  process.cwd(),
];

let xlsxFile = process.argv[2] || null;

if (!xlsxFile) {
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    if (files.length > 0) { xlsxFile = path.join(dir, files[0]); break; }
  }
}

if (!xlsxFile) { console.error('Не знайдено xlsx файл. Вкажіть шлях: node debug-ed.cjs path/to/file.xlsx'); process.exit(1); }
console.log(`\nФайл: ${xlsxFile}\n`);

const workbook = XLSX.readFile(xlsxFile);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

// Detect column names
const first = rows[0] || {};
const keys = Object.keys(first);
console.log('Назви колонок:', keys.slice(10, 20).join(' | '), '\n');

// Find direction + category + status columns
const findCol = (names) => keys.find(k => names.some(n => k.toLowerCase().trim() === n.toLowerCase()));
const dirCol  = findCol(['напрямок', 'направление', 'direction']) || keys[13];
const catCol  = findCol(['категорія', 'категория', 'category'])   || keys[14];
const statCol = findCol(['статус', 'status'])                      || keys[3];

console.log(`Напрямок   → "${dirCol}"`);
console.log(`Категорія  → "${catCol}"`);
console.log(`Статус     → "${statCol}"\n`);

// Filter ED rows
const edRows = rows.filter(r => String(r[dirCol] || '').trim() === 'ED');
console.log(`Всього рядків ED: ${edRows.length}`);

const edPravky = edRows.filter(r => String(r[catCol] || '').toLowerCase().includes('правк'));
console.log(`ED + Правки (всі статуси): ${edPravky.length}`);

// By status
const grouped = {};
edPravky.forEach(r => {
  const s = String(r[statCol] || 'невідомо').trim();
  grouped[s] = (grouped[s] || 0) + 1;
});
console.log('\nРозбивка ED+Правки за статусом:');
Object.entries(grouped).forEach(([s, c]) => console.log(`  "${s}": ${c}`));

// Unique category values in ED
const cats = [...new Set(edRows.map(r => String(r[catCol] || '').trim()))];
console.log('\nУнікальні значення Категорії для ED:', cats);
