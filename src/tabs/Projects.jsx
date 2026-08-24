import React, { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ArrowDown, ArrowUp, Eye, EyeOff, FilterX, Plus, Search, Trash2, Upload } from 'lucide-react';
import { db } from '../lib/firebase';
import { getImportedProjectKey, processBitrixExcel, parseBitrixText } from '../lib/excelUtils';
import { useAuth } from '../store/useAuth';
import { triggerGlobalSync } from '../lib/syncUtils';
import CustomSelect from '../components/CustomSelect';
import { useDepartment } from '../store/departmentContext';

const Projects = ({ projectFilter, setProjectFilter }) => {
  const [projects, setProjects] = useState([]);
  const { role } = useAuth();
  const { filterByDepartment, activeDepartment } = useDepartment();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', points: 0, assignedEmployee: '', status: 'active', direction: '' });
  const [localFilter, setLocalFilter] = useState('all');
  const [showClosed, setShowClosed] = useState(false);

  // Column filter state
  const [filterName, setFilterName] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDirection, setFilterDirection] = useState('');
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

  const saveImportedProjects = async (imported, isAuto = false) => {
    console.log('[saveImportedProjects] Processing imported projects count:', imported?.length, imported);
    if (!imported || imported.length === 0) return;

    const existingSnapshot = await getDocs(collection(db, 'projects'));
    const existingProjects = existingSnapshot.docs.map((projectDoc) => ({
      ...projectDoc.data(),
      docId: projectDoc.id
    }));

    const existingById = new Map();
    const existingByNameEmp = new Map();
    const duplicateExistingIds = [];

    existingProjects.forEach((project) => {
      const dept = project.department || 'design';
      const btxId = String(project.bitrixId || project.externalId || '').trim();
      const normName = String(project.name || '').trim().toLowerCase();
      const normEmp = String(project.assignedEmployee || '').trim().toLowerCase();
      const nameEmpKey = `${normName}___${normEmp}_${dept}`;

      if (btxId) {
        const idKey = `btx_${btxId}_${dept}`;
        if (!existingById.has(idKey)) {
          existingById.set(idKey, project);
        } else {
          duplicateExistingIds.push(project.docId);
        }
      }

      if (normName && !existingByNameEmp.has(nameEmpKey)) {
        existingByNameEmp.set(nameEmpKey, project);
      }
    });

    const importedByKey = new Map();
    imported.forEach((project) => {
      const sourceKey = getImportedProjectKey(project);
      if (!sourceKey) return;
      importedByKey.set(sourceKey, { ...project, sourceKey, department: activeDepartment });
    });

    const batch = writeBatch(db);
    let createdCount = 0;
    let updatedCount = 0;

    importedByKey.forEach((project, sourceKey) => {
      const btxId = String(project.bitrixId || project.externalId || '').trim();
      const normName = String(project.name || '').trim().toLowerCase();
      const normEmp = String(project.assignedEmployee || '').trim().toLowerCase();
      const idKey = btxId ? `btx_${btxId}_${activeDepartment}` : null;
      const nameEmpKey = `${normName}___${normEmp}_${activeDepartment}`;

      // 1. Try finding by unique Bitrix ID
      let existingProject = idKey ? existingById.get(idKey) : null;

      // 2. Fallback to Name + Employee for migrating legacy records
      if (!existingProject && nameEmpKey) {
        existingProject = existingByNameEmp.get(nameEmpKey);
      }

      const { id: importedBitrixId, ...projectData } = project;

      if (existingProject) {
        batch.set(
          doc(db, 'projects', existingProject.docId),
          {
            ...projectData,
            bitrixId: btxId || existingProject.bitrixId || '',
            externalId: btxId || existingProject.externalId || importedBitrixId,
            sourceKey,
            id: deleteField(),
            department: activeDepartment,
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
          bitrixId: btxId || '',
          externalId: btxId || importedBitrixId,
          sourceKey,
          department: activeDepartment,
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

    if (!isAuto) {
      const summary = [
        `оброблено задач: ${importedByKey.size}`,
        createdCount > 0 ? `створено: ${createdCount}` : null,
        updatedCount > 0 ? `оновлено: ${updatedCount}` : null,
        duplicateExistingIds.length > 0 ? `прибрано дублів: ${duplicateExistingIds.length}` : null,
        addedEmployees > 0 ? `додано виконавців: ${addedEmployees}` : null,
        deletedEmployees > 0 ? `видалено виконавців: ${deletedEmployees}` : null
      ].filter(Boolean);

      alert(`Імпорт завершено.\n${summary.join('\n')}`);
    } else {
      console.log(`[Auto-Sync] Успішно автоматично оновлено ${importedByKey.size} задач.`);
    }
  };

  const deptProjects = filterByDepartment(projects);
  const displayProjectsMap = new Map();
  deptProjects.forEach((project) => {
    const key = getImportedProjectKey(project);
    if (!key) {
      displayProjectsMap.set(project.id, project);
    } else if (!displayProjectsMap.has(key)) {
      displayProjectsMap.set(key, project);
    }
  });
  const displayProjects = Array.from(displayProjectsMap.values());

  const now = new Date();

  const activeCount = displayProjects.filter((p) => p.status === 'active').length;
  const waitingCount = displayProjects.filter((p) => p.status === 'waiting').length;
  const overdueCount = displayProjects.filter((p) => p.status === 'overdue').length;
  const openProjectsCount = displayProjects.filter((p) => p.status !== 'completed').length;

  const closedThisMonthCount = displayProjects.filter((p) => {
    if (p.status !== 'completed') return false;
    const dateStr = p.completedAt || p.importedAt || (p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : null);
    if (!dateStr) return false;
    const parsedDate = new Date(dateStr);
    if (Number.isNaN(parsedDate.getTime())) return false;
    return parsedDate.getMonth() === now.getMonth() && parsedDate.getFullYear() === now.getFullYear();
  }).length;

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const imported = await processBitrixExcel(file);

      if (!imported || imported.length === 0) {
        alert('Файл порожній або має непідтримуваний формат.');
        return;
      }

      await saveImportedProjects(imported, false);
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
      department: activeDepartment,
      createdAt: serverTimestamp()
    });
    setShowAddModal(false);
    setNewProject({ name: '', points: 0, assignedEmployee: '', status: 'active', direction: '' });
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
    new Set(displayProjects.map((p) => p.assignedEmployee).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'uk'));

  const uniqueDirections = Array.from(
    new Set(displayProjects.map((p) => p.direction).filter(Boolean))
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
    setFilterDirection('');
  };

  const hasActiveColumnFilters = Boolean(filterName || filterEmployee || filterStatus || filterDirection);

  const filteredProjects = displayProjects.filter((project) => {
    // 1. Tab filter
    if (currentFilter === 'all') {
      if (!showClosed && project.status === 'completed') return false;
    } else if (currentFilter === 'active') {
      if (project.status !== 'active') return false;
    } else if (currentFilter === 'waiting') {
      if (project.status !== 'waiting') return false;
    } else if (currentFilter === 'overdue') {
      if (project.status !== 'overdue') return false;
    } else if (currentFilter === 'completedThisMonth') {
      if (project.status !== 'completed') return false;
      const dateStr =
        project.completedAt ||
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
      if (project.assignedEmployee !== filterEmployee) return false;
    }

    if (filterStatus) {
      if (project.status !== filterStatus) return false;
    }

    if (filterDirection) {
      if (project.direction !== filterDirection) return false;
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
    } else if (sortField === 'deadline') {
      const aEmpty = !aVal || aVal === '-';
      const bEmpty = !bVal || bVal === '-';
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1; // Always push empty dates to the bottom
      if (bEmpty) return -1; // Always push empty dates to the bottom
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleClipboardSync = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseBitrixText(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await saveImportedProjects(parsed, false);
      } else {
        alert('Буфер обміну не містить даних з Бітрікса. Спочатку натисніть "Передати в Load Manager" у Бітріксі.');
      }
    } catch (err) {
      alert('Не вдалося зчитати з буферу обміну. Надайте дозвіл браузера на доступ до буферу.');
    }
  };
  const totalTasks = sortedProjects.length;
  const totalPoints = sortedProjects.reduce((sum, p) => sum + (Number(p.points) || 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-gray-700">
            Проєкти
          </h2>
          <p className="text-gray-500 mt-2 text-lg font-medium">Керування чергою та імпорт з Бітрікса</p>
        </div>

        {role === 'admin' && (
          <div className="flex gap-4">
            <button
              onClick={clearAllProjects}
              className="neu-btn px-4 py-2.5 text-red-500 flex items-center gap-2 font-bold text-xs tracking-wider uppercase hover:text-red-600 transition-all"
            >
              <Trash2 size={18} />
              Очистити базу
            </button>

            <label className="neu-btn px-4 py-2.5 text-gray-600 flex items-center gap-2 cursor-pointer font-bold text-xs uppercase tracking-wider hover:text-primary transition-all">
              <Upload size={18} />
              <span>Bitrix Import</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
            <button onClick={() => setShowAddModal(true)} className="neu-btn px-5 py-2.5 text-primary flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
              <Plus size={20} />
              <span>Новий проєкт</span>
            </button>
          </div>
        )}
      </header>

      <div className="flex items-center gap-3 mb-6 neu-pressed p-3 rounded-2xl w-fit flex-wrap">
        {[
          { id: 'all', label: `Всі проєкти (${openProjectsCount})` },
          { id: 'active', label: `В роботі (${activeCount})` },
          { id: 'waiting', label: `В очікуванні (${waitingCount})` },
          { id: 'overdue', label: `Протерміновані (${overdueCount})` },
          { id: 'completedThisMonth', label: `Закриті (цей місяць) (${closedThisMonthCount})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrentFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentFilter === tab.id
                ? 'neu-menu-active'
                : 'neu-btn text-gray-600 hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

        <button
          onClick={() => setShowClosed((prev) => !prev)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            showClosed
              ? 'neu-menu-active'
              : 'neu-btn text-gray-600 hover:text-primary'
          }`}
        >
          {showClosed ? <Eye size={16} /> : <EyeOff size={16} />}
          <span>Показувати закриті</span>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

        {/* ПАНЕЛЬ ЛІЧИЛЬНИКІВ */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1.5 rounded-xl neu-flat text-blue-600 flex items-center gap-1.5">
            <span>Всього активних:</span>
            <strong className="text-sm font-bold text-blue-700">{openProjectsCount}</strong>
          </span>

          <span className="px-3 py-1.5 rounded-xl neu-flat text-red-500 flex items-center gap-1.5">
            <span>Протерміновано:</span>
            <strong className="text-sm font-bold text-red-600">{overdueCount}</strong>
          </span>

          <span className="px-3 py-1.5 rounded-xl neu-flat text-emerald-600 flex items-center gap-1.5">
            <span>Закрито (цей місяць):</span>
            <strong className="text-sm font-bold text-emerald-700">{closedThisMonthCount}</strong>
          </span>
        </div>
      </div>

      <div className="neu-flat overflow-hidden p-2">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-300/60">
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
                onClick={() => handleSort('direction')}
                className="table-header cursor-pointer select-none hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Напрямок</span>
                  {sortField === 'direction' && (
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
            <tr className="border-b border-gray-300/40">
              <th className="px-4 py-2 font-normal">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Фільтр назви..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    className="w-full neu-pressed rounded-xl pl-8 pr-6 py-1.5 text-xs text-gray-700 font-semibold outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-gray-400"
                  />
                  {filterName && (
                    <button
                      onClick={() => setFilterName('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </th>
              <th className="px-4 py-2 font-normal">
                <CustomSelect
                  value={filterEmployee}
                  onChange={(val) => setFilterEmployee(val)}
                  options={[
                    { value: '', label: 'Всі виконавці' },
                    { value: '__unassigned__', label: 'Не призначено' },
                    ...uniqueEmployees.map((emp) => ({ value: emp, label: emp }))
                  ]}
                  placeholder="Всі виконавці"
                />
              </th>
              <th className="px-4 py-2 font-normal">
                <CustomSelect
                  value={filterDirection}
                  onChange={(val) => setFilterDirection(val)}
                  options={[
                    { value: '', label: 'Всі напрямки' },
                    ...uniqueDirections.map((dir) => ({ value: dir, label: dir }))
                  ]}
                  placeholder="Всі напрямки"
                />
              </th>
              <th className="px-4 py-2 font-normal"></th>
              <th className="px-4 py-2 font-normal">
                <CustomSelect
                  value={filterStatus}
                  onChange={(val) => setFilterStatus(val)}
                  options={[
                    { value: '', label: 'Всі статуси' },
                    { value: 'active', label: 'В роботі' },
                    { value: 'waiting', label: 'Очікує' },
                    { value: 'overdue', label: 'Протерміновано' },
                    { value: 'completed', label: 'Completed' }
                  ]}
                  placeholder="Всі статуси"
                />
              </th>
              <th className="px-4 py-2 font-normal">
                <CustomSelect
                  value={sortField === 'deadline' ? sortOrder : ''}
                  onChange={(val) => {
                    if (val === 'asc') {
                      setSortField('deadline');
                      setSortOrder('asc');
                    } else if (val === 'desc') {
                      setSortField('deadline');
                      setSortOrder('desc');
                    } else {
                      if (sortField === 'deadline') {
                        setSortField(null);
                        setSortOrder('asc');
                      }
                    }
                  }}
                  options={[
                    { value: '', label: 'Без сортування' },
                    { value: 'asc', label: 'Спочатку найближчі' },
                    { value: 'desc', label: 'Спочатку пізніші' }
                  ]}
                  placeholder="Дедлайн..."
                />
              </th>
              <th className="px-4 py-2 font-normal text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300/40">
            {sortedProjects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-300/20 transition-colors group">
                <td className="px-6 py-5 font-bold text-gray-800 text-sm leading-relaxed">{project.name}</td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3 text-gray-700 font-medium text-sm">
                    <div className="w-7 h-7 rounded-full neu-pressed flex items-center justify-center text-xs font-bold text-primary">
                      {project.assignedEmployee?.charAt(0) || '?'}
                    </div>
                    {project.assignedEmployee || 'Не призначено'}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="text-gray-600 font-medium text-sm">
                    {project.direction || 'Загальне'}
                  </span>
                </td>
                <td className="px-6 py-5 text-center">
                  <span className="neu-pressed text-primary px-3 py-1 rounded-xl text-xs font-bold">
                    {project.points}
                  </span>
                </td>
                <td className="px-6 py-5">
                  <span
                    className={`badge ${
                      project.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : project.status === 'waiting'
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : project.status === 'overdue'
                            ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                            : 'bg-gray-500/10 text-gray-600 border border-gray-500/20'
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
                <td className="px-6 py-4 text-gray-600 font-semibold text-sm">{formatDate(project.deadline)}</td>
                {role === 'admin' && (
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(project.id)} className="text-gray-400 hover:text-red-500 p-2">
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-300/60 font-semibold text-gray-700">
            <tr>
              <td colSpan={3} className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm font-medium">Всього задач:</span>
                  <span className="neu-pressed px-3 py-1 rounded-xl text-sm font-bold text-gray-800">
                    {totalTasks}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <div className="inline-flex flex-col items-center">
                  <span className="text-secondary text-[9px] uppercase tracking-widest font-bold">Сума поінтів:</span>
                  <span className="bg-primary/20 text-primary px-3 py-1 rounded-lg text-sm font-extrabold ring-1 ring-primary/35 mt-1">
                    {totalPoints}
                  </span>
                </div>
              </td>
              <td colSpan={2} className="px-6 py-4"></td>
              {role === 'admin' && <td className="px-6 py-4"></td>}
            </tr>
          </tfoot>
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
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Напрямок</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-primary"
                  value={newProject.direction}
                  onChange={(event) => setNewProject({ ...newProject, direction: event.target.value })}
                  placeholder="Наприклад: Стенди, ED, VR..."
                />
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
