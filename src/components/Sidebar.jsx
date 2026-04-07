import React from 'react';
import { LayoutDashboard, ClipboardList, PieChart, Users, LogOut, Package, BarChart2, Layers, Box, Activity } from 'lucide-react';
import { useAuth } from '../store/useAuth';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { role, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Панель керування', icon: LayoutDashboard },
    { id: 'projects', label: 'Проєкти', icon: ClipboardList },
    { id: 'load', label: 'Навантаження', icon: BarChart2 },
    { id: 'audit', label: 'Аудит проєктантів', icon: PieChart },
    { id: 'direction-audit', label: 'Аудит напрямків', icon: Layers },
    { id: 'items-audit', label: 'Аудит виробів', icon: Box },
    { id: 'flow', label: 'Потік', icon: Activity },
  ];

  if (role === 'admin') {
    navItems.push({ id: 'team', label: 'Команда', icon: Users });
  }

  return (
    <div className="w-80 h-screen bg-background border-r border-border flex flex-col p-6 sticky top-0">
      <div className="flex items-center gap-4 px-2 py-8 mb-10">
        <div className="relative group">
          <div className="absolute -inset-2 bg-primary/20 rounded-2xl blur-lg group-hover:bg-primary/30 transition-all"></div>
          <div className="relative bg-gradient-to-br from-primary to-primary/80 p-3 rounded-2xl shadow-xl shadow-primary/20">
            <Package className="text-white w-7 h-7" />
          </div>
        </div>
        <div>
          <h1 className="font-bold text-2xl tracking-tighter text-white">Load<span className="text-primary">Pro</span></h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-secondary font-bold">Manager v2.0</p>
        </div>
      </div>

      <div className="mb-4 px-2 text-[10px] uppercase tracking-[0.2em] font-bold text-white/20">Основні розділи</div>
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full group sidebar-link ${activeTab === item.id ? 'active' : ''}`}
          >
            <item.icon size={22} className={`${activeTab === item.id ? 'text-primary' : 'text-secondary group-hover:text-white'} transition-colors`} />
            <span className="font-semibold text-sm tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-border">
        <div className="glass-card p-4 mb-6 bg-primary/[0.03] border-primary/10">
          <p className="text-[10px] uppercase font-bold text-primary mb-1 tracking-wider">Ваш статус</p>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success"></div>
            <span className="text-sm font-bold capitalize">{role}</span>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-secondary hover:text-danger hover:bg-danger/5 transition-all"
        >
          <LogOut size={20} />
          <span className="font-bold text-sm tracking-tight">Завершити сеанс</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
