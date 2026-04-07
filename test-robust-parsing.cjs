const XLSX = require('xlsx');

const filePath = 'c:/Users/v_marushchak/Desktop/report (1).xls';

function robustGet(row, possibleNames) {
  const keys = Object.keys(row);
  for (const name of possibleNames) {
    const target = name.toLowerCase().trim();
    const match = keys.find(k => k.toLowerCase().trim() === target);
    if (match) return row[match];
  }
  return undefined;
}

try {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  let totalPoints = 0;
  let rowCount = 0;
  let closedPoints = 0;
  let closedCount = 0;

  data.forEach((row, i) => {
    const status = String(robustGet(row, ['Статус']) || '').toLowerCase();
    const isClosed = status.includes('заверш') || status.includes('complete');

    const pointsVal = robustGet(row, ['Point', 'Поинты', 'Поінти']);
    let p = 0;
    if (pointsVal !== undefined && pointsVal !== '') {
        p = Number(pointsVal);
    } else {
        const hoursVal = robustGet(row, ['Планируемые трудозатраты']);
        if (hoursVal) {
            p = Math.round(5); // placeholder
        }
    }
    
    if (isNaN(p) || p < 1) p = 1;

    totalPoints += p;
    rowCount++;

    if (isClosed) {
        closedPoints += p;
        closedCount++;
    }
  });

  console.log(`Summary for ${filePath}:`);
  console.log(`Total Rows (Tasks): ${rowCount}`);
  console.log(`Total Points (Sum): ${totalPoints}`);
  console.log(`---`);
  console.log(`Closed Rows (Tasks): ${closedCount}`);
  console.log(`Closed Points (Sum): ${closedPoints}`);

} catch (e) {
  console.error(e.message);
}
