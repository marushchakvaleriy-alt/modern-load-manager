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

const Flow = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [selectedDirection, setSelectedDirection] = useState(ALL_DIRECTIONS_VALUE);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const initialStart = new Date();
    initialStart.setDate(initialStart.getDate() - 20);
    return initialStart.toISOString().split('T')[0];
  });

  const { calculateDailyFlow } = useLoadEngine(projects, employees, absences);

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
      ...[...new Set(projects.map((project) => project.direction).filter(Boolean))]
        .sort()
        .map((direction) => ({ value: direction, label: direction }))
    ],
    [projects]
  );

  const selectedDirectionLabel =
    directionOptions.find((option) => option.value === selectedDirection)?.label || ALL_DIRECTIONS_LABEL;
  const isAllDirections = selectedDirection === ALL_DIRECTIONS_VALUE;

  const rawFlowData = calculateDailyFlow(selectedDirection, startDate, endDate);
  const overallFlowData = calculateDailyFlow(ALL_DIRECTIONS_VALUE, startDate, endDate);

  const flowData = useMemo(
    () =>
      rawFlowData.map((day, index) => {
        if (isAllDirections) {
          return {
            ...day,
            loadWeight: day.buffer + day.overdue,
            weightedShare: 100,
            estimatedPerformers: day.performersCount,
            estimatedCapacity: day.capacity
          };
        }

        const overallDay = overallFlowData[index];
        const ownWeight = day.buffer + day.overdue;
        const totalWeight = (overallDay?.buffer || 0) + (overallDay?.overdue || 0);
        const share = totalWeight > 0 ? ownWeight / totalWeight : 0;

        return {
          ...day,
          loadWeight: ownWeight,
          weightedShare: share * 100,
          estimatedPerformers: (overallDay?.performersCount || 0) * share,
          estimatedCapacity: Math.round((overallDay?.capacity || 0) * share)
        };
      }),
    [isAllDirections, overallFlowData, rawFlowData]
  );

  const lastDay = flowData[flowData.length - 1] || {};

  const barPoints = flowData.map((day, index) => ({
    x: index + 1.5,
    input: day.input,
    completed: day.completed,
    buffer: day.buffer,
    overdue: day.overdue
  }));

  const capacityPoints = flowData.length
    ? [
        {
          x: 1,
          y: isAllDirections ? flowData[0].capacity : flowData[0].estimatedCapacity
        },
        ...flowData.map((day, index) => ({
          x: index + 2,
          y: isAllDirections ? day.capacity : day.estimatedCapacity
        }))
      ]
    : [];

  const chartData = {
    datasets: [
      {
        type: 'bar',
        label: 'Вхід (Поінти)',
        data: barPoints.map((point) => ({ x: point.x, y: point.input })),
        backgroundColor: INPUT_COLOR,
        hoverBackgroundColor: '#4c4cff',
        borderRadius: 5,
        order: 2,
        grouped: true,
        barPercentage: 0.75,
        maxBarThickness: 14
      },
      {
        type: 'bar',
        label: 'Закрито',
        data: barPoints.map((point) => ({ x: point.x, y: point.completed })),
        backgroundColor: COMPLETED_COLOR,
        hoverBackgroundColor: '#ff4da6',
        borderRadius: 5,
        order: 3,
        grouped: true,
        barPercentage: 0.75,
        maxBarThickness: 14
      },
      {
        type: 'bar',
        label: 'Буфер (Залишок)',
        data: barPoints.map((point) => ({ x: point.x, y: point.buffer })),
        backgroundColor: BUFFER_COLOR,
        hoverBackgroundColor: '#86efac',
        borderRadius: 5,
        order: 1,
        grouped: true,
        barPercentage: 0.88,
        maxBarThickness: 20
      },
      {
        type: 'line',
        label: 'Протерміновані',
        data: barPoints.map((point) => ({ x: point.x, y: point.overdue })),
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
        label: isAllDirections ? 'Потужність (Capacity)' : 'Оцінена потужність',
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

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          usePointStyle: true,
          boxWidth: 10,
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          title: (items) => {
            const x = items[0]?.parsed?.x ?? 1;
            const index = Math.max(0, Math.min(flowData.length - 1, Math.floor(x) - 1));
            return flowData[index]?.dateLabel || '';
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
          color: 'rgba(255,255,255,0.03)',
          drawTicks: false
        },
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          stepSize: 1,
          callback: (value) => {
            const index = Number(value) - 1;
            return Number.isInteger(value) && flowData[index] ? flowData[index].dateLabel : '';
          }
        }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b' }
      }
    }
  };

  const formatDate = (dateStr, field) =>
    formatDateOnly(normalizeImportedProjectDate(dateStr, { preferPast: field !== 'deadline' }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
            Потік та пропускна здатність
          </h2>
          <p className="text-secondary mt-2 text-lg">Аналіз вхідної роботи, випуску та накопиченого буфера</p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">���� �:</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:bg-white/10 text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">���� ��:</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:bg-white/10 text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">��������:</span>
            <select
              value={selectedDirection}
              onChange={(event) => setSelectedDirection(event.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:bg-white/10 text-white"
            >
              {directionOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-900 border-none">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {!isAllDirections && (
        <div className="glass-card p-4 text-sm text-secondary">
          Розподіл для напрямку зараз рахується як аналітична оцінка: <span className="text-white font-semibold">буфер + протерміновані</span>
          . Вона не дублює відділ, а ділить загальний ресурс пропорційно частці навантаження напрямку.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="glass-card p-4 border-l-4 border-[#0e0efe]">
          <div className="flex items-center gap-3 mb-2">
            <Inbox size={18} className="text-[#0e0efe]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-secondary">Вхід (період)</span>
          </div>
          <p className="text-xl font-bold">
            {flowData.reduce((sum, day) => sum + day.input, 0)} <span className="text-xs font-normal text-secondary">поінтів</span>
          </p>
        </div>

        <div className="glass-card p-4 border-l-4 border-[#ff0080]">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={18} className="text-[#ff0080]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-secondary">Закрито (період)</span>
          </div>
          <p className="text-xl font-bold">
            {flowData.reduce((sum, day) => sum + day.completed, 0)} <span className="text-xs font-normal text-secondary">поінтів</span>
          </p>
        </div>

        <div className="glass-card p-4 border-l-4 border-[#4ade80]">
          <div className="flex items-center gap-3 mb-2">
            <Database size={18} className="text-[#4ade80]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-secondary">Буфер (поточний)</span>
          </div>
          <p className="text-xl font-bold">
            {lastDay.buffer || 0} <span className="text-xs font-normal text-secondary">поінтів</span>
          </p>
        </div>

        <div className="glass-card p-4 border-l-4 border-[#ff0000]">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={18} className="text-[#ff0000]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-secondary">Протерміновано</span>
          </div>
          <p className="text-xl font-bold">
            {lastDay.overdue || 0} <span className="text-xs font-normal text-secondary">поінтів</span>
          </p>
        </div>

        <div className="glass-card p-4 border-l-4 border-purple-400">
          <div className="flex items-center gap-3 mb-2">
            <Users size={18} className="text-purple-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-secondary">
              {isAllDirections ? 'Виконавці' : 'Оцінено виконавців'}
            </span>
          </div>
          <p className="text-xl font-bold">
            {isAllDirections ? (
              <>
                {lastDay.performersCount || 0} <span className="text-xs font-normal text-secondary">осіб</span>
              </>
            ) : (
              <>
                {formatPeople(lastDay.estimatedPerformers || 0)} <span className="text-xs font-normal text-secondary">осіб</span>
              </>
            )}
          </p>
        </div>

        <div className="glass-card p-4 border-l-4 border-[#f59e0b]">
          <div className="flex items-center gap-3 mb-2">
            <Zap size={18} className="text-[#f59e0b]" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-secondary">
              {isAllDirections ? 'Потужність' : 'Оцінена потужність'}
            </span>
          </div>
          <p className="text-xl font-bold">
            {isAllDirections ? lastDay.capacity || 0 : lastDay.estimatedCapacity || 0}{' '}
            <span className="text-xs font-normal text-secondary">поінтів</span>
          </p>
        </div>
      </div>

      <div className="glass-card p-8 h-[600px]">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Activity size={20} className="text-primary" />
            Динаміка пропускної здатності (21 день) — {selectedDirectionLabel} ({flowData[0]?.date?.toLocaleDateString('uk-UA') || '—'} — {flowData[flowData.length - 1]?.date?.toLocaleDateString('uk-UA') || '—'})
          </h3>
        </div>
        <div className="h-[450px]">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="glass-card p-8">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-secondary">
          <Database size={18} />
          DEBUG: Останні 15 проєктів у базі
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-secondary uppercase font-bold">
                <th className="py-2">Назва проєкту</th>
                <th className="py-2">Статус</th>
                <th className="py-2">Створено (Input)</th>
                <th className="py-2">Завершено (Completed)</th>
                <th className="py-2">Бали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {projects.slice(-15).map((project) => (
                <tr key={project.id}>
                  <td className="py-2 font-medium">{project.name}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        project.status === 'completed' ? 'bg-violet-400/20 text-[#ff0080]' : 'bg-green-400/20 text-green-400'
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="py-2 text-[#0e0efe]">{formatDate(project.startDate, 'startDate')}</td>
                  <td className="py-2 text-[#ff0080]">{formatDate(project.completedAt, 'completedAt')}</td>
                  <td className="py-2 font-bold">{project.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-secondary mt-4 italic">
            * Якщо бачиш X, значить колонку в Excel не знайдено або вона була порожня.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Flow;


