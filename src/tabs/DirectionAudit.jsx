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

  const { filterByDepartment, activeDepartment } = useDepartment();
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
      <header className="mb-8 space-y-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-800 flex items-center gap-3">
            <Layers className="text-primary" size={32} />
            Аудит напрямків
          </h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">
            Аналіз виконання, виробів, правок та поінтів по напрямках для відділу {activeDepartment === 'construction' ? 'Конструювання' : 'Проєктування'}
          </p>
        </div>

        <div className="neu-flat flex flex-wrap items-center gap-6 p-4 rounded-2xl border border-white/60">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Дата з:</span>
            <CustomDatePicker
              value={startDate}
              max={endDate}
              onChange={setStartDate}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Дата до:</span>
            <CustomDatePicker
              value={endDate}
              min={startDate}
              onChange={setEndDate}
            />
          </div>
        </div>
      </header>

      {stats.length === 0 ? (
        <div className="neu-flat p-16 text-center rounded-2xl border border-white/60">
          <PieChart className="mx-auto mb-4 text-gray-300" size={56} />
          <p className="text-base text-gray-500 font-medium">Немає даних для аудиту напрямків у вибраному періоді.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {stats.map((direction) => {
            const totalWork = direction.newTasks + direction.revisions;
            const revisionShare = totalWork > 0 ? Math.round((direction.revisions / totalWork) * 100) : 0;
            const totalPointsWork = (direction.newTasksPoints || 0) + (direction.revisionsPoints || 0);
            const revisionPointsShare = totalPointsWork > 0 ? Math.round(((direction.revisionsPoints || 0) / totalPointsWork) * 100) : 0;

            return (
              <div key={direction.name} className="neu-flat group p-6 rounded-2xl border border-white/60 transition-all hover:-translate-y-0.5 shadow-sm">
                <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center">
                  {/* Left info */}
                  <div className="w-full flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                        <Layers size={20} />
                      </div>
                      <h3 className="text-xl font-black text-gray-800">{direction.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-gray-500">
                      <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <CheckCircle size={13} className="text-emerald-600" />
                        {direction.totalTasks} завершених задач
                      </span>
                      {direction.activePoints > 0 && (
                        <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          <Clock size={13} className="text-amber-600" />
                          {direction.activePoints} поінтів у залишку
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Grid metrics */}
                  <div className="grid w-full flex-[2] grid-cols-2 gap-4 border-l border-gray-300/60 pl-6 md:grid-cols-4">
                    {/* Completed Points */}
                    <div className="neu-flat p-3 rounded-xl bg-white/40">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Завершено</p>
                      <p className="text-xl font-black text-gray-800">
                        {direction.completedPoints} <span className="text-[11px] font-bold text-gray-500">поінтів</span>
                      </p>
                    </div>

                    {/* Items */}
                    <div className="neu-flat p-3 rounded-xl bg-white/40">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Вироби</p>
                      <p className="text-xl font-black text-emerald-600">
                        {direction.itemsCount} <span className="text-[11px] font-bold text-gray-500">шт</span>
                      </p>
                    </div>

                    {/* New Tasks + Points */}
                    <div className="neu-flat p-3 rounded-xl bg-white/40">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Нові задачі</p>
                      <p className="text-xl font-black text-primary flex items-baseline gap-1.5">
                        <span>{direction.newTasks}</span>
                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded border border-blue-200">
                          {direction.newTasksPoints || 0}п
                        </span>
                      </p>
                    </div>

                    {/* Revisions + Points */}
                    <div className="neu-flat p-3 rounded-xl bg-white/40">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Правки</p>
                      <p className="text-xl font-black text-orange-600 flex items-baseline gap-1.5">
                        <span>{direction.revisions}</span>
                        <span className="text-xs font-mono font-bold text-orange-700 bg-orange-100/80 px-1.5 py-0.2 rounded border border-orange-200">
                          {direction.revisionsPoints || 0}п
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Ratio bar */}
                  <div className="w-full lg:w-48 neu-flat p-3 rounded-xl bg-white/40 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                      <span>Правки / Нові</span>
                      <span className="text-orange-600">{revisionShare}% правки ({revisionPointsShare}% поінтів)</span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-200/80 shadow-inner">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${totalWork > 0 ? (direction.newTasks / totalWork) * 100 : 0}%` }}
                        title={`Нові: ${direction.newTasks} (${direction.newTasksPoints || 0}п)`}
                      />
                      <div
                        className="h-full bg-orange-500 transition-all"
                        style={{ width: `${totalWork > 0 ? (direction.revisions / totalWork) * 100 : 0}%` }}
                        title={`Правки: ${direction.revisions} (${direction.revisionsPoints || 0}п)`}
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
