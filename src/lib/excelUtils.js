import * as XLSX from 'xlsx';
import { normalizeImportedProjectDate } from './dateUtils';

const normalizeKeyPart = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/[|]/g, '')
    .replace(/["'`]/g, '');

export const getImportedProjectKey = (project) => {
  const normalizedName = normalizeKeyPart(project?.name);
  if (!normalizedName) return '';

  return normalizedName;
};

export const processBitrixExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '' });
        const formattedJsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

        const robustGet = (row, possibleNames) => {
          const keys = Object.keys(row);
          
          // Homoglyph normalization: Latin to Cyrillic lookalikes
          const homoglyphs = { 
            'a': 'а', 'c': 'с', 'e': 'е', 'o': 'о', 'p': 'р', 'x': 'х', 'y': 'у',
            'A': 'А', 'C': 'С', 'E': 'Е', 'O': 'О', 'P': 'Р', 'X': 'Х', 'Y': 'У'
          };
          
          const normalize = (s) => 
            String(s || '')
              .replace(/[\s\u00A0]+/g, ' ')
              .trim()
              .split('')
              .map(char => homoglyphs[char] || char)
              .join('')
              .toLowerCase();
          
          for (const name of possibleNames) {
            const target = normalize(name);
            const match = keys.find(k => {
              const key = normalize(k);
              // Match if exact or if one contains the other
              return key === target || key.includes(target) || target.includes(key);
            });
            if (match) return row[match];
          }
          return undefined;
        };

        const projects = jsonData.map((row, index) => {
          const formattedRow = formattedJsonData[index] || {};
          // Bitrix columns mapping
          let points = 1;
          const explicitPoints = robustGet(row, ['Point', 'Поинты', 'Поінти', 'Поінт', 'Оценка', 'Score']);
          
          if (explicitPoints !== undefined && explicitPoints !== '') {
            points = Number(explicitPoints);
          } else if (robustGet(row, ['Планируемые трудозатраты', 'Трудозатраты', 'План. час'])) {
            const timeVal = robustGet(row, ['Планируемые трудозатраты', 'Трудозатраты', 'План. час']);
            let hours = 0;
            
            if (typeof timeVal === 'number') {
              // Excel stores time as fraction of a day (e.g. 1:00 is 1/24 = 0.04166)
              hours = timeVal < 1 ? timeVal * 24 : timeVal;
            } else {
              const timeStr = String(timeVal);
              if (timeStr.includes(':')) {
                const parts = timeStr.split(':');
                hours = Number(parts[0] || 0) + (Number(parts[1] || 0) / 60);
              } else {
                hours = Number(timeStr) || 0;
              }
            }
            // 42 points / 7 work hours = 6 points per hour
            points = Math.round(hours * 6);
          }
          
          if (Number.isNaN(points) || points < 0) points = 0;

          // Mapping logic: exhaustive list of variations with homoglyph normalization
          const creationColNames = ['Дата создания', 'Дата созд', 'Дата створення', 'Created', 'Создано'];
          const completionColNames = ['Дата завершения', 'Дата завершення', 'Дата заверш', 'Завершено', 'Закрито', 'Дата закриття', 'Completed on'];
          const deadlineColNames = ['Крайний срок', 'Кrajní termín', 'Deadline', 'Крайній термін'];

          const startDate = parseExcelDate(
            robustGet(formattedRow, creationColNames) || robustGet(row, creationColNames),
            { preferPast: true, preferDayFirst: true }
          ) || null;
          const completedAt = parseExcelDate(
            robustGet(formattedRow, completionColNames) || robustGet(row, completionColNames),
            { preferPast: true, preferDayFirst: true }
          ) || null;
          const deadline = parseExcelDate(
            robustGet(formattedRow, deadlineColNames) || robustGet(row, deadlineColNames),
            { preferDayFirst: true }
          ) || null;

          const p = {
            id: `btx-${Date.now()}-${index}`,
            name: robustGet(row, ['Название', 'Title', 'Назва', 'Заголовок', 'Задача', 'Наименование']) || 'Без назви',
            status: completedAt ? 'completed' : mapBitrixStatus(robustGet(row, ['Статус', 'Status', 'Стан'])),
            assignedEmployee: String(robustGet(row, ['Ответственный', 'Responsible', 'Відповідальний', 'Виконавець', 'Исполнитель']) || 'Не призначено').trim(),
            points: Number(points),
            plannedTime: robustGet(row, ['Планируемые трудозатраты']) || '',
            spentTime: robustGet(row, ['Затраченное время', 'Витрачений час']) || '',
            direction: robustGet(row, ['Напрямок', 'Направление', 'Direction', 'Сфера', 'Вид діяльності']) || 'Загальне',
            taskType: robustGet(row, ['Категорія', 'Категория', 'Category', 'Вид робіт', 'Вид', 'Тип', 'Type', 'Правка/Нова']) || '',
            itemsInfo: robustGet(row, ['Виріб', 'Изделие', 'Product', 'виріб+кількість', 'items+qty']) || '',
            startDate,
            deadline,
            completedAt,
            type: 'bitrix',
            importedAt: new Date().toISOString()
          };

          p.sourceKey = getImportedProjectKey(p);

          return p;
        });

        resolve(projects);
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
};

