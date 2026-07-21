import React, { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ArrowDown, ArrowUp, Eye, EyeOff, FilterX, Plus, Search, Trash2, Upload } from 'lucide-react';
import { db } from '../lib/firebase';
import { getImportedProjectKey, processBitrixExcel } from '../lib/excelUtils';
import { useAuth } from '../store/useAuth';
import { triggerGlobalSync } from '../lib/syncUtils';

const Projects = ({ projectFilter, setProjectFilter }) => {
  const [projects, setProjects] = useState([]);
  const { role } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', points: 0, assignedEmployee: '', status: 'active' });
  const [localFilter, setLocalFilter] = useState('all');
  const [showClosed, setShowClosed] = useState(false);

  // Column filter state
  const [filterName, setFilterName] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDeadline, setFilterDeadline] = useState('');
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');

  const currentFilter = projectFilter || localFilter;
  const setCurrentFilter = setProjectFilter || setLocalFilter;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(
        snapshot.docs.map((projectDoc) => ({
          ...projectDoc.data(),
          id: projectDoc.id
        }))
      );
    });
    return () => unsubscribe();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const imported = await processBitrixExcel(file);

      if (!imported || imported.length === 0) {
        alert('Файл порожній або має непідтримуваний формат.');
        return;
      }

      const existingSnapshot = await getDocs(collection(db, 'projects'));
      const existingProjects = existingSnapshot.docs.map((projectDoc) => ({
        ...projectDoc.data(),
        docId: projectDoc.id
      }));

      const existingBitrixByKey = new Map();
      const duplicateExistingIds = [];

      existingProjects.forEach((project) => {
        if (project.type !== 'bitrix') return;

        const sourceKey = getImportedProjectKey(project);
        if (!sourceKey) return;

        if (!existingBitrixByKey.has(sourceKey)) {
          existingBitrixByKey.set(sourceKey, project);
        } else {
          duplicateExistingIds.push(project.docId);
        }
      });

      const importedByKey = new Map();
      imported.forEach((project) => {
        const sourceKey = getImportedProjectKey(project);
        if (!sourceKey) return;
        importedByKey.set(sourceKey, { ...project, sourceKey });
      });

      const batch = writeBatch(db);
      let createdCount = 0;
      let updatedCount = 0;

      importedByKey.forEach((project, sourceKey) => {
        const existingProject = existingBitrixByKey.get(sourceKey);
        const { id: importedBitrixId, ...projectData } = project;

        if (existingProject) {
          batch.set(
            doc(db, 'projects', existingProject.docId),
            {
              ...projectData,
              externalId: importedBitrixId,
              id: deleteField(),
              createdAt: existingProject.createdAt || serverTimestamp(),
              importedAt: new Date().toISOString(),
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
          updatedCount++;
        } else {
          const newDocRef = doc(collection(db, 'projects'));
          batch.set(newDocRef, {
            ...projectData,
            externalId: importedBitrixId,
            sourceKey,
            createdAt: serverTimestamp(),
            importedAt: new Date().toISOString(),
            updatedAt: serverTimestamp()
          });
          createdCount++;
        }
      });

      duplicateExistingIds.forEach((projectId) => {
        batch.delete(doc(db, 'projects', projectId));
      });

      await batch.commit();

      const syncResult = await triggerGlobalSync();
      const addedEmployees = syncResult?.diagnostics?.added || 0;
      const deletedEmployees = syncResult?.diagnostics?.deleted || 0;

      const summary = [
        `оброблено задач: ${importedByKey.size}`,
        createdCount > 0 ? `створено: ${createdCount}` : null,
        updatedCount > 0 ? `оновлено: ${updatedCount}` : null,
        duplicateExistingIds.length > 0 ? `прибрано дублів: ${duplicateExistingIds.length}` : null,
        addedEmployees > 0 ? `додано виконавців: ${addedEmployees}` : null,
        deletedEmployees > 0 ? `видалено виконавців: ${deletedEmployees}` : null
      ].filter(Boolean);

      alert(`Імпорт завершено.\n${summary.join('\n')}`);
    } catch (err) {
      console.error(err);
      alert(`Помилка імпорту: ${err.message || 'Невідома помилка'}`);
    } finally {
      event.target.value = null;
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Видалити цей проєкт?')) {
      await deleteDoc(doc(db, 'projects', id));
      await triggerGlobalSync();
    }
  };

  const handleAddProject = async (event) => {
    event.preventDefault();
    await addDoc(collection(db, 'projects'), {
      ...newProject,
      points: Number(newProject.points),
      createdAt: serverTimestamp()
    });
    setShowAddModal(false);
    setNewProject({ name: '', points: 0, assignedEmployee: '', status: 'active' });
    await triggerGlobalSync();
  };

  const clearAllProjects = async () => {
    if (
      window.confirm(
        'ОБЕРЕЖНО! Ви впевнені, що хочете видалити всі проєкти з бази даних? Цю дію неможливо скасувати.'
      )
    ) {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((projectDoc) => {
        batch.delete(doc(db, 'projects', projectDoc.id));
      });
      await batch.commit();
      await triggerGlobalSync();
      alert('Всі проєкти успішно видалено.');
    }
  };

  const uniqueEmployees = Array.from(
    new Set(projects.map((p) => p.assignedEmployee).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'uk'));

  const handleSort = (field) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortField(null);
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const clearColumnFilters = () => {
    setFilterName('');
    setFilterEmployee('');
    setFilterStatus('');
    setFilterDeadline('');
  };

  const hasActiveColumnFilters = Boolean(filterName || filterEmployee || filterStatus || filterDeadline);

  const filteredProjects = projects.filter((project) => {
    // 1. Tab filter
    if (currentFilter === 'all') {
      if (!showClosed && project.status === 'completed') return false;
    } else if (currentFilter === 'active') {
      if (project.status !== 'active') return false;
    } else if (currentFilter === 'waiting') {
      if (project.status !== 'waiting') return false;
    } else if (currentFilter === 'overdue') {
      if (project.status === 'overdue') {
        // ok
      } else if (project.status !== 'active' || !project.deadline || project.deadline === '-') {
        return false;
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        if (project.deadline >= todayStr) return false;
      }
    } else if (currentFilter === 'completedThisMonth') {
      if (project.status !== 'completed') return false;
      const now = new Date();
      const dateStr =
        project.importedAt ||
        (project.createdAt?.toDate ? project.createdAt.toDate().toISOString() : new Date().toISOString());
      const parsedDate = new Date(dateStr);
      if (Number.isNaN(parsedDate.getTime())) return false;
      if (parsedDate.getMonth() !== now.getMonth() || parsedDate.getFullYear() !== now.getFullYear()) return false;
    }

    // 2. Column filters
    if (filterName && !project.name?.toLowerCase().includes(filterName.toLowerCase())) {
      return false;
    }

    if (filterEmployee) {
      if (filterEmployee === '__unassigned__') {
        if (project.assignedEmployee) return false;
      } else if (project.assignedEmployee !== filterEmployee) {
        return false;
      }
    }

    if (filterStatus) {
      if (project.status !== filterStatus) return false;
    }

    if (filterDeadline) {
      const formatted = formatDate(project.deadline);
      const raw = project.deadline || '';
      const q = filterDeadline.toLowerCase();
      if (!formatted.toLowerCase().includes(q) && !raw.toLowerCase().includes(q)) {
        return false;
      }
    }

    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (!sortField) return 0;

    let aVal = a[sortField] ?? '';
    let bVal = b[sortField] ?? '';

    if (sortField === 'points') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
            Проєкти
          </h2>
          <p className="text-secondary mt-2 text-lg">Керування чергою та імпорт з Бітрікса</p>
        </div>

        {role === 'admin' && (
          <div className="flex gap-4">
            <button
              onClick={clearAllProjects}
              className="px-4 py-2 rounded-xl text-danger hover:bg-danger/10 border border-danger/20 flex items-center gap-2 transition-all font-bold text-sm tracking-wider uppercase"
            >
              <Trash2 size={18} />
              Очистити базу
            </button>
            <label className="btn-primary bg-secondary/10 hover:bg-secondary/20 shadow-none border border-white/5 text-slate-300 flex items-center gap-2 cursor-pointer transition-all">
              <Upload size={18} />
              <span className="text-sm font-bold uppercase tracking-wider">Bitrix Import</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              <Plus size={20} />
              <span className="text-sm font-bold uppercase tracking-wider">Новий проєкт</span>
            </button>
          </div>
        )}
      </header>

      <div className="flex items-center gap-2 mb-6 bg-white/[0.02] p-1.5 rounded-xl border border-white/5 w-fit flex-wrap">
        {[
          { id: 'all', label: 'Всі проєкти' },
          { id: 'active', label: 'В роботі' },
          { id: 'waiting', label: 'В очікуванні' },
          { id: 'overdue', label: 'Протерміновані' },
          { id: 'completedThisMonth', label: 'Закриті (цей місяць)' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrentFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              currentFilter === tab.id
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="w-px h-6 bg-white/10 mx-1 self-center" />

        <button
          onClick={() => setShowClosed((prev) => !prev)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            showClosed
              ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
              : 'text-secondary hover:text-white hover:bg-white/5'
          }`}
        >
          {showClosed ? <Eye size={16} /> : <EyeOff size={16} />}
          <span>Показувати закриті</span>
        </button>
      </div>

      <div className="glass-card overflow-hidden border-white/5 shadow-3xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5">
              <th
                onClick={() => handleSort('name')}
                className="table-header cursor-pointer select-none hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Назва проєкту</span>
                  {sortField === 'name' && (
                    sortOrder === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('assignedEmployee')}
                className="table-header cursor-pointer select-none hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Виконавець</span>
                  {sortField === 'assignedEmployee' && (
                    sortOrder === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('points')}
                className="table-header text-center cursor-pointer select-none hover:text-white transition-colors"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Поінти</span>
                  {sortField === 'points' && (
                    sortOrder === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('status')}
                className="table-header cursor-pointer select-none hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Статус</span>
                  {sortField === 'status' && (
                    sortOrder === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('deadline')}
                className="table-header cursor-pointer select-none hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Дедлайн</span>
                  {sortField === 'deadline' && (
                    sortOrder === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                  )}
                </div>
              </th>
              <th className="table-header text-right">
                {hasActiveColumnFilters && (
                  <button
                    onClick={clearColumnFilters}
                    title="Скинути фільтри"
                    className="p-1 rounded-lg text-secondary hover:text-white hover:bg-white/10 transition-colors inline-flex items-center gap-1 text-xs font-normal"
                  >
                    <FilterX size={14} />
                    <span>Скинути</span>
                  </button>
                )}
              </th>
            </tr>

            {/* Column Filter Controls Row */}
            <tr className="bg-white/[0.01] border-b border-white/5">
              <th className="px-4 py-2 font-normal">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary/60" />
                  <input
                    type="text"
                    placeholder="Фільтр назви..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-6 py-1.5 text-xs text-slate-200 outline-none focus:border-primary focus:bg-white/10 transition-all placeholder:text-secondary/50"
                  />
                  {filterName && (
                    <button
                      onClick={() => setFilterName('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </th>
              <th className="px-4 py-2 font-normal">
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-primary focus:bg-white/10 transition-all cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-200">Всі виконавці</option>
                  <option value="__unassigned__" className="bg-slate-900 text-slate-200">Не призначено</option>
                  {uniqueEmployees.map((emp) => (
                    <option key={emp} value={emp} className="bg-slate-900 text-slate-200">
                      {emp}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-4 py-2 font-normal"></th>
              <th className="px-4 py-2 font-normal">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-primary focus:bg-white/10 transition-all cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-200">Всі статуси</option>
                  <option value="active" className="bg-slate-900 text-slate-200">В роботі</option>
                  <option value="waiting" className="bg-slate-900 text-slate-200">Очікує</option>
                  <option value="overdue" className="bg-slate-900 text-slate-200">Протерміновано</option>
                  <option value="completed" className="bg-slate-900 text-slate-200">Completed</option>
                </select>
              </th>
              <th className="px-4 py-2 font-normal">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Фільтр дати..."
                    value={filterDeadline}
                    onChange={(e) => setFilterDeadline(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-primary focus:bg-white/10 transition-all placeholder:text-secondary/50"
                  />
                  {filterDeadline && (
                    <button
                      onClick={() => setFilterDeadline('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </th>
              <th className="px-4 py-2 font-normal text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {sortedProjects.map((project) => (
              <tr key={project.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-5 font-semibold text-slate-200">{project.name}</td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3 text-secondary text-sm">
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] uppercase">
                      {project.assignedEmployee?.charAt(0) || '?'}
                    </div>
                    {project.assignedEmployee || 'Не призначено'}
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-bold ring-1 ring-primary/20">
                    {project.points}
                  </span>
                </td>
                <td className="px-6 py-5">
                  <span
                    className={`badge ${
                      project.status === 'active'
                        ? 'bg-success/10 text-success ring-1 ring-success/20'
                        : project.status === 'waiting'
                          ? 'bg-accent/10 text-accent ring-1 ring-accent/20'
                          : project.status === 'overdue'
                            ? 'bg-danger/10 text-danger ring-1 ring-danger/20'
                            : 'bg-secondary/10 text-secondary ring-1 ring-secondary/20'
                    }`}
                  >
                    {project.status === 'active'
                      ? 'В роботі'
                      : project.status === 'waiting'
                        ? 'Очікує'
                        : project.status === 'overdue'
                          ? 'Протерміновано'
                          : project.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-secondary text-sm">{formatDate(project.deadline)}</td>
                {role === 'admin' && (
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(project.id)} className="text-secondary hover:text-danger p-2">
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card bg-surface p-8 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-6">Новий проєкт / бронювання</h3>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Назва</label>
                <input
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-primary"
                  value={newProject.name}
                  onChange={(event) => setNewProject({ ...newProject, name: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Поінти</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-primary"
                    value={newProject.points}
                    onChange={(event) => setNewProject({ ...newProject, points: event.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Виконавець</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-primary"
                    value={newProject.assignedEmployee}
                    onChange={(event) => setNewProject({ ...newProject, assignedEmployee: event.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-secondary hover:text-white">
                  Скасувати
                </button>
                <button type="submit" className="btn-primary">
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
