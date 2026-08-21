import React, { createContext, useContext, useState, useEffect } from 'react';

const DepartmentContext = createContext();

export const DEPARTMENTS = {
  DESIGN: 'design',
  CONSTRUCTION: 'construction',
};

export const DepartmentProvider = ({ children }) => {
  const [activeDepartment, setActiveDepartment] = useState(() => {
    return localStorage.getItem('LM_ACTIVE_DEPARTMENT') || DEPARTMENTS.DESIGN;
  });

  useEffect(() => {
    localStorage.setItem('LM_ACTIVE_DEPARTMENT', activeDepartment);
  }, [activeDepartment]);

  const isDesign = activeDepartment === DEPARTMENTS.DESIGN;
  const isConstruction = activeDepartment === DEPARTMENTS.CONSTRUCTION;

  const departmentMeta = {
    activeDepartment,
    setActiveDepartment,
    isDesign,
    isConstruction,
    departmentLabel: isDesign ? 'Проєктування' : 'Конструювання',
    departmentEmoji: isDesign ? '📐' : '🛠️',
    employeeRoleTitle: isDesign ? 'проєктантів' : 'конструкторів',
    employeeSingleTitle: isDesign ? 'Проєктант' : 'Конструктор',
    teamTabLabel: isDesign ? 'Команда проєктантів' : 'Команда конструкторів',
    auditTabLabel: isDesign ? 'Аудит проєктантів' : 'Аудит конструкторів',
    
    // Universal filter helper for arrays of items (projects, employees, absences)
    filterByDepartment: (items = []) => {
      if (!Array.isArray(items)) return [];
      return items.filter((item) => {
        const itemDept = item?.department || DEPARTMENTS.DESIGN;
        return itemDept === activeDepartment;
      });
    }
  };

  return (
    <DepartmentContext.Provider value={departmentMeta}>
      {children}
    </DepartmentContext.Provider>
  );
};

export const useDepartment = () => {
  const context = useContext(DepartmentContext);
  if (!context) {
    throw new Error('useDepartment must be used within a DepartmentProvider');
  }
  return context;
};
