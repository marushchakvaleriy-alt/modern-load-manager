const XLSX = require('xlsx');
const wb = XLSX.readFile('c:/Users/v_marushchak/Desktop/report (1).xls');
const s = wb.Sheets[wb.SheetNames[0]];
const d = XLSX.utils.sheet_to_json(s);
let closedCount = 0;
d.forEach((r, i) => {
  const status = String(r['Статус'] || '').toLowerCase();
  if (status.includes('заверш')) {
     if (closedCount < 10) {
        console.log(`Row ${i} - CompletedAt: ${r['Дата завершения']}, Deadline: ${r['Крайний срок']}, Points: ${r['Point']}`);
     }
     closedCount++;
  }
});
