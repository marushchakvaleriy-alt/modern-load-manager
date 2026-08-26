import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useDepartment } from '../store/departmentContext';
import { 
  CalendarRange, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  Calendar, 
  Flag, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Layers,
  BarChart2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';

const STATUS_CONFIG = {
  active: { label: 'В роботі', color: 'bg-blue-500', text: 'text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  waiting: { label: 'Очікує', color: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  overdue: { label: 'Протерміновано', color: 'bg-red-500', text: 'text-red-600', badge: 'bg-red-50 text-red-700 border-red-200' },
};

// 3D Volumetric color palette for Gantt bars
const PERFORMER_COLORS = [
  { 
    bar: 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 shadow-md shadow-blue-500/35 border-t border-white/40 border-b border-blue-900/30', 
    text: 'text-blue-800', 
    dot: 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm shadow-blue-500/50',
    light: 'bg-blue-500/10 text-blue-700 border-blue-300'
  },
  { 
    bar: 'bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 shadow-md shadow-amber-500/35 border-t border-white/40 border-b border-amber-900/30', 
    text: 'text-amber-800', 
    dot: 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm shadow-amber-500/50',
    light: 'bg-amber-500/10 text-amber-700 border-amber-300'
  },
  { 
    bar: 'bg-gradient-to-r from-purple-600 via-purple-500 to-fuchsia-500 shadow-md shadow-purple-500/35 border-t border-white/40 border-b border-purple-900/30', 
    text: 'text-purple-800', 
    dot: 'bg-gradient-to-br from-purple-400 to-purple-600 shadow-sm shadow-purple-500/50',
    light: 'bg-purple-500/10 text-purple-700 border-purple-300'
  },
  { 
    bar: 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 shadow-md shadow-emerald-500/35 border-t border-white/40 border-b border-emerald-900/30', 
    text: 'text-emerald-800', 
    dot: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm shadow-emerald-500/50',
    light: 'bg-emerald-500/10 text-emerald-700 border-emerald-300'
  },
  { 
    bar: 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-500 shadow-md shadow-cyan-500/35 border-t border-white/40 border-b border-cyan-900/30', 
    text: 'text-cyan-800', 
    dot: 'bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-sm shadow-cyan-500/50',
    light: 'bg-cyan-500/10 text-cyan-700 border-cyan-300'
  },
  { 
    bar: 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 shadow-md shadow-indigo-500/35 border-t border-white/40 border-b border-indigo-900/30', 
    text: 'text-indigo-800', 
    dot: 'bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-sm shadow-indigo-500/50',
    light: 'bg-indigo-500/10 text-indigo-700 border-indigo-300'
  },
  { 
    bar: 'bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 shadow-md shadow-teal-500/35 border-t border-white/40 border-b border-teal-900/30', 
    text: 'text-teal-800', 
    dot: 'bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm shadow-teal-500/50',
    light: 'bg-teal-500/10 text-teal-700 border-teal-300'
  },
  { 
    bar: 'bg-gradient-to-r from-violet-600 via-violet-500 to-purple-500 shadow-md shadow-violet-500/35 border-t border-white/40 border-b border-violet-900/30', 
    text: 'text-violet-800', 
    dot: 'bg-gradient-to-br from-violet-400 to-violet-600 shadow-sm shadow-violet-500/50',
    light: 'bg-violet-500/10 text-violet-700 border-violet-300'
  },
];

const CAPACITY_PER_DAY = 42; // standard norm: 7 hours * 6 points

const formatDateISO = (d) => {
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateReadable = (d) => {
  if (!d) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatDateShort = (d) => {
  if (!d) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
};

const parseDateSafe = (dateStr) => {
  if (!dateStr || dateStr === '-') return null;
  if (dateStr instanceof Date) return dateStr;
  
  if (dateStr && typeof dateStr.toDate === 'function') {
    return dateStr.toDate();
  }

  const parts = String(dateStr).split(' ')[0].split(/[./-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

// Advance date skipping weekends (Saturday & Sunday)
const getNextWorkingDate = (date) => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

// Ensure a given date is a working day (if Sat/Sun -> jump to next Monday)
const ensureWorkingDate = (date) => {
  const curr = new Date(date);
  curr.setHours(0, 0, 0, 0);
  while (curr.getDay() === 0 || curr.getDay() === 6) {
    curr.setDate(curr.getDate() + 1);
  }
  return curr;
};

const Gantt = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const { filterByDepartment, activeDepartment } = useDepartment();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPerformer, setSelectedPerformer] = useState('all');
  const [zoomLevel, setZoomLevel] = useState('day'); // 'day', 'week', 'month'
  const [viewOffsetWeeks, setViewOffsetWeeks] = useState(0);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);

  // View Mode: 'gantt' (Timeline bars) or 'workload' (Daily points matrix)
  const [viewMode, setViewMode] = useState('gantt');

  // Sorting & Grouping states
  const [sortField, setSortField] = useState('employee');
  const [sortOrder, setSortOrder] = useState('asc');
  const [groupByEmployee, setGroupByEmployee] = useState(true);

  useEffect(() => {
    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubProjects();
      unsubEmployees();
    };
  }, []);

  const deptProjects = filterByDepartment(projects);
  const deptEmployees = filterByDepartment(employees);
  const ignoredNames = new Set(
    deptEmployees.filter((e) => e.isIgnored).map((e) => (e.name || '').trim().toLowerCase())
  );

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Filtered valid projects (Excluding completed)
  const filteredProjects = useMemo(() => {
    return deptProjects.filter((p) => {
      if (p.status === 'completed') return false;

      const empName = (p.assignedEmployee || '').trim();
      if (ignoredNames.has(empName.toLowerCase())) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const empMatch = empName.toLowerCase().includes(q);
        const dirMatch = (p.direction || '').toLowerCase().includes(q);
        if (!nameMatch && !empMatch && !dirMatch) return false;
      }

      if (selectedStatus !== 'all' && p.status !== selectedStatus) {
        return false;
      }

      if (selectedPerformer !== 'all' && empName !== selectedPerformer) {
        return false;
      }

      return true;
    });
  }, [deptProjects, ignoredNames, searchTerm, selectedStatus, selectedPerformer]);

  // Unique performers list for filter & color map
  const { performersList, performerColorMap } = useMemo(() => {
    const set = new Set();
    deptProjects.forEach((p) => {
      const name = (p.assignedEmployee || '').trim();
      if (name && name !== 'Не призначено' && !ignoredNames.has(name.toLowerCase())) {
        set.add(name);
      }
    });
    const list = Array.from(set).sort();
    const map = {};
    list.forEach((name, idx) => {
      map[name] = PERFORMER_COLORS[idx % PERFORMER_COLORS.length];
    });
    return { performersList: list, performerColorMap: map };
  }, [deptProjects, ignoredNames]);

  // -------------------------------------------------------------
  // Calculate maximum forecast date across all tasks for 'all' mode
  // -------------------------------------------------------------
  const maxForecastEndDate = useMemo(() => {
    let maxD = new Date(today);
    deptProjects.forEach((p) => {
      if (p.status === 'completed') return;
      const pts = Math.max(0.5, Number(p.points) || 1);
      const estDays = Math.ceil(pts / CAPACITY_PER_DAY);
      const startCandidate = parseDateSafe(p.startDate || p.createdAt || p.createdDate) || today;
      const estEnd = new Date(startCandidate);
      estEnd.setDate(estEnd.getDate() + estDays + 30);
      if (estEnd.getTime() > maxD.getTime()) {
        maxD = estEnd;
      }
    });
    return maxD;
  }, [deptProjects, today]);

  // Timeline view calculations
  const timelineDays = useMemo(() => {
    const days = [];
    let numDays = 28;
    if (zoomLevel === '3w' || zoomLevel === 'day') numDays = 21;
    else if (zoomLevel === '6w' || zoomLevel === 'week') numDays = 42;
    else if (zoomLevel === '2m' || zoomLevel === 'month') numDays = 60;
    else if (zoomLevel === '3m') numDays = 90;
    else if (zoomLevel === 'all') {
      const diffDays = Math.ceil((maxForecastEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      numDays = Math.max(35, Math.min(180, diffDays + 14));
    }

    const start = new Date(today);
    start.setDate(today.getDate() - 4 + viewOffsetWeeks * 7);

    for (let i = 0; i < numDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [zoomLevel, viewOffsetWeeks, today, maxForecastEndDate]);

  const startDate = timelineDays[0];
  const endDate = timelineDays[timelineDays.length - 1];

  const getPositionForDate = (date) => {
    if (!date) return null;
    const diff = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    return (diff / timelineDays.length) * 100;
  };

  const todayPos = getPositionForDate(today);

  // -------------------------------------------------------------
  // SEQUENTIAL CAPACITY SCHEDULE ENGINE (1 task at a time per person)
  // -------------------------------------------------------------
  const { scheduledGroups, departmentDailyPointSums } = useMemo(() => {
    const deptSums = {};

    // 1. Group projects by employee
    const rawGroups = {};
    filteredProjects.forEach((p) => {
      const emp = (p.assignedEmployee || 'Не призначено').trim();
      if (!rawGroups[emp]) {
        rawGroups[emp] = [];
      }
      rawGroups[emp].push(p);
    });

    const groupsList = Object.entries(rawGroups).map(([empName, taskList]) => {
      // Sort tasks in employee's queue by Earliest Deadline First (EDF)
      taskList.sort((a, b) => {
        const deadlineA = parseDateSafe(a.deadline);
        const deadlineB = parseDateSafe(b.deadline);

        // 1. Prioritize tasks with earlier deadline
        if (deadlineA && deadlineB) {
          const diff = deadlineA.getTime() - deadlineB.getTime();
          if (diff !== 0) return diff;
        } else if (deadlineA && !deadlineB) {
          return -1;
        } else if (!deadlineA && deadlineB) {
          return 1;
        }

        // 2. Secondary sort: Status priority (active/overdue before waiting)
        const orderStatus = { active: 1, overdue: 1, waiting: 2 };
        const statusDiff = (orderStatus[a.status] || 9) - (orderStatus[b.status] || 9);
        if (statusDiff !== 0) return statusDiff;

        // 3. Tertiary sort: by start/creation date
        const dateA = parseDateSafe(a.startDate || a.createdAt || a.createdDate) || today;
        const dateB = parseDateSafe(b.startDate || b.createdAt || b.createdDate) || today;
        return dateA.getTime() - dateB.getTime();
      });

      let totalPoints = 0;
      const dailyPointSums = {};
      const scheduledTasks = [];

      // Start queue simulation from today (or task start date if specified in future)
      let cursorDate = ensureWorkingDate(new Date(today));
      let availableCapacityToday = CAPACITY_PER_DAY;

      taskList.forEach((task) => {
        const pts = Math.max(0.5, Number(task.points) || 1);
        totalPoints += pts;

        const taskStartCandidate = parseDateSafe(task.startDate || task.createdAt || task.createdDate);
        if (taskStartCandidate && taskStartCandidate.getTime() > cursorDate.getTime()) {
          cursorDate = ensureWorkingDate(taskStartCandidate);
          availableCapacityToday = CAPACITY_PER_DAY;
        }

        const taskCalculatedStart = new Date(cursorDate);
        let remainingPoints = pts;
        const taskDailyMap = {};
        let taskLastAllocatedDate = new Date(cursorDate);

        while (remainingPoints > 0) {
          cursorDate = ensureWorkingDate(cursorDate);
          taskLastAllocatedDate = new Date(cursorDate);

          const allocated = Math.min(remainingPoints, availableCapacityToday);
          const dateISO = formatDateISO(cursorDate);

          taskDailyMap[dateISO] = Number(((taskDailyMap[dateISO] || 0) + allocated).toFixed(1));
          dailyPointSums[dateISO] = Number(((dailyPointSums[dateISO] || 0) + allocated).toFixed(1));
          deptSums[dateISO] = Number(((deptSums[dateISO] || 0) + allocated).toFixed(1));

          remainingPoints = Number((remainingPoints - allocated).toFixed(1));
          availableCapacityToday = Number((availableCapacityToday - allocated).toFixed(1));

          if (availableCapacityToday <= 0.05) {
            cursorDate = getNextWorkingDate(cursorDate);
            availableCapacityToday = CAPACITY_PER_DAY;
          }
        }

        const taskCalculatedEnd = new Date(taskLastAllocatedDate);
        const deadlineDate = parseDateSafe(task.deadline);
        const isDeadlineRisk = deadlineDate && taskCalculatedEnd.getTime() > deadlineDate.getTime();

        const durationWorkingDays = Math.max(1, Object.keys(taskDailyMap).length);

        scheduledTasks.push({
          ...task,
          schedule: {
            startDate: taskCalculatedStart,
            endDate: taskCalculatedEnd,
            deadlineDate,
            isDeadlineRisk,
            totalPoints: pts,
            dailyMap: taskDailyMap,
            durationWorkingDays,
            pointsPerDay: Number((pts / durationWorkingDays).toFixed(1))
          }
        });
      });

      // Free date calculation: when this employee finishes all queued tasks
      const freeDate = availableCapacityToday >= CAPACITY_PER_DAY ? cursorDate : getNextWorkingDate(cursorDate);
      const workingDaysToFinish = Number((totalPoints / CAPACITY_PER_DAY).toFixed(1));

      return {
        name: empName,
        color: performerColorMap[empName] || PERFORMER_COLORS[0],
        items: scheduledTasks,
        totalPoints,
        dailyPointSums,
        freeDate,
        workingDaysToFinish
      };
    });

    // Sort groups alphabetically by performer name
    groupsList.sort((a, b) => a.name.localeCompare(b.name));

    return {
      scheduledGroups: groupsList,
      departmentDailyPointSums: deptSums
    };
  }, [filteredProjects, today, performerColorMap]);

  const handleHeaderSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="text-gray-400 opacity-60 ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={12} className="text-primary font-bold ml-1" />
    ) : (
      <ArrowDown size={12} className="text-primary font-bold ml-1" />
    );
  };

  // Render a daily workload cell (points badge)
  const renderWorkloadCell = (pts, isWeekend, isToday) => {
    if (isWeekend) {
      return <div className="w-full h-full bg-gray-300/30" />;
    }
    if (!pts || pts === 0) {
      return <span className="text-[10px] text-gray-300 font-mono">-</span>;
    }

    let style = 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
    let icon = null;

    if (pts > 42 && pts <= 65) {
      style = 'bg-amber-500/20 text-amber-800 border-amber-500/40 font-black';
    } else if (pts > 65) {
      style = 'bg-red-500/25 text-red-800 border-red-500/50 font-black shadow-sm';
      icon = <AlertTriangle size={8} className="inline text-red-600 mr-0.5" />;
    }

    return (
      <span className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-mono border ${style}`}>
        {icon}
        {pts}
      </span>
    );
  };

  const dayColWidth = zoomLevel === 'all' || zoomLevel === '3m' ? 36 : zoomLevel === '2m' ? 38 : 42;
  const totalGridWidth = timelineDays.length * dayColWidth;
  const todayIndex = timelineDays.findIndex((d) => formatDateISO(d) === formatDateISO(today));

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-800 flex items-center gap-3">
            <CalendarRange className="text-primary" size={32} />
            Послідовний графік навантаження та черга задач
          </h2>
          <p className="text-gray-500 font-medium text-sm mt-1">
            Автоматичний прорахунок зайнятості (1 задача одночасно, 42 поінти/день) для відділу {activeDepartment === 'construction' ? 'Конструювання' : 'Проєктування'}
          </p>
        </div>

        {/* Zoom & Range Slider Navigation */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Range Slider for Week Offset */}
          <div className="flex items-center gap-2 neu-flat px-3.5 py-1.5 rounded-2xl shadow-sm bg-[#e0e5ec]">
            <span className="text-[11px] font-extrabold uppercase text-gray-500 whitespace-nowrap flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-primary" />
              Повзунок часу:
            </span>
            <button
              type="button"
              onClick={() => setViewOffsetWeeks((w) => Math.max(-4, w - 1))}
              className="p-1 text-gray-600 hover:text-primary rounded-lg transition-all"
              title="Попередній тиждень"
            >
              <ChevronLeft size={14} />
            </button>
            <input
              type="range"
              min={-4}
              max={24}
              step={1}
              value={viewOffsetWeeks}
              onChange={(e) => setViewOffsetWeeks(Number(e.target.value))}
              className="w-24 sm:w-36 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              title="Перетягніть повзунок для гортання графіка вбік"
            />
            <button
              type="button"
              onClick={() => setViewOffsetWeeks((w) => Math.min(24, w + 1))}
              className="p-1 text-gray-600 hover:text-primary rounded-lg transition-all"
              title="Наступний тиждень"
            >
              <ChevronRight size={14} />
            </button>
            <span className="text-xs font-mono font-black text-primary min-w-[55px] text-center">
              {viewOffsetWeeks === 0 ? 'Сьогодні' : viewOffsetWeeks > 0 ? `+${viewOffsetWeeks} тиж.` : `${viewOffsetWeeks} тиж.`}
            </span>
            {viewOffsetWeeks !== 0 && (
              <button
                type="button"
                onClick={() => setViewOffsetWeeks(0)}
                className="px-2 py-0.5 text-[10px] font-bold text-gray-700 hover:text-primary bg-white/70 rounded-md shadow-xs transition-all"
              >
                Скинути
              </button>
            )}
          </div>

          {/* Time Horizon Presets */}
          <div className="neu-flat p-1.5 rounded-2xl flex items-center gap-1 shadow-sm">
            <button
              onClick={() => setZoomLevel('3w')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                zoomLevel === '3w' || zoomLevel === 'day' ? 'neu-btn text-primary font-black bg-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              3 тижні
            </button>
            <button
              onClick={() => setZoomLevel('6w')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                zoomLevel === '6w' || zoomLevel === 'week' ? 'neu-btn text-primary font-black bg-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              6 тижнів
            </button>
            <button
              onClick={() => setZoomLevel('2m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                zoomLevel === '2m' || zoomLevel === 'month' ? 'neu-btn text-primary font-black bg-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              2 місяці
            </button>
            <button
              onClick={() => setZoomLevel('3m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                zoomLevel === '3m' ? 'neu-btn text-primary font-black bg-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              3 місяці
            </button>
            <button
              onClick={() => setZoomLevel('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                zoomLevel === 'all' ? 'neu-btn text-purple-700 font-black bg-white shadow-xs ring-1 ring-purple-400' : 'text-purple-600 font-extrabold hover:text-purple-800'
              }`}
              title="Автоматично охопити всю чергу навантаження"
            >
              <Sparkles size={12} className="text-purple-500" />
              Вся черга
            </button>
          </div>
        </div>
      </div>

      {/* Main View Mode Selector & Filter Toolbar */}
      <div className="neu-flat p-4 rounded-2xl flex flex-wrap items-center gap-3">
        {/* Mode Switcher Tabs */}
        <div className="neu-flat p-1 rounded-xl flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('gantt')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              viewMode === 'gantt'
                ? 'neu-btn text-primary bg-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
            title="Відобразити 3D смужки графіку Ганта"
          >
            <BarChart2 size={14} />
            <span>Діаграма Ганта</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('workload')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              viewMode === 'workload'
                ? 'neu-btn text-primary bg-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
            title="Таблиця розподілу поінтів по днях"
          >
            <Layers size={14} />
            <span>Поінти по днях</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Пошук за проєктом або виконавцем..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full neu-pressed pl-9 pr-3 py-2 rounded-xl text-xs font-semibold text-gray-700 outline-none bg-transparent placeholder-gray-400"
          />
        </div>

        {/* Group Mode Toggle */}
        <button
          type="button"
          onClick={() => setGroupByEmployee(!groupByEmployee)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            groupByEmployee ? 'neu-btn text-primary font-black bg-white shadow-sm' : 'neu-flat text-gray-600'
          }`}
        >
          <User size={13} />
          <span>За виконавцями</span>
        </button>

        {/* Status Filter */}
        <div className="w-36">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full neu-flat px-3 py-2 rounded-xl text-xs font-bold text-gray-700 outline-none bg-[#e0e5ec] cursor-pointer"
          >
            <option value="all">Усі активні</option>
            <option value="active">В роботі</option>
            <option value="waiting">Очікує</option>
            <option value="overdue">Протерміновані</option>
          </select>
        </div>

        {/* Performer Filter */}
        <div className="w-48">
          <select
            value={selectedPerformer}
            onChange={(e) => setSelectedPerformer(e.target.value)}
            className="w-full neu-flat px-3 py-2 rounded-xl text-xs font-bold text-gray-700 outline-none bg-[#e0e5ec] cursor-pointer"
          >
            <option value="all">Усі виконавці</option>
            {performersList.map((perf) => (
              <option key={perf} value={perf}>
                {perf}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-extrabold text-gray-500 px-2">
          Задач: <span className="text-primary font-black">{filteredProjects.length}</span>
        </div>
      </div>

      {/* Main Viewport Container with Sticky Header & Smooth Horizontal Scroll */}
      <div className="neu-flat rounded-2xl border border-white/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)] p-4 relative custom-scrollbar">
          <div style={{ width: `calc(26rem + ${totalGridWidth}px)`, minWidth: `calc(26rem + ${totalGridWidth}px)` }}>
            {/* Table & Timeline Header (Sticky Top) */}
            <div className="sticky top-0 z-40 bg-[#e0e5ec] py-2.5 mb-4 border-b-2 border-gray-300 shadow-md flex items-center rounded-xl px-2">
              {/* Left Column Headers (Sticky Left) */}
              <div className="w-[26rem] shrink-0 sticky left-0 z-50 bg-[#e0e5ec] grid grid-cols-12 gap-2 pr-3 pl-2 items-center text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                {/* Performer Header */}
                <button
                  type="button"
                  onClick={() => handleHeaderSort('employee')}
                  className="col-span-5 flex items-center hover:text-primary transition-colors text-left"
                  title="Сортувати за виконавцем"
                >
                  <span>Виконавець</span>
                  {renderSortIcon('employee')}
                </button>

                {/* Project / Name Header */}
                <button
                  type="button"
                  onClick={() => handleHeaderSort('name')}
                  className="col-span-7 flex items-center hover:text-primary transition-colors text-left"
                  title="Сортувати за назвою проєкту"
                >
                  <span>Черга задач (послідовно)</span>
                  {renderSortIcon('name')}
                </button>
              </div>

              {/* Timeline Days Header Grid */}
              <div
                className="shrink-0 grid"
                style={{
                  width: `${totalGridWidth}px`,
                  minWidth: `${totalGridWidth}px`,
                  gridTemplateColumns: `repeat(${timelineDays.length}, ${dayColWidth}px)`
                }}
              >
                {timelineDays.map((date, idx) => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = formatDateISO(date) === formatDateISO(today);

                  return (
                    <div
                      key={idx}
                      className={`text-center py-1 text-[11px] font-bold border-l border-gray-300/40 ${
                        isToday
                          ? 'bg-primary/15 text-primary rounded-t-lg font-black ring-1 ring-primary/30'
                          : isWeekend
                          ? 'bg-gray-300/30 text-gray-400'
                          : 'text-gray-600'
                      }`}
                    >
                      <div>{date.getDate()}</div>
                      <div className="text-[9px] uppercase font-semibold text-gray-400">
                        {date.toLocaleDateString('uk-UA', { weekday: 'narrow' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content Rows */}
            {scheduledGroups.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-medium text-sm">
                Немає активних задач, що відповідають вибраним фільтрам.
              </div>
            ) : (
              <div className="space-y-4 relative">
                {/* Vertical "Today" line */}
                {todayIndex !== -1 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                    style={{ left: `calc(26rem + ${todayIndex * dayColWidth + dayColWidth / 2}px)` }}
                  >
                    <span className="absolute -top-4 -translate-x-1/2 bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow">
                      Сьогодні
                    </span>
                  </div>
                )}

                {scheduledGroups.map((group, gIdx) => (
                  <div
                    key={gIdx}
                    className="neu-flat p-3.5 rounded-2xl mb-5 border border-white/60 bg-[#e0e5ec]/70 shadow-md space-y-2.5"
                  >
                    {/* Performer Card with Individual Horizontal Scroll / Slider */}
                    <div className="overflow-x-auto custom-scrollbar pb-2.5 pt-1 rounded-xl">
                      <div
                        className="space-y-2"
                        style={{
                          width: `calc(26rem + ${totalGridWidth}px)`,
                          minWidth: `calc(26rem + ${totalGridWidth}px)`
                        }}
                      >
                        {/* Performer Group Header with Availability Forecast */}
                        <div className="flex items-center p-2.5 rounded-xl bg-white/85 border border-gray-300/60 shadow-sm">
                          {/* Left sticky group title */}
                          <div className="w-[26rem] shrink-0 sticky left-0 z-30 bg-white/95 backdrop-blur-sm rounded-l-xl flex items-center justify-between pr-4 pl-1">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-sm ${group.color.dot}`}>
                                {group.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-xs text-gray-800">{group.name}</span>
                                  <span className="text-[10px] text-gray-500 font-medium">
                                    ({group.items.length} {group.items.length === 1 ? 'задача' : group.items.length < 5 ? 'задачі' : 'задач'})
                                  </span>
                                </div>
                                {/* Forecast badge: When this performer will be free */}
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.2 rounded border border-emerald-300">
                                    <Sparkles size={10} className="text-emerald-600" />
                                    Звільниться: {formatDateReadable(group.freeDate)}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-mono font-medium">
                                    (~{group.workingDaysToFinish} роб. дн.)
                                  </span>
                                </div>
                              </div>
                            </div>

                            <span className="font-black text-[11px] text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 shrink-0">
                              Черга: {group.totalPoints}п
                            </span>
                          </div>

                          {/* Daily Points Heatmap for Performer in Group Header */}
                          <div
                            className="shrink-0 grid h-7 items-center"
                            style={{
                              width: `${totalGridWidth}px`,
                              minWidth: `${totalGridWidth}px`,
                              gridTemplateColumns: `repeat(${timelineDays.length}, ${dayColWidth}px)`
                            }}
                          >
                            {timelineDays.map((date, idx) => {
                              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                              const isToday = formatDateISO(date) === formatDateISO(today);
                              const dateISO = formatDateISO(date);
                              const dayPts = group.dailyPointSums[dateISO] || 0;

                              return (
                                <div
                                  key={idx}
                                  className={`h-full flex items-center justify-center border-l border-gray-300/40 ${
                                    isToday ? 'bg-primary/10' : isWeekend ? 'bg-gray-300/30' : ''
                                  }`}
                                  title={`${group.name} на ${date.toLocaleDateString('uk-UA')}: ${dayPts} поінтів`}
                                >
                                  {renderWorkloadCell(dayPts, isWeekend, isToday)}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Task Rows inside Sequential Queue */}
                        <div className="space-y-2">
                          {group.items.map((project, taskIdx) => {
                            const perfColor = group.color;
                            const { schedule } = project;
                            const { startDate: taskStart, endDate: taskEnd, totalPoints: taskPts, durationWorkingDays, dailyMap, isDeadlineRisk, deadlineDate } = schedule;

                            let leftPercent = getPositionForDate(taskStart);
                            let rightPercent = getPositionForDate(taskEnd);

                            if (leftPercent === null) leftPercent = 0;
                            if (rightPercent === null) rightPercent = 100;

                            const clampedLeft = Math.max(0, Math.min(100, leftPercent));
                            const clampedRight = Math.max(clampedLeft + 1, Math.min(100, rightPercent + (100 / timelineDays.length)));
                            const widthPercent = clampedRight - clampedLeft;

                            const isVisibleInView = rightPercent >= -10 && leftPercent <= 110;

                            return (
                              <div
                                key={project.id}
                                className="flex items-center neu-flat p-2 rounded-2xl hover:brightness-[1.02] hover:-translate-y-0.5 transition-all group cursor-pointer border border-white/40 bg-white/30"
                                onClick={() => setSelectedTaskDetails(project)}
                              >
                                {/* Table columns on the left (Sticky Left) */}
                                <div className="w-[26rem] shrink-0 sticky left-0 z-20 bg-[#e6ebf2]/95 backdrop-blur-sm rounded-l-xl grid grid-cols-12 gap-2 pr-3 pl-1 items-center">
                                  {/* Order in queue */}
                                  <div className="col-span-1 flex items-center justify-center">
                                    <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-black flex items-center justify-center">
                                      {taskIdx + 1}
                                    </span>
                                  </div>

                                  {/* Project Name & Calculated Timing */}
                                  <div className="col-span-11 min-w-0 pr-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className="font-bold text-xs text-gray-800 truncate" title={project.name}>
                                        {project.name}
                                      </p>
                                      <span className="text-[10px] font-black text-gray-700 bg-gray-200/80 px-1.5 py-0.2 rounded shrink-0">
                                        {taskPts}п
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono mt-0.5">
                                      <span>
                                        План: {formatDateShort(taskStart)} ➔ {formatDateShort(taskEnd)} ({durationWorkingDays} роб. дн.)
                                      </span>
                                      {isDeadlineRisk && (
                                        <span className="text-red-600 font-bold bg-red-100 px-1.5 py-0.2 rounded border border-red-200 flex items-center gap-0.5" title={`Дедлайн: ${formatDateReadable(deadlineDate)}`}>
                                          <AlertTriangle size={9} />
                                          Дедлайн: {formatDateShort(deadlineDate)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Timeline / Workload Matrix Viewport */}
                                <div
                                  className="h-8 bg-[#d8dfe8]/70 rounded-xl relative overflow-hidden flex items-center shadow-inner shrink-0"
                                  style={{
                                    width: `${totalGridWidth}px`,
                                    minWidth: `${totalGridWidth}px`
                                  }}
                                >
                                  {/* Weekend background grid */}
                                  <div
                                    className="absolute inset-0 grid pointer-events-none"
                                    style={{ gridTemplateColumns: `repeat(${timelineDays.length}, ${dayColWidth}px)` }}
                                  >
                                    {timelineDays.map((date, idx) => {
                                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                      return (
                                        <div
                                          key={idx}
                                          className={`h-full border-r border-gray-300/30 ${isWeekend ? 'bg-gray-300/40' : ''}`}
                                        />
                                      );
                                    })}
                                  </div>

                                  {/* Mode 1: SEQUENTIAL GANTT 3D BARS */}
                                  {viewMode === 'gantt' && isVisibleInView && (
                                    <div
                                      className={`absolute h-6 rounded-lg ${perfColor.bar} text-white font-black text-[10px] px-2.5 flex items-center justify-between transition-all z-20 overflow-hidden hover:scale-[1.01]`}
                                      style={{
                                        left: `${clampedLeft}%`,
                                        width: `${widthPercent}%`,
                                        minWidth: '36px'
                                      }}
                                      title={`№${taskIdx + 1} у черзі: ${project.name}\nВиконавець: ${group.name}\nРозрахунковий початок: ${formatDateReadable(taskStart)}\nРозрахунковий кінець: ${formatDateReadable(taskEnd)}\nСкладність: ${taskPts}п (${durationWorkingDays} роб. днів по 42п/день)`}
                                    >
                                      <span className="truncate pr-1 drop-shadow-sm">{project.name}</span>
                                      <span className="text-[9px] font-mono opacity-95 shrink-0 whitespace-nowrap bg-black/25 px-1.5 py-0.5 rounded shadow-sm">
                                        {taskPts}п · {formatDateShort(taskStart)}-{formatDateShort(taskEnd)}
                                      </span>
                                    </div>
                                  )}

                                  {/* Mode 2: WORKLOAD DAILY POINTS MATRIX */}
                                  {viewMode === 'workload' && (
                                    <div
                                      className="absolute inset-0 grid h-full items-center z-20"
                                      style={{ gridTemplateColumns: `repeat(${timelineDays.length}, ${dayColWidth}px)` }}
                                    >
                                      {timelineDays.map((date, idx) => {
                                        const dateISO = formatDateISO(date);
                                        const pts = dailyMap[dateISO];
                                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                                        if (isWeekend) return <div key={idx} />;

                                        if (pts) {
                                          return (
                                            <div key={idx} className="h-full flex items-center justify-center px-0.5">
                                              <span className={`w-full py-0.5 rounded text-center text-[10px] font-bold font-mono border shadow-sm ${perfColor.light}`}>
                                                {pts}п
                                              </span>
                                            </div>
                                          );
                                        }

                                        return <div key={idx} className="h-full flex items-center justify-center text-[9px] text-gray-300 font-mono">-</div>;
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total Department Daily Workload Summary Footer */}
                <div className="flex items-center neu-flat p-2.5 rounded-xl border border-primary/30 bg-primary/5 mt-4">
                  <div className="w-[26rem] shrink-0 sticky left-0 z-30 bg-[#dbe4ef] backdrop-blur-sm rounded-l-xl pr-4 pl-2 flex items-center justify-between">
                    <span className="font-extrabold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap size={14} className="text-primary" />
                      Загальне навантаження відділу:
                    </span>
                  </div>

                  <div
                    className="shrink-0 grid h-7 items-center"
                    style={{
                      width: `${totalGridWidth}px`,
                      minWidth: `${totalGridWidth}px`,
                      gridTemplateColumns: `repeat(${timelineDays.length}, ${dayColWidth}px)`
                    }}
                  >
                    {timelineDays.map((date, idx) => {
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const isToday = formatDateISO(date) === formatDateISO(today);
                      const dateISO = formatDateISO(date);
                      const totalDayPts = departmentDailyPointSums[dateISO] || 0;

                      return (
                        <div
                          key={idx}
                          className={`h-full flex items-center justify-center border-l border-gray-300/40 ${
                            isToday ? 'bg-primary/10' : isWeekend ? 'bg-gray-300/30' : ''
                          }`}
                          title={`Сумарне навантаження відділу на ${date.toLocaleDateString('uk-UA')}: ${totalDayPts} поінтів`}
                        >
                          {renderWorkloadCell(totalDayPts, isWeekend, isToday)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Details Modal on Click */}
      {selectedTaskDetails && (() => {
        const sched = selectedTaskDetails.schedule || {};
        const cfg = STATUS_CONFIG[selectedTaskDetails.status] || STATUS_CONFIG.active;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#e0e5ec] p-6 rounded-2xl neu-flat max-w-lg w-full border border-white/50 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-gray-300/70 pb-3">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border mb-1.5 ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  <h3 className="text-lg font-bold text-gray-800 leading-snug">
                    {selectedTaskDetails.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTaskDetails(null)}
                  className="p-1 text-gray-400 hover:text-gray-700 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Timing & Workload Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="neu-flat p-3 rounded-xl">
                  <p className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1 mb-1">
                    <Calendar size={12} className="text-primary" />
                    Початок у черзі
                  </p>
                  <p className="text-sm font-extrabold text-gray-800">
                    {formatDateReadable(sched.startDate)}
                  </p>
                </div>

                <div className="neu-flat p-3 rounded-xl">
                  <p className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1 mb-1">
                    <Flag size={12} className="text-red-500" />
                    Розрахункове завершення
                  </p>
                  <p className="text-sm font-extrabold text-gray-800">
                    {formatDateReadable(sched.endDate)}
                  </p>
                </div>

                <div className="neu-flat p-3 rounded-xl">
                  <p className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1 mb-1">
                    <Clock size={12} className="text-amber-500" />
                    Тривалість у роботі
                  </p>
                  <p className="text-sm font-extrabold text-gray-800">
                    {sched.durationWorkingDays} роб. дн. (при 42п/день)
                  </p>
                </div>

                <div className="neu-flat p-3 rounded-xl">
                  <p className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1 mb-1">
                    <Zap size={12} className="text-emerald-500" />
                    Складність задачі
                  </p>
                  <p className="text-sm font-extrabold text-emerald-700">
                    {sched.totalPoints} поінтів
                  </p>
                </div>
              </div>

              {/* Additional Meta */}
              <div className="neu-flat p-3.5 rounded-xl text-xs space-y-1.5 text-gray-600 font-medium">
                {(() => {
                  const rawId = String(selectedTaskDetails.bitrixId || selectedTaskDetails.externalId || '').trim();
                  const isRealId = rawId && !rawId.startsWith('btx-auto') && !rawId.startsWith('btx-txt') && !rawId.includes('178');
                  if (!isRealId) return null;
                  const cleanId = rawId.replace(/^btx-/, '');
                  return (
                    <div className="flex justify-between">
                      <span>Унікальний ID (Бітрікс):</span>
                      <span className="font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                        #{cleanId}
                      </span>
                    </div>
                  );
                })()}
                <div className="flex justify-between">
                  <span>Виконавець:</span>
                  <span className="font-bold text-gray-800">{selectedTaskDetails.assignedEmployee || 'Не призначено'}</span>
                </div>
                {selectedTaskDetails.deadline && (
                  <div className="flex justify-between">
                    <span>Офіційний дедлайн:</span>
                    <span className={`font-bold ${sched.isDeadlineRisk ? 'text-red-600' : 'text-gray-800'}`}>
                      {selectedTaskDetails.deadline} {sched.isDeadlineRisk && '(⚠️ Ризик запізнення)'}
                    </span>
                  </div>
                )}
                {selectedTaskDetails.direction && (
                  <div className="flex justify-between">
                    <span>Напрямок:</span>
                    <span className="font-bold text-gray-800">{selectedTaskDetails.direction}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedTaskDetails(null)}
                className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Закрити
              </button>
            </div>
          </div>
        );
      })()}

      {/* Legend & Forecast Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2 pt-1 text-xs font-bold text-gray-500">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-gray-400 font-extrabold uppercase text-[10px]">Принцип розрахунку:</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>1 виконавець = 1 задача одночасно (42п/день)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Черга задач одна за одною</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-gray-300/50 rounded border border-gray-400/40" />
            Вихідні дні
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-3 bg-red-500 rounded shadow-sm" />
            Сьогодні
          </span>
        </div>
      </div>
    </div>
  );
};

export default Gantt;
