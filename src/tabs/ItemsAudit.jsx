import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { BarChart2, Package, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';

const getMonthStartValue = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayValue = () => new Date().toISOString().split('T')[0];

const ItemsAudit = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [startDate, setStartDate] = useState(getMonthStartValue);
  const [endDate, setEndDate] = useState(getTodayValue);
  const { calculateItemStats } = useLoadEngine(projects, employees);

  useEffect(() => {
    const unsubProjects = onSnapshot(query(collection(db, 'projects')), (snap) =>
      setProjects(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );
    const unsubEmployees = onSnapshot(query(collection(db, 'employees')), (snap) =>
      setEmployees(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    );

    return () => {
      unsubProjects();
      unsubEmployees();
    };
  }, []);

  const stats = calculateItemStats(startDate, endDate);
  const totalNew = stats.reduce((sum, item) => sum + (item.newCount || 0), 0);
  const totalRevisions = stats.reduce((sum, item) => sum + (item.revisionCount || 0), 0);

  return (
    <div className="space-y-8">
      <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="bg-gradient-to-r from-white to-white/40 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            Аудит виробів
          </h2>
          <p className="mt-2 text-lg text-secondary">Статистика випуску продукції за вибраний період</p>
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

      {stats.length === 0 ? (
        <div className="glass-card p-20 text-center">
          <Package className="mx-auto mb-4 text-white/5" size={64} />
          <p className="text-lg text-secondary">Немає даних про вироби у вибраному періоді.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="glass-card flex items-center gap-4 border-l-4 border-blue-400 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-400/10 text-blue-400">
              <BarChart2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary">Всього задач</p>
              <p className="text-2xl font-bold">
                {stats.reduce((sum, item) => sum + item.projects, 0)}{' '}
                <span className="text-sm font-normal text-secondary">шт</span>
              </p>
            </div>
          </div>

          <div className="glass-card flex items-center gap-4 border-l-4 border-emerald-400 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
              <Package size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary">Всього нових</p>
              <p className="text-2xl font-bold">
                {totalNew} <span className="text-sm font-normal text-secondary">шт</span>
              </p>
            </div>
          </div>

          <div className="glass-card flex items-center gap-4 border-l-4 border-orange-400 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-400/10 text-orange-400">
              <RefreshCw size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary">Всього правок</p>
              <p className="text-2xl font-bold">
                {totalRevisions} <span className="text-sm font-normal text-secondary">шт</span>
              </p>
            </div>
          </div>

          <div className="glass-card overflow-hidden p-0 md:col-span-3">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] p-6">
              <h3 className="flex items-center gap-2 font-bold">
                <BarChart2 size={18} className="text-primary" />
                Аналітика по виробах
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-secondary">
                    <th className="px-8 py-4">Назва виробу</th>
                    <th className="px-4 py-4 text-center">Нові</th>
                    <th className="px-4 py-4 text-center">Правки</th>
                    <th className="px-6 py-4 text-center text-white/30">Задач</th>
                    <th className="px-6 py-4 text-right">Поінти</th>
                    <th className="w-1/4 px-8 py-4">Частка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stats.map((item) => (
                    <tr key={item.name} className="group transition-colors hover:bg-white/[0.02]">
                      <td className="px-8 py-5">
                        <span className="text-lg font-bold transition-colors group-hover:text-primary">{item.name}</span>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <span className="rounded-md bg-white/5 px-2 py-1 text-sm font-medium text-white/70">
                          {item.newCount}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <span className="rounded-md bg-orange-500/10 px-2 py-1 text-sm font-medium text-orange-400/80">
                          {item.revisionCount}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center text-sm text-secondary">{item.projects}</td>
                      <td className="px-6 py-5 text-right font-mono text-sm">{item.points.toFixed(0)}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${totalNew > 0 ? (item.newCount / totalNew) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="w-10 text-xs font-bold text-secondary">
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
