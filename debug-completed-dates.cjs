const XLSX = require('xlsx');
const wb = XLSX.readFile('c:/Users/v_marushchak/Desktop/report (1).xls');
const d = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
let sumCompleted = 0;
let dateMap = {};

d.forEach((r, i) => {
  const status = String(r['Статус'] || '').toLowerCase();
  if (status.includes('заверш') || status.includes('complete')) {
    let pts = 1;
    if (r['Point']) pts = Number(r['Point']);
    else if (r['Планируемые трудозатраты']) pts = 5; 
    
    sumCompleted += pts;
    
    const rawDate = r['Дата завершения'];
    let parsedDate = '';
    let parsedMonth = '';

    if (typeof rawDate === 'number') {
      const epochOrigin = new Date(Date.UTC(1899, 11, 30));
      const jsDate = new Date(epochOrigin.getTime() + rawDate * 86400000);
      parsedDate = jsDate.toISOString();
      parsedMonth = jsDate.getMonth() + 1; // 1-indexed month
    } else if (typeof rawDate === 'string') {
        let parts = rawDate.split(' ')[0].split('.');
        if (parts.length === 3) {
            parsedMonth = Number(parts[1]);
        }
    }
    
    if (parsedMonth) {
      dateMap[parsedMonth] = (dateMap[parsedMonth] || 0) + pts;
    } else {
      dateMap['Unknown'] = (dateMap['Unknown'] || 0) + pts;
      if (i < 20) console.log("Unknown rawDate in completed row " + i + ":", rawDate);
    }
  }
});
console.log('Total completed points:', sumCompleted);
console.log('Points by parsed month:', dateMap);
