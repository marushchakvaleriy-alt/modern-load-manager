const XLSX = require('xlsx');

const parseExcelDate = (excelDate) => {
  if (!excelDate) return '';
  if (typeof excelDate === 'number') {
    const epochOrigin = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(epochOrigin.getTime() + excelDate * 86400000);
    return jsDate.toISOString();
  }
  if (typeof excelDate === 'string') {
    let datePart = excelDate.split(' ')[0];
    let parts = datePart.split('.');
    if (parts.length === 3) {
      const formattedStr = `${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`;
      const date = new Date(formattedStr);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    parts = datePart.split('/');
    if (parts.length === 3) {
      let year = Number(parts[2]);
      if (year < 100) year += 2000;
      const formattedStr = `${year}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}T00:00:00.000Z`;
      const date = new Date(formattedStr);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    const nativeDate = new Date(excelDate);
    if (!isNaN(nativeDate.getTime())) return nativeDate.toISOString();
    return excelDate;
  }
  return '';
};

const mapBitrixStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('заверш') || s.includes('complete')) return 'completed';
  if (s.includes('просроч') || s.includes('overdue')) return 'overdue';
  if (s.includes('ждет') || s.includes('awaiting')) return 'waiting';
  if (s.includes('выполня') || s.includes('роботі') || s.includes('progress')) return 'active';
  return 'active';
};

try {
  const workbook = XLSX.readFile('c:/Users/v_marushchak/Desktop/report (1).xls');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(sheet);
  
  let totalClosedPoints = 0;
  let marchClosedPoints = 0;
  let otherMonthClosedPoints = 0;
  let missingDateClosedPoints = 0;

  jsonData.forEach((row, index) => {
    const status = mapBitrixStatus(row['Статус']);
    if (status !== 'completed') return;

    let points = 1;
    const explicitPoints = row['Point'] || row['Поинты'] || row['Поінти'];
    
    if (explicitPoints !== undefined && explicitPoints !== '') {
      points = Number(explicitPoints);
    } else if (row['Планируемые трудозатраты']) {
      const timeStr = String(row['Планируемые трудозатраты']);
      if (timeStr.includes(':')) {
        const [h, m] = timeStr.split(':');
        const hours = Number(h) + (Number(m) / 60);
        points = Math.round(hours * 1.5);
      } else {
        points = Math.round(Number(timeStr) * 1.5);
      }
    }
    if (isNaN(points) || points < 1) points = 1;

    totalClosedPoints += points;

    const completedRaw = row['Дата завершения'] || row['Completed on'] || row['Дата завершення'];
    const completedAt = parseExcelDate(completedRaw);
    
    if (!completedAt) {
      missingDateClosedPoints += points;
      return;
    }

    const d = new Date(completedAt);
    if (!isNaN(d.getTime())) {
      if (d.getMonth() === 2 && d.getFullYear() === 2026) { // Month is 0-indexed, 2 = March
        marchClosedPoints += points;
      } else {
        otherMonthClosedPoints += points;
      }
    } else {
       missingDateClosedPoints += points;
       console.log(`Failed to parse completion date for Row ${index}: Raw=${completedRaw}`);
    }
  });

  console.log(`--- ANALYSIS RESULTS ---`);
  console.log(`Total Points (All Completed Tasks): ${totalClosedPoints}`);
  console.log(`Points closed EXACTLY in March 2026: ${marchClosedPoints}`);
  console.log(`Points closed in Other Months/Years: ${otherMonthClosedPoints}`);
  console.log(`Points with missing/unparseable Completion Date: ${missingDateClosedPoints}`);

} catch (e) {
  console.error(e);
}
