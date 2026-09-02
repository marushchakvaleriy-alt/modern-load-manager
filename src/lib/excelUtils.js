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
  const btxId = String(project?.bitrixId || project?.externalId || '').trim();
  if (btxId) {
    return `btx_${btxId}`;
  }

  const normalizedName = normalizeKeyPart(project?.name);
  if (!normalizedName) return '';

  const normalizedEmp = normalizeKeyPart(project?.assignedEmployee);
  if (normalizedEmp) {
    return `${normalizedName}___${normalizedEmp}`;
  }

  return normalizedName;
};

export const processBitrixExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const projects = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
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

          jsonData.forEach((row, index) => {
            const formattedRow = formattedJsonData[index] || {};
            const rowStr = JSON.stringify(row).toLowerCase();
            
            // Skip summary rows
            if (rowStr.includes('итого') || rowStr.includes('всего') || rowStr.includes('разом') || rowStr.includes('всього')) {
              return;
            }

            const rawName = String(robustGet(row, ['Название', 'Title', 'Назва', 'Заголовок', 'Задача', 'Наименование']) || '').trim();
            
            // Skip rows where the name is purely a time/number format (likely a shifted summary row)
            if (/^(\d+[:.]\d{2})$/.test(rawName)) {
              return;
            }

            // Bitrix columns mapping
            let points = 0;
            const explicitPoints = robustGet(row, ['Point', 'Поинты', 'Поінти', 'Поінт', 'Score']);
            
            if (explicitPoints !== undefined && explicitPoints !== '' && !Number.isNaN(Number(explicitPoints))) {
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

            const rawId = String(robustGet(row, ['ID', 'Id', 'Айді', 'ID задачи', 'Номер', '№', 'Код', 'Идентификатор', 'Task ID', 'Task_id']) || '').trim();

            const p = {
              id: rawId ? `btx-${rawId}` : `btx-${Date.now()}-${projects.length}-${index}`,
              bitrixId: rawId,
              externalId: rawId,
              name: robustGet(row, ['Название', 'Title', 'Назва', 'Заголовок', 'Задача', 'Наименование']) || 'Без назви',
              status: completedAt ? 'completed' : mapBitrixStatus(robustGet(row, ['Статус', 'Status', 'Стан'])),
              assignedEmployee: String(robustGet(row, ['Ответственный', 'Responsible', 'Відповідальний', 'Виконавець', 'Исполнитель']) || 'Не призначено').trim(),
              points: Number(points),
              plannedTime: robustGet(row, ['Планируемые трудозатраты']) || '',
              spentTime: robustGet(row, ['Затраченное время', 'Витрачений час']) || '',
              direction: robustGet(row, ['Напрямок', 'Направление', 'Direction', 'Сфера', 'Вид діяльності']) || 'Загальне',
              taskType: robustGet(row, ['Категорія', 'Категория', 'Category', 'Розробка/Правка', 'Правка/Нова', 'Вид робіт', 'Вид', 'Тип', 'Type']) || '',
              itemsInfo: robustGet(row, ['виріб+кількість', 'виріб + кількість', 'виріб/кількість', 'Виріб', 'Изделие', 'Product', 'items+qty', 'виріб кількість']) || '',
              startDate,
              deadline,
              completedAt,
              type: 'bitrix',
              importedAt: new Date().toISOString()
            };

            p.sourceKey = getImportedProjectKey(p);
            
            // Set department based on sheet name if not available
            if (sheetName.toLowerCase().includes('конструювання') || sheetName.toLowerCase().includes('construction')) {
               p.department = 'construction';
            } else if (sheetName.toLowerCase().includes('проєкт') || sheetName.toLowerCase().includes('design')) {
               p.department = 'design';
            }

            projects.push(p);
          });
        }

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

