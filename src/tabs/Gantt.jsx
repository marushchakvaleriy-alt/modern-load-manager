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
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle
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

  // View Mode: 'gantt' (Timeline bars), 'workload' (Daily points matrix), 'both' (Hybrid)
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to calculate start, end and duration of a task
  const getTaskTimeframe = (project) => {
    const start = parseDateSafe(project.startDate || project.createdAt || project.createdDate) || today;
    start.setHours(0, 0, 0, 0);
    
    let end = parseDateSafe(project.completedAt || project.completedDate);
    if (!end) {
      end = parseDateSafe(project.deadline);
    }
    if (!end) {
      const durationDays = Math.max(1, Math.ceil((Number(project.points) || 1) / 8));
      end = new Date(start);
      end.setDate(start.getDate() + durationDays);
    }
    end.setHours(0, 0, 0, 0);

    const durationDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    return {
      startDate: start,
      endDate: end,
      deadlineDate: parseDateSafe(project.deadline),
      durationDays
    };
  };

  // Helper to calculate daily workload for a task
  const getTaskWorkload = (project) => {
    const tf = getTaskTimeframe(project);
    const totalPoints = Number(project.points) || 0;

    let workingDaysCount = 0;
    const curr = new Date(tf.startDate);
    while (curr <= tf.endDate) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) {
        workingDaysCount++;
      }
      curr.setDate(curr.getDate() + 1);
    }

    const validWorkingDays = Math.max(1, workingDaysCount);
    const pointsPerDay = Number((totalPoints / validWorkingDays).toFixed(1));

    const dailyMap = {};
    const fillDate = new Date(tf.startDate);
    while (fillDate <= tf.endDate) {
      const day = fillDate.getDay();
      if (day !== 0 && day !== 6) {
        dailyMap[formatDateISO(fillDate)] = pointsPerDay;
      }
      fillDate.setDate(fillDate.getDate() + 1);
    }

    return {
      tf,
      totalPoints,
      workingDaysCount: validWorkingDays,
      pointsPerDay,
      dailyMap
    };
  };

  // Filtered & Sorted valid projects (Excluding completed)
  const filteredProjects = useMemo(() => {
    const list = deptProjects.filter((p) => {
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

    // Sorting
    return list.sort((a, b) => {
      let valA, valB;
      if (sortField === 'employee') {
        valA = (a.assignedEmployee || '').toLowerCase();
        valB = (b.assignedEmployee || '').toLowerCase();
        if (valA === valB) {
          return (a.name || '').localeCompare(b.name || '');
        }
      } else if (sortField === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (sortField === 'points') {
        valA = Number(a.points) || 0;
        valB = Number(b.points) || 0;
      } else if (sortField === 'startDate') {
        valA = getTaskTimeframe(a).startDate.getTime();
        valB = getTaskTimeframe(b).startDate.getTime();
      } else if (sortField === 'deadline') {
        valA = getTaskTimeframe(a).endDate.getTime();
        valB = getTaskTimeframe(b).endDate.getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [deptProjects, ignoredNames, searchTerm, selectedStatus, selectedPerformer, sortField, sortOrder]);

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

  // Timeline view calculations
  const timelineDays = useMemo(() => {
    const days = [];
    const numDays = zoomLevel === 'month' ? 60 : zoomLevel === 'week' ? 28 : 21;
    const start = new Date(today);
    start.setDate(today.getDate() - 4 + viewOffsetWeeks * 7);

    for (let i = 0; i < numDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [zoomLevel, viewOffsetWeeks, today]);

  const startDate = timelineDays[0];
  const endDate = timelineDays[timelineDays.length - 1];

  const getPositionForDate = (date) => {
    if (!date) return null;
    const diff = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    return (diff / timelineDays.length) * 100;
  };

  const todayPos = getPositionForDate(today);

  // Grouped by Performer structure with Daily Point sums
  const groupedData = useMemo(() => {
    if (!groupByEmployee) {
      return [{ groupName: null, items: filteredProjects, dailyPointSums: {} }];
    }

    const groups = {};
    filteredProjects.forEach((p) => {
      const emp = (p.assignedEmployee || 'Не призначено').trim();
      if (!groups[emp]) {
        groups[emp] = {
          name: emp,
          color: performerColorMap[emp] || PERFORMER_COLORS[0],
          items: [],
          totalPoints: 0,
          dailyPointSums: {}
        };
      }
      groups[emp].items.push(p);
      groups[emp].totalPoints += Number(p.points) || 0;

      // Add to daily point sums for this performer
      const workload = getTaskWorkload(p);
      Object.entries(workload.dailyMap).forEach(([dateISO, pts]) => {
        groups[emp].dailyPointSums[dateISO] = Number(((groups[emp].dailyPointSums[dateISO] || 0) + pts).toFixed(1));
      });
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredProjects, groupByEmployee, performerColorMap]);

  // Total department daily point sums across all visible tasks
  const departmentDailyPointSums = useMemo(() => {
    const sums = {};
    filteredProjects.forEach((p) => {
      const workload = getTaskWorkload(p);
      Object.entries(workload.dailyMap).forEach(([dateISO, pts]) => {
        sums[dateISO] = Number(((sums[dateISO] || 0) + pts).toFixed(1));
      });
    });
    return sums;
  }, [filteredProjects]);

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

    // Color thresholds for daily workload (based on 42 points/day standard capacity)
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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-800 flex items-center gap-3">
            <CalendarRange className="text-primary" size={32} />
            Діаграма Ганта та матриця навантаження
          </h2>
          <p className="text-gray-500 font-medium text-sm mt-1">
            Терміни виконання проєктів та розподіл поінтів по днях для відділу {activeDepartment === 'construction' ? 'Конструювання' : 'Проєктування'}
          </p>
        </div>

        {/* Zoom & Navigation buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="neu-flat p-1.5 rounded-2xl flex items-center gap-1.5 shadow-sm">
            <button
              onClick={() => setZoomLevel('day')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                zoomLevel === 'day' ? 'neu-btn text-primary font-black bg-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Дні (3 тиж.)
            </button>
            <button
              onClick={() => setZoomLevel('week')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                zoomLevel === 'week' ? 'neu-btn text-primary font-black bg-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              4 Тижні
            </button>
            <button
              onClick={() => setZoomLevel('month')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                zoomLevel === 'month' ? 'neu-btn text-primary font-black bg-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              2 Місяці
            </button>
          </div>

          <div className="flex items-center gap-1.5 neu-flat p-1.5 rounded-2xl shadow-sm">
            <button
              onClick={() => setViewOffsetWeeks((w) => w - 1)}
              className="p-1.5 text-gray-600 hover:text-primary rounded-lg transition-all"
              title="Попередній період"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setViewOffsetWeeks(0)}
              className="px-3 py-1 text-xs font-bold text-gray-700 hover:text-primary rounded-lg transition-all"
            >
              Сьогодні
            </button>
            <button
              onClick={() => setViewOffsetWeeks((w) => w + 1)}
              className="p-1.5 text-gray-600 hover:text-primary rounded-lg transition-all"
              title="Наступний період"
            >
              <ChevronRight size={16} />
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
            title="Відобразити реальні поінти навантаження по днях"
          >
            <Zap size={14} className={viewMode === 'workload' ? 'text-amber-500' : ''} />
            <span>Поінти по днях</span>
          </button>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Пошук за проєктом або виконавцем..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full neu-flat pl-10 pr-4 py-2 rounded-xl text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-primary/40 bg-[#e0e5ec]"
          />
        </div>

        {/* Grouping Toggle */}
        <button
          type="button"
          onClick={() => setGroupByEmployee(!groupByEmployee)}
          className={`neu-btn px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            groupByEmployee
              ? 'text-primary font-black'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title="Групувати за виконавцями, як в Excel"
        >
          <Layers size={14} className={groupByEmployee ? 'text-primary' : 'text-gray-500'} />
          <span>{groupByEmployee ? 'За виконавцями' : 'Список'}</span>
        </button>

        {/* Status Filter */}
        <div className="w-44">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full neu-flat px-3 py-2 rounded-xl text-xs font-bold text-gray-700 outline-none bg-[#e0e5ec] cursor-pointer"
          >
            <option value="all">Усі активні</option>
            <option value="active">В роботі</option>
            <option value="waiting">Очікує</option>
            <option value="overdue">Протерміновано</option>
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

      {/* Main Viewport Container */}
      <div className="neu-flat rounded-2xl p-5 overflow-hidden border border-white/60">
        <div className="overflow-x-auto">
          <div className="min-w-[1150px]">
            {/* Table & Timeline Header */}
            <div className="flex border-b border-gray-300/80 pb-3 mb-4">
              {/* Left Column Headers */}
              <div className="w-[24rem] shrink-0 grid grid-cols-12 gap-2 pr-3 pl-2 items-center text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
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
                  <span>Проєкт / Задача</span>
                  {renderSortIcon('name')}
                </button>
              </div>

              {/* Timeline Days Header Grid */}
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(0, 1fr))` }}>
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
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-medium text-sm">
                Немає активних задач, що відповідають вибраним фільтрам.
              </div>
            ) : (
              <div className="space-y-3 relative">
                {/* Vertical "Today" line */}
                {todayPos !== null && todayPos >= 0 && todayPos <= 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                    style={{ left: `calc(24rem + (100% - 24rem) * ${todayPos / 100})` }}
                  >
                    <span className="absolute -top-4 -translate-x-1/2 bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow">
                      Сьогодні
                    </span>
                  </div>
                )}

                {groupedData.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-2">
                    {/* Performer Group Header with Daily Heatmap Summary */}
                    {group.groupName && (
                      <div className="flex items-center neu-flat p-2 rounded-xl border border-white/60 shadow-sm bg-white/40">
                        <div className="w-[24rem] shrink-0 flex items-center justify-between pr-4 pl-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded-full ${group.color.dot}`} />
                            <span className="font-extrabold text-xs text-gray-800">{group.name}</span>
                            <span className="text-[10px] text-gray-500 font-medium">({group.items.length} задач)</span>
                          </div>
                          <span className="font-black text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                            {group.totalPoints} поінтів
                          </span>
                        </div>

                        {/* Daily Points Heatmap for Performer */}
                        <div className="flex-1 grid h-7 items-center" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(0, 1fr))` }}>
                          {timelineDays.map((date, idx) => {
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            const isToday = formatDateISO(date) === formatDateISO(today);
                            const dateISO = formatDateISO(date);
                            const dayPts = group.dailyPointSums[dateISO] || 0;

                            return (
                              <div
                                key={idx}
                                className={`h-full flex items-center justify-center border-l border-gray-300/30 ${
                                  isToday ? 'bg-primary/5' : isWeekend ? 'bg-gray-300/20' : ''
                                }`}
                                title={`${group.name} на ${date.toLocaleDateString('uk-UA')}: ${dayPts} поінтів`}
                              >
                                {renderWorkloadCell(dayPts, isWeekend, isToday)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Task Rows inside Group */}
                    {group.items.map((project) => {
                      const empName = project.assignedEmployee || 'Не призначено';
                      const perfColor = performerColorMap[empName] || PERFORMER_COLORS[0];
                      const workload = getTaskWorkload(project);
                      const { tf, totalPoints, pointsPerDay, dailyMap } = workload;

                      let leftPercent = getPositionForDate(tf.startDate);
                      let rightPercent = getPositionForDate(tf.endDate);

                      if (leftPercent === null) leftPercent = 0;
                      if (rightPercent === null) rightPercent = 100;

                      const clampedLeft = Math.max(0, Math.min(100, leftPercent));
                      const clampedRight = Math.max(clampedLeft + 1.5, Math.min(100, rightPercent));
                      const widthPercent = clampedRight - clampedLeft;

                      const isVisibleInView = rightPercent >= 0 && leftPercent <= 100;

                      return (
                        <div
                          key={project.id}
                          className="flex items-center neu-flat p-2 rounded-2xl hover:brightness-[1.02] hover:-translate-y-0.5 transition-all group cursor-pointer border border-white/40"
                          onClick={() => setSelectedTaskDetails(project)}
                        >
                          {/* Table columns on the left */}
                          <div className="w-[24rem] shrink-0 grid grid-cols-12 gap-2 pr-3 pl-1 items-center">
                            {/* Employee */}
                            <div className="col-span-5 flex items-center gap-2 min-w-0 pr-1">
                              <span className={`w-2.5 h-2.5 rounded-full ${perfColor.dot} shrink-0`} />
                              <span className="font-bold text-xs text-gray-700 truncate" title={empName}>
                                {empName}
                              </span>
                            </div>

                            {/* Project Name & Points Subtitle */}
                            <div className="col-span-7 min-w-0 pr-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="font-bold text-xs text-gray-800 truncate" title={project.name}>
                                  {project.name}
                                </p>
                                <span className="text-[10px] font-black text-gray-700 bg-gray-200/80 px-1.5 py-0.2 rounded shrink-0">
                                  {totalPoints}п
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono">
                                {formatDateShort(tf.startDate)} ➔ {formatDateShort(tf.endDate)} ({tf.durationDays}д · {pointsPerDay}п/д)
                              </p>
                            </div>
                          </div>

                          {/* Timeline / Workload Matrix Viewport */}
                          <div className="flex-1 h-8 bg-[#d8dfe8]/70 rounded-xl relative overflow-hidden flex items-center shadow-inner">
                            {/* Weekend background grid */}
                            <div
                              className="absolute inset-0 grid pointer-events-none"
                              style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(0, 1fr))` }}
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

                            {/* Mode 1: GANTT 3D BARS */}
                            {viewMode === 'gantt' && isVisibleInView && (
                              <div
                                className={`absolute h-6 rounded-lg ${perfColor.bar} text-white font-black text-[10px] px-2.5 flex items-center justify-between transition-all z-20 overflow-hidden hover:scale-[1.01]`}
                                style={{
                                  left: `${clampedLeft}%`,
                                  width: `${widthPercent}%`,
                                  minWidth: '32px'
                                }}
                                title={`Задача: ${project.name}\nВиконавець: ${empName}\nПочаток: ${formatDateReadable(tf.startDate)}\nДедлайн: ${formatDateReadable(tf.endDate)}\nПоінти: ${totalPoints}п (${pointsPerDay}п/день)`}
                              >
                                <span className="truncate pr-1 drop-shadow-sm">{project.name}</span>
                                <span className="text-[9px] font-mono opacity-95 shrink-0 whitespace-nowrap bg-black/25 px-1.5 py-0.5 rounded shadow-sm">
                                  {totalPoints}п · {formatDateShort(tf.startDate)}-{formatDateShort(tf.endDate)}
                                </span>
                              </div>
                            )}

                            {/* Mode 2: WORKLOAD DAILY POINTS MATRIX */}
                            {viewMode === 'workload' && (
                              <div className="absolute inset-0 grid h-full items-center z-20" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(0, 1fr))` }}>
                                {timelineDays.map((date, idx) => {
                                  const dateISO = formatDateISO(date);
                                  const pts = dailyMap[dateISO];
                                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                  const isToday = formatDateISO(date) === formatDateISO(today);

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
                ))}

                {/* Total Department Daily Workload Summary Footer */}
                <div className="flex items-center neu-flat p-2.5 rounded-xl border border-primary/30 bg-primary/5 mt-4">
                  <div className="w-[24rem] shrink-0 pr-4 pl-2 flex items-center justify-between">
                    <span className="font-extrabold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap size={14} className="text-primary" />
                      Загальне навантаження відділу:
                    </span>
                  </div>

                  <div className="flex-1 grid h-7 items-center" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(0, 1fr))` }}>
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
        const workload = getTaskWorkload(selectedTaskDetails);
        const { tf, totalPoints, pointsPerDay, workingDaysCount } = workload;
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
                    Поставлено / Створено
                  </p>
                  <p className="text-sm font-extrabold text-gray-800">
                    {formatDateReadable(tf.startDate)}
                  </p>
                </div>

                <div className="neu-flat p-3 rounded-xl">
                  <p className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1 mb-1">
                    <Flag size={12} className="text-red-500" />
                    Кінець / Дедлайн
                  </p>
                  <p className="text-sm font-extrabold text-gray-800">
                    {formatDateReadable(tf.endDate)}
                  </p>
                </div>

                <div className="neu-flat p-3 rounded-xl">
                  <p className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1 mb-1">
                    <Clock size={12} className="text-amber-500" />
                    Робочі дні / Тривалість
                  </p>
                  <p className="text-sm font-extrabold text-gray-800">
                    {workingDaysCount} роб. дн. ({tf.durationDays} заг.)
                  </p>
                </div>

                <div className="neu-flat p-3 rounded-xl">
                  <p className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1 mb-1">
                    <Zap size={12} className="text-emerald-500" />
                    Щоденне навантаження
                  </p>
                  <p className="text-sm font-extrabold text-emerald-700">
                    {pointsPerDay} поінтів / день
                  </p>
                </div>
              </div>

              {/* Additional Meta */}
              <div className="neu-flat p-3.5 rounded-xl text-xs space-y-1.5 text-gray-600 font-medium">
                <div className="flex justify-between">
                  <span>Загальний обсяг складності:</span>
                  <span className="font-bold text-gray-800">{totalPoints} поінтів</span>
                </div>
                <div className="flex justify-between">
                  <span>Виконавець:</span>
                  <span className="font-bold text-gray-800">{selectedTaskDetails.assignedEmployee || 'Не призначено'}</span>
                </div>
                {selectedTaskDetails.direction && (
                  <div className="flex justify-between">
                    <span>Напрямок:</span>
                    <span className="font-bold text-gray-800">{selectedTaskDetails.direction}</span>
                  </div>
                )}
                {selectedTaskDetails.taskType && (
                  <div className="flex justify-between">
                    <span>Категорія:</span>
                    <span className="font-bold text-gray-800">{selectedTaskDetails.taskType}</span>
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

      {/* Legend & Capacity Thresholds */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2 pt-1 text-xs font-bold text-gray-500">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-gray-400 font-extrabold uppercase text-[10px]">Шкала навантаження (норма = 42п/день):</span>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono border bg-emerald-500/15 text-emerald-700 border-emerald-500/30">До 42п</span>
            <span>Норма (1 роб. день)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono border bg-amber-500/20 text-amber-800 border-amber-500/40">43-65п</span>
            <span>Високе</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono border bg-red-500/25 text-red-800 border-red-500/50">65+п ⚠️</span>
            <span>Перевантаження</span>
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
