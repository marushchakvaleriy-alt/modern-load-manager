import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './tabs/Dashboard';
import Projects from './tabs/Projects';
import Audit from './tabs/Audit';
import Load from './tabs/Load';
import Team from './tabs/Team';
import DirectionAudit from './tabs/DirectionAudit';
import ItemsAudit from './tabs/ItemsAudit';
import Flow from './tabs/Flow';
import { AuthProvider } from './store/authContext';
import { useAuth } from './store/useAuth';

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

const AppContent = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projectFilter, setProjectFilter] = useState('all');
  const { user } = useAuth();

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen bg-background text-slate-200">
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
      </main>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
