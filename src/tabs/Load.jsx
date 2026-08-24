import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { User, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';

import { useDepartment } from '../store/departmentContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Load = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);

  const { filterByDepartment } = useDepartment();
  const deptProjects = filterByDepartment(projects);
  const deptEmployees = filterByDepartment(employees);
  const deptAbsences = filterByDepartment(absences);

  const { employeeLoad, CAPACITY_PER_DAY } = useLoadEngine(deptProjects, deptEmployees, deptAbsences);

  useEffect(() => {
    const unsubProjects = onSnapshot(query(collection(db, 'projects')), (snap) =>
      setProjects(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    const unsubEmployees = onSnapshot(query(collection(db, 'employees')), (snap) =>
      setEmployees(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    const unsubAbsences = onSnapshot(query(collection(db, 'absences')), (snap) =>
      setAbsences(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );

    return () => {
      unsubProjects();
      unsubEmployees();
      unsubAbsences();
    };
  }, []);

  const chartData = {
    labels: employeeLoad.map((employee) => employee.name),
    datasets: [
      {
        label: 'В роботі (поінти)',
        data: employeeLoad.map((employee) => employee.active),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 6
      },
      {
        label: 'Завершено (поінти)',
        data: employeeLoad.map((employee) => employee.completed),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 6
      },
      {
        label: 'Прострочено (поінти)',
        data: employeeLoad.map((employee) => employee.overdue),
        backgroundColor: 'rgba(239, 68, 68, 0.65)',
        borderColor: '#ef4444',
        borderWidth: 1,
        borderRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#4b5563',
          padding: 16,
          font: { weight: 'bold', family: 'Outfit' }
        }
      },
      tooltip: {
        backgroundColor: '#e0e5ec',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          afterLabel: (ctx) => {
            const employee = employeeLoad[ctx.dataIndex];
            if (employee?.isSenior) return 'В очікуванні розподілу';
            const totalPending = employee?.pending ?? (employee.active + employee.overdue);
            const days = employee ? Math.round((totalPending / CAPACITY_PER_DAY) * 10) / 10 : 0;
            return `Завантажена на: ${days} дн. (${totalPending}п у черзі)`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: false,
        grid: { display: false },
        ticks: { color: '#6b7280', font: { family: 'Outfit' } }
      },
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: '#6b7280', font: { family: 'Outfit' } }
      }
    }
  };

  if (!employeeLoad.length) {
    return (
      <div className="space-y-8">
        <header className="mb-10">
          <h2 className="text-4xl font-bold tracking-tight text-gray-700">
            Навантаження
          </h2>
          <p className="text-gray-500 font-medium mt-2 text-lg">Розподіл задач між проєктантами</p>
        </header>
        <div className="glass-card p-12 text-center">
          <User size={48} className="text-secondary mx-auto mb-4" />
          <p className="text-secondary">Дані відсутні. Імпортуйте файл Excel для відображення навантаження.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="mb-10">
        <h2 className="text-4xl font-bold tracking-tight text-gray-700">
          Навантаження
        </h2>
        <p className="text-gray-500 font-medium mt-2 text-lg">Розподіл задач між проєктантами</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {employeeLoad.map((employee, index) => {
          const WORKING_DAYS = 22;
          const totalPending = employee?.pending ?? (employee.active + employee.overdue);
          const totalPendingCount = employee?.pendingCount ?? (employee.activeCount + employee.overdueCount);
          const daysLoaded = Math.round((totalPending / CAPACITY_PER_DAY) * 10) / 10;
          const barWidth = Math.min(100, (daysLoaded / WORKING_DAYS) * 100);
          const isOverloaded = daysLoaded > WORKING_DAYS * 0.9;
          const isUnderloaded = daysLoaded < WORKING_DAYS * 0.4;

          return (
            <div key={index} className="neu-flat p-6 transition-all hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 neu-pressed flex items-center justify-center text-primary">
                  <User size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate text-gray-700">{employee.name}</p>
                    {employee.isSenior && (
                      <span className="px-2 py-0.5 rounded-lg neu-pressed text-amber-600 text-[9px] font-bold uppercase">
                        Старший
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    {totalPendingCount} активних задач ({totalPending} поінтів)
                  </p>
                </div>
                {employee.isSenior ? (
                  <RefreshCw size={16} className="text-amber-500 shrink-0" />
                ) : (
                  <>
                    {isOverloaded && <AlertTriangle size={16} className="text-red-500 shrink-0" />}
                    {!isOverloaded && !isUnderloaded && <TrendingUp size={16} className="text-emerald-500 shrink-0" />}
                  </>
                )}
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 font-semibold mb-1">
                  <span>{employee.isSenior ? 'В очікуванні розподілу' : 'Завантажена на'}</span>
                  <span className={isOverloaded && !employee.isSenior ? 'text-red-500 font-extrabold' : 'text-gray-800 font-extrabold'}>
                    {employee.isSenior ? `${totalPending} поінтів` : `${daysLoaded} дн.`}
                  </span>
                </div>
                {!employee.isSenior && (
                  <>
                    <div className="h-2.5 neu-pressed rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOverloaded ? 'bg-red-500' : isUnderloaded ? 'bg-amber-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 text-right">норма: 22 дн./міс. (при 42п/день)</p>
                  </>
                )}
                {employee.isSenior && (
                  <div className="h-2.5 neu-pressed rounded-full overflow-hidden p-0.5">
                    <div className="h-full bg-amber-500/40 w-full animate-pulse rounded-full" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="neu-pressed p-2 rounded-xl">
                  <p className="text-lg font-extrabold text-blue-600">
                    {employee.activeCount} <span className="text-xs font-semibold text-blue-500">({employee.active})</span>
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">В роботі</p>
                </div>
                <div className="neu-pressed p-2 rounded-xl">
                  <p className="text-lg font-extrabold text-emerald-600">
                    {employee.completedCount} <span className="text-xs font-semibold text-emerald-500">({employee.completed})</span>
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Закрито</p>
                </div>
                <div className="neu-pressed p-2 rounded-xl">
                  <p className="text-lg font-extrabold text-red-500">
                    {employee.overdueCount} <span className="text-xs font-semibold text-red-400">({employee.overdue})</span>
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Прострочено</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="neu-flat p-8 h-[440px]">
        <h3 className="text-xl font-bold tracking-tight text-gray-700 mb-6">Зведений графік навантаження</h3>
        <div className="h-[340px] neu-pressed p-6 rounded-3xl">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default Load;