export const parseBitrixText = (text) => {
  if (!text || typeof text !== 'string') return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    // Not JSON
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const projects = [];

  const tabRows = lines.filter((l) => l.includes('\t'));
  if (tabRows.length > 0) {
    tabRows.forEach((rowStr, idx) => {
      const cols = rowStr.split('\t').map((c) => c.trim());
      if (cols.length >= 2) {
        const name = cols[0];
        const emp = cols[2] || cols[1];
        const ptsStr = cols[3] || '1';
        const statusStr = cols[4] || cols[3] || 'active';
        const deadlineStr = cols[5] || cols[4] || null;

        if (name && name !== 'НАЗВА ПРОЄКТУ' && name !== 'Назва') {
          projects.push({
            id: `btx-txt-${Date.now()}-${idx}`,
            name,
            assignedEmployee: emp,
            points: Number(ptsStr) || 1,
            status: mapBitrixStatus(statusStr),
            deadline: deadlineStr && deadlineStr !== '-' ? deadlineStr : null,
            type: 'bitrix',
            importedAt: new Date().toISOString()
          });
        }
      }
    });
  }

  return projects;
};

/**
 * Export full department salary audit report with summary & details to Excel
 */
export const exportSalaryAuditExcel = ({
  departmentName,
  startDate,
  endDate,
  auditData = []
}) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary by Employee
  const summaryRows = auditData.map((item, idx) => ({
    '№': idx + 1,
    'Виконавець': item.employeeName,
    'Виконано поінтів': item.stats.totalPoints,
    'План поінтів': item.stats.targetPoints,
    'Ефективність (%)': Math.round(item.stats.efficiency) + '%',
    'Закрито задач': item.stats.completedProjects?.length || 0,
    'Нових задач': item.stats.advanced?.newTasks || 0,
    'Правок': item.stats.advanced?.revisions || 0,
    'Факт годин': item.stats.advanced?.spentH || 0,
    'План годин': item.stats.advanced?.plannedH || 0,
    'Виробів (шт)': item.stats.advanced?.items || 0,
    'Робочих днів у періоді': item.stats.elapsedWorkingDays || 0
  }));

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Зведена ЗП');

  // Sheet 2: All Tasks Details
  const allTasksRows = [];
  let taskCounter = 1;
  auditData.forEach((item) => {
    (item.stats.completedProjects || []).forEach((p) => {
      allTasksRows.push({
        '№': taskCounter++,
        'Виконавець': item.employeeName,
        'ID Бітрікс': p.bitrixId || p.externalId || '',
        'Назва задачі': p.name || '',
        'Дата закриття': p.completedAt || '',
        'Поінти': p.points || 0,
        'Категорія': p.taskType || (String(p.name || '').toLowerCase().includes('правк') ? 'Правки' : 'Нова розробка'),
        'Напрямок': p.direction || 'Загальне',
        'Витрачений час': p.spentTime || '',
        'План час': p.plannedTime || '',
        'Вироби': p.itemsInfo || '',
        'Посилання Бітрікс': p.bitrixId ? `https://portal.viyar.ua/company/personal/user/1/tasks/task/view/${p.bitrixId}/` : ''
      });
    });
  });

  const wsTasks = XLSX.utils.json_to_sheet(allTasksRows);
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Детальні задачі');

  const cleanDept = String(departmentName || 'Відділ').replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `Звіт_ЗП_${cleanDept}_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * Export single employee completed tasks to Excel
 */
export const exportSingleEmployeeAuditExcel = ({
  employeeName,
  startDate,
  endDate,
  stats
}) => {
  const wb = XLSX.utils.book_new();

  const tasksRows = (stats?.completedProjects || []).map((p, idx) => ({
    '№': idx + 1,
    'ID Бітрікс': p.bitrixId || p.externalId || '',
    'Назва задачі': p.name || '',
    'Дата закриття': p.completedAt || '',
    'Поінти': p.points || 0,
    'Категорія': p.taskType || (String(p.name || '').toLowerCase().includes('правк') ? 'Правки' : 'Нова розробка'),
    'Напрямок': p.direction || 'Загальне',
    'Витрачений час': p.spentTime || '',
    'План час': p.plannedTime || '',
    'Вироби': p.itemsInfo || '',
    'Посилання Бітрікс': p.bitrixId ? `https://portal.viyar.ua/company/personal/user/1/tasks/task/view/${p.bitrixId}/` : ''
  }));

  const wsTasks = XLSX.utils.json_to_sheet(tasksRows);
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Задачі');

  const cleanName = String(employeeName || 'Співробітник').replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `ЗП_${cleanName}_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * Export department salary audit report matching company Excel template exactly:
 * - Grouped by employee with blue banner
 * - All columns A to P matching Bitrix export
 * - Employee subtotal row with total points and "Нові вироби - X (Y поінт), правки - Z (W поінти)"
 */
export const exportStandardSalaryTemplateExcel = ({
  departmentName,
  startDate,
  endDate,
  auditData = []
}) => {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Название',
    'Статус',
    'Дата создания',
    'Крайний срок',
    'Дата завершения',
    'Планируемые трудозатраты',
    'Затраченное время',
    'Постановщик',
    'Ответственный',
    'Затраченное время (отчетный период)',
    'Кількість виробів',
    'Point',
    'Вид робіт',
    'Напрямок',
    'Категория',
    'виріб+кількість'
  ];

  const rows = [headers];

  auditData.forEach((item) => {
    const empName = item.employeeName;
    const completedTasks = item.stats.completedProjects || [];
    if (completedTasks.length === 0) return;

    // 1. Employee Header Row (Banner)
    const headerRow = new Array(16).fill('');
    headerRow[8] = empName; // Col I: Ответственный
    rows.push(headerRow);

    let totalPoints = 0;
    let newCount = 0;
    let newPoints = 0;
    let revCount = 0;
    let revPoints = 0;

    const formatDate = (d) => {
      if (!d || d === '-') return '';
      const parts = String(d).split(' ')[0].split(/[-.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
      return d;
    };

    // 2. Task rows for this employee
    completedTasks.forEach((p) => {
      const isRev =
        String(p.taskType || '').toLowerCase().includes('правк') ||
        String(p.name || '').toLowerCase().includes('правк');

      const pts = Number(p.points) || 0;
      totalPoints += pts;

      if (isRev) {
        revCount++;
        revPoints += pts;
      } else {
        newCount++;
        newPoints += pts;
      }

      const taskRow = [
        p.name || '',
        'Завершена',
        formatDate(p.startDate || p.createdAt),
        formatDate(p.deadline),
        formatDate(p.completedAt),
        p.plannedTime || '',
        p.spentTime || '',
        p.creator || 'Салимко Вікторія',
        empName,
        p.spentTime || '',
        p.itemsInfo ? 1 : 0,
        pts,
        isRev ? 'Правки' : 'Креслення на погодження',
        p.direction || 'Загальне',
        isRev ? 'Правки' : 'Розробка нового',
        p.itemsInfo || ''
      ];
      rows.push(taskRow);
    });

    // 3. Employee Summary / Subtotal Row (like row 18 in screenshot)
    const summaryRow = new Array(16).fill('');
    summaryRow[8] = empName; // Col I: Employee name
    summaryRow[11] = totalPoints; // Col L: Total points
    summaryRow[15] = `Нові вироби - ${newCount} (${newPoints} поінт), правки - ${revCount} (${revPoints} поінти)`; // Col P
    rows.push(summaryRow);

    // Empty separator row
    rows.push(new Array(16).fill(''));
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Precise column widths
  ws['!cols'] = [
    { wch: 58 }, // A: Название
    { wch: 13 }, // B: Статус
    { wch: 14 }, // C: Дата создания
    { wch: 14 }, // D: Крайний срок
    { wch: 14 }, // E: Дата завершения
    { wch: 12 }, // F: Планируемые трудозатраты
    { wch: 12 }, // G: Затраченное время
    { wch: 22 }, // H: Постановщик
    { wch: 24 }, // I: Ответственный
    { wch: 16 }, // J: Затраченное время (отчетный период)
    { wch: 12 }, // K: Кількість виробів
    { wch: 10 }, // L: Point
    { wch: 28 }, // M: Вид робіт
    { wch: 12 }, // N: Напрямок
    { wch: 18 }, // O: Категория
    { wch: 48 }  // P: виріб+кількість
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Звіт ЗП відділу');

  const cleanDept = String(departmentName || 'Відділ').replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `Звіт_ЗП_${cleanDept}_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

