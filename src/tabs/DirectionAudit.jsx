import React, { useEffect, useState } from 'react';
import CustomDatePicker from '../components/CustomDatePicker';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { CheckCircle, Clock, Layers, PieChart } from 'lucide-react';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';

import { useDepartment } from '../store/departmentContext';

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

const DirectionAudit = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [startDate, setStartDate] = useState(getMonthStartValue);
  const [endDate, setEndDate] = useState(getTodayValue);

  const { filterByDepartment } = useDepartment();
  const deptProjects = filterByDepartment(projects);
  const deptEmployees = filterByDepartment(employees);

  const { calculateDirectionStats } = useLoadEngine(deptProjects, deptEmployees);

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

  const stats = calculateDirectionStats(startDate, endDate);

  return (
    <div className="space-y-8">
      <header className="mb-10 space-y-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-gray-700">
            Аудит напрямків
          </h2>
          <p className="mt-2 text-lg text-gray-500 font-medium">
            Аналіз виконання та поточного залишку по напрямках
          </p>
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
        <div className="glass-card p-20 text-center">
          <PieChart className="mx-auto mb-4 text-white/5" size={64} />
          <p className="text-lg text-secondary">Немає даних для аудиту напрямків у вибраному періоді.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {stats.map((direction) => {
            const totalWork = direction.newTasks + direction.revisions;
            const revisionShare = totalWork > 0 ? Math.round((direction.revisions / totalWork) * 100) : 0;

            return (
              <div key={direction.name} className="glass-card group p-8 transition-all hover:border-primary/30">
                <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center">
                  <div className="w-full flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Layers size={20} />
                      </div>
                      <h3 className="text-2xl font-bold">{direction.name}</h3>
                    </div>
                    <div className="flex gap-4 text-sm text-secondary">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-success" />
                        {direction.totalTasks} завершених задач
                      </span>
                      {direction.activePoints > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} className="text-accent" />
                          {direction.activePoints} поінтів у залишку
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid w-full flex-[2] grid-cols-2 gap-8 border-l border-white/5 pl-8 md:grid-cols-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Завершено</p>
                      <p className="text-2xl font-bold text-white">
                        {direction.completedPoints} <span className="text-xs font-normal text-secondary">поінтів</span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Вироби</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        {direction.itemsCount} <span className="text-xs font-normal text-secondary">шт</span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Нові задачі</p>
                      <p className="text-2xl font-bold text-primary">{direction.newTasks}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Правки</p>
                      <p className="text-2xl font-bold text-orange-400">{direction.revisions}</p>
                    </div>
                  </div>

                  <div className="w-full lg:w-48">
                    <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-secondary">
                      <span>Правки / нові</span>
                      <span>{revisionShare}% правки</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5 shadow-inner">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${totalWork > 0 ? (direction.newTasks / totalWork) * 100 : 0}%` }}
                      />
                      <div
                        className="h-full bg-orange-400"
                        style={{ width: `${totalWork > 0 ? (direction.revisions / totalWork) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DirectionAudit;
