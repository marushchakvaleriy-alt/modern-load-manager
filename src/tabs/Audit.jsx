import React, { useEffect, useState, useMemo } from 'react';
import CustomDatePicker from '../components/CustomDatePicker';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GitPullRequest,
  Layers,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Search,
  AlertTriangle,
  FileSpreadsheet,
  Copy,
  Check,
  Filter,
  Sparkles,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';
import { useDepartment } from '../store/departmentContext';
import {
  exportSalaryAuditExcel,
  exportSingleEmployeeAuditExcel,
  exportStandardSalaryTemplateExcel
} from '../lib/excelUtils';

const getMonthStartValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const getTodayValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPrevMonthRange = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed, so today.getMonth() is previous month index
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
};

const getLast30DaysRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
};

const formatDateUA = (dateStr) => {
  if (!dateStr || dateStr === '-') return '—';
  const parts = String(dateStr).split(' ')[0].split(/[-.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return dateStr;
};

const Audit = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [startDate, setStartDate] = useState(getMonthStartValue);
  const [endDate, setEndDate] = useState(getTodayValue);
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [filterEmployeeName, setFilterEmployeeName] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [taskTypeFilter, setTaskTypeFilter] = useState('all'); // 'all', 'new', 'revisions'

  // Task Table Sorting state
  const [taskSortField, setTaskSortField] = useState('completedAt'); // 'completedAt', 'points', 'bitrixId', 'name', 'taskType', 'spentTime', 'itemsInfo'
  const [taskSortOrder, setTaskSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Employee sorting state
  const [empSortField, setEmpSortField] = useState('points'); // 'points', 'name', 'efficiency', 'tasks'
  const [empSortOrder, setEmpSortOrder] = useState('desc');

  const { filterByDepartment, auditTabLabel, employeeSingleTitle, departmentLabel } = useDepartment();
  const deptProjects = filterByDepartment(projects);
  const deptEmployees = filterByDepartment(employees);

  const { calculateEfficiency, CAPACITY_PER_DAY } = useLoadEngine(deptProjects, deptEmployees);

  useEffect(() => {
    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) =>
      setProjects(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) =>
      setEmployees(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );

    return () => {
      unsubProjects();
      unsubEmployees();
    };
  }, []);

  // Compute stats for all department employees
  const auditData = useMemo(() => {
    const list = deptEmployees
      .filter((emp) => !emp.isIgnored)
      .map((emp) => {
        const stats = calculateEfficiency(emp.name, startDate, endDate);
        return {
          employee: emp,
          employeeName: emp.name,
          stats
        };
      });

    list.sort((a, b) => {
      let comp = 0;
      if (empSortField === 'points') {
        comp = (a.stats.totalPoints || 0) - (b.stats.totalPoints || 0);
      } else if (empSortField === 'name') {
        comp = a.employeeName.localeCompare(b.employeeName);
      } else if (empSortField === 'efficiency') {
        comp = (a.stats.efficiency || 0) - (b.stats.efficiency || 0);
      } else if (empSortField === 'tasks') {
        comp = (a.stats.completedProjects?.length || 0) - (b.stats.completedProjects?.length || 0);
      }
      return empSortOrder === 'asc' ? comp : -comp;
    });

    return list;
  }, [deptEmployees, calculateEfficiency, startDate, endDate, empSortField, empSortOrder]);

  const handleTaskSort = (field) => {
    if (taskSortField === field) {
      setTaskSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTaskSortField(field);
      if (['completedAt', 'points', 'spentTime'].includes(field)) {
        setTaskSortOrder('desc');
      } else {
        setTaskSortOrder('asc');
      }
    }
  };

  const renderSortIndicator = (field) => {
    if (taskSortField !== field) {
      return <ArrowUpDown size={11} className="opacity-30 ml-1 inline group-hover:opacity-80 transition-opacity" />;
    }
    return taskSortOrder === 'asc' ? (
      <ArrowUp size={12} className="text-primary ml-1 inline" />
    ) : (
      <ArrowDown size={12} className="text-primary ml-1 inline" />
    );
  };

  // Overall Department Totals for Selected Period
  const departmentTotals = useMemo(() => {
    let totalPoints = 0;
    let targetPoints = 0;
    let totalCompletedTasks = 0;
    let totalNew = 0;
    let totalRevisions = 0;
    let totalSpentH = 0;
    let totalPlannedH = 0;
    let totalItems = 0;

    auditData.forEach(({ stats }) => {
      totalPoints += stats.totalPoints || 0;
      targetPoints += stats.targetPoints || 0;
      totalCompletedTasks += stats.completedProjects?.length || 0;
      totalNew += stats.advanced?.newTasks || 0;
      totalRevisions += stats.advanced?.revisions || 0;
      totalSpentH += stats.advanced?.spentH || 0;
      totalPlannedH += stats.advanced?.plannedH || 0;
      totalItems += stats.advanced?.items || 0;
    });

    const efficiency = targetPoints > 0 ? Math.round((totalPoints / targetPoints) * 100) : 0;

    return {
      totalPoints,
      targetPoints,
      efficiency,
      totalCompletedTasks,
      totalNew,
      totalRevisions,
      totalSpentH,
      totalPlannedH,
      totalItems,
      activeEmployeesCount: auditData.length
    };
  }, [auditData]);

  // Toggle Accordion
  const toggleEmployee = (empId) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedEmployees(new Set(deptEmployees.map((e) => e.id)));
  };

  const collapseAll = () => {
    setExpandedEmployees(new Set());
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportFullExcel = () => {
    exportSalaryAuditExcel({
      departmentName: departmentLabel,
      startDate,
      endDate,
      auditData
    });
  };

  const handleExportStandardTemplate = () => {
    exportStandardSalaryTemplateExcel({
      departmentName: departmentLabel,
      startDate,
      endDate,
      auditData
    });
  };

  const handleExportSingle = (employeeName, stats) => {
    exportSingleEmployeeAuditExcel({
      employeeName,
      startDate,
      endDate,
      stats
    });
  };

  return (
    <div className="space-y-8">
      {/* Header with Title & Date Range Controls */}
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-800 flex items-center gap-3">
              <Award className="text-primary" size={32} />
              {auditTabLabel} (Звіт заробітної плати)
            </h2>
            <p className="mt-1 text-sm text-gray-500 font-medium">
              Звірка закритих задач, поінтів та відпрацьованого часу за період для відділу {departmentLabel}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportStandardTemplate}
              className="neu-btn px-4 py-2.5 rounded-xl text-xs font-black text-emerald-800 bg-emerald-100 hover:bg-emerald-200 flex items-center gap-2 border-2 border-emerald-400 shadow-md transition-all hover:scale-[1.02]"
              title="Сформувати єдину Excel-таблицю ЗП на весь відділ (з синіми шапками по людях, формулами, сумою поінтів та розбивкою по нових/правках як у вашому шаблоні)"
            >
              <FileSpreadsheet size={17} className="text-emerald-700" />
              <span>Сформувати звіт ЗП відділу (Excel як у шаблоні)</span>
            </button>

            <button
              type="button"
              onClick={expandedEmployees.size > 0 ? collapseAll : expandAll}
              className="neu-flat px-4 py-2.5 rounded-xl text-xs font-bold text-gray-700 hover:text-primary transition-all flex items-center gap-2"
            >
              {expandedEmployees.size > 0 ? (
                <>
                  <ChevronUp size={15} />
                  <span>Згорнути всі</span>
                </>
              ) : (
                <>
                  <ChevronDown size={15} />
                  <span>Розгорнути всі</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Date Selection & Preset Buttons Bar */}
        <div className="neu-flat p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-white/60 shadow-sm">
          {/* Custom Date Pickers */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500">Дата з:</span>
              <CustomDatePicker value={startDate} max={endDate} onChange={setStartDate} />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500">Дата до:</span>
              <CustomDatePicker value={endDate} min={startDate} onChange={setEndDate} />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase text-gray-400 mr-1 hidden sm:inline">Період:</span>
            <button
              type="button"
              onClick={() => {
                setStartDate(getMonthStartValue());
                setEndDate(getTodayValue());
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-gray-700 hover:text-primary shadow-xs border border-gray-200 transition-all"
            >
              Поточний місяць
            </button>

            <button
              type="button"
              onClick={() => {
                const prev = getPrevMonthRange();
                setStartDate(prev.start);
                setEndDate(prev.end);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-gray-700 hover:text-primary shadow-xs border border-gray-200 transition-all"
            >
              Попередній місяць
            </button>

            <button
              type="button"
              onClick={() => {
                const l30 = getLast30DaysRange();
                setStartDate(l30.start);
                setEndDate(l30.end);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-gray-700 hover:text-primary shadow-xs border border-gray-200 transition-all"
            >
              Останні 30 днів
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="neu-flat p-3 rounded-2xl flex flex-wrap items-center gap-3 border border-white/60">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Пошук задачі за назвою або #ID Бітрікса серед усіх закритих..."
              value={taskSearchQuery}
              onChange={(e) => setTaskSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#e0e5ec] rounded-xl text-xs font-bold text-gray-800 outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="w-48">
            <select
              value={filterEmployeeName}
              onChange={(e) => setFilterEmployeeName(e.target.value)}
              className="w-full px-3 py-2 bg-[#e0e5ec] rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer"
            >
              <option value="all">Усі співробітники ({auditData.length})</option>
              {auditData.map((a) => (
                <option key={a.employee.id} value={a.employeeName}>
                  {a.employeeName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase text-gray-500 hidden sm:inline">Сортувати людей:</span>
            <select
              value={`${empSortField}_${empSortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split('_');
                setEmpSortField(f);
                setEmpSortOrder(o);
              }}
              className="px-3 py-2 bg-[#e0e5ec] rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer"
            >
              <option value="points_desc">Поінти (від більших ⬇)</option>
              <option value="points_asc">Поінти (від менших ⬆)</option>
              <option value="efficiency_desc">% плану (найкращі ⬇)</option>
              <option value="efficiency_asc">% плану (найнижчі ⬆)</option>
              <option value="name_asc">Ім'я (А — Я)</option>
              <option value="name_desc">Ім'я (Я — А)</option>
              <option value="tasks_desc">Кількість задач (більше ⬇)</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-[#e0e5ec] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTaskTypeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                taskTypeFilter === 'all' ? 'bg-white text-primary shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Всі типи
            </button>
            <button
              type="button"
              onClick={() => setTaskTypeFilter('new')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                taskTypeFilter === 'new' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Тільки нові
            </button>
            <button
              type="button"
              onClick={() => setTaskTypeFilter('revisions')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                taskTypeFilter === 'revisions' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Тільки правки
            </button>
          </div>
        </div>

        {/* Global KPI Summary Strip for Department */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="neu-flat p-3.5 rounded-2xl border border-white/60 bg-white/40">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-primary" />
              Виконано поінтів
            </p>
            <p className="text-2xl font-black text-gray-800 mt-1">
              {departmentTotals.totalPoints}
              <span className="text-xs font-normal text-gray-500 ml-1">/ {departmentTotals.targetPoints}п</span>
            </p>
          </div>

          <div className="neu-flat p-3.5 rounded-2xl border border-white/60 bg-white/40">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-500" />
              Прогрес плану
            </p>
            <p className={`text-2xl font-black mt-1 ${departmentTotals.efficiency >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
              {departmentTotals.efficiency}%
            </p>
          </div>

          <div className="neu-flat p-3.5 rounded-2xl border border-white/60 bg-white/40">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <GitPullRequest size={13} className="text-indigo-500" />
              Закрито задач
            </p>
            <p className="text-2xl font-black text-gray-800 mt-1">
              {departmentTotals.totalCompletedTasks}
              <span className="text-xs font-normal text-gray-500 ml-1">
                ({departmentTotals.totalNew}н / {departmentTotals.totalRevisions}пр)
              </span>
            </p>
          </div>

          <div className="neu-flat p-3.5 rounded-2xl border border-white/60 bg-white/40">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Clock3 size={13} className="text-amber-500" />
              Витрачено часу
            </p>
            <p className="text-2xl font-black text-gray-800 mt-1">
              {departmentTotals.totalSpentH}
              <span className="text-xs font-normal text-gray-500 ml-1">год (план {departmentTotals.totalPlannedH})</span>
            </p>
          </div>

          <div className="neu-flat p-3.5 rounded-2xl border border-white/60 bg-white/40">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Layers size={13} className="text-purple-500" />
              Виробів
            </p>
            <p className="text-2xl font-black text-purple-700 mt-1">{departmentTotals.totalItems} шт</p>
          </div>

          <div className="neu-flat p-3.5 rounded-2xl border border-white/60 bg-white/40">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Users size={13} className="text-gray-500" />
              Працівників
            </p>
            <p className="text-2xl font-black text-gray-800 mt-1">{departmentTotals.activeEmployeesCount}</p>
          </div>
        </div>
      </header>

      {/* Main Employee Cards List with Expandable Task Tables */}
      <div className="space-y-5">
        {auditData.length === 0 ? (
          <div className="neu-flat p-16 text-center rounded-2xl border border-white/60">
            <Award className="mx-auto mb-4 text-gray-300" size={56} />
            <p className="text-base text-gray-500 font-medium">Немає даних про виконавців для аудиту у вибраному періоді.</p>
          </div>
        ) : (
          auditData
            .filter((item) => filterEmployeeName === 'all' || item.employeeName === filterEmployeeName)
            .map(({ employee, employeeName, stats }) => {
              const isExpanded = expandedEmployees.has(employee.id);
              const progress = Math.round(stats.efficiency);
              const progressBarWidth = Math.min(progress, 100);
              const progressTone =
                progress >= 100 ? 'text-emerald-600 font-black' : progress >= 80 ? 'text-blue-600 font-black' : 'text-amber-600 font-black';
              const progressBarColor = progress >= 100 ? 'bg-emerald-500' : progress >= 80 ? 'bg-blue-500' : 'bg-amber-500';

              // Filter tasks inside this employee by search or type
              const displayedTasks = (stats.completedProjects || []).filter((task) => {
                if (taskSearchQuery) {
                  const q = taskSearchQuery.toLowerCase();
                  const nameMatch = (task.name || '').toLowerCase().includes(q);
                  const idMatch = String(task.bitrixId || task.externalId || '').includes(q);
                  if (!nameMatch && !idMatch) return false;
                }

                if (taskTypeFilter === 'new') {
                  const isRev = (task.taskType || '').toLowerCase().includes('правк') || (task.name || '').toLowerCase().includes('правк');
                  if (isRev) return false;
                } else if (taskTypeFilter === 'revisions') {
                  const isRev = (task.taskType || '').toLowerCase().includes('правк') || (task.name || '').toLowerCase().includes('правк');
                  if (!isRev) return false;
                }

                return true;
              });

              // Apply sorting to displayed tasks
              displayedTasks.sort((a, b) => {
                let comp = 0;
                if (taskSortField === 'completedAt') {
                  const dateA = a.completedAt || '';
                  const dateB = b.completedAt || '';
                  comp = dateA.localeCompare(dateB);
                } else if (taskSortField === 'points') {
                  comp = (Number(a.points) || 0) - (Number(b.points) || 0);
                } else if (taskSortField === 'bitrixId') {
                  const idA = Number(String(a.bitrixId || a.externalId || '').replace(/\D/g, '')) || 0;
                  const idB = Number(String(b.bitrixId || b.externalId || '').replace(/\D/g, '')) || 0;
                  comp = idA - idB;
                } else if (taskSortField === 'name') {
                  comp = (a.name || '').localeCompare(b.name || '');
                } else if (taskSortField === 'taskType') {
                  const isRevA = (a.taskType || '').toLowerCase().includes('правк') || (a.name || '').toLowerCase().includes('правк') ? 1 : 0;
                  const isRevB = (b.taskType || '').toLowerCase().includes('правк') || (b.name || '').toLowerCase().includes('правк') ? 1 : 0;
                  comp = isRevA - isRevB;
                } else if (taskSortField === 'spentTime') {
                  const parseH = (t) => {
                    if (!t) return 0;
                    if (String(t).includes(':')) {
                      const [h, m] = String(t).split(':');
                      return (Number(h) || 0) * 60 + (Number(m) || 0);
                    }
                    return Number(t) || 0;
                  };
                  comp = parseH(a.spentTime) - parseH(b.spentTime);
                } else if (taskSortField === 'itemsInfo') {
                  comp = (a.itemsInfo || '').localeCompare(b.itemsInfo || '');
                }
                return taskSortOrder === 'asc' ? comp : -comp;
              });

              const totalTasksCount = stats.completedProjects?.length || 0;
              const hasUnmatched = stats.unmatchedProjects && stats.unmatchedProjects.length > 0;

              return (
                <div
                  key={employee.id}
                  className="neu-flat rounded-2xl border border-white/60 bg-[#e0e5ec] overflow-hidden shadow-sm transition-all hover:shadow-md"
                >
                  {/* Employee Summary Card Header */}
                  <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Avatar & Employee Info */}
                    <div className="flex items-center gap-4 min-w-[260px]">
                      <div className="w-14 h-14 rounded-2xl neu-flat flex items-center justify-center text-xl font-black text-primary bg-white/70 shadow-sm shrink-0">
                        {employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-800 leading-snug">{employeeName}</h3>
                        <p className="text-xs font-semibold text-gray-500 mt-0.5">
                          {employeeSingleTitle} · {stats.elapsedWorkingDays} роб. дн. у періоді
                        </p>
                      </div>
                    </div>

                    {/* Middle: KPI Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                      {/* Points */}
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1">
                          <TrendingUp size={11} className="text-primary" />
                          Виконано / План
                        </span>
                        <p className="text-lg font-black text-gray-800 mt-0.5">
                          {stats.totalPoints}п <span className="text-xs font-normal text-gray-500">/ {stats.targetPoints}п</span>
                        </p>
                        <p className={`text-xs ${progressTone}`}>{progress}% виконання</p>
                      </div>

                      {/* Tasks */}
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-emerald-500" />
                          Закрито задач
                        </span>
                        <p className="text-lg font-black text-gray-800 mt-0.5">
                          {totalTasksCount} <span className="text-xs font-normal text-gray-500">шт</span>
                        </p>
                        <p className="text-[11px] font-medium text-gray-500">
                          {stats.advanced.newTasks}н · {stats.advanced.revisions}пр
                        </p>
                      </div>

                      {/* Hours */}
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-gray-500 flex items-center gap-1">
                          <Clock3 size={11} className="text-indigo-500" />
                          Час факт / план
                        </span>
                        <p className="text-lg font-black text-gray-800 mt-0.5">
                          {stats.advanced.spentH} <span className="text-xs font-normal text-gray-500">/ {stats.advanced.plannedH} год</span>
                        </p>
                        <p className="text-[11px] font-medium text-gray-500">
                          {stats.advanced.items} виробів
                        </p>
                      </div>

                      {/* Progress Bar Visual */}
                      <div className="flex flex-col justify-center">
                        <div className="flex justify-between text-[10px] font-extrabold uppercase text-gray-500 mb-1">
                          <span>Прогрес</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-300/60 rounded-full overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
                            style={{ width: `${progressBarWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleExportSingle(employeeName, stats)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-gray-700 hover:text-primary bg-white shadow-xs border border-gray-200 transition-all flex items-center gap-1.5"
                        title="Експортувати список закритих задач співробітника в Excel"
                      >
                        <Download size={13} />
                        <span className="hidden sm:inline">Excel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleEmployee(employee.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                          isExpanded
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}
                      >
                        <span>Задачі ({totalTasksCount})</span>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Accordion: Detailed Task List for Bitrix Reconciliation */}
                  {isExpanded && (
                    <div className="border-t border-gray-300/80 bg-white/60 p-5 space-y-4 animate-in fade-in duration-200">
                      {/* Diagnostic Alert if Unmatched Tasks Exist */}
                      {hasUnmatched && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3">
                          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                          <div>
                            <p className="font-extrabold">
                              Знайдено {stats.unmatchedProjects.length} задач цього виконавця без дати закриття чи з іншим статусом:
                            </p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              Якщо в Бітріксі поінти вищі, можливо ці задачі завершено в Бітрікс, але в них не заповнено колонку дати завершення:
                            </p>
                            <div className="mt-2 space-y-1">
                              {stats.unmatchedProjects.map((u, uIdx) => (
                                <div key={uIdx} className="font-mono text-[11px] flex items-center gap-2">
                                  <span className="font-bold text-amber-700">#{u.bitrixId || 'без ID'}:</span>
                                  <span>{u.name}</span>
                                  <span className="text-gray-500 font-normal">({u.points || 0}п, причина: {u.unmatchReason})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Header bar inside details: Count and quick search match */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-gray-700 tracking-wider">
                            Список закритих задач за вибраний період:
                          </span>
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            {displayedTasks.length} {displayedTasks.length === 1 ? 'задача' : 'задач'}
                          </span>
                        </div>

                        <span className="text-xs font-mono font-bold text-gray-500">
                          Сума поінтів: <span className="text-primary font-black">{displayedTasks.reduce((s, t) => s + (t.points || 0), 0)}п</span>
                        </span>
                      </div>

                      {/* Tasks Table */}
                      {displayedTasks.length === 0 ? (
                        <div className="p-8 text-center rounded-xl bg-[#e0e5ec]/40 border border-dashed border-gray-300 text-gray-500 text-xs">
                          Не знайдено закритих задач, що відповідають умовам пошуку.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-300/80 bg-white shadow-xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-100/90 border-b border-gray-300 text-[10px] font-black uppercase text-gray-600 tracking-wider">
                                <th className="py-2.5 px-3 w-12 text-center select-none">№</th>
                                <th
                                  onClick={() => handleTaskSort('bitrixId')}
                                  className={`py-2.5 px-3 w-28 cursor-pointer select-none group transition-colors hover:bg-gray-200/90 ${
                                    taskSortField === 'bitrixId' ? 'text-primary bg-primary/10' : ''
                                  }`}
                                  title="Натисніть для сортування за ID Бітрікса"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>ID Бітрікс</span>
                                    {renderSortIndicator('bitrixId')}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleTaskSort('name')}
                                  className={`py-2.5 px-4 cursor-pointer select-none group transition-colors hover:bg-gray-200/90 ${
                                    taskSortField === 'name' ? 'text-primary bg-primary/10' : ''
                                  }`}
                                  title="Натисніть для сортування за назвою задачі"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Назва задачі / проєкту</span>
                                    {renderSortIndicator('name')}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleTaskSort('completedAt')}
                                  className={`py-2.5 px-3 w-36 text-center cursor-pointer select-none group transition-colors hover:bg-gray-200/90 ${
                                    taskSortField === 'completedAt' ? 'text-primary bg-primary/10' : ''
                                  }`}
                                  title="Натисніть для сортування за датою закриття"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span>Дата закриття</span>
                                    {renderSortIndicator('completedAt')}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleTaskSort('points')}
                                  className={`py-2.5 px-3 w-24 text-center cursor-pointer select-none group transition-colors hover:bg-gray-200/90 ${
                                    taskSortField === 'points' ? 'text-primary bg-primary/10' : ''
                                  }`}
                                  title="Натисніть для сортування за поінтами"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span>Поінти</span>
                                    {renderSortIndicator('points')}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleTaskSort('taskType')}
                                  className={`py-2.5 px-3 w-32 cursor-pointer select-none group transition-colors hover:bg-gray-200/90 ${
                                    taskSortField === 'taskType' ? 'text-primary bg-primary/10' : ''
                                  }`}
                                  title="Натисніть для сортування за типом (Нові / Правки)"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Тип / Категорія</span>
                                    {renderSortIndicator('taskType')}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleTaskSort('spentTime')}
                                  className={`py-2.5 px-3 w-32 text-center cursor-pointer select-none group transition-colors hover:bg-gray-200/90 ${
                                    taskSortField === 'spentTime' ? 'text-primary bg-primary/10' : ''
                                  }`}
                                  title="Натисніть для сортування за часом"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span>Час (факт/план)</span>
                                    {renderSortIndicator('spentTime')}
                                  </div>
                                </th>
                                <th
                                  onClick={() => handleTaskSort('itemsInfo')}
                                  className={`py-2.5 px-3 w-36 cursor-pointer select-none group transition-colors hover:bg-gray-200/90 ${
                                    taskSortField === 'itemsInfo' ? 'text-primary bg-primary/10' : ''
                                  }`}
                                  title="Натисніть для сортування за виробами"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>Вироби</span>
                                    {renderSortIndicator('itemsInfo')}
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {displayedTasks.map((task, tIdx) => {
                                const isRev =
                                  (task.taskType || '').toLowerCase().includes('правк') ||
                                  (task.name || '').toLowerCase().includes('правк');
                                const bitrixIdClean = String(task.bitrixId || task.externalId || '').replace(/^btx-/, '').trim();
                                const isRealBitrixId = /^\d+$/.test(bitrixIdClean);

                                return (
                                  <tr key={task.id || tIdx} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="py-2 px-3 text-center text-gray-400 font-mono text-[11px]">
                                      {tIdx + 1}
                                    </td>

                                    {/* Bitrix ID with Link and Copy */}
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      {isRealBitrixId ? (
                                        <div className="inline-flex items-center gap-1">
                                          <a
                                            href={`https://portal.viyar.ua/company/personal/user/1/tasks/task/view/${bitrixIdClean}/`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-mono font-black text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                                            title="Відкрити цю задачу в Бітрікс24"
                                          >
                                            <span>#{bitrixIdClean}</span>
                                            <ExternalLink size={10} className="text-blue-400" />
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => copyToClipboard(bitrixIdClean, `id-${task.id}`)}
                                            className="p-1 text-gray-400 hover:text-gray-700 rounded"
                                            title="Скопіювати ID"
                                          >
                                            {copiedId === `id-${task.id}` ? (
                                              <Check size={11} className="text-emerald-600" />
                                            ) : (
                                              <Copy size={11} />
                                            )}
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="font-mono text-gray-400 text-[10px]">
                                          {task.bitrixId ? `#${task.bitrixId}` : '—'}
                                        </span>
                                      )}
                                    </td>

                                    {/* Task Name & Direction */}
                                    <td className="py-2 px-4">
                                      <div className="font-bold text-gray-800 leading-snug">
                                        {task.name}
                                      </div>
                                      {task.direction && task.direction !== 'Загальне' && (
                                        <div className="text-[10px] font-medium text-gray-500 mt-0.5">
                                          Напрямок: <span className="font-semibold text-gray-700">{task.direction}</span>
                                        </div>
                                      )}
                                    </td>

                                    {/* Completed Date */}
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <span className="font-mono font-bold text-gray-700 text-xs">
                                        {formatDateUA(task.completedAt)}
                                      </span>
                                    </td>

                                    {/* Points */}
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <span className="inline-block px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-black font-mono text-xs border border-blue-200">
                                        {task.points || 0}п
                                      </span>
                                    </td>

                                    {/* Task Category / Type */}
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                          isRev
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        }`}
                                      >
                                        {isRev ? 'Правка' : 'Нова розробка'}
                                      </span>
                                    </td>

                                    {/* Spent vs Planned Time */}
                                    <td className="py-2 px-3 text-center whitespace-nowrap font-mono text-xs text-gray-600">
                                      <span className="font-bold text-gray-800">{task.spentTime || '0'}</span>
                                      <span className="text-gray-400 font-normal"> / {task.plannedTime || '0'}</span>
                                    </td>

                                    {/* Items Info */}
                                    <td className="py-2 px-3 text-gray-600 truncate max-w-[180px]" title={task.itemsInfo || ''}>
                                      {task.itemsInfo || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-100 font-black text-gray-800 border-t-2 border-gray-300">
                                <td colSpan={4} className="py-2.5 px-4 text-right uppercase text-[10px] tracking-wider text-gray-600">
                                  Разом по співробітнику:
                                </td>
                                <td className="py-2.5 px-3 text-center text-primary text-sm font-mono font-black">
                                  {displayedTasks.reduce((s, t) => s + (t.points || 0), 0)}п
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-gray-600 font-normal">
                                  {displayedTasks.length} задач
                                </td>
                                <td className="py-2.5 px-3 text-center text-xs font-mono text-gray-700">
                                  {stats.advanced.spentH} год
                                </td>
                                <td className="py-2.5 px-3 text-xs text-gray-600">
                                  {stats.advanced.items} виробів
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};

export default Audit;
