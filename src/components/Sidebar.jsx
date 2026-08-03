import React from 'react';
import {
  Activity,
  BarChart2,
  Box,
  ClipboardList,
  Compass,
  Layers,
  LayoutDashboard,
  LogOut,
  Package,
  PieChart,
  Users,
  Wrench
} from 'lucide-react';
import { useAuth } from '../store/useAuth';
import { useDepartment, DEPARTMENTS } from '../store/departmentContext';

import logoImg from '../assets/logo3.png';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { role, logout } = useAuth();
  const { activeDepartment, setActiveDepartment, auditTabLabel } = useDepartment();

  const navItems = [
    { id: 'dashboard', label: 'Панель керування', icon: LayoutDashboard },
    { id: 'projects', label: 'Проєкти', icon: ClipboardList },
    { id: 'load', label: 'Навантаження', icon: BarChart2 },
    { id: 'audit', label: auditTabLabel, icon: PieChart },
    { id: 'direction-audit', label: 'Аудит напрямків', icon: Layers },
    { id: 'items-audit', label: 'Аудит виробів', icon: Box },
    { id: 'flow', label: 'Потік', icon: Activity }
  ];

  if (role === 'admin') {
    navItems.push({ id: 'team', label: 'Команда', icon: Users });
  }

  return (
    <div className="w-80 h-screen bg-[#e0e5ec] border-r border-gray-300/40 flex flex-col p-4 sticky top-0">
      <div className="flex flex-col items-center justify-center gap-0 px-1 py-0 mb-2 text-center">
        <img src={logoImg} alt="ViYar Logo" style={{ height: '155px', transform: 'scaleX(1.15) rotate(-0.5deg)' }} className="w-auto object-contain drop-shadow-md rounded-xl" />
      </div>

      {/* Department Selector Toggle */}
      <div className="neu-pressed p-2 mb-5 rounded-2xl">
        <p className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-gray-400 mb-2 px-2 text-center">
          Відділ
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveDepartment(DEPARTMENTS.DESIGN)}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs transition-all ${activeDepartment === DEPARTMENTS.DESIGN
                ? 'neu-flat bg-white text-primary font-extrabold shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
              }`}
          >
            <Compass size={14} className={activeDepartment === DEPARTMENTS.DESIGN ? 'text-primary' : ''} />
            <span>Проєктування</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDepartment(DEPARTMENTS.CONSTRUCTION)}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs transition-all ${activeDepartment === DEPARTMENTS.CONSTRUCTION
                ? 'neu-flat bg-white text-primary font-extrabold shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
              }`}
          >
            <Wrench size={14} className={activeDepartment === DEPARTMENTS.CONSTRUCTION ? 'text-primary' : ''} />
            <span>Конструювання</span>
          </button>
        </div>
      </div>

      <div className="mb-3 px-2 text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">Основні розділи</div>
      <nav className="flex-1 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 font-bold text-sm tracking-tight transition-all ${isActive ? 'neu-menu-active' : 'neu-btn text-gray-600 hover:text-primary'
                }`}
            >
              <item.icon
                size={18}
                className={isActive ? 'text-primary' : 'text-gray-500'}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-300/60 flex flex-col gap-3">
        <div className="neu-pressed p-3.5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-primary mb-1 tracking-wider">Ваш статус</p>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span className="text-sm font-bold capitalize text-gray-700">{role}</span>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full neu-btn flex items-center justify-center gap-3 px-4 py-2.5 text-gray-600 hover:text-red-500 transition-all font-bold text-sm"
        >
          <LogOut size={18} />
          <span>Завершити сеанс</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

