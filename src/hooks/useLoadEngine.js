import { useCallback, useMemo } from 'react';
import { normalizeImportedProjectDate, parseDateOnly } from '../lib/dateUtils';

/**
 * Hook for calculating department and designer load
 * Capacity: 42 points per day
 */
export const useLoadEngine = (projects, employees, absences = []) => {
  const CAPACITY_PER_DAY = 42;

  // Helper: check if a given date string falls within any absence for an employee
  const isEmployeeAbsent = useCallback(
    (empId, dateStr) => absences.some(a => a.employeeId === empId && a.startDate <= dateStr && a.endDate >= dateStr),
    [absences]
  );

  // Count how many employees are present (not absent) on a given date
  // EXCLUDE Senior Designers from capacity because they only distribute tasks, not execute them
  const presentEmployeeCount = useCallback((dateStr) => {
    if (!employees.length) return 1; 
    return employees.filter(emp => !emp.isSenior && !isEmployeeAbsent(emp.id, dateStr)).length;
  }, [employees, isEmployeeAbsent]);

  // Burndown chart: starts at total active points, decreases by available capacity each working day
  const departmentLoad = useMemo(() => {
    if (!projects.length) return [];

    const totalBacklogPoints = projects
      .filter(p => p.status === 'active' || p.status === 'waiting' || p.status === 'overdue')
      .reduce((sum, p) => sum + (p.points || 0), 0);

    const today = new Date();
    const loadByDay = [];
    let remaining = totalBacklogPoints;

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dateStr = date.toISOString().split('T')[0];
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
  }, [projects, presentEmployeeCount]);

  // Per-employee load breakdown for the Load tab
  const employeeLoad = useMemo(() => {
    const nameSet = new Set(projects.map(p => (p.assignedEmployee || '').trim()).filter(Boolean));
    return [...nameSet].map(name => {
      const empData = employees.find(e => (e.name || '').trim().toLowerCase() === name.toLowerCase());

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
        
      return { 
        name, 
        active, 
        completed, 
        overdue, 
        total: active + completed + overdue,
        isSenior: !!empData?.isSenior,
        activeCount: activeProjects.length,
        completedCount: completedProjects.length,
        overdueCount: overdueProjects.length
      };
    }).sort((a, b) => b.active - a.active);
  }, [projects, employees]);

  // Shared helper: detect if a project is a revision (works for old & new data)
  const isRevision = (p) => {
    const checks = [
      String(p.taskType || ''),    // new field from column O
      String(p.category || ''),    // old field (was previously mapped)
    ];
    return checks.some(v => v.toLowerCase().includes('РїСЂР°РІРє'));
  };

  const calculateEfficiency = (employeeName) => {
    const employeeProjects = projects.filter(p =>
      p.status === 'completed' &&
      (p.assignedEmployee || '').trim().toLowerCase() === (employeeName || '').trim().toLowerCase()
    );

    const actualPoints = employeeProjects.reduce((sum, p) => sum + (p.points || 0), 0);
    const expectedPoints = 42 * 22;

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

    employeeProjects.forEach(p => {
      if (isRevision(p)) {
        totalRevisions++;
      } else {
        totalNew++;
      }
      
      plannedHours += parseTime(p.plannedTime);
      spentHours += parseTime(p.spentTime);
      
      // Items count from itemsInfo - robust regex
      if (p.itemsInfo && p.itemsInfo.trim() !== '') {
        const match = String(p.itemsInfo).match(/\((\d+)\)/);
        itemsCount += match ? Number(match[1]) : 1;
      } else {
        // Fallback for some Bitrix formats where count is at the end
        const endMatch = String(p.name || '').match(/\s\((\d+)\)$/);
        if (endMatch) itemsCount += Number(endMatch[1]);
      }
    });

    return {
      efficiency: (actualPoints / expectedPoints) * 100,
      totalPoints: actualPoints,
      targetPoints: expectedPoints,
      advanced: {
        revisions: totalRevisions,
        newTasks: totalNew,
        plannedH: Math.round(plannedHours),
        spentH: Math.round(spentHours),
        items: itemsCount
      }
    };
  };

  const calculateDirectionStats = () => {
    const rawDirections = [...new Set(projects.map(p => p.direction).filter(Boolean))];
    const directions = rawDirections.length > 0 ? rawDirections : ['Р—Р°РіР°Р»СЊРЅРµ'];
    
    // If we have some directions but also some projects without direction, add 'Р—Р°РіР°Р»СЊРЅРµ' to the list
    if (rawDirections.length > 0 && projects.some(p => !p.direction)) {
      if (!directions.includes('Р—Р°РіР°Р»СЊРЅРµ')) directions.push('Р—Р°РіР°Р»СЊРЅРµ');
    }

    return directions.map(dir => {
      const isZagalne = dir === 'Р—Р°РіР°Р»СЊРЅРµ';
      const dirCompleted = projects.filter(p => 
        p.status === 'completed' && 
        (isZagalne ? (!p.direction || p.direction === 'Р—Р°РіР°Р»СЊРЅРµ') : p.direction === dir)
      );
      const dirActive = projects.filter(p => 
        (p.status === 'active' || p.status === 'waiting') && 
        (isZagalne ? (!p.direction || p.direction === 'Р—Р°РіР°Р»СЊРЅРµ') : p.direction === dir)
      );

      const completedPoints = dirCompleted.reduce((sum, p) => sum + (p.points || 0), 0);
      const activePoints    = dirActive.reduce((sum, p) => sum + (p.points || 0), 0);

      let itemsCount = 0;
      let newTasks = 0;
      let revisions = 0;

      dirCompleted.forEach(p => {
        if (isRevision(p)) revisions++; else newTasks++;

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
        revisions,
        totalTasks: dirCompleted.length
      };
    }).sort((a, b) => b.completedPoints - a.completedPoints);
  };

  const calculateItemStats = () => {
    const itemMap = {};
    
    projects.filter(p => p.status === 'completed').forEach(p => {
      const itemsStr = String(p.itemsInfo || '');
      if (!itemsStr) return;

      const revision = isRevision(p);
      const parts = itemsStr.split(',').map(s => s.trim()).filter(Boolean);
      
      parts.forEach(part => {
        const match = part.match(/^([^(]+)(?:\((\d+)\))?$/);
        if (match) {
          const itemName = match[1].trim();
          const qty = match[2] ? Number(match[2]) : 1;
          
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
        }
      });
    });

    return Object.values(itemMap).sort((a, b) => b.count - a.count);
  };

  const calculateDailyFlow = (targetDirection = 'Р’СЃС–', startDateParam = null, endDateParam = null) => {
    const rangeEnd = endDateParam ? new Date(endDateParam) : new Date();
    rangeEnd.setHours(23, 59, 59, 999);
    const rangeStart = startDateParam ? new Date(startDateParam) : new Date(rangeEnd);
    if (!startDateParam) rangeStart.setDate(rangeEnd.getDate() - 20);
    rangeStart.setHours(0, 0, 0, 0);
    
    const normTarget = String(targetDirection || '').trim().toLowerCase();
    const isAll = normTarget === '__all__' || normTarget === 'РІСЃС–' || !normTarget;

    const filteredProjects = isAll
      ? projects 
      : projects.filter(p => {
          const dir = String(p.direction || 'Р—Р°РіР°Р»СЊРЅРµ').trim().toLowerCase();
          if (normTarget === 'Р·Р°РіР°Р»СЊРЅРµ') return !p.direction || dir === 'Р·Р°РіР°Р»СЊРЅРµ';
          return dir === normTarget;
        });

    const flowData = [];
    const cursor = new Date(rangeStart);

    while (cursor <= rangeEnd) {
      const d = new Date(cursor);
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      const dateStr = d.toISOString().split('T')[0];
      const dayEnd   = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      const isWorkingDay = d.getDay() !== 0 && d.getDay() !== 6;
      const dateStr = d.toISOString().split('T')[0];
      
      // 1. Input: created on this exact day
      const input = filteredProjects.filter(p => {
        if (!p.startDate) return false;
        const createdDate = parseDateOnly(normalizeImportedProjectDate(p.startDate, { preferPast: true }));
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

      // 3. Buffer: what rolled into this day from yesterday.
      // It includes tasks created before today started and not completed before today started.
      const bufferTasks = filteredProjects.filter(p => {
        if (!p.startDate) return true;
        const createdDate = parseDateOnly(normalizeImportedProjectDate(p.startDate, { preferPast: true }));
        if (!createdDate) return true;
        if (createdDate >= dayStart) return false;

        if (p.status === 'completed' && p.completedAt) {
          const compDate = parseDateOnly(normalizeImportedProjectDate(p.completedAt, { preferPast: true }));
          if (!compDate) return true;
          if (compDate < dayStart) return false;
        }
        return true;
      });

      const buffer = bufferTasks.reduce((sum, p) => sum + (Number(p.points) || 0), 0);

      // 4. Overdue: in buffer and passed deadline
      const overdue = bufferTasks.filter(p => {
        if (!p.deadline) return false;
        const deadlineDate = parseDateOnly(normalizeImportedProjectDate(p.deadline));
        if (!deadlineDate) return false;
        return deadlineDate < dayEnd;
      }).reduce((sum, p) => sum + (Number(p.points) || 0), 0);

      const dailyPerformers = new Set(
        bufferTasks.filter(p => p.assignedEmployee && p.assignedEmployee !== 'РќРµ РїСЂРёР·РЅР°С‡РµРЅРѕ')
          .map(p => p.assignedEmployee)
      );
      const assignedPerformersCount = dailyPerformers.size;
      const baseEmployeeCount = presentEmployeeCount(dateStr);
      
      // If employees DB is empty, use the maximum number of performers we've ever seen
      // effectively identifying "team size" from the task list.
      const teamSize = employees.length > 0 
        ? baseEmployeeCount 
        : Math.max(assignedPerformersCount, new Set(projects.map(p => p.assignedEmployee).filter(n => n && n !== 'РќРµ РїСЂРёР·РЅР°С‡РµРЅРѕ')).size);

      const capacityCount = isAll ? teamSize : Math.min(assignedPerformersCount, baseEmployeeCount);
      const capacity = isWorkingDay ? (capacityCount * CAPACITY_PER_DAY) : 0;

      flowData.push({
        date: d,
        dateLabel: d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
        input,
        completed,
        buffer,
        overdue,
        capacity,
        performersCount: capacityCount
      });

      cursor.setDate(cursor.getDate() + 1);

      cursor.setDate(cursor.getDate() + 1);
    }

    return flowData;
  };

  return { departmentLoad, employeeLoad, calculateEfficiency, calculateDirectionStats, calculateItemStats, calculateDailyFlow, CAPACITY_PER_DAY };
};

