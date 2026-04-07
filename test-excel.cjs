const XLSX = require('xlsx');

const mapBitrixStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('заверш') || s.includes('complete')) return 'completed';
  if (s.includes('ждет') || s.includes('awaiting')) return 'waiting';
  if (s.includes('выполня') || s.includes('progress')) return 'active';
  return 'active';
};

try {
  const workbook = XLSX.readFile('c:/Users/v_marushchak/Desktop/report (1).xls');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Total rows parsed: ${jsonData.length}`);
  let failedCount = 0;

  for (let index = 0; index < jsonData.length; index++) {
    const row = jsonData[index];
    try {
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

        const project = {
            id: `btx-${Date.now()}-${index}`,
            name: row['Название'] || row['Title'] || row['Назва'] || 'Без назви',
            status: mapBitrixStatus(row['Статус'] || row['Status'] || row['Стан']),
            assignedEmployee: String(row['Ответственный'] || row['Responsible'] || row['Відповідальний'] || 'Не призначено').trim(),
            points: Number(points) || 1,
            plannedTime: row['Планируемые трудозатраты'] || '',
            spentTime: row['Затраченное время'] || row['Витрачений час'] || '',
            category: row['Категория'] || row['Category'] || row['Категорія'] || '',
            itemsInfo: row['виріб+кількість'] || row['items+qty'] || '',
            startDate: row['Дата начала'] || row['Дата початку'] || new Date().toISOString(),
            deadline: row['Крайний срок'] || row['Deadline'] || row['Крайній термін'] || '',
            type: 'bitrix',
            importedAt: new Date().toISOString()
        };

        // Check for Firebase incompatible values
        for (const [key, value] of Object.entries(project)) {
            if (value === undefined) {
                throw new Error(`Field ${key} is undefined`);
            }
            if (typeof value === 'number' && isNaN(value)) {
                 throw new Error(`Field ${key} is NaN`);
            }
        }

    } catch (e) {
         console.error(`\nFailed at row ${index}: Name: ${row['Название']}`, e.message);
         console.log(JSON.stringify(row, null, 2));
         failedCount++;
         if (failedCount > 2) break; // Stop after a few errors
    }
  }

  if (failedCount === 0) {
      console.log("All 130 rows passed the data checks!");
  }

} catch (e) {
  console.error("Error parsing file:", e);
}
