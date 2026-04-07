const parseExcelDate = (excelDate) => {
  if (!excelDate) return '';
  
  if (typeof excelDate === 'number') {
    const epochOrigin = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(epochOrigin.getTime() + excelDate * 86400000);
    return jsDate.toISOString();
  }
  
  if (typeof excelDate === 'string') {
    // Handle formats like "DD.MM.YYYY" or "DD.MM.YYYY HH:MM:SS"
    let datePart = excelDate.split(' ')[0]; // Take only the date part
    let parts = datePart.split('.');
    
    if (parts.length === 3) {
      const formattedStr = `${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`;
      const date = new Date(formattedStr);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    
    // Handle MM/DD/YY
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

console.log("02.03.2026 =>", parseExcelDate("02.03.2026"));
console.log("02.03.2026 15:45:00 =>", parseExcelDate("02.03.2026 15:45:00"));
console.log("46268.0 =>", parseExcelDate(46268.0));
