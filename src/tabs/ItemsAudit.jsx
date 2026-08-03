import React, { useEffect, useState } from 'react';
import CustomDatePicker from '../components/CustomDatePicker';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { BarChart2, Package, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';

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

import { useDepartment } from '../store/departmentContext';

const ItemsAudit = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [startDate, setStartDate] = useState(getMonthStartValue);
  const [endDate, setEndDate] = useState(getTodayValue);

  const { filterByDepartment } = useDepartment();
  const deptProjects = filterByDepartment(projects);
  const deptEmployees = filterByDepartment(employees);

  const { calculateItemStats } = useLoadEngine(deptProjects, deptEmployees);

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
      <header className="mb-10 space-y-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-gray-700">
            Аудит виробів
          </h2>
          <p className="mt-2 text-lg text-gray-500 font-medium">Статистика випуску продукції за вибраний період</p>
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
        </div>
      </header>

      {stats.length === 0 ? (
        <div className="neu-flat p-20 text-center">
          <Package className="mx-auto mb-4 text-gray-400" size={64} />
          <p className="text-lg font-bold text-gray-600">Немає даних про вироби у вибраному періоді.</p>
          <p className="text-sm text-gray-400 mt-2 font-medium">
            (Цей розділ аналізує тільки <strong>завершені</strong> проєкти із датою завершення у вибраному інтервалі).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="neu-flat flex items-center gap-4 border-l-4 border-emerald-500 p-6">
            <div className="flex h-12 w-12 items-center justify-center neu-pressed text-emerald-600">
              <Package size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Всього нових виробів</p>
              <p className="text-2xl font-extrabold text-gray-800">
                {totalNew} <span className="text-sm font-semibold text-gray-500">шт</span>
              </p>
            </div>
          </div>

          <div className="neu-flat flex items-center gap-4 border-l-4 border-orange-500 p-6">
            <div className="flex h-12 w-12 items-center justify-center neu-pressed text-orange-600">
              <RefreshCw size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Всього правок по виробам</p>
              <p className="text-2xl font-extrabold text-gray-800">
                {totalRevisions} <span className="text-sm font-semibold text-gray-500">шт</span>
              </p>
            </div>
          </div>

          <div className="neu-flat flex items-center gap-4 border-l-4 border-blue-500 p-6">
            <div className="flex h-12 w-12 items-center justify-center neu-pressed text-blue-600">
              <BarChart2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Всього проєктів</p>
              <p className="text-2xl font-extrabold text-gray-800">
                {stats.reduce((sum, item) => sum + item.projects, 0)}{' '}
                <span className="text-sm font-semibold text-gray-500">шт</span>
              </p>
            </div>
          </div>

          <div className="neu-flat overflow-hidden p-0 md:col-span-3">
            <div className="flex items-center justify-between border-b border-gray-200/50 p-6">
              <h3 className="flex items-center gap-2 font-bold text-gray-800">
                <BarChart2 size={18} className="text-primary" />
                Аналітика по виробах та правках
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] font-extrabold uppercase tracking-widest text-gray-500">
                    <th className="px-8 py-4">Назва виробу</th>
                    <th className="px-4 py-4 text-center">Нові (шт)</th>
                    <th className="px-4 py-4 text-center">Правки (шт)</th>
                    <th className="px-6 py-4 text-center">Проєктів</th>
                    <th className="px-6 py-4 text-right">Поінти</th>
                    <th className="w-1/4 px-8 py-4">Частка нових</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/40">
                  {stats.map((item) => (
                    <tr key={item.name} className="group transition-colors hover:bg-gray-100/50">
                      <td className="px-8 py-5">
                        <span className="text-base font-extrabold text-gray-800 transition-colors group-hover:text-primary">{item.name}</span>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <span className="neu-pressed px-3 py-1 rounded-lg text-sm font-extrabold text-emerald-600 inline-block">
                          {item.newCount}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <span className="neu-pressed px-3 py-1 rounded-lg text-sm font-extrabold text-orange-600 inline-block">
                          {item.revisionCount}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center text-sm font-bold text-gray-700">{item.projects}</td>
                      <td className="px-6 py-5 text-right font-mono font-bold text-sm text-gray-800">{item.points.toFixed(0)}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="h-2 flex-1 overflow-hidden neu-pressed rounded-full">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${totalNew > 0 ? (item.newCount / totalNew) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="w-10 text-xs font-extrabold text-gray-700">
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
