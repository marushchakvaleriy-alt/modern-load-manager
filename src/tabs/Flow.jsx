import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  BarController
} from 'chart.js';
import { Activity, CheckCircle, Database, Inbox, TrendingUp, Users, Zap } from 'lucide-react';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';
import { formatDateOnly, normalizeImportedProjectDate } from '../lib/dateUtils';
import CustomSelect from '../components/CustomSelect';

import CustomDatePicker from '../components/CustomDatePicker';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  BarController
);

const ALL_DIRECTIONS_VALUE = '__ALL__';
const ALL_DIRECTIONS_LABEL = 'Всі';

const INPUT_COLOR = '#0e0efe';
const COMPLETED_COLOR = '#ff0080';
const BUFFER_COLOR = '#4ade80';
const OVERDUE_COLOR = '#ff0000';
const CAPACITY_COLOR = '#f59e0b';

const formatPeople = (value) => {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

import { useDepartment } from '../store/departmentContext';

const Flow = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);

  const { filterByDepartment } = useDepartment();
  const deptProjects = filterByDepartment(projects);
  const deptEmployees = filterByDepartment(employees);
  const deptAbsences = filterByDepartment(absences);

  const [selectedDirection, setSelectedDirection] = useState(ALL_DIRECTIONS_VALUE);
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });

  const { calculateDailyFlow } = useLoadEngine(deptProjects, deptEmployees, deptAbsences);

  useEffect(() => {
    const unsubProjects = onSnapshot(query(collection(db, 'projects')), (snapshot) =>
      setProjects(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    const unsubEmployees = onSnapshot(query(collection(db, 'employees')), (snapshot) =>
      setEmployees(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    const unsubAbsences = onSnapshot(query(collection(db, 'absences')), (snapshot) =>
      setAbsences(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );

    return () => {
      unsubProjects();
      unsubEmployees();
      unsubAbsences();
    };
  }, []);

  const directionOptions = useMemo(
    () => [
      { value: ALL_DIRECTIONS_VALUE, label: ALL_DIRECTIONS_LABEL },
      ...[...new Set(deptProjects.map((project) => project.direction).filter(Boolean))]
        .sort()
        .map((direction) => ({ value: direction, label: direction }))
    ],
    [deptProjects]
  );

  const selectedDirectionLabel =
    directionOptions.find((option) => option.value === selectedDirection)?.label || ALL_DIRECTIONS_LABEL;
  const isAllDirections = selectedDirection === ALL_DIRECTIONS_VALUE;

  const rawFlowData = calculateDailyFlow(selectedDirection, startDate, endDate);
  const overallFlowData = calculateDailyFlow(ALL_DIRECTIONS_VALUE, startDate, endDate);

  const flowData = useMemo(
    () =>
      rawFlowData.map((day, index) => {
        const overallDay = overallFlowData[index] || {};
        const isSelectedDirection = !isAllDirections;

        let estimatedCapacity = day.capacity;
        let estimatedPerformers = day.performersCount;

        if (isSelectedDirection) {
          const overallBacklogTotal = (overallDay.buffer || 0) + (overallDay.overdue || 0);
          const dirBacklogTotal = (day.buffer || 0) + (day.overdue || 0);

          if (overallBacklogTotal > 0 && dirBacklogTotal > 0) {
            const ratio = Math.min(1, dirBacklogTotal / overallBacklogTotal);
            estimatedCapacity = (overallDay.capacity || 0) * ratio;
            estimatedPerformers = (overallDay.performersCount || 0) * ratio;
          } else if (day.input > 0) {
            const overallInput = overallDay.input || 1;
            const ratio = Math.min(1, day.input / overallInput);
            estimatedCapacity = (overallDay.capacity || 0) * ratio;
            estimatedPerformers = (overallDay.performersCount || 0) * ratio;
          } else {
            estimatedCapacity = 0;
            estimatedPerformers = 0;
          }
        }

        return {
          ...day,
          estimatedCapacity,
          estimatedPerformers
        };
      }),
    [rawFlowData, overallFlowData, isAllDirections]
  );

  const lastDay = flowData[flowData.length - 1] || {};

  const currentBacklog = useMemo(() => {
    const normTarget = String(selectedDirection || '').trim().toLowerCase();
    const isAll = normTarget === '__all__' || normTarget === 'всі' || !normTarget;
    
    return deptProjects
      .filter(p => {
        if (p.status === 'completed') return false;
        if (isAll) return true;
        const dir = String(p.direction || 'Загальне').trim().toLowerCase();
        if (normTarget === 'загальне') return !p.direction || dir === 'загальне';
        return dir === normTarget;
      })
      .reduce((sum, p) => sum + (Number(p.points) || 0), 0);
  }, [projects, selectedDirection]);

  const currentOverdue = useMemo(() => {
    const normTarget = String(selectedDirection || '').trim().toLowerCase();
    const isAll = normTarget === '__all__' || normTarget === 'всі' || !normTarget;
    
    return deptProjects
      .filter(p => {
        if (p.status !== 'overdue') return false;
        if (isAll) return true;
        const dir = String(p.direction || 'Загальне').trim().toLowerCase();
        if (normTarget === 'загальне') return !p.direction || dir === 'загальне';
        return dir === normTarget;
      })
      .reduce((sum, p) => sum + (Number(p.points) || 0), 0);
  }, [projects, selectedDirection]);

  const BUFFER_X_OFFSET = 1.08;
  const INPUT_X_OFFSET = 1.22;
  const COMPLETED_X_OFFSET = 1.36;
  const OVERDUE_X_OFFSET = 1.10;

  const dayPoints = flowData.map((day, index) => ({
    bufferX: index + BUFFER_X_OFFSET,
    inputX: index + INPUT_X_OFFSET,
    completedX: index + COMPLETED_X_OFFSET,
    overdueX: index + OVERDUE_X_OFFSET,
    input: day.input,
    completed: day.completed,
    buffer: day.buffer,
    overdue: day.overdue
  }));

  const capacityPoints = flowData.length
    ? [
        ...flowData.map((day, index) => ({
          x: index + 1,
          y: isAllDirections ? day.capacity : day.estimatedCapacity
        })),
        {
          x: flowData.length + 1,
          y: isAllDirections ? flowData[flowData.length - 1].capacity : flowData[flowData.length - 1].estimatedCapacity
        }
      ]
    : [];

  const chartData = {
    datasets: [
      {
        type: 'bar',
        label: 'Вхід (поінти)',
        data: dayPoints.map((point) => ({ x: point.inputX, y: point.input })),
        backgroundColor: INPUT_COLOR,
        hoverBackgroundColor: '#4c4cff',
        borderRadius: 5,
        order: 2,
        grouped: false,
        barThickness: 10,
        maxBarThickness: 10
      },
      {
        type: 'bar',
        label: 'Закрито',
        data: dayPoints.map((point) => ({ x: point.completedX, y: point.completed })),
        backgroundColor: COMPLETED_COLOR,
        hoverBackgroundColor: '#ff4da6',
        borderRadius: 5,
        order: 3,
        grouped: false,
        barThickness: 10,
        maxBarThickness: 10
      },
      {
        type: 'bar',
        label: 'Буфер (залишок)',
        data: dayPoints.map((point) => ({ x: point.bufferX, y: point.buffer })),
        backgroundColor: BUFFER_COLOR,
        hoverBackgroundColor: '#86efac',
        borderRadius: 5,
        order: 1,
        grouped: false,
        barThickness: 14,
        maxBarThickness: 14
      },
      {
        type: 'line',
        label: 'Протерміновані',
        data: dayPoints.map((point) => ({ x: point.overdueX, y: point.overdue })),
        borderColor: OVERDUE_COLOR,
        backgroundColor: 'rgba(255, 0, 0, 0.14)',
        pointBackgroundColor: OVERDUE_COLOR,
        pointBorderColor: '#fecaca',
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 3,
        fill: false,
        tension: 0.25
      },
      {
        type: 'line',
        label: isAllDirections ? 'Потужність' : 'Оцінена потужність',
        data: capacityPoints,
        borderColor: CAPACITY_COLOR,
        backgroundColor: 'rgba(245, 158, 11, 0.10)',
        pointBackgroundColor: '#fbbf24',
        pointBorderColor: '#fde68a',
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 3,
        fill: false,
        tension: 0,
        stepped: 'before'
      }
    ]
  };

  const getTooltipDayIndex = (x) => {
    if (!Number.isFinite(x) || !flowData.length) return 0;
    const clamped = Math.max(1, Math.min(flowData.length + 0.999, x));
    return Math.max(0, Math.min(flowData.length - 1, Math.floor(clamped) - 1));
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          title: (items) => {
            const x = items[0]?.parsed?.x ?? 1;
            const index = getTooltipDayIndex(x);
            return flowData[index]?.dateLabel || '';
          },
          label: (context) => {
            const x = context.parsed?.x ?? 1;
            const index = getTooltipDayIndex(x);
            const day = flowData[index];
            if (!day) return '';

            if (context.dataset.label === 'Вхід (поінти)') {
              return `Вхід (поінти): ${day.input}`;
            }
            if (context.dataset.label === 'Закрито') {
              return `Закрито: ${day.completed}`;
            }
            if (context.dataset.label === 'Буфер (залишок)') {
              return `Буфер (залишок): ${day.buffer}`;
            }
            if (context.dataset.label === 'Протерміновані') {
              return `Протерміновані: ${day.overdue}`;
            }

            const capacityValue = Number.isFinite(context.parsed?.y)
              ? context.parsed.y
              : isAllDirections
                ? day.capacity
                : day.estimatedCapacity;
            return `${context.dataset.label}: ${capacityValue}`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        min: 1,
        max: flowData.length + 1,
        grid: {
          display: true,
          color: 'rgba(0,0,0,0.05)',
          drawTicks: false
        },
        ticks: {
          color: '#4b5563',
          font: { size: 10, weight: 'bold' },
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0,
          stepSize: 1,
          callback: (value) => {
            const index = Number(value) - 1;
            return Number.isInteger(value) && flowData[index] ? flowData[index].dateLabel : '';
          }
        }
      },
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: '#4b5563', font: { weight: 'bold' } }
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-gray-700">
            Потік та пропускна здатність
          </h2>
          <p className="text-gray-500 font-medium mt-2 text-lg">Аналіз вхідної роботи, випуску та накопиченого буфера</p>
        </div>

        <div className="neu-pressed flex flex-wrap items-center gap-6 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Дата з:</span>
            <CustomDatePicker
              value={startDate}
              max={endDate}
              onChange={setStartDate}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Дата до:</span>
            <CustomDatePicker
              value={endDate}
              min={startDate}
              onChange={setEndDate}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Напрямок:</span>
            <CustomSelect
              options={directionOptions}
              value={selectedDirection}
              onChange={setSelectedDirection}
              className="w-40"
            />
          </div>
        </div>
      </header>

      {!isAllDirections && (
        <div className="neu-flat p-4 text-sm text-gray-600 font-medium">
          Розподіл для напрямку зараз рахується як аналітична оцінка: <span className="text-gray-800 font-bold">буфер + протерміновані</span>.
          Вона не дублює відділ, а ділить загальний ресурс пропорційно частці навантаження напрямку.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="neu-flat p-4 border-l-4 border-[#0e0efe]">
          <div className="flex items-center gap-3 mb-2">
            <Inbox size={18} className="text-[#0e0efe]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Вхід (період)</span>
          </div>
          <p className="text-xl font-extrabold text-gray-800">
            {flowData.reduce((sum, day) => sum + day.input, 0)} <span className="text-xs font-normal text-gray-500">поінтів</span>
          </p>
        </div>

        <div className="neu-flat p-4 border-l-4 border-[#ff0080]">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={18} className="text-[#ff0080]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Закрито (період)</span>
          </div>
          <p className="text-xl font-extrabold text-gray-800">
            {flowData.reduce((sum, day) => sum + day.completed, 0)} <span className="text-xs font-normal text-gray-500">поінтів</span>
          </p>
        </div>

        <div className="neu-flat p-4 border-l-4 border-[#4ade80]">
          <div className="flex items-center gap-3 mb-2">
            <Database size={18} className="text-[#4ade80]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Буфер (поточний)</span>
          </div>
          <p className="text-xl font-extrabold text-gray-800">
            {currentBacklog} <span className="text-xs font-normal text-gray-500">поінтів</span>
          </p>
        </div>

        <div className="neu-flat p-4 border-l-4 border-[#ff0000]">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={18} className="text-[#ff0000]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Протерміновано</span>
          </div>
          <p className="text-xl font-extrabold text-gray-800">
            {currentOverdue} <span className="text-xs font-normal text-gray-500">поінтів</span>
          </p>
        </div>

        <div className="neu-flat p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-3 mb-2">
            <Users size={18} className="text-purple-600" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">
              {isAllDirections ? 'Виконавці' : 'Оцінено виконавців'}
            </span>
          </div>
          <p className="text-xl font-extrabold text-gray-800">
            {isAllDirections ? (
              <>
                {lastDay.performersCount || 0} <span className="text-xs font-normal text-gray-500">осіб</span>
              </>
            ) : (
              <>
                {formatPeople(lastDay.estimatedPerformers || 0)} <span className="text-xs font-normal text-gray-500">осіб</span>
              </>
            )}
          </p>
        </div>

        <div className="neu-flat p-4 border-l-4 border-[#f59e0b]">
          <div className="flex items-center gap-3 mb-2">
            <Zap size={18} className="text-[#f59e0b]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">
              {isAllDirections ? 'Потужність' : 'Оцінена потужність'}
            </span>
          </div>
          <p className="text-xl font-extrabold text-gray-800">
            {isAllDirections ? lastDay.capacity || 0 : lastDay.estimatedCapacity || 0}{' '}
            <span className="text-xs font-normal text-gray-500">поінтів</span>
          </p>
        </div>
      </div>

      <div className="neu-flat p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-extrabold flex items-center gap-2 text-gray-800">
            <Activity size={20} className="text-primary" />
            Динаміка пропускної здатності — {selectedDirectionLabel} ({flowData[0]?.date?.toLocaleDateString('uk-UA') || '—'} — {flowData[flowData.length - 1]?.date?.toLocaleDateString('uk-UA') || '—'})
          </h3>

          <div className="flex flex-wrap items-center gap-5 neu-pressed px-4 py-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff0000] inline-block shadow-sm" />
              <span className="text-xs font-extrabold text-gray-800">Протерміновані</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f59e0b] inline-block shadow-sm" />
              <span className="text-xs font-extrabold text-gray-800">
                {isAllDirections ? 'Потужність' : 'Оцінена потужність'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#4ade80] inline-block shadow-sm" />
              <span className="text-xs font-extrabold text-gray-800">Буфер (залишок)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#0e0efe] inline-block shadow-sm" />
              <span className="text-xs font-extrabold text-gray-800">Вхід (поінти)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff0080] inline-block shadow-sm" />
              <span className="text-xs font-extrabold text-gray-800">Закрито</span>
            </div>
          </div>
        </div>

        <div className="h-[460px]">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default Flow;
