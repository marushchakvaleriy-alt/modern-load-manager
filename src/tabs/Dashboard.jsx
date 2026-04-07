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
  const { departmentLoad } = useLoadEngine(projects, employees, absences);

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

  const calculatePoints = (status) =>
    projects
      .filter((project) => project.status === status)
      .reduce((sum, project) => sum + (project.points || 0), 0);

  const calculateOverduePoints = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    return projects
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

    return projects
      .filter((project) => {
        if (project.status !== 'completed') return false;

        const dateStr =
          project.importedAt ||
          (project.createdAt?.toDate ? project.createdAt.toDate().toISOString() : new Date().toISOString());

        const parsedDate = new Date(dateStr);
        if (Number.isNaN(parsedDate.getTime())) return false;

        return parsedDate.getMonth() === currentMonth && parsedDate.getFullYear() === currentYear;
      })
      .reduce((sum, project) => sum + (project.points || 0), 0);
  };

  const totalDepartmentBacklog = departmentLoad[0]?.load || 0;

  const stats = [
    {
      id: 'all',
      label: 'Усього на відділі',
      value: totalDepartmentBacklog,
      icon: Layers3,
      color: 'text-cyan-400',
      featured: true
    },
    {
      id: 'active',
      label: 'Поінти в роботі',
      value: calculatePoints('active'),
      icon: ClipboardCheck,
      color: 'text-primary'
    },
    {
      id: 'waiting',
      label: 'В очікуванні',
      value: calculatePoints('waiting'),
      icon: Clock,
      color: 'text-accent'
    },
    {
      id: 'overdue',
      label: 'Протерміновані поінти',
      value: calculateOverduePoints(),
      icon: AlertTriangle,
      color: 'text-danger'
    },
    {
      id: 'completedThisMonth',
      label: 'Закрито за поточний місяць',
      value: calculateCompletedThisMonth(),
      icon: CheckCircle,
      color: 'text-success'
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
          color: '#cbd5e1',
          usePointStyle: true,
          boxWidth: 10,
          padding: 18
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b' }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b' }
      }
    }
  };

  return (
    <div className="space-y-8">
      <header className="mb-10 flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
            Панель керування
          </h2>
          <p className="text-secondary mt-2 text-lg">Огляд реального навантаження відділу у реальному часі</p>
        </div>
        <button
          onClick={() => setActiveTab('audit')}
          className="btn-primary flex items-center gap-2 py-3 px-6 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
        >
          <PieChart size={20} />
          <span>Відкрити звітність</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.id}
            onClick={() => handleStatClick(stat.id)}
            className={`glass-card p-6 flex items-center gap-5 group cursor-pointer transition-colors hover:bg-white/[0.02] ${
              stat.featured
                ? 'border-cyan-400/30 hover:border-cyan-400/60 bg-cyan-400/[0.03]'
                : 'hover:border-primary/50'
            }`}
          >
            <div
              className={`p-4 rounded-2xl ${
                stat.featured ? 'bg-cyan-400/10 ring-1 ring-cyan-400/20' : 'bg-white/5'
              } ${stat.color} transition-transform group-hover:scale-110`}
            >
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-secondary text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-8 h-[500px] hover:shadow-primary/5">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold tracking-tight">Графік завантаження (42 поінти/день)</h3>
          <div className="flex gap-4 text-xs font-medium text-secondary">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.55)]"></div>
              <span>Завантаження</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)]"></div>
              <span>Потужність</span>
            </div>
          </div>
        </div>
        <div className="h-[380px]">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
