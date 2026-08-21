import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../components/CustomDatePicker';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../store/useAuth';
import { Users, Plus, Trash2, RefreshCw, Shield, UserCog, UserX, UserCheck, ChevronDown, ChevronUp, UserPlus, Pencil, Check, X } from 'lucide-react';
import { triggerGlobalSync } from '../lib/syncUtils';
import { useDepartment } from '../store/departmentContext';

const ABSENCE_TYPES = [
  { value: 'sick', label: 'Лікарняний', emoji: '🏥', color: 'text-orange-400' },
  { value: 'vacation', label: 'Відпустка', emoji: '🌴', color: 'text-emerald-400' },
];

const LoadingOverlay = ({ message }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
    <div className="text-center p-12 glass-card border-primary/20 shadow-2xl shadow-primary/10 max-w-sm w-full mx-4">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full border-2 border-primary/10 border-t-primary animate-spin mx-auto" />
        <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={32} />
      </div>
      <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
        Оновлення команди
      </h3>
      <p className="text-secondary text-base leading-relaxed">
        {message || 'Зачекайте, ми синхронізуємо список виконавців із базою проєктів...'}
      </p>
    </div>
  </div>
);

const Team = () => {
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [absences, setAbsences] = useState([]);
  const { role, user } = useAuth();
  const { filterByDepartment, teamTabLabel, activeDepartment, employeeSingleTitle } = useDepartment();

  const deptEmployees = filterByDepartment(employees);
  const activeTeam = deptEmployees.filter(e => !e.isIgnored);
  const ignoredTeam = deptEmployees.filter(e => !!e.isIgnored);
  const deptAbsences = filterByDepartment(absences);

  const [showAbsenceFor, setShowAbsenceFor] = useState(null);
  const [absenceType, setAbsenceType] = useState('sick');
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('');
  const [showIgnoredSection, setShowIgnoredSection] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('team'); // 'team' | 'users'

  // Absence editing states
  const [editingAbsenceId, setEditingAbsenceId] = useState(null);
  const [editingAbsenceType, setEditingAbsenceType] = useState('vacation');
  const [editingAbsenceStart, setEditingAbsenceStart] = useState('');
  const [editingAbsenceEnd, setEditingAbsenceEnd] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [syncStats, setSyncStats] = useState(null);

  useEffect(() => {
    const unsubEmp = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setInitialLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).sort((a, b) => (a.fullName || a.email || '').localeCompare(b.fullName || b.email || '')));
    });

    const unsubAbs = onSnapshot(collection(db, 'absences'), (snapshot) => {
      setAbsences(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });

    const runSync = async () => {
      setSyncing(true);

      const safetyTimeout = setTimeout(() => {
        setSyncing(false);
        console.warn('Sync took too long, hiding overlay');
      }, 5000);

      try {
        const result = await triggerGlobalSync();
        if (result?.diagnostics) {
          setSyncStats(result.diagnostics);
        }
      } catch (err) {
        console.error('Sync error in Team component:', err);
      } finally {
        clearTimeout(safetyTimeout);
        setTimeout(() => setSyncing(false), 500);
      }
    };

    runSync();

    return () => {
      unsubEmp();
      unsubUsers();
      unsubAbs();
    };
  }, []);

  const countWorkingDays = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (current.getDay() !== 0 && current.getDay() !== 6) count++;
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  const getAbsencesForEmp = (empId) =>
    deptAbsences.filter((absence) => absence.employeeId === empId).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const handleAddAbsence = async (employee) => {
    if (!absenceStart || !absenceEnd) return;
    if (new Date(absenceEnd) < new Date(absenceStart)) {
      alert('Дата завершення не може бути раніше дати початку!');
      return;
    }

    await addDoc(collection(db, 'absences'), {
      employeeId: employee.id,
      employeeName: employee.name,
      type: absenceType,
      startDate: absenceStart,
      endDate: absenceEnd,
      department: activeDepartment,
      days: countWorkingDays(absenceStart, absenceEnd),
      createdAt: serverTimestamp(),
    });

    setShowAbsenceFor(null);
    setAbsenceStart('');
    setAbsenceEnd('');
  };

  const handleDeleteAbsence = async (absenceId) => {
    await deleteDoc(doc(db, 'absences', absenceId));
    if (editingAbsenceId === absenceId) setEditingAbsenceId(null);
  };

  const handleStartEditAbsence = (absence) => {
    setEditingAbsenceId(absence.id);
    setEditingAbsenceType(absence.type || 'vacation');
    setEditingAbsenceStart(absence.startDate || '');
    setEditingAbsenceEnd(absence.endDate || '');
  };

  const handleSaveEditAbsence = async (absenceId) => {
    if (!editingAbsenceStart || !editingAbsenceEnd) return;
    if (new Date(editingAbsenceEnd) < new Date(editingAbsenceStart)) {
      alert('Дата завершення не може бути раніше дати початку!');
      return;
    }

    await updateDoc(doc(db, 'absences', absenceId), {
      type: editingAbsenceType,
      startDate: editingAbsenceStart,
      endDate: editingAbsenceEnd,
      days: countWorkingDays(editingAbsenceStart, editingAbsenceEnd),
      updatedAt: serverTimestamp(),
    });

    setEditingAbsenceId(null);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;

    const customId = (newEmpName || '').trim().toLowerCase().replace(/[^a-z0-9а-яіїєґ]/gi, '_') + '_' + activeDepartment;
    const defaultRole = activeDepartment === 'construction' ? 'Конструктор' : 'Проєктант';

    await setDoc(doc(db, 'employees', customId), {
      name: newEmpName.trim(),
      role: newEmpRole.trim() || defaultRole,
      department: activeDepartment,
      isSenior: false,
      isIgnored: false,
      isManual: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    setNewEmpName('');
    setNewEmpRole('');
    setShowAddModal(false);
  };

  const handleToggleSenior = async (employee) => {
    await updateDoc(doc(db, 'employees', employee.id), {
      isSenior: !employee.isSenior,
      isIgnored: false,
      updatedAt: serverTimestamp()
    });
  };

  const handleToggleIgnored = async (employee) => {
    const nextIgnored = !employee.isIgnored;
    await updateDoc(doc(db, 'employees', employee.id), {
      isIgnored: nextIgnored,
      updatedAt: serverTimestamp()
    });
  };

  const handleRoleChange = async (targetUserId, nextRole) => {
    await updateDoc(doc(db, 'users', targetUserId), {
      role: nextRole,
      updatedAt: serverTimestamp()
    });
  };

  const handleDeleteUser = async (userToDelete) => {
    if (userToDelete.email === user?.email) {
      alert('Ви не можете видалити власний обліковий запис, під яким зараз авторизовані!');
      return;
    }
    if (window.confirm(`Видалити користувача "${userToDelete.fullName || userToDelete.email}" з системи назавжди?`)) {
      await deleteDoc(doc(db, 'users', userToDelete.id));
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-8 relative">
      {syncing && <LoadingOverlay message="Синхронізація складу команди з проєктами..." />}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-800 flex items-center gap-3">
            <Users className="text-primary" size={32} />
            {teamTabLabel}
          </h2>
          <p className="text-gray-500 font-medium text-sm mt-1">
            Керування складом команди, ролями та відсутностями (Лікарняні / Відпустки)
          </p>
        </div>

        {role === 'admin' && activeSubTab === 'team' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="neu-btn px-4 py-2.5 rounded-xl font-bold text-sm text-primary flex items-center gap-2 hover:text-blue-700 transition-all"
            >
              <UserPlus size={16} />
              Додати співробітника
            </button>

            <button
              onClick={async () => {
                setSyncing(true);
                try {
                  const res = await triggerGlobalSync();
                  if (res?.diagnostics) setSyncStats(res.diagnostics);
                } finally {
                  setSyncing(false);
                }
              }}
              className="neu-btn px-4 py-2.5 rounded-xl font-bold text-sm text-gray-600 flex items-center gap-2 hover:text-primary transition-all"
              title="Синхронізувати з базою проєктів"
            >
              <RefreshCw size={16} />
              Синхронізація
            </button>
          </div>
        )}
      </header>

      {/* Sub-tabs Navigation */}
      <div className="flex items-center gap-3 border-b border-gray-300/60 pb-3">
        <button
          onClick={() => setActiveSubTab('team')}
          className={`neu-btn px-5 py-2.5 rounded-xl font-extrabold text-sm flex items-center gap-2.5 transition-all ${
            activeSubTab === 'team'
              ? 'text-primary bg-white shadow-md ring-2 ring-primary/30'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <UserCheck size={18} className={activeSubTab === 'team' ? 'text-primary' : 'text-gray-500'} />
          <span>Склад команди ({activeTeam.length})</span>
        </button>

        {role === 'admin' && (
          <button
            onClick={() => setActiveSubTab('users')}
            className={`neu-btn px-5 py-2.5 rounded-xl font-extrabold text-sm flex items-center gap-2.5 transition-all ${
              activeSubTab === 'users'
                ? 'text-primary bg-white shadow-md ring-2 ring-primary/30'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UserCog size={18} className={activeSubTab === 'users' ? 'text-primary' : 'text-gray-500'} />
            <span>Користувачі системи ({users.length})</span>
          </button>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#e0e5ec] p-6 rounded-2xl neu-flat max-w-md w-full border border-white/40 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <UserPlus className="text-primary" size={20} />
              Додати члена команди
            </h3>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  ПІБ / Ім&apos;я співробітника (як у Бітрікс)
                </label>
                <input
                  type="text"
                  required
                  placeholder="наприклад: Мартинчук Олександр"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full neu-pressed px-4 py-2.5 rounded-xl outline-none text-gray-800 text-sm font-medium focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Посада / Роль (необов&apos;язково)
                </label>
                <input
                  type="text"
                  placeholder={activeDepartment === 'construction' ? 'Конструктор' : 'Проєктант'}
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  className="w-full neu-pressed px-4 py-2.5 rounded-xl outline-none text-gray-800 text-sm font-medium focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl neu-flat text-gray-600 font-bold text-sm hover:text-gray-800"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-blue-700 transition-colors"
                >
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Tab View */}
      {role === 'admin' && activeSubTab === 'users' && (
        <section className="neu-flat p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-gray-300/60 pb-3">
            <div className="flex items-center gap-2">
              <UserCog className="text-primary" size={20} />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-700">
                Користувачі та права доступу до системи ({users.length})
              </h3>
            </div>
            <span className="text-xs text-gray-500 font-medium">
              Керування адміністраторами та переглядачами
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {users.map((u) => {
              const currentRole = u.role || 'viewer';
              return (
                <div key={u.id} className="neu-flat p-4 rounded-xl flex items-center justify-between gap-3 border border-white/50">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{u.fullName || u.email}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRoleChange(u.id, currentRole === 'admin' ? 'viewer' : 'admin')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all ${
                        currentRole === 'admin'
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-gray-300 text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {currentRole === 'admin' ? 'Admin' : 'Viewer'}
                    </button>

                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="p-1.5 rounded-lg border border-gray-300 text-gray-400 hover:border-red-500/40 hover:text-red-600 transition-all"
                      title="Видалити користувача з бази даних"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Team Section (Active / White List) */}
      {activeSubTab === 'team' && (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-600 flex items-center gap-2">
            <UserCheck size={18} className="text-emerald-600" />
            Склад команди ({activeTeam.length})
          </h3>
          <span className="text-xs font-semibold text-gray-500">
            Враховуються у навантаженні та плануванні
          </span>
        </div>

        {activeTeam.length === 0 ? (
          <div className="neu-flat p-12 text-center rounded-2xl">
            <Users className="mx-auto text-gray-400 mb-3" size={48} />
            <h4 className="font-bold text-gray-700 mb-1">Команда порожня</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Натисніть &quot;Додати співробітника&quot; або синхронізуйте проєкти з Бітрікс.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTeam.map((employee) => {
              const employeeAbsences = getAbsencesForEmp(employee.id);
              const activeAbsence = employeeAbsences.find((absence) => absence.startDate <= today && absence.endDate >= today);
              const isShowingAbsenceForm = showAbsenceFor === employee.id;

              return (
                <div key={employee.id} className="neu-flat p-5 rounded-2xl hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl neu-pressed flex items-center justify-center text-primary font-extrabold text-xl">
                        {employee.name?.charAt(0)}
                      </div>
                      {activeAbsence && (
                        <span className="absolute -top-1 -right-1 text-base leading-none">
                          {activeAbsence.type === 'sick' ? '🏥' : '🌴'}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-gray-800 truncate">{employee.name}</p>
                        {employee.isSenior && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase border border-amber-500/20">
                            Старший
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 font-medium">
                        {activeAbsence ? (
                          <span className={activeAbsence.type === 'sick' ? 'text-orange-500 font-bold' : 'text-emerald-600 font-bold'}>
                            {activeAbsence.type === 'sick' ? 'Лікарняний' : 'Відпустка'} до {new Date(activeAbsence.endDate).toLocaleDateString('uk-UA')}
                          </span>
                        ) : (employee.role || employeeSingleTitle)}
                      </p>
                    </div>

                    {role === 'admin' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Senior Toggle */}
                        <button
                          onClick={() => handleToggleSenior(employee)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all font-semibold ${
                            employee.isSenior
                              ? 'border-amber-500/40 text-amber-600 bg-amber-500/10'
                              : 'border-gray-300/80 text-gray-600 hover:text-amber-600 hover:border-amber-400'
                          }`}
                          title="Старший проєктант (розподіляє задачі, не входить в навантаження)"
                        >
                          {employee.isSenior ? 'Старший' : 'Виконавець'}
                        </button>

                        {/* Absence Button */}
                        <button
                          onClick={() => setShowAbsenceFor(isShowingAbsenceForm ? null : employee.id)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isShowingAbsenceForm
                              ? 'border-primary text-primary bg-primary/10'
                              : 'border-gray-300 text-gray-500 hover:text-primary hover:border-primary/40'
                          }`}
                          title="Додати відсутність (лікарняний / відпустка)"
                        >
                          <Plus size={14} />
                        </button>

                        {/* Ignore / Exclude Button */}
                        <button
                          onClick={() => handleToggleIgnored(employee)}
                          className="p-1.5 rounded-lg border border-gray-300 text-gray-400 hover:border-amber-500/40 hover:text-amber-600 transition-all"
                          title="Виключити з команди (ігнорувати ліву людину з Бітрікс)"
                        >
                          <UserX size={14} />
                        </button>

                        {/* Delete permanently */}
                        <button
                          onClick={async () => {
                            if (window.confirm(`Видалити ${employee.name} назавжди?`)) {
                              await deleteDoc(doc(db, 'employees', employee.id));
                            }
                          }}
                          className="p-1.5 rounded-lg border border-gray-300 text-gray-400 hover:border-red-500/40 hover:text-red-600 transition-all"
                          title="Видалити запис"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Absence form */}
                  {isShowingAbsenceForm && (
                    <div className="mb-4 neu-pressed p-4 rounded-xl space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Додати відсутність</p>
                      <div className="flex gap-2">
                        {ABSENCE_TYPES.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setAbsenceType(type.value)}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                              absenceType === type.value
                                ? 'border-primary/40 bg-white text-primary shadow-sm'
                                : 'border-gray-300 text-gray-600 hover:border-gray-400'
                            }`}
                          >
                            {type.emoji} {type.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide block mb-1">Початок</label>
                          <CustomDatePicker value={absenceStart} onChange={setAbsenceStart} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide block mb-1">Кінець</label>
                          <CustomDatePicker value={absenceEnd} min={absenceStart} onChange={setAbsenceEnd} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddAbsence(employee)}
                        disabled={!absenceStart || !absenceEnd}
                        className="w-full py-2 rounded-xl bg-primary text-white font-bold text-xs shadow-md disabled:opacity-40 hover:bg-blue-700"
                      >
                        Зберегти відсутність
                      </button>
                    </div>
                  )}

                  {/* Absence list */}
                  {employeeAbsences.length > 0 && (
                    <div className="space-y-2">
                      {employeeAbsences.map((absence) => {
                        const isActive = absence.startDate <= today && absence.endDate >= today;
                        const typeInfo = ABSENCE_TYPES.find((type) => type.value === absence.type) || ABSENCE_TYPES[0];
                        const isEditingThis = editingAbsenceId === absence.id;

                        if (isEditingThis) {
                          return (
                            <div key={absence.id} className="p-3.5 rounded-xl neu-pressed space-y-2.5 border border-primary/40 bg-white/40">
                              <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">Редагування відсутності</p>
                              <div className="flex gap-2">
                                {ABSENCE_TYPES.map((type) => (
                                  <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setEditingAbsenceType(type.value)}
                                    className={`flex-1 py-1 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                                      editingAbsenceType === type.value
                                        ? 'border-primary/50 bg-white text-primary shadow-sm'
                                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                                    }`}
                                  >
                                    {type.emoji} {type.label}
                                  </button>
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] text-gray-500 font-extrabold uppercase block mb-1">Початок</label>
                                  <CustomDatePicker value={editingAbsenceStart} onChange={setEditingAbsenceStart} />
                                </div>
                                <div>
                                  <label className="text-[9px] text-gray-500 font-extrabold uppercase block mb-1">Кінець</label>
                                  <CustomDatePicker value={editingAbsenceEnd} min={editingAbsenceStart} onChange={setEditingAbsenceEnd} />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditAbsence(absence.id)}
                                  className="flex-1 py-1.5 rounded-lg bg-primary text-white font-bold text-xs shadow hover:bg-blue-700 flex items-center justify-center gap-1"
                                >
                                  <Check size={14} /> Зберегти
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingAbsenceId(null)}
                                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-200 text-xs font-bold flex items-center justify-center"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={absence.id}
                            className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg neu-pressed ${
                              isActive ? 'border border-primary/30' : 'opacity-80'
                            }`}
                          >
                            <span className="text-sm">{typeInfo.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-bold ${typeInfo.color}`}>{typeInfo.label}</p>
                              <p className="text-[10px] text-gray-500">
                                {new Date(absence.startDate).toLocaleDateString('uk-UA')} - {new Date(absence.endDate).toLocaleDateString('uk-UA')}
                                <span className="ml-1 font-bold">({absence.days} роб. дн.)</span>
                              </p>
                            </div>
                            {role === 'admin' && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleStartEditAbsence(absence)}
                                  className="text-gray-400 hover:text-primary transition-colors p-1"
                                  title="Редагувати дати або тип відсутності"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteAbsence(absence.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                  title="Видалити відсутність"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* Ignored / Excluded Team Members Section */}
      {activeSubTab === 'team' && ignoredTeam.length > 0 && (
        <section className="neu-flat p-5 rounded-2xl border border-amber-500/20">
          <button
            type="button"
            onClick={() => setShowIgnoredSection(!showIgnoredSection)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <UserX className="text-amber-500" size={18} />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-700">
                Ігноровані особи / Поза командою ({ignoredTeam.length})
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
              <span>{showIgnoredSection ? 'Згорнути' : 'Розгорнути'}</span>
              {showIgnoredSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {showIgnoredSection && (
            <div className="mt-4 pt-3 border-t border-gray-300 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ignoredTeam.map((emp) => (
                <div key={emp.id} className="neu-pressed p-3 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-gray-700 truncate">{emp.name}</p>
                    <p className="text-[10px] text-amber-600 font-medium">Ігнорується в аналітиці</p>
                  </div>
                  {role === 'admin' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleIgnored(emp)}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-600/10 text-emerald-600 border border-emerald-600/20 hover:bg-emerald-600/20"
                        title="Повернути в активну команду"
                      >
                        Повернути
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Видалити ${emp.name} назавжди?`)) {
                            await deleteDoc(doc(db, 'employees', emp.id));
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="Видалити"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Team;
