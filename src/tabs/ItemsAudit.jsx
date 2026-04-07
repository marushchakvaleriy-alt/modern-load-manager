import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';
import { Package, TrendingUp, BarChart2, Star, Box, RefreshCw } from 'lucide-react';

const ItemsAudit = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const { calculateItemStats } = useLoadEngine(projects, employees);

  useEffect(() => {
    const unsubProjects = onSnapshot(query(collection(db, 'projects')), snap =>
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubEmployees = onSnapshot(query(collection(db, 'employees')), snap =>
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubProjects(); unsubEmployees(); };
  }, []);

  const stats = calculateItemStats();
  const totalNew = stats.reduce((sum, item) => sum + (item.newCount || 0), 0);
  const totalRevisions = stats.reduce((sum, item) => sum + (item.revisionCount || 0), 0);

  return (
    <div className="space-y-8">
      <header className="mb-10">
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
          Аудит виробів
        </h2>
        <p className="text-secondary mt-2 text-lg">Статистика випуску продукції за типами виробів</p>
      </header>


      {stats.length === 0 ? (
        <div className="glass-card p-20 text-center">
          <Package className="mx-auto text-white/5 mb-4" size={64} />
          <p className="text-secondary text-lg">Немає даних про вироби для відображення.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Top Metric Cards */}
          <div className="glass-card p-6 flex items-center gap-4 border-l-4 border-blue-400">
            <div className="w-12 h-12 rounded-full bg-blue-400/10 flex items-center justify-center text-blue-400">
              <BarChart2 size={24} />
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-secondary">Всього задач</p>
              <p className="text-2xl font-bold">{stats.reduce((sum, i) => sum + i.projects, 0)} <span className="text-sm font-normal text-secondary">шт</span></p>
            </div>
          </div>
          
          <div className="glass-card p-6 flex items-center gap-4 border-l-4 border-emerald-400">
            <div className="w-12 h-12 rounded-full bg-emerald-400/10 flex items-center justify-center text-emerald-400">
              <Package size={24} />
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-secondary">Всього нових</p>
              <p className="text-2xl font-bold">{totalNew} <span className="text-sm font-normal text-secondary">шт</span></p>
            </div>
          </div>

          <div className="glass-card p-6 flex items-center gap-4 border-l-4 border-orange-400">
            <div className="w-12 h-12 rounded-full bg-orange-400/10 flex items-center justify-center text-orange-400">
              <RefreshCw size={24} />
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-secondary">Всього правок</p>
              <p className="text-2xl font-bold">{totalRevisions} <span className="text-sm font-normal text-secondary">шт</span></p>
            </div>
          </div>

          {/* Detailed Table/List */}
          <div className="glass-card p-0 md:col-span-3 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="font-bold flex items-center gap-2">
                <BarChart2 size={18} className="text-primary" />
                Аналітика по виробам
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase font-bold tracking-widest text-secondary">
                    <th className="px-8 py-4">Назва виробу</th>
                    <th className="px-4 py-4 text-center">Нові</th>
                    <th className="px-4 py-4 text-center">Правки</th>
                    <th className="px-6 py-4 text-center text-white/30">Задач</th>
                    <th className="px-6 py-4 text-right">Поїнти</th>
                    <th className="px-8 py-4 w-1/4">Частка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stats.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-5">
                        <span className="font-bold text-lg group-hover:text-primary transition-colors">{item.name}</span>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <span className="px-2 py-1 rounded-md bg-white/5 text-sm font-medium text-white/70">
                          {item.newCount}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <span className="px-2 py-1 rounded-md bg-orange-500/10 text-sm font-medium text-orange-400/80">
                          {item.revisionCount}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center text-secondary text-sm">{item.projects}</td>
                      <td className="px-6 py-5 text-right font-mono text-sm">{item.points.toFixed(0)}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${totalNew > 0 ? (item.newCount / totalNew) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-secondary w-10">
                            {totalNew > 0 ? Math.round((item.newCount / totalNew) * 100) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsAudit;
