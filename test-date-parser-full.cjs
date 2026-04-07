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

try {
  const workbook = XLSX.readFile('c:/Users/v_marushchak/Desktop/report (1).xls');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false }); // Try raw: false which gives strings
  const jsonDataRaw = XLSX.utils.sheet_to_json(sheet, { raw: true }); // Try raw: true which gives numbers
  
  console.log("--- RAW = FALSE (Strings) ---");
  for(let i=0; i<5; i++) {
     const val = jsonData[i]['Крайний срок'];
     console.log(`Row ${i} Raw:`, val, "Parsed:", parseExcelDate(val));
  }
  
  console.log("\n--- RAW = TRUE (Numbers) ---");
  for(let i=0; i<5; i++) {
     const val = jsonDataRaw[i]['Крайний срок'];
     console.log(`Row ${i} Raw:`, val, "Parsed:", parseExcelDate(val));
  }

} catch (e) {
  console.error(e);
}
