import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLoadEngine } from '../hooks/useLoadEngine';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  ClipboardCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  PieChart,
  Layers3
} from 'lucide-react';
import { normalizeImportedProjectDate, parseDateOnly } from '../lib/dateUtils';

import { useDepartment } from '../store/departmentContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Dashboard = ({ setActiveTab, setProjectFilter }) => {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);

  const { filterByDepartment, departmentLabel } = useDepartment();
  const deptProjects = filterByDepartment(projects);
  const deptEmployees = filterByDepartment(employees);
  const deptAbsences = filterByDepartment(absences);

  const { departmentLoad } = useLoadEngine(deptProjects, deptEmployees, deptAbsences);

  useEffect(() => {
    const qProjects = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribeProjects = onSnapshot(qProjects, (snapshot) => {
      setProjects(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const qEmployees = query(collection(db, 'employees'));
    const unsubscribeEmployees = onSnapshot(qEmployees, (snapshot) => {
      setEmployees(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const qAbsences = query(collection(db, 'absences'));
    const unsubscribeAbsences = onSnapshot(qAbsences, (snapshot) => {
      setAbsences(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeProjects();
      unsubscribeEmployees();
      unsubscribeAbsences();
    };
  }, []);

  const maxImportedAt = projects
    .map(p => p.importedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  const lastUpdateTime = maxImportedAt
    ? new Date(maxImportedAt).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : 'Невідомо';

  const calculatePoints = (status) =>
    deptProjects
      .filter((project) => project.status === status)
      .reduce((sum, project) => sum + (project.points || 0), 0);

  const calculateOverduePoints = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    return deptProjects
      .filter((project) => {
        if (project.status === 'overdue') return true;
        if (project.status !== 'active' || !project.deadline || project.deadline === '-') return false;

        const deadlineDate = new Date(project.deadline);
        return !Number.isNaN(deadlineDate.getTime()) && deadlineDate < todayDate;
      })
      .reduce((sum, project) => sum + (project.points || 0), 0);
  };

  const calculateCompletedThisMonth = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return deptProjects
      .filter((project) => {
        if (project.status !== 'completed') return false;
        if (!project.completedAt) return false;

        const parsedDate = parseDateOnly(
          normalizeImportedProjectDate(project.completedAt, { preferPast: true })
        );
        if (!parsedDate) return false;

        return parsedDate.getMonth() === currentMonth && parsedDate.getFullYear() === currentYear;
      })
      .reduce((sum, project) => sum + (project.points || 0), 0);
  };

  const calculateTaskCount = (status) =>
    deptProjects.filter((project) => project.status === status).length;

  const calculateOverdueTasks = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    return deptProjects.filter((project) => {
      if (project.status === 'overdue') return true;
      if (project.status !== 'active' || !project.deadline || project.deadline === '-') return false;

      const deadlineDate = new Date(project.deadline);
      return !Number.isNaN(deadlineDate.getTime()) && deadlineDate < todayDate;
    }).length;
  };

  const calculateCompletedThisMonthTasks = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return deptProjects.filter((project) => {
      if (project.status !== 'completed') return false;
      if (!project.completedAt) return false;

      const parsedDate = parseDateOnly(
        normalizeImportedProjectDate(project.completedAt, { preferPast: true })
      );
      if (!parsedDate) return false;

      return parsedDate.getMonth() === currentMonth && parsedDate.getFullYear() === currentYear;
    }).length;
  };

  const totalTasksCount = deptProjects.filter((p) => p.status !== 'completed').length;
  const totalDepartmentBacklog = departmentLoad[0]?.load || 0;

  const stats = [
    {
      id: 'all',
      label: 'Усього на відділі',
      value: totalDepartmentBacklog,
      tasksCount: totalTasksCount,
      icon: Layers3,
      color: 'text-cyan-500',
      featured: true
    },
    {
      id: 'active',
      label: 'Поінти в роботі',
      value: calculatePoints('active'),
      tasksCount: calculateTaskCount('active'),
      icon: ClipboardCheck,
      color: 'text-primary'
    },
    {
      id: 'waiting',
      label: 'В очікуванні',
      value: calculatePoints('waiting'),
      tasksCount: calculateTaskCount('waiting'),
      icon: Clock,
      color: 'text-amber-500'
    },
    {
      id: 'overdue',
      label: 'Протерміновані поінти',
      value: calculateOverduePoints(),
      tasksCount: calculateOverdueTasks(),
      icon: AlertTriangle,
      color: 'text-red-500'
    },
    {
      id: 'completedThisMonth',
      label: 'Закрито за поточний місяць',
      value: calculateCompletedThisMonth(),
      tasksCount: calculateCompletedThisMonthTasks(),
      icon: CheckCircle,
      color: 'text-emerald-500'
    }
  ];

  const handleStatClick = (filterId) => {
    if (filterId === 'all') {
      setProjectFilter?.('all');
      setActiveTab?.('projects');
      return;
    }

    if (setActiveTab && setProjectFilter) {
      setProjectFilter(filterId);
      setActiveTab('projects');
    }
  };

  const chartData = {
    labels: departmentLoad.map((day) => day.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })),
    datasets: [
      {
        label: 'Завантаження (Поінти)',
        data: departmentLoad.map((day) => day.load),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(37, 99, 235, 0.18)',
        pointBackgroundColor: '#60a5fa',
        pointBorderColor: '#bfdbfe',
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 3,
        fill: true,
        tension: 0.35
      },
      {
        label: 'Потужність відділу',
        data: departmentLoad.map((day) => day.capacity),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        pointBackgroundColor: '#fbbf24',
        pointBorderColor: '#fde68a',
        pointRadius: 3,
        pointHoverRadius: 5,
        pointStyle: 'rectRounded',
        borderWidth: 4,
        fill: true,
        tension: 0,
        stepped: 'before'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#4b5563',
          usePointStyle: true,
          boxWidth: 10,
          padding: 18,
          font: { weight: 'bold', family: 'Outfit' }
        }
      },
      tooltip: {
        backgroundColor: '#e0e5ec',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        boxPadding: 6
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6b7280', font: { family: 'Outfit' } }
      },
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: '#6b7280', font: { family: 'Outfit' } }
      }
    }
  };

  return (
    <div className="space-y-8">
      <header className="mb-10 flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-gray-700">
            Панель керування
          </h2>
          <p className="text-gray-500 mt-2 text-lg font-medium">Огляд реального навантаження відділу у реальному часі</p>
        </div>
        
        <div className="neu-pressed px-4 py-3 rounded-2xl flex items-center gap-3">
          <Clock size={18} className="text-gray-400" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Останнє оновлення</span>
            <span className="text-sm font-bold text-gray-700">{lastUpdateTime}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.id}
            onClick={() => handleStatClick(stat.id)}
            className="neu-flat p-6 flex items-center gap-5 group cursor-pointer transition-all hover:-translate-y-1"
          >
            <div className="neu-btn p-3.5 rounded-2xl flex items-center justify-center">
              <stat.icon size={26} className={stat.color} />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-bold tracking-tight text-gray-700">{stat.value}</p>
              <span className="neu-pressed px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold text-primary mt-1.5 inline-block">
                {stat.tasksCount} задач
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="neu-flat p-8 h-[520px]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold tracking-tight text-gray-700">Графік завантаження (42 поінти/день)</h3>
          <div className="flex gap-4 text-xs font-bold text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Завантаження</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-amber-500"></div>
              <span>Потужність</span>
            </div>
          </div>
        </div>
        <div className="h-[400px] neu-pressed p-6 rounded-3xl">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
