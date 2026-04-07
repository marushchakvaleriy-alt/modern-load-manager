import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';
import { TrendingUp, Award, Zap, Clock, GitPullRequest, Layers } from 'lucide-react';

const Audit = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const { calculateEfficiency, CAPACITY_PER_DAY } = useLoadEngine(projects, employees);

  useEffect(() => {
    onSnapshot(collection(db, 'projects'), (snap) => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(collection(db, 'employees'), (snap) => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  return (
    <div className="space-y-8">
      <header className="mb-10">
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
          Аудит ефективності
        </h2>
        <p className="text-secondary mt-2 text-lg">Аналіз виконання за нормою 42 поінти на день</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {employees.length === 0 && (
          <div className="glass-card p-20 text-center">
            <Award className="mx-auto text-white/5 mb-4" size={64} />
            <p className="text-secondary text-lg">Немає даних про виконавців для аудиту.</p>
          </div>
        )}
        
        {employees.map((emp) => {
          const stats = calculateEfficiency(emp.name);
          return (
            <div key={emp.id} className="glass-card p-8 flex flex-col lg:flex-row gap-10 items-center hover:border-primary/30 group">
              <div className="flex items-center gap-6 flex-1 w-full">
                <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-bold text-3xl shadow-inner shadow-white/5">
                  {emp.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">{emp.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                    <p className="text-secondary text-sm font-medium">Проєктант відділу</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-6 lg:gap-x-8 flex-[2] w-full border-l border-white/5 pl-10">
                {/* Main Metrics */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-secondary text-[10px] uppercase font-bold tracking-[0.2em]">
                    <TrendingUp size={12} className="text-primary" /> <span>KPI Поінтів</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight">{stats.totalPoints} <span className="text-sm text-secondary font-normal italic">/ {stats.targetPoints}</span></p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-secondary text-[10px] uppercase font-bold tracking-[0.2em]">
                    <Zap size={12} className="text-accent" /> <span>Ефективність</span>
                  </div>
                  <p className={`text-3xl font-bold tracking-tight ${stats.efficiency >= 100 ? 'text-success' : 'text-accent'}`}>
                    {Math.round(stats.efficiency)}%
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-secondary text-[10px] uppercase font-bold tracking-[0.2em]">
                    <Award size={12} className="text-secondary" /> <span>Норма</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight">{CAPACITY_PER_DAY}</p>
                </div>

                {/* Advanced Metrics */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-secondary text-[10px] uppercase font-bold tracking-[0.2em]">
                    <Clock size={12} className="text-indigo-400" /> <span>Час (Витрач. / План)</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{stats.advanced.spentH} <span className="text-xs text-secondary font-normal italic">год / {stats.advanced.plannedH} год</span></p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-secondary text-[10px] uppercase font-bold tracking-[0.2em]">
                    <GitPullRequest size={12} className="text-amber-400" /> <span>Задачі (Правки / Нові)</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{stats.advanced.revisions} <span className="text-xs text-secondary font-normal italic">/ {stats.advanced.newTasks} шт</span></p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-secondary text-[10px] uppercase font-bold tracking-[0.2em]">
                    <Layers size={12} className="text-emerald-400" /> <span>Вироби</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{stats.advanced.items} <span className="text-xs text-secondary font-normal italic">шт</span></p>
                </div>
              </div>

              <div className="w-full lg:w-64">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">
                  <span>Статус</span>
                  <span>{Math.round(stats.efficiency)}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden shadow-inner">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(61,90,254,0.3)] ${stats.efficiency >= 100 ? 'bg-success' : 'bg-primary'}`}
                    style={{ width: `${Math.min(stats.efficiency, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default Audit;
