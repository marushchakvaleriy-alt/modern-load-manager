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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Load = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);
  const { employeeLoad, CAPACITY_PER_DAY } = useLoadEngine(projects, employees, absences);

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
      legend: { position: 'top', labels: { color: '#94a3b8', padding: 16 } },
      tooltip: {
        callbacks: {
          afterLabel: (ctx) => {
            const employee = employeeLoad[ctx.dataIndex];
            if (employee?.isSenior) return 'В очікуванні розподілу';
            const days = employee ? Math.round((employee.active / CAPACITY_PER_DAY) * 10) / 10 : 0;
            return `Завантажена на: ${days} дн.`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: false,
        grid: { display: false },
        ticks: { color: '#64748b' }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#64748b' }
      }
    }
  };

  if (!employeeLoad.length) {
    return (
      <div className="space-y-8">
        <header className="mb-10">
          <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
            Навантаження
          </h2>
          <p className="text-secondary mt-2 text-lg">Розподіл задач між проєктантами</p>
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
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
          Навантаження
        </h2>
        <p className="text-secondary mt-2 text-lg">Розподіл задач між проєктантами</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {employeeLoad.map((employee, index) => {
          const WORKING_DAYS = 22;
          const daysLoaded = Math.round((employee.active / CAPACITY_PER_DAY) * 10) / 10;
          const barWidth = Math.min(100, (daysLoaded / WORKING_DAYS) * 100);
          const isOverloaded = daysLoaded > WORKING_DAYS * 0.9;
          const isUnderloaded = daysLoaded < WORKING_DAYS * 0.4;

          return (
            <div key={index} className="glass-card p-6 hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <User size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate">{employee.name}</p>
                    {employee.isSenior && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase border border-amber-500/20">
                        Старший
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-secondary">
                    {employee.activeCount} задач у роботі ({employee.active} поінтів)
                  </p>
                </div>
                {employee.isSenior ? (
                  <RefreshCw size={16} className="text-amber-500 shrink-0" />
                ) : (
                  <>
                    {isOverloaded && <AlertTriangle size={16} className="text-danger shrink-0" />}
                    {!isOverloaded && !isUnderloaded && <TrendingUp size={16} className="text-success shrink-0" />}
                  </>
                )}
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-xs text-secondary mb-1">
                  <span>{employee.isSenior ? 'В очікуванні розподілу' : 'Завантажена на'}</span>
                  <span className={isOverloaded && !employee.isSenior ? 'text-danger font-bold' : 'text-white font-semibold'}>
                    {employee.isSenior ? `${employee.active} поінтів` : `${daysLoaded} дн.`}
                  </span>
                </div>
                {!employee.isSenior && (
                  <>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOverloaded ? 'bg-danger' : isUnderloaded ? 'bg-accent' : 'bg-primary'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-secondary mt-1 text-right">норма: 22 дн./міс.</p>
                  </>
                )}
                {employee.isSenior && (
                  <div className="h-2 bg-amber-500/10 rounded-full overflow-hidden border border-amber-500/20">
                    <div className="h-full bg-amber-500/30 w-full animate-pulse" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-primary">
                    {employee.activeCount} <span className="text-xs font-medium text-primary/80">({employee.active})</span>
                  </p>
                  <p className="text-[10px] text-secondary uppercase tracking-wider">В роботі</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-success">
                    {employee.completedCount} <span className="text-xs font-medium text-success/80">({employee.completed})</span>
                  </p>
                  <p className="text-[10px] text-secondary uppercase tracking-wider">Закрито</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-danger">
                    {employee.overdueCount} <span className="text-xs font-medium text-danger/80">({employee.overdue})</span>
                  </p>
                  <p className="text-[10px] text-secondary uppercase tracking-wider">Прострочено</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-card p-8 h-[420px]">
        <h3 className="text-xl font-bold tracking-tight mb-6">Зведений графік навантаження</h3>
        <div className="h-[320px]">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default Load;
