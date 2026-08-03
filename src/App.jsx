import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './tabs/Dashboard';
import Projects from './tabs/Projects';
import Audit from './tabs/Audit';
import Load from './tabs/Load';
import Team from './tabs/Team';
import DirectionAudit from './tabs/DirectionAudit';
import ItemsAudit from './tabs/ItemsAudit';
import Flow from './tabs/Flow';
import AiAssistant from './tabs/AiAssistant';
import { AuthProvider } from './store/authContext';
import { useAuth } from './store/useAuth';
import { collection, doc, getDocs, deleteField, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './lib/firebase';
import { getImportedProjectKey } from './lib/excelUtils';
import { triggerGlobalSync } from './lib/syncUtils';

const LoginScreen = () => {
  const { login, register, isFirebaseConfigured } = useAuth();
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'register') {
        await register({ firstName, lastName, email, password });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(
        err?.message || (
          mode === 'register'
            ? 'Не вдалося зареєструватися. Перевірте дані та спробуйте ще раз.'
            : 'Не вдалося увійти. Перевірте логін і пароль.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4">
      <div className="glass-card p-10 w-full max-w-md">
        <div className="mb-6 flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              mode === 'login' ? 'bg-primary text-white' : 'text-secondary hover:text-white'
            }`}
          >
            Увійти
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              mode === 'register' ? 'bg-primary text-white' : 'text-secondary hover:text-white'
            }`}
          >
            Зареєструватися
          </button>
        </div>

        <h2 className="text-2xl font-bold mb-3 text-center">
          {mode === 'register' ? 'Створити акаунт' : 'Вхід у систему'}
        </h2>
        <p className="text-secondary mb-8 text-center">
          {isFirebaseConfigured
            ? (
              mode === 'register'
                ? 'Заповніть дані, щоб створити акаунт у системі.'
                : 'Увійдіть через Firebase-акаунт, щоб відкрити робочий простір.'
            )
            : 'Додайте Firebase-конфіг у Vite-змінні середовища, щоб увімкнути вхід.'}
        </p>

        {isFirebaseConfigured ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  placeholder="Ім’я"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-primary"
                />
                <input
                  type="text"
                  required
                  placeholder="Прізвище"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-primary"
                />
              </div>
            )}

            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              placeholder="Пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-primary"
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 disabled:opacity-60"
            >
              {submitting
                ? (mode === 'register' ? 'Створення акаунта...' : 'Вхід...')
                : (mode === 'register' ? 'Зареєструватися' : 'Увійти')}
            </button>
          </form>
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
            Очікуються змінні `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
            `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
            `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
          </div>
        )}
      </div>
    </div>
  );
};

import { DepartmentProvider } from './store/departmentContext';

const saveGlobalImportedProjects = async (imported, targetDepartment = 'design') => {
  console.log('[GlobalAutoSync] Processing projects count:', imported?.length, 'Target Department:', targetDepartment);
  if (!imported || imported.length === 0) return;

  try {
    const existingSnapshot = await getDocs(collection(db, 'projects'));
    const existingProjects = existingSnapshot.docs.map((projectDoc) => ({
      ...projectDoc.data(),
      docId: projectDoc.id
    }));

    const existingBitrixByKey = new Map();
    const duplicateExistingIds = [];

    existingProjects.forEach((project) => {
      const sourceKey = getImportedProjectKey(project);
      if (!sourceKey) return;
      const dept = project.department || 'design';
      const scopedKey = `${sourceKey}_${dept}`;

      if (!existingBitrixByKey.has(scopedKey)) {
        existingBitrixByKey.set(scopedKey, project);
      } else {
        duplicateExistingIds.push(project.docId);
      }
    });

    const importedByKey = new Map();
    imported.forEach((project) => {
      const sourceKey = getImportedProjectKey(project);
      if (!sourceKey) return;
      importedByKey.set(sourceKey, { ...project, sourceKey, department: targetDepartment });
    });

    const batch = writeBatch(db);
    let createdCount = 0;
    let updatedCount = 0;

    importedByKey.forEach((project, sourceKey) => {
      const scopedKey = `${sourceKey}_${targetDepartment}`;
      const existingProject = existingBitrixByKey.get(scopedKey);
      const { id: importedBitrixId, ...projectData } = project;

      if (existingProject) {
        batch.set(
          doc(db, 'projects', existingProject.docId),
          {
            ...projectData,
            externalId: importedBitrixId,
            id: deleteField(),
            department: targetDepartment,
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
          department: targetDepartment,
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
    await triggerGlobalSync();
    console.log(`[GlobalAutoSync] Успішно оновлено ${importedByKey.size} задач для відділу "${targetDepartment}".`);
  } catch (err) {
    console.error('[GlobalAutoSync] Error:', err);
  }
};

const AppContent = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projectFilter, setProjectFilter] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let syncQueue = Promise.resolve();
    const queueSync = (projects, department) => {
      console.log(`[GlobalAutoSync] Queuing sync for department "${department}", count: ${projects?.length}`);
      syncQueue = syncQueue
        .then(() => saveGlobalImportedProjects(projects, department))
        .catch((err) => console.error('[GlobalAutoSync] Queue error:', err));
      return syncQueue;
    };

    let channel;
    try {
      channel = new BroadcastChannel('lm_bitrix_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'BITRIX_AUTO_SYNC' && Array.isArray(event.data?.projects)) {
          queueSync(event.data.projects, event.data.department || 'design');
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported', e);
    }

    const handleWindowMessage = (event) => {
      if (event.data?.type === 'BITRIX_AUTO_SYNC' && Array.isArray(event.data?.projects)) {
        queueSync(event.data.projects, event.data.department || 'design');
      }
    };

    window.addEventListener('message', handleWindowMessage);

    const checkLocalStorageSync = () => {
      const pendingData = localStorage.getItem('LM_PENDING_AUTO_SYNC');
      if (pendingData) {
        try {
          const parsed = JSON.parse(pendingData);
          localStorage.removeItem('LM_PENDING_AUTO_SYNC');
          if (typeof parsed === 'object' && Array.isArray(parsed.projects)) {
            queueSync(parsed.projects, parsed.department || 'design');
          } else if (Array.isArray(parsed) && parsed.length > 0) {
            queueSync(parsed, 'design');
          }
        } catch (e) {
          console.error('Error parsing pending auto-sync data:', e);
        }
      }
    };

    checkLocalStorageSync();
    window.addEventListener('focus', checkLocalStorageSync);
    window.addEventListener('storage', checkLocalStorageSync);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('focus', checkLocalStorageSync);
      window.removeEventListener('storage', checkLocalStorageSync);
    };
  }, [user]);

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen bg-[#e0e5ec] text-gray-700 font-sans antialiased">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} setProjectFilter={setProjectFilter} />}
        {activeTab === 'projects' && <Projects projectFilter={projectFilter} setProjectFilter={setProjectFilter} />}
        {activeTab === 'audit' && <Audit />}
        {activeTab === 'direction-audit' && <DirectionAudit />}
        {activeTab === 'items-audit' && <ItemsAudit />}
        {activeTab === 'load' && <Load />}
        {activeTab === 'flow' && <Flow />}
        {activeTab === 'team' && <Team />}
        {/* {activeTab === 'ai' && <AiAssistant />} */}
      </main>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <DepartmentProvider>
      <AppContent />
    </DepartmentProvider>
  </AuthProvider>
);

export default App;
