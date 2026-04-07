import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';
import { Layers, PieChart, TrendingUp, CheckCircle, Clock } from 'lucide-react';

const DirectionAudit = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const { calculateDirectionStats } = useLoadEngine(projects, employees);

  useEffect(() => {
    const unsubProjects = onSnapshot(query(collection(db, 'projects')), snap =>
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubEmployees = onSnapshot(query(collection(db, 'employees')), snap =>
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubProjects(); unsubEmployees(); };
  }, []);

  const stats = calculateDirectionStats();

  return (
    <div className="space-y-8">
      <header className="mb-10">
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
          Аудит за напрямками
        </h2>
        <p className="text-secondary mt-2 text-lg">Аналіз продуктивності за категоріями проєктів</p>
      </header>

      {stats.length === 0 ? (
        <div className="glass-card p-20 text-center">
          <PieChart className="mx-auto text-white/5 mb-4" size={64} />
          <p className="text-secondary text-lg">Немає даних для відображення аудиту за напрямками.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {stats.map((dir, i) => (
            <div key={i} className="glass-card p-8 group hover:border-primary/30 transition-all">
              <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">
                
                {/* Direction Name & General Info */}
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Layers size={20} />
                    </div>
                    <h3 className="text-2xl font-bold">{dir.name}</h3>
                  </div>
                  <div className="flex gap-4 text-sm text-secondary">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-success" />
                      {dir.totalTasks} завершених задач
                    </span>
                    {dir.activePoints > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-accent" />
                        {dir.activePoints} поінтів у роботі
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-[2] w-full border-l border-white/5 pl-8">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-secondary">Завершено</p>
                    <p className="text-2xl font-bold text-white">{dir.completedPoints} <span className="text-xs font-normal text-secondary">поінтів</span></p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-secondary">Вироби</p>
                    <p className="text-2xl font-bold text-emerald-400">{dir.itemsCount} <span className="text-xs font-normal text-secondary">шт</span></p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-secondary">Нові задачі</p>
                    <p className="text-2xl font-bold text-primary">{dir.newTasks}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-secondary">Правки</p>
                    <p className="text-2xl font-bold text-orange-400">{dir.revisions}</p>
                  </div>
                </div>

                {/* Progress Visualizer */}
                <div className="w-full lg:w-48">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">
                    <span>Правки / Нові</span>
                    <span>{dir.newTasks > 0 ? Math.round((dir.revisions / (dir.newTasks + dir.revisions)) * 100) : 0}% правки</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex shadow-inner">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${(dir.newTasks / (dir.newTasks + dir.revisions || 1)) * 100}%` }}
                    />
                    <div 
                      className="h-full bg-orange-400" 
                      style={{ width: `${(dir.revisions / (dir.newTasks + dir.revisions || 1)) * 100}%` }}
                    />
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DirectionAudit;
