import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';
import { generateAiResponse } from '../lib/geminiApi';
import { BrainCircuit, Loader2, Target, AlertTriangle, Settings } from 'lucide-react';

const AiAssistant = () => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);
  const { employeeLoad } = useLoadEngine(projects, employees, absences);

  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);

  const handleSaveKey = (newKey) => {
    localStorage.setItem('gemini_api_key', newKey);
    setApiKey(newKey);
  };

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [distributionPlan, setDistributionPlan] = useState(null);
  const [errorPlan, setErrorPlan] = useState('');

  const [loadingRisks, setLoadingRisks] = useState(false);
  const [riskReport, setRiskReport] = useState(null);
  const [errorRisks, setErrorRisks] = useState('');

  useEffect(() => {
    const unsubProjects = onSnapshot(query(collection(db, 'projects'), orderBy('createdAt', 'desc')), (snapshot) => {
      setProjects(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAbsences = onSnapshot(collection(db, 'absences'), (snapshot) => {
      setAbsences(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubProjects();
      unsubEmployees();
      unsubAbsences();
    };
  }, []);

  const handleGeneratePlan = async () => {
    setLoadingPlan(true);
    setErrorPlan('');
    setDistributionPlan(null);
    try {
      const seniorNames = employees.filter(e => e.isSenior).map(e => (e.name || '').trim().toLowerCase());
      const unassignedTasks = projects.filter(p => 
        (p.status === 'active' || p.status === 'waiting') && 
        seniorNames.includes((p.assignedEmployee || '').trim().toLowerCase())
      );

      const teamLoad = employeeLoad.filter(e => !e.isSenior);

      if (unassignedTasks.length === 0) {
        throw new Error('Немає активних задач, які закріплені за старшим проєктантом (всі задачі вже розподілені).');
      }

      if (teamLoad.length === 0) {
         throw new Error('У команді немає доступних проєктантів для розподілу (або всі відмічені як старші).');
      }

      const prompt = `
Ти - ШІ-менеджер команди. Твоє завдання - розподілити задачі між проектантами.
Капасіті 1 працівника = 42 поінти на день.
Дані про задачі, які зараз "висять" на старшому проєктанті і які треба розподілити:
${JSON.stringify(unassignedTasks.map(t => ({ id: t.name, points: t.points, deadline: t.deadline })))}

Дані про команду (Кому можна віддати задачі та їхнє поточне навантаження):
${JSON.stringify(teamLoad.map(e => ({ name: e.name, activeLoadPoints: e.active })))}

Запропонуй розподіл задач так, щоб вирівняти навантаження.
Формат відповіді ТІЛЬКИ чистий JSON масив об'єктів (без маркдауну, без \`\`\`json):
[{"taskName": "назва задачі", "assignTo": "ім'я працівника", "reason": "чому віддали саме йому"}]
`;
      
      const plan = await generateAiResponse(prompt);
      if (!Array.isArray(plan)) throw new Error('ШІ повернув не масив.');
      setDistributionPlan(plan);
    } catch (e) {
      setErrorPlan(e.message);
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleAnalyzeRisks = async () => {
    setLoadingRisks(true);
    setErrorRisks('');
    setRiskReport(null);
    try {
      const activeTasks = projects.filter(p => p.status === 'active' || p.status === 'overdue' || p.status === 'waiting');
      
      if (activeTasks.length === 0) {
          throw new Error('Немає активних задач для аналізу.');
      }

      const prompt = `
Ти - ШІ-менеджер. Проаналізуй список активних задач і знайди ті, що мають найвищий ризик протермінування (зважай на дедлайн і поінти).
Також порекомендуй задачі, які краще віддати на аутсорс, щоб врятувати дедлайни. Поточна дата: ${new Date().toISOString().split('T')[0]}.
Задачі:
${JSON.stringify(activeTasks.map(t => ({ id: t.name, assignee: t.assignedEmployee, points: t.points, deadline: t.deadline, status: t.status })))}

Формат відповіді ТІЛЬКИ чистий JSON об'єкт (без маркдауну, без \`\`\`json): 
{
  "highRiskTasks": [{"taskName": "назва", "reason": "чому високий ризик"}],
  "outsourceRecommendations": [{"taskName": "назва", "reason": "чому на аутсорс"}]
}
`;
      const report = await generateAiResponse(prompt);
      if (!report.highRiskTasks) throw new Error('Невірний формат відповіді від ШІ.');
      setRiskReport(report);
    } catch (e) {
      setErrorRisks(e.message);
    } finally {
      setLoadingRisks(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="mb-10">
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-4">
          <BrainCircuit size={40} className="text-purple-400" />
          ШІ Асистент
        </h2>
        <p className="text-secondary mt-2 text-lg">Автоматичний розподіл задач та аналіз ризиків</p>
      </header>

      {/* API Key Banner/Settings */}
      {!apiKey && !import.meta.env.VITE_GEMINI_API_KEY && (
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div>
            <h4 className="font-bold text-lg flex items-center gap-2">
              <AlertTriangle className="text-amber-400 animate-pulse" size={20} />
              Gemini API Key не налаштовано
            </h4>
            <p className="text-sm mt-1 opacity-90">
              Для роботи ШІ-асистента необхідно вказати ваш особистий API ключ Gemini. Він зберігається локально у вашому браузері.
            </p>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Налаштувати ключ
          </button>
        </div>
      )}

      <div className="glass-card p-6 border-white/10 mb-8 max-w-2xl">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="text-secondary text-sm font-semibold flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
        >
          <Settings size={16} />
          {showSettings ? 'Сховати налаштування ключів' : 'Налаштування ключів Gemini'}
        </button>
        
        {showSettings && (
          <div className="mt-4 space-y-3">
            <label className="block text-xs uppercase tracking-wider font-bold text-secondary">
              Ваш Gemini API Key:
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleSaveKey(e.target.value)}
                placeholder="Введіть API ключ (наприклад, AIzaSy...)"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
              {apiKey && (
                <button 
                  onClick={() => handleSaveKey('')}
                  className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  Очистити
                </button>
              )}
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Ключ зберігається лише локально на цьому комп'ютері у вашому браузері (`localStorage`) та не надсилається в репозиторій GitHub.
              Ви можете отримати безкоштовний ключ у <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Google AI Studio</a>.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Task Distribution */}
        <div className="glass-card p-8 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.05)] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Target size={100} />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <Target className="text-purple-400" size={28} />
            <h3 className="text-2xl font-bold">Розподіл нових задач</h3>
          </div>
          <p className="text-secondary mb-8 relative z-10">
            ШІ проаналізує задачі, які зараз закріплені за <span className="text-amber-500 font-bold">Старшим проєктантом</span>, і запропонує, кому з вільної команди їх краще передати.
          </p>
          <button 
            onClick={handleGeneratePlan}
            disabled={loadingPlan}
            className="btn-primary w-full py-4 bg-purple-600 hover:bg-purple-500 border-purple-500 flex items-center justify-center gap-3 text-lg font-semibold disabled:opacity-50 relative z-10 shadow-lg shadow-purple-500/20"
          >
            {loadingPlan ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
            {loadingPlan ? 'Аналізую навантаження команди...' : 'Згенерувати план розподілу'}
          </button>
          
          {errorPlan && <div className="mt-6 p-4 bg-danger/10 border border-danger/30 text-danger rounded-xl relative z-10">{errorPlan}</div>}
          
          {distributionPlan && (
            <div className="mt-8 space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-4">
              <h4 className="font-bold text-lg text-white mb-4">Пропозиція ШІ:</h4>
              {distributionPlan.map((item, i) => (
                <div key={i} className="p-5 bg-white/5 border border-purple-500/20 rounded-xl hover:bg-white/10 transition-colors">
                  <p className="font-bold text-lg text-purple-200 mb-3">{item.taskName}</p>
                  <div className="flex items-center gap-3 text-sm mb-2">
                    <span className="text-secondary uppercase text-[10px] tracking-widest font-bold">Віддати виконавцю:</span>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-md font-bold">{item.assignTo}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm mt-3">
                    <span className="text-secondary uppercase text-[10px] tracking-widest font-bold">Причина:</span>
                    <span className="text-white/80 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">{item.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Risk Analysis */}
        <div className="glass-card p-8 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <AlertTriangle size={100} />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <AlertTriangle className="text-amber-400" size={28} />
            <h3 className="text-2xl font-bold">Ризики та Аутсорс</h3>
          </div>
          <p className="text-secondary mb-8 relative z-10">
            ШІ проаналізує всі дедлайни та навантаження, щоб попередити вас про можливі зриви термінів та запропонує задачі для передачі на аутсорс.
          </p>
          <button 
            onClick={handleAnalyzeRisks}
            disabled={loadingRisks}
            className="btn-primary w-full py-4 bg-amber-600 hover:bg-amber-500 border-amber-500 flex items-center justify-center gap-3 text-lg font-semibold disabled:opacity-50 relative z-10 shadow-lg shadow-amber-500/20"
          >
            {loadingRisks ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
            {loadingRisks ? 'Пошук ризиків...' : 'Провести аналіз ризиків'}
          </button>
          
          {errorRisks && <div className="mt-6 p-4 bg-danger/10 border border-danger/30 text-danger rounded-xl relative z-10">{errorRisks}</div>}
          
          {riskReport && (
            <div className="mt-8 space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4">
              {riskReport.highRiskTasks?.length > 0 && (
                <div>
                  <h4 className="font-bold text-lg text-amber-400 mb-4 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                    Високий ризик протермінування:
                  </h4>
                  <div className="space-y-3">
                    {riskReport.highRiskTasks.map((item, i) => (
                      <div key={i} className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-colors">
                        <p className="font-bold text-white mb-2">{item.taskName}</p>
                        <p className="text-sm text-amber-200/80 leading-relaxed">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {riskReport.outsourceRecommendations?.length > 0 && (
                <div>
                  <h4 className="font-bold text-lg text-cyan-400 mb-4 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                    </span>
                    Рекомендація на аутсорс:
                  </h4>
                  <div className="space-y-3">
                    {riskReport.outsourceRecommendations.map((item, i) => (
                      <div key={i} className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 transition-colors">
                        <p className="font-bold text-white mb-2">{item.taskName}</p>
                        <p className="text-sm text-cyan-200/80 leading-relaxed">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AiAssistant;
