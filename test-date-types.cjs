const XLSX = require('xlsx');
const wb = XLSX.readFile('c:/Users/v_marushchak/Desktop/report (1).xls');
const s = wb.Sheets[wb.SheetNames[0]];

const d_raw = XLSX.utils.sheet_to_json(s);

for(let i=0; i<5; i++) {
  const cDate = d_raw[i]['Дата создания'];
  const dDate = d_raw[i]['Крайний срок'];
  const zDate = d_raw[i]['Дата завершения'];
  console.log(`Row ${i}: Created (${typeof cDate}): ${cDate} | Deadline (${typeof dDate}): ${dDate} | Completed (${typeof zDate}): ${zDate}`);
}
