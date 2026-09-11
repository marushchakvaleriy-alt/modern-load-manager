import { useCallback, useMemo } from 'react';
import { normalizeImportedProjectDate, parseDateOnly } from '../lib/dateUtils';

const toLocalDateStr = (d) => {
  if (!d || Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Hook for calculating department and designer load
 * Capacity: 42 points per day
 */
export const useLoadEngine = (projects, employees, absences = []) => {
  const CAPACITY_PER_DAY = 42;

  const parseProjectDate = useCallback(
    (value, options = {}) => {
      if (!value) return null;
      return parseDateOnly(normalizeImportedProjectDate(value, options));
    },
    []
  );

  const createDateRange = useCallback((startDateParam = null, endDateParam = null) => {
    const today = new Date();
    const rangeEnd = endDateParam ? new Date(endDateParam) : today;
    rangeEnd.setHours(23, 59, 59, 999);

    const rangeStart = startDateParam
      ? new Date(startDateParam)
      : new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
    rangeStart.setHours(0, 0, 0, 0);

    return { rangeStart, rangeEnd };
  }, []);

  // Helper: check if a given date string falls within any absence for an employee
  const isEmployeeAbsent = useCallback(
    (empIdOrName, dateStr) => {
      const target = (empIdOrName || '').toString().trim().toLowerCase();
      return absences.some(a => {
        const matchId = a.employeeId && a.employeeId.toString().trim().toLowerCase() === target;
        const matchName = a.employeeName && a.employeeName.trim().toLowerCase() === target;
        if (!matchId && !matchName) return false;

        const start = (a.startDate || '').slice(0, 10);
        const end = (a.endDate || '').slice(0, 10);
        return start && end && start <= dateStr && end >= dateStr;
      });
    },
    [absences]
  );

  // Count how many employees are present (not absent) on a given date
  // EXCLUDE Senior Designers and Ignored employees from capacity
  const presentEmployeeCount = useCallback((dateStr) => {
    if (!employees.length) return 1; 
    return employees.filter(emp => 
      !emp.isSenior && 
      !emp.isIgnored && 
      !isEmployeeAbsent(emp.id, dateStr) && 
      !isEmployeeAbsent(emp.name, dateStr)
    ).length;
  }, [employees, isEmployeeAbsent]);

  // Burndown chart: starts at total active points, decreases by available capacity each working day
  const departmentLoad = useMemo(() => {
    if (!projects.length) return [];

    const ignoredNames = new Set(
      employees.filter(e => e.isIgnored).map(e => (e.name || '').trim().toLowerCase())
    );

    const totalBacklogPoints = projects
      .filter(p => !ignoredNames.has((p.assignedEmployee || '').trim().toLowerCase()))
      .filter(p => p.status === 'active' || p.status === 'waiting' || p.status === 'overdue')
      .reduce((sum, p) => sum + (p.points || 0), 0);

    const today = new Date();
    const loadByDay = [];
    let remaining = totalBacklogPoints;

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dateStr = toLocalDateStr(date);
      const isWorkingDay = date.getDay() !== 0 && date.getDay() !== 6;
      const presentCount = isWorkingDay ? presentEmployeeCount(dateStr) : 0;
      const capacity = presentCount * CAPACITY_PER_DAY;

      // The first point (today) should show the current total backlog
      // We push the current state, THEN subtract today's capacity for the next point
      loadByDay.push({
        date,
        capacity,
        load: remaining,
        isWorkingDay
      });

      if (isWorkingDay && remaining > 0) {
        remaining = Math.max(0, remaining - capacity);
      }
    }

    return loadByDay;
  }, [projects, employees, presentEmployeeCount]);

  // Per-employee load breakdown for the Load tab
  const employeeLoad = useMemo(() => {
    const nameSet = new Set([
      ...projects.map(p => (p.assignedEmployee || '').trim()),
      ...employees.filter(e => !e.isIgnored).map(e => (e.name || '').trim())
    ].filter(Boolean));

    const ignoredNames = new Set(
      employees.filter(e => e.isIgnored).map(e => (e.name || '').trim().toLowerCase())
    );

    const today = new Date();
    const todayStr = toLocalDateStr(today);
    const totalWorkingDaysInMonth = (() => {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      let count = 0;
      const cur = new Date(startOfMonth);
      while (cur <= endOfMonth) {
        if (cur.getDay() !== 0 && cur.getDay() !== 6) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    })();
    const startOfMonthStr = toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
    const endOfMonthStr = toLocalDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 0));

    return [...nameSet]
      .filter(name => !ignoredNames.has(name.toLowerCase()))
      .map(name => {
        const normName = name.toLowerCase();
        const empData = employees.find(e => (e.name || '').trim().toLowerCase() === normName);
        const empId = empData?.id;

        const activeProjects = projects.filter(
          p => (p.status === 'active' || p.status === 'waiting') && (p.assignedEmployee || '').trim() === name
        );
        const completedProjects = projects.filter(
          p => p.status === 'completed' && (p.assignedEmployee || '').trim() === name
        );
        const overdueProjects = projects.filter(
          p => p.status === 'overdue' && (p.assignedEmployee || '').trim() === name
        );

        const active = activeProjects.reduce((s, p) => s + (p.points || 0), 0);
        const completed = completedProjects.reduce((s, p) => s + (p.points || 0), 0);
        const overdue = overdueProjects.reduce((s, p) => s + (p.points || 0), 0);
        const pending = active + overdue;
        const pendingCount = activeProjects.length + overdueProjects.length;

        // Absences
        const empAbsences = absences.filter(a => {
          const matchId = empId && a.employeeId && a.employeeId.toString().trim().toLowerCase() === empId.toString().trim().toLowerCase();
          const matchName = a.employeeName && a.employeeName.trim().toLowerCase() === normName;
          return matchId || matchName;
        });

        const currentAbsence = empAbsences.find(a => {
          const start = (a.startDate || '').slice(0, 10);
          const end = (a.endDate || '').slice(0, 10);
          return start && end && start <= todayStr && end >= todayStr;
        });

        const upcomingAbsence = empAbsences.find(a => {
          const start = (a.startDate || '').slice(0, 10);
          return start && start > todayStr && start <= endOfMonthStr;
        });

        let monthAbsenceDays = 0;
        let monthVacationDays = 0;
        let monthSickDays = 0;
        
        const cur = new Date(today.getFullYear(), today.getMonth(), 1);
        while (cur <= new Date(today.getFullYear(), today.getMonth() + 1, 0)) {
          if (cur.getDay() !== 0 && cur.getDay() !== 6) {
            const dateStr = toLocalDateStr(cur);
            const matched = empAbsences.find(a => {
              const s = (a.startDate || '').slice(0, 10);
              const e = (a.endDate || '').slice(0, 10);
              return s && e && s <= dateStr && e >= dateStr;
            });
            if (matched) {
              monthAbsenceDays++;
              if (matched.type === 'sick') monthSickDays++;
              else monthVacationDays++;
            }
          }
          cur.setDate(cur.getDate() + 1);
        }

        const availableWorkingDays = Math.max(0, totalWorkingDaysInMonth - monthAbsenceDays);
        const monthlyCapacity = availableWorkingDays * CAPACITY_PER_DAY;
          
        return { 
          name, 
          active, 
          completed, 
          overdue, 
          pending,
          total: active + completed + overdue,
          isSenior: !!empData?.isSenior,
          isIgnored: !!empData?.isIgnored,
          activeCount: activeProjects.length,
          completedCount: completedProjects.length,
          overdueCount: overdueProjects.length,
          pendingCount,
          totalWorkingDaysInMonth,
          monthAbsenceDays,
          monthVacationDays,
          monthSickDays,
          availableWorkingDays,
          monthlyCapacity,
          isCurrentlyAbsent: !!currentAbsence,
          currentAbsence,
          upcomingAbsence
        };
      }).sort((a, b) => (b.active + b.overdue) - (a.active + a.overdue));
  }, [projects, employees, absences]);

  // Shared helper: detect if a project is a revision (works for old & new data)
  const isRevision = (p) => {
    const taskTypeStr = String(p.taskType || p.category || '').trim().toLowerCase();
    
    // Explicit revision keywords in category or task name
    if (taskTypeStr.includes('правк')) return true;
    
    const nameStr = String(p.name || '').toLowerCase();
    if (nameStr.includes('правк')) return true;

    // Explicit new task keyword (Column O: Розробка нового)
    if (taskTypeStr.includes('розробка') || taskTypeStr.includes('нова')) return false;

    // Default for other/old tasks without explicit "правк": treat as new
    return false;
  };

  const calculateEfficiency = (employeeName, startDateParam = null, endDateParam = null) => {
    const { rangeStart, rangeEnd } = createDateRange(startDateParam, endDateParam);

    const employeeProjects = [];
    const unmatchedProjects = [];

    projects.forEach((p) => {
      const assigned = (p.assignedEmployee || '').trim().toLowerCase();
      if (assigned !== (employeeName || '').trim().toLowerCase()) return;

      const isCompleted = p.status === 'completed' || (p.completedAt && p.completedAt !== '-');
      if (!isCompleted) return;

      if (!p.completedAt || p.completedAt === '-') {
        unmatchedProjects.push({ ...p, unmatchReason: 'Відсутня дата закриття' });
        return;
      }

      const completedDate = parseProjectDate(p.completedAt, { preferPast: true });
      if (!completedDate) {
        unmatchedProjects.push({ ...p, unmatchReason: 'Не вдалося розпізнати дату' });
        return;
      }

      if (completedDate >= rangeStart && completedDate <= rangeEnd) {
        employeeProjects.push({ ...p, parsedCompletedDate: completedDate });
      }
    });

    const sortedCompleted = [...employeeProjects].sort((a, b) => {
      const dateA = a.completedAt || '';
      const dateB = b.completedAt || '';
      return dateB.localeCompare(dateA);
    });

    const actualPoints = sortedCompleted.reduce((sum, p) => sum + (p.points || 0), 0);

    const normName = (employeeName || '').trim().toLowerCase();
    const empData = employees.find(e => (e.name || '').trim().toLowerCase() === normName);
    const empId = empData?.id;
    const empAbsences = absences.filter(a => {
      const matchId = empId && a.employeeId && a.employeeId.toString().trim().toLowerCase() === empId.toString().trim().toLowerCase();
      const matchName = a.employeeName && a.employeeName.trim().toLowerCase() === normName;
      return matchId || matchName;
    });

    let totalWorkingDays = 0;
    let absenceWorkingDays = 0;
    let sickDays = 0;
    let vacationDays = 0;

    const cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        totalWorkingDays += 1;
        const dateStr = toLocalDateStr(cursor);
        
        const matchedAbsence = empAbsences.find(a => {
          const start = (a.startDate || '').slice(0, 10);
          const end = (a.endDate || '').slice(0, 10);
          return start && end && start <= dateStr && end >= dateStr;
        });

        if (matchedAbsence) {
          absenceWorkingDays += 1;
          if (matchedAbsence.type === 'sick') sickDays += 1;
          else vacationDays += 1;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const elapsedWorkingDays = Math.max(0, totalWorkingDays - absenceWorkingDays);
    const expectedPoints = CAPACITY_PER_DAY * elapsedWorkingDays;

    let totalRevisions = 0;
    let totalNew = 0;
    let plannedHours = 0;
    let spentHours = 0;
    let itemsCount = 0;

    const parseTime = (timeStr) => {
      if (!timeStr) return 0;
      const str = String(timeStr);
      if (str.includes(':')) {
        const parts = str.split(':');
        return Number(parts[0] || 0) + (Number(parts[1] || 0) / 60);
      }
      return Number(str) || 0;
    };

    sortedCompleted.forEach(p => {
      if (isRevision(p)) {
        totalRevisions++;
      } else {
        totalNew++;
      }
      
      plannedHours += parseTime(p.plannedTime);
      spentHours += parseTime(p.spentTime);
      
      // Items count from itemsInfo - robust regex & multi-item splitting
      if (p.itemsInfo && p.itemsInfo.trim() !== '') {
        const itemsList = parseItemsFromStr(p.itemsInfo);
        if (itemsList.length > 0) {
          itemsCount += itemsList.reduce((sum, item) => sum + item.qty, 0);
        } else {
          itemsCount += 1;
        }
      } else {
        // Fallback for some Bitrix formats where count is at the end
        const endMatch = String(p.name || '').match(/\s\((\d+)\)$/);
        if (endMatch) itemsCount += Number(endMatch[1]);
      }
    });

    return {
      efficiency: expectedPoints > 0 ? (actualPoints / expectedPoints) * 100 : (actualPoints > 0 ? 100 : 100),
      totalPoints: actualPoints,
      targetPoints: expectedPoints,
      totalWorkingDays,
      absenceWorkingDays,
      sickDays,
      vacationDays,
      elapsedWorkingDays,
      completedProjects: sortedCompleted,
      unmatchedProjects,
      advanced: {
        revisions: totalRevisions,
        newTasks: totalNew,
        plannedH: Math.round(plannedHours),
        spentH: Math.round(spentHours),
        items: itemsCount
      }
    };
  };

  const calculateDirectionStats = (startDateParam = null, endDateParam = null) => {
    const { rangeStart, rangeEnd } = createDateRange(startDateParam, endDateParam);
    const rawDirections = [...new Set(projects.map(p => p.direction).filter(Boolean))];
    const directions = rawDirections.length > 0 ? rawDirections : ['Загальне'];
    
    // If we have some directions but also some projects without direction, add 'Загальне' to the list
    if (rawDirections.length > 0 && projects.some(p => !p.direction)) {
      if (!directions.includes('Загальне')) directions.push('Загальне');
    }

    return directions.map(dir => {
      const isZagalne = dir === 'Загальне';
      const dirCompleted = projects.filter(p => 
        p.status === 'completed' && 
        (isZagalne ? (!p.direction || p.direction === 'Загальне') : p.direction === dir) &&
        (() => {
          const completedDate = parseProjectDate(p.completedAt, { preferPast: true });
          return completedDate && completedDate >= rangeStart && completedDate <= rangeEnd;
        })()
      );
      const dirActive = projects.filter(p => 
        (p.status === 'active' || p.status === 'waiting' || p.status === 'overdue') && 
        (isZagalne ? (!p.direction || p.direction === 'Загальне') : p.direction === dir) &&
        (() => {
          const createdDate = parseProjectDate(p.startDate, { preferPast: true });
          const completedDate = parseProjectDate(p.completedAt, { preferPast: true });
          const createdOk = !createdDate || createdDate <= rangeEnd;
          const notClosedBeforeEnd = !completedDate || completedDate > rangeEnd;
          return createdOk && notClosedBeforeEnd;
        })()
      );

      const completedPoints = dirCompleted.reduce((sum, p) => sum + (p.points || 0), 0);
      const activePoints    = dirActive.reduce((sum, p) => sum + (p.points || 0), 0);

      let itemsCount = 0;
      let newTasks = 0;
      let newTasksPoints = 0;
      let revisions = 0;
      let revisionsPoints = 0;

      dirCompleted.forEach(p => {
        const pts = Number(p.points) || 0;
        if (isRevision(p)) {
          revisions++;
          revisionsPoints += pts;
        } else {
          newTasks++;
          newTasksPoints += pts;
        }

        const itemsStr = String(p.itemsInfo || '');
        if (itemsStr) {
          const match = itemsStr.match(/\((\d+)\)/);
          itemsCount += match ? Number(match[1]) : 1;
        }
      });

      return {
        name: dir,
        completedPoints,
        activePoints,
        itemsCount,
        newTasks,
        newTasksPoints,
        revisions,
        revisionsPoints,
        totalTasks: dirCompleted.length
      };
    }).sort((a, b) => b.completedPoints - a.completedPoints);
  };

  const parseItemsFromStr = (itemsStr) => {
    if (!itemsStr || typeof itemsStr !== 'string') return [];
    // Split by comma, plus, semicolon, slash, or ampersand
    const parts = itemsStr.split(/[,+;/&]+/).map((s) => s.trim()).filter(Boolean);
    const items = [];

    parts.forEach((part) => {
      const match = part.match(/^([^(]+?)(?:\s*\(\s*(\d+)\s*\))?$/);
      const rawName = match ? match[1].trim() : part.trim();
      const qty = match && match[2] && !isNaN(Number(match[2])) ? parseInt(match[2], 10) : 1;

      if (!rawName) return;

      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
      items.push({ name, qty });
    });

    return items;
  };

  const calculateItemStats = (startDateParam = null, endDateParam = null) => {
    const { rangeStart, rangeEnd } = createDateRange(startDateParam, endDateParam);
    const itemMap = {};

    projects
      .filter((p) => {
        if (p.status !== 'completed') return false;
        const completedDate = parseProjectDate(p.completedAt, { preferPast: true });
        if (!completedDate) return false;
        return completedDate >= rangeStart && completedDate <= rangeEnd;
      })
      .forEach((p) => {
        let itemsStr = String(p.itemsInfo || '').trim();
        if (!itemsStr) {
          const nameMatch = String(p.name || '').match(/виріб[:\s]+([^()]+)/i);
          if (nameMatch) {
            itemsStr = nameMatch[1].trim();
          } else {
            itemsStr = 'Не вказано (без деталізації)';
          }
        }

        const revision = isRevision(p);
        const items = parseItemsFromStr(itemsStr);
        const projectItemsMap = {};
        items.forEach(({ name: itemName, qty }) => {
          projectItemsMap[itemName] = (projectItemsMap[itemName] || 0) + qty;
        });

        Object.entries(projectItemsMap).forEach(([itemName, qty]) => {
          if (!itemMap[itemName]) {
            itemMap[itemName] = {
              name: itemName,
              count: 0,
              points: 0,
              projects: 0,
              newCount: 0,
              revisionCount: 0
            };
          }

          itemMap[itemName].count += qty;
          itemMap[itemName].projects += 1;
          itemMap[itemName].points += (p.points || 0);

          if (revision) {
            itemMap[itemName].revisionCount += qty;
          } else {
            itemMap[itemName].newCount += qty;
          }
        });
      });

    return Object.values(itemMap).sort((a, b) => b.count - a.count);
  };

  const calculateDailyFlow = (targetDirection = 'Всі', startDateParam = null, endDateParam = null) => {
    const rangeEnd = endDateParam ? new Date(endDateParam) : new Date();
    rangeEnd.setHours(23, 59, 59, 999);
    const rangeStart = startDateParam ? new Date(startDateParam) : new Date(rangeEnd);
    if (!startDateParam) rangeStart.setDate(rangeEnd.getDate() - 20);
    rangeStart.setHours(0, 0, 0, 0);
    
    const normTarget = String(targetDirection || '').trim().toLowerCase();
    const isAll = normTarget === '__all__' || normTarget === 'всі' || !normTarget;

    const filteredProjects = isAll
      ? projects 
      : projects.filter(p => {
          const dir = String(p.direction || 'Загальне').trim().toLowerCase();
          if (normTarget === 'загальне') return !p.direction || dir === 'загальне';
          return dir === normTarget;
        });

    const flowData = [];
    const cursor = new Date(rangeStart);

    while (cursor <= rangeEnd) {
      const d = new Date(cursor);
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      const dateStr = toLocalDateStr(d);
      const isWorkingDay = d.getDay() !== 0 && d.getDay() !== 6;
      
      // 1. Input: created on this exact day
      const input = filteredProjects.filter(p => {
        if (!p.startDate) return false;
        const createdDate = parseProjectDate(p.startDate, { preferPast: true });
        if (!createdDate) return false;
        const projectDay = new Date(createdDate);
        projectDay.setHours(0, 0, 0, 0);
        return projectDay.getTime() === dayStart.getTime();
      }).reduce((sum, p) => sum + (Number(p.points) || 0), 0);

      // 2. Completed: finished on this exact day
      const completed = filteredProjects.filter(p => {
        if (p.status !== 'completed' || !p.completedAt) return false;
        const compDate = parseDateOnly(normalizeImportedProjectDate(p.completedAt, { preferPast: true }));
        if (!compDate) return false;
        const projectDay = new Date(compDate);
        projectDay.setHours(0, 0, 0, 0);
        return projectDay.getTime() === dayStart.getTime();
      }).reduce((sum, p) => sum + (Number(p.points) || 0), 0);

      // 3. Buffer (end of day): created on or before dayEnd and not completed before dayEnd
      const bufferTasks = filteredProjects.filter(p => {
        if (!p.startDate) return true;
        const createdDate = parseDateOnly(normalizeImportedProjectDate(p.startDate, { preferPast: true }));
        if (createdDate && createdDate > dayEnd) return false;

        if (p.status === 'completed' && p.completedAt) {
          const compDate = parseProjectDate(p.completedAt, { preferPast: true });
          if (compDate && compDate <= dayEnd) return false;
        }
        return true;
      });

      const buffer = bufferTasks.reduce((sum, p) => sum + (Number(p.points) || 0), 0);

      // 4. Overdue: in buffer and passed deadline
      const overdue = bufferTasks.filter(p => {
        if (!p.deadline) return false;
        const deadlineDate = parseProjectDate(p.deadline);
        if (!deadlineDate) return false;
        return deadlineDate < dayEnd;
      }).reduce((sum, p) => sum + (Number(p.points) || 0), 0);

      const dailyPerformers = new Set(
        bufferTasks.filter(p => p.assignedEmployee && p.assignedEmployee !== 'Не призначено')
          .map(p => p.assignedEmployee)
      );
      const assignedPerformersCount = dailyPerformers.size;
      const baseEmployeeCount = presentEmployeeCount(dateStr);
      
      // If employees DB is empty, use the maximum number of performers we've ever seen
      // effectively identifying "team size" from the task list.
      const teamSize = employees.length > 0 
        ? baseEmployeeCount 
        : Math.max(assignedPerformersCount, new Set(projects.map(p => p.assignedEmployee).filter(n => n && n !== 'Не призначено')).size);

      const capacityCount = isAll ? teamSize : Math.min(assignedPerformersCount, baseEmployeeCount);
      const capacity = isWorkingDay ? (capacityCount * CAPACITY_PER_DAY) : 0;

      const isToday = dateStr === toLocalDateStr(new Date());
      const finalBuffer = isToday 
        ? filteredProjects.filter(p => p.status !== 'completed').reduce((sum, p) => sum + (Number(p.points) || 0), 0)
        : buffer;
      const finalOverdue = isToday
        ? filteredProjects.filter(p => p.status === 'overdue').reduce((sum, p) => sum + (Number(p.points) || 0), 0)
        : overdue;

      flowData.push({
        date: d,
        dateLabel: d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
        input,
        completed,
        buffer: finalBuffer,
        overdue: finalOverdue,
        capacity,
        performersCount: capacityCount
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return flowData;
  };

  return { departmentLoad, employeeLoad, calculateEfficiency, calculateDirectionStats, calculateItemStats, calculateDailyFlow, CAPACITY_PER_DAY };
};
