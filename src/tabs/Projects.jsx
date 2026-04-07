import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../store/useAuth';
import { processBitrixExcel } from '../lib/excelUtils';
import { Plus, Upload, Trash2 } from 'lucide-react';
import { triggerGlobalSync } from '../lib/syncUtils';

const Projects = ({ projectFilter, setProjectFilter }) => {
  const [projects, setProjects] = useState([]);
  const { role } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', points: 0, assignedEmployee: '', status: 'active' });

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
  };

  const [localFilter, setLocalFilter] = useState('all');
  const currentFilter = projectFilter || localFilter;
  const setCurrentFilter = setProjectFilter || setLocalFilter;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map((projectDoc) => ({ id: projectDoc.id, ...projectDoc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const imported = await processBitrixExcel(file);

      if (!imported || imported.length === 0) {
        alert('Файл порожній або має непідтримуваний формат!');
        return;
      }

      const batch = writeBatch(db);
      imported.forEach((project) => {
        const newDocRef = doc(collection(db, 'projects'));
        batch.set(newDocRef, { ...project, createdAt: serverTimestamp() });
      });

      await batch.commit();

      const syncResult = await triggerGlobalSync();
      const added = syncResult?.diagnostics?.added || 0;
      const deleted = syncResult?.diagnostics?.deleted || 0;

      const messages = [];
      if (added > 0) messages.push(`додано ${added} нових виконавців`);
      if (deleted > 0) messages.push(`видалено ${deleted} виконавців, яких немає у звіті`);

      alert(`Успішно імпортовано ${imported.length} проєктів${messages.length ? `. ${messages.join(', ')}.` : '!'}`);
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
    if (window.confirm('ОБЕРЕЖНО! Ви впевнені, що хочете видалити ВСІ проєкти з бази даних? Цю дію неможливо скасувати.')) {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((projectDoc) => {
        batch.delete(doc(db, 'projects', projectDoc.id));
      });
      await batch.commit();
      await triggerGlobalSync();
      alert('Всі проєкти успішно видалено!');
    }
  };

  const filteredProjects = projects.filter((project) => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'active') return project.status === 'active';
    if (currentFilter === 'waiting') return project.status === 'waiting';
    if (currentFilter === 'overdue') {
      if (project.status === 'overdue') return true;
      if (project.status !== 'active' || !project.deadline || project.deadline === '-') return false;

      const todayStr = new Date().toISOString().split('T')[0];
      return project.deadline < todayStr;
    }
    if (currentFilter === 'completedThisMonth') {
      if (project.status !== 'completed') return false;
      const now = new Date();
      const dateStr = project.importedAt || (project.createdAt?.toDate ? project.createdAt.toDate().toISOString() : new Date().toISOString());
      const parsedDate = new Date(dateStr);
      if (Number.isNaN(parsedDate.getTime())) return false;
      return parsedDate.getMonth() === now.getMonth() && parsedDate.getFullYear() === now.getFullYear();
    }
    return true;
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

      <div className="flex gap-2 mb-6 bg-white/[0.02] p-1.5 rounded-xl border border-white/5 w-fit">
        {[
          { id: 'all', label: 'Всі проєкти' },
          { id: 'active', label: 'В роботі' },
          { id: 'waiting', label: 'В очікуванні' },
          { id: 'overdue', label: 'Протерміновані' },
          { id: 'completedThisMonth', label: 'Закриті (Цей місяць)' }
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
      </div>

      <div className="glass-card overflow-hidden border-white/5 shadow-3xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="table-header">Назва проєкту</th>
              <th className="table-header">Виконавець</th>
              <th className="table-header text-center">Поінти</th>
              <th className="table-header">Статус</th>
              <th className="table-header">Дедлайн</th>
              {role === 'admin' && <th className="table-header text-right"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filteredProjects.map((project) => (
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
                  <span className={`badge ${
                    project.status === 'active' ? 'bg-success/10 text-success ring-1 ring-success/20'
                    : project.status === 'waiting' ? 'bg-accent/10 text-accent ring-1 ring-accent/20'
                    : project.status === 'overdue' ? 'bg-danger/10 text-danger ring-1 ring-danger/20'
                    : 'bg-secondary/10 text-secondary ring-1 ring-secondary/20'
                  }`}>
                    {project.status === 'active' ? 'В роботі'
                      : project.status === 'waiting' ? 'Очікує'
                      : project.status === 'overdue' ? 'Протерміновано'
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
            <h3 className="text-xl font-bold mb-6">Новий проєкт / Бронювання</h3>
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
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-secondary hover:text-white">Скасувати</button>
                <button type="submit" className="btn-primary">Зберегти</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