const parseExcelDate = (val, options = {}) => {
  if (val === undefined || val === null || val === '') return null;

  // 1. Handle JS Date objects (best case, from cellDates: true)
  if (val instanceof Date || (typeof val === 'object' && typeof val.getMonth === 'function')) {
    const d = val;
    if (isNaN(d.getTime())) return null;
    
    // Normalize to date string. Using local methods might shift day if imported at midnight.
    // However, XLSX Date objects are usually calibrated to UTC or local depending on source.
    // Safest approach for "Date Only" usage:
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    
    // Check if it's very close to previous day due to TZ (e.g. 23:59:59)
    if (d.getHours() >= 23) {
       const next = new Date(d.getTime() + 3600000); // Shift 1 hour forward
       return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    }
    
    return `${Y}-${M}-${D}`;
  }

  // 2. Handle Excel Serial Numbers (immune to cultural swaps)
  if (typeof val === 'number') {
    // Excel thinks 1900 was a leap year, so we subtract 1 day (25569 -> 25568 maybe? No, 25569 is standard)
    // Actually standard JS conversion for Excel serial:
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    // Use UTC to keep the date invariant to user's local timezone
    const Y = date.getUTCFullYear();
    const M = String(date.getUTCMonth() + 1).padStart(2, '0');
    const D = String(date.getUTCDate()).padStart(2, '0');
    return `${Y}-${M}-${D}`;
  }

  // 3. Handle Strings (the risky part)
  const s = String(val).trim();
  if (!s) return null;

  // Split and take only the date part (ignore time like 14:30:00)
  const datePart = s.split(/\s+/)[0]; 
  const parts = datePart.split(/[./-]/);

  if (parts.length === 3) {
    let d, m, y;
    if (parts[0].length === 4) {
      // YYYY.MM.DD
      [y, m, d] = parts.map(Number);
    } else if (parts[2].length === 4 || parts[2].length === 2) {
      // DD.MM.YYYY/YY or MM.DD.YYYY/YY
      const p0 = Number(parts[0]);
      const p1 = Number(parts[1]);
      let p2 = Number(parts[2]);
      if (p2 < 100) p2 += 2000;

      // For Bitrix exports we prefer day-first dates like 2/4/26 => 2026-04-02
      if (options.preferDayFirst) {
        d = p0; m = p1; y = p2;
      } else if (p0 > 12 && p0 <= 31) {
        // Definitely DD.MM
        d = p0; m = p1; y = p2;
      } else if (p1 > 12 && p1 <= 31) {
        // Definitely MM.DD (Unlikely in UA, but possible in US exports)
        m = p0; d = p1; y = p2;
      } else {
        // Ambiguous (e.g. 03.12.2026). Default to DD.MM.YYYY as requested.
        d = p0; m = p1; y = p2;
      }
    }

    if (y && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return normalizeImportedProjectDate(
        `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        options
      );
    }
  }

  // Final fallback to native parser
  const lastD = new Date(s);
  if (!isNaN(lastD.getTime())) {
    const Y = lastD.getFullYear();
    const M = String(lastD.getMonth() + 1).padStart(2, '0');
    const D = String(lastD.getDate()).padStart(2, '0');
    return `${Y}-${M}-${D}`;
  }

  return null;
};

const mapBitrixStatus = (status) => {
  const s = String(status || '').toLowerCase();
  
  // Completed
  if (s.includes('заверш') || s.includes('complete')) return 'completed';
  
  // Overdue
  if (s.includes('просроч') || s.includes('overdue')) return 'overdue';
  
  // Waiting
  if (s.includes('ждет') || s.includes('awaiting')) return 'waiting';
  
  // Active
  if (s.includes('выполня') || s.includes('роботі') || s.includes('progress')) return 'active';
  
  return 'active'; // Default
};
