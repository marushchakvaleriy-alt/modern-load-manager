const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('c:/Users/v_marushchak/Desktop/report (1).xls');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // try parsing with raw: true or cellDates formatting
  const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false });
  
  const first5 = jsonData.slice(0, 10);
  first5.forEach((row, idx) => {
    console.log(`Row ${idx}:`);
    console.log(`  Name: ${row['Название']}`);
    console.log(`  Deadline raw: ${row['Крайний срок']}`);
  });
} catch (e) {
  console.error(e);
}
