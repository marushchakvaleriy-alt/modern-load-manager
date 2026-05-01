import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GitPullRequest,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';

const getMonthStartValue = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayValue = () => new Date().toISOString().split('T')[0];

const Audit = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [startDate, setStartDate] = useState(getMonthStartValue);
  const [endDate, setEndDate] = useState(getTodayValue);
  const { calculateEfficiency, CAPACITY_PER_DAY } = useLoadEngine(projects, employees);

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

  return (
    <div className="space-y-8">
      <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="bg-gradient-to-r from-white to-white/40 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            Аудит виконання
          </h2>
          <p className="mt-2 text-lg text-secondary">
            Поточний прогрес за вибраний період відносно плану
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">Дата з</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-primary/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">Дата до</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-primary/50"
            />
          </label>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {employees.length === 0 && (
          <div className="glass-card p-20 text-center">
            <Award className="mx-auto mb-4 text-white/5" size={64} />
            <p className="text-lg text-secondary">Немає даних про виконавців для аудиту.</p>
          </div>
        )}

        {employees.map((employee) => {
          const stats = calculateEfficiency(employee.name, startDate, endDate);
          const progress = Math.round(stats.efficiency);
          const progressBarWidth = Math.min(progress, 100);
          const progressTone = progress >= 100 ? 'text-success' : 'text-accent';
          const progressBarTone = progress >= 100 ? 'bg-success' : 'bg-primary';

          return (
            <div
              key={employee.id}
              className="glass-card group flex flex-col items-center gap-10 p-8 transition-colors hover:border-primary/30 lg:flex-row"
            >
              <div className="flex w-full flex-1 items-center gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gradient-to-br from-primary/30 to-primary/10 text-3xl font-bold text-primary shadow-inner shadow-white/5">
                  {employee.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">{employee.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-success"></span>
                    <p className="text-sm font-medium text-secondary">Проєктант відділу</p>
                  </div>
                </div>
              </div>

              <div className="grid w-full flex-[2] grid-cols-2 gap-y-8 gap-x-6 border-l border-white/5 pl-10 md:grid-cols-3 lg:gap-x-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    <TrendingUp size={12} className="text-primary" />
                    <span>Виконано за період</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight">
                    {stats.totalPoints}{' '}
                    <span className="text-sm font-normal italic text-secondary">/ {stats.targetPoints}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    <CheckCircle2 size={12} className="text-accent" />
                    <span>Прогрес плану</span>
                  </div>
                  <p className={`text-3xl font-bold tracking-tight ${progressTone}`}>{progress}%</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    <CalendarDays size={12} className="text-secondary" />
                    <span>План за період</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight">
                    {stats.targetPoints}{' '}
                    <span className="text-sm font-normal italic text-secondary">
                      ({stats.elapsedWorkingDays} роб. дн.)
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    <Clock3 size={12} className="text-indigo-400" />
                    <span>Час (факт / план)</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    {stats.advanced.spentH}{' '}
                    <span className="text-xs font-normal italic text-secondary">
                      год / {stats.advanced.plannedH} год
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    <GitPullRequest size={12} className="text-amber-400" />
                    <span>Задачі (правки / нові)</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    {stats.advanced.revisions}{' '}
                    <span className="text-xs font-normal italic text-secondary">
                      / {stats.advanced.newTasks} шт
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    <Layers size={12} className="text-emerald-400" />
                    <span>Вироби</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    {stats.advanced.items}{' '}
                    <span className="text-xs font-normal italic text-secondary">шт</span>
                  </p>
                </div>
              </div>

              <div className="w-full lg:w-64">
                <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-secondary">
                  <span>Статус</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/5 shadow-inner">
                  <div
                    className={`h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(61,90,254,0.3)] ${progressBarTone}`}
                    style={{ width: `${progressBarWidth}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-secondary">
                  Норма дня: {CAPACITY_PER_DAY} поінти. Тут показано прогрес за вибраний період.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Audit;
