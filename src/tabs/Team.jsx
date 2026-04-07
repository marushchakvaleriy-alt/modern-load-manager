import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../store/useAuth';
import { Users, Plus, Trash2, RefreshCw, Shield, UserCog } from 'lucide-react';
import { triggerGlobalSync } from '../lib/syncUtils';

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

  const [showAbsenceFor, setShowAbsenceFor] = useState(null);
  const [absenceType, setAbsenceType] = useState('sick');
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');

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
        if (result.diagnostics) {
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
    absences.filter((absence) => absence.employeeId === empId).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

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
      days: countWorkingDays(absenceStart, absenceEnd),
      createdAt: serverTimestamp(),
    });

    setShowAbsenceFor(null);
    setAbsenceStart('');
    setAbsenceEnd('');
  };

  const handleDeleteAbsence = async (absenceId) => {
    await deleteDoc(doc(db, 'absences', absenceId));
  };

  const handleRoleChange = async (targetUserId, nextRole) => {
    await updateDoc(doc(db, 'users', targetUserId), {
      role: nextRole,
      updatedAt: serverTimestamp()
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-8 relative">
      {(syncing || initialLoading) && <LoadingOverlay message={initialLoading ? 'Завантаження команди...' : undefined} />}

      <header className="mb-10 flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
            Команда
          </h2>
          <p className="text-secondary mt-2 text-lg">Управління виконавцями, акаунтами та доступністю</p>
        </div>
        {syncing && (
          <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl animate-pulse">
            <RefreshCw size={18} className="text-primary animate-spin" />
            <span className="text-sm font-bold text-primary">Синхронізація виконавців...</span>
          </div>
        )}
      </header>

      {role === 'admin' && users.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="text-primary" size={20} />
            <h3 className="text-xl font-bold">Акаунти та ролі</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((account) => {
              const isCurrentUser = account.id === user?.uid;
              const currentRole = account.role || 'viewer';
              return (
                <div key={account.id} className="glass-card p-5 border-white/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-lg">{account.fullName || `${account.firstName || ''} ${account.lastName || ''}`.trim() || account.email}</p>
                      <p className="text-sm text-secondary">{account.email || 'Без email'}</p>
                      <p className="text-xs text-secondary mt-2">
                        Поточна роль: <span className="font-semibold text-white">{currentRole}</span>{isCurrentUser ? ' • це ви' : ''}
                      </p>
                    </div>
                    <UserCog size={18} className="text-primary shrink-0" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleRoleChange(account.id, 'viewer')}
                      disabled={currentRole === 'viewer'}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${currentRole === 'viewer' ? 'border-white/10 bg-white/5 text-white/60' : 'border-white/10 text-secondary hover:text-white hover:border-white/30'}`}
                    >
                      Viewer
                    </button>
                    <button
                      onClick={() => handleRoleChange(account.id, 'admin')}
                      disabled={currentRole === 'admin'}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${currentRole === 'admin' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-primary/20 text-primary hover:bg-primary/10'}`}
                    >
                      Admin
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {employees.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Users className="mx-auto text-white/5 mb-4" size={64} />
          <h3 className="text-xl font-bold mb-2">Команда порожня</h3>
          <p className="text-secondary text-sm max-w-sm mx-auto mb-8">
            Виконавці з&apos;являться автоматично після додавання або імпорту проєктів.
          </p>

          {syncStats && (
            <div className="max-w-xs mx-auto p-4 rounded-xl bg-white/[0.02] border border-white/5 text-left space-y-2">
              <p className="text-[10px] uppercase font-bold tracking-widest text-secondary mb-3">Діагностика синхронізації:</p>
              <div className="flex justify-between text-xs">
                <span className="text-secondary">Знайдено проєктів:</span>
                <span className="font-mono text-white">{syncStats.projectsFound}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-secondary">Унікальних імен:</span>
                <span className="font-mono text-white">{syncStats.uniqueNames}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.map((employee) => {
            const employeeAbsences = getAbsencesForEmp(employee.id);
            const activeAbsence = employeeAbsences.find((absence) => absence.startDate <= today && absence.endDate >= today);
            const isShowingAbsenceForm = showAbsenceFor === employee.id;

            return (
              <div key={employee.id} className="glass-card p-6 hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-bold text-xl">
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
                      <p className="font-bold truncate">{employee.name}</p>
                      {employee.isSenior && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase border border-amber-500/20">
                          Старший
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-secondary mt-0.5">
                      {activeAbsence ? (
                        <span className={activeAbsence.type === 'sick' ? 'text-orange-400' : 'text-emerald-400'}>
                          {activeAbsence.type === 'sick' ? 'Лікарняний' : 'Відпустка'} до {new Date(activeAbsence.endDate).toLocaleDateString('uk-UA')}
                        </span>
                      ) : (employee.role || 'Проєктант')}
                    </p>
                  </div>
                  {role === 'admin' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await updateDoc(doc(db, 'employees', employee.id), {
                            isSenior: !employee.isSenior
                          });
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                          employee.isSenior
                            ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                            : 'border-white/10 text-secondary hover:border-amber-500/30 hover:text-amber-500'
                        }`}
                      >
                        {employee.isSenior ? 'Старший' : 'Проєктант'}
                      </button>
                      <button
                        onClick={() => setShowAbsenceFor(isShowingAbsenceForm ? null : employee.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                          isShowingAbsenceForm
                            ? 'border-primary/40 text-primary bg-primary/10'
                            : 'border-white/10 text-secondary hover:border-primary/30 hover:text-primary'
                        }`}
                      >
                        <Plus size={12} />
                        Відсутність
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Видалити ${employee.name} з команди?`)) {
                            await deleteDoc(doc(db, 'employees', employee.id));
                          }
                        }}
                        className="p-1.5 rounded-lg border border-white/10 text-secondary hover:border-danger/40 hover:text-danger hover:bg-danger/5 transition-all"
                        title="Видалити виконавця"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {isShowingAbsenceForm && (
                  <div className="mb-4 bg-white/[0.03] rounded-xl p-4 border border-white/5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-secondary">Додати відсутність</p>
                    <div className="flex gap-2">
                      {ABSENCE_TYPES.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setAbsenceType(type.value)}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-1.5 border transition-all ${
                            absenceType === type.value
                              ? 'border-primary/40 bg-primary/10 text-white'
                              : 'border-white/5 text-secondary hover:border-white/20'
                          }`}
                        >
                          {type.emoji} {type.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-secondary uppercase tracking-wide block mb-1">Початок</label>
                        <input
                          type="date"
                          value={absenceStart}
                          onChange={(event) => setAbsenceStart(event.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-secondary uppercase tracking-wide block mb-1">Кінець</label>
                        <input
                          type="date"
                          value={absenceEnd}
                          onChange={(event) => setAbsenceEnd(event.target.value)}
                          min={absenceStart}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddAbsence(employee)}
                      disabled={!absenceStart || !absenceEnd}
                      className="btn-primary w-full py-2 text-sm disabled:opacity-40"
                    >
                      Зберегти
                    </button>
                  </div>
                )}

                {employeeAbsences.length > 0 && (
                  <div className="space-y-2">
                    {employeeAbsences.map((absence) => {
                      const isActive = absence.startDate <= today && absence.endDate >= today;
                      const typeInfo = ABSENCE_TYPES.find((type) => type.value === absence.type) || ABSENCE_TYPES[0];
                      return (
                        <div key={absence.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${isActive ? 'bg-white/5 border border-white/10' : 'opacity-50'}`}>
                          <span className="text-base">{typeInfo.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${typeInfo.color}`}>{typeInfo.label}</p>
                            <p className="text-[11px] text-secondary">
                              {new Date(absence.startDate).toLocaleDateString('uk-UA')} - {new Date(absence.endDate).toLocaleDateString('uk-UA')}
                              <span className="ml-1 text-white/30">({absence.days} роб. дн.)</span>
                            </p>
                          </div>
                          {role === 'admin' && (
                            <button onClick={() => handleDeleteAbsence(absence.id)} className="text-white/10 hover:text-danger transition-colors">
                              <Trash2 size={13} />
                            </button>
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
    </div>
  );
};

export default Team;
