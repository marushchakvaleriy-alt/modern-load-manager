const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Find any xlsx file in the current folder or Desktop
const searchDirs = [
  process.cwd(),
  path.join(process.env.USERPROFILE || '', 'Desktop'),
];

let xlsxFile = null;
for (const dir of searchDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  if (files.length > 0) {
    xlsxFile = path.join(dir, files[0]);
    break;
  }
}

if (!xlsxFile) {
  console.error('❌ Не знайдено жодного xlsx файлу. Вкажіть шлях вручну.');
  process.exit(1);
}

console.log(`\n📄 Читаємо файл: ${xlsxFile}\n`);

const workbook = XLSX.readFile(xlsxFile);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(sheet);

if (jsonData.length === 0) {
  console.error('❌ Файл порожній');
  process.exit(1);
}

const firstRow = jsonData[0];
console.log('=== Всі назви колонок у файлі ===');
Object.keys(firstRow).forEach((key, i) => {
  console.log(`  ${String.fromCharCode(65 + i)}: "${key}" = "${String(firstRow[key]).slice(0, 50)}"`);
});

console.log('\n=== Приклади значень з першого рядку ===');

// Check N, O, P columns specifically
const keys = Object.keys(firstRow);
const colN = keys[13]; // index 13 = column N
const colO = keys[14]; // index 14 = column O  
const colP = keys[15]; // index 15 = column P

if (colN) console.log(`\nN: "${colN}" = "${firstRow[colN]}"`);
if (colO) console.log(`O: "${colO}" = "${firstRow[colO]}"`);
if (colP) console.log(`P: "${colP}" = "${firstRow[colP]}"`);

// Show unique values for O column (category)
if (colO) {
  const uniqueO = [...new Set(jsonData.map(r => r[colO]).filter(Boolean))];
  console.log(`\n=== Унікальні значення стовпчика O ("${colO}") ===`);
  uniqueO.forEach(v => console.log(`  "${v}"`));
}
