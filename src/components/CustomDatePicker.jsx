import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTH_NAMES = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
];

const WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const toYMD = (d) => {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (ymdStr) => {
  if (!ymdStr) return 'Виберіть дату';
  const parts = ymdStr.split('-');
  if (parts.length !== 3) return ymdStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const CustomDatePicker = ({
  value,
  onChange,
  min,
  max,
  placeholder = 'Виберіть дату',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Current parsed selected date
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length !== 3) return null;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  // View state (month & year displayed in calendar)
  const [viewYear, setViewYear] = useState(() => (selectedDate ? selectedDate.getFullYear() : new Date().getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (selectedDate ? selectedDate.getMonth() : new Date().getMonth()));

  // Keep view in sync when selected value changes externally
  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [selectedDate]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dayDate) => {
    const ymd = toYMD(dayDate);
    if (min && ymd < min) return;
    if (max && ymd > max) return;
    onChange(ymd);
    setIsOpen(false);
  };

  const handleToday = (e) => {
    e.stopPropagation();
    const today = new Date();
    handleSelectDay(today);
  };

  const handleMonthStart = (e) => {
    e.stopPropagation();
    const firstDay = new Date(viewYear, viewMonth, 1);
    handleSelectDay(firstDay);
  };

  const handleMonthEnd = (e) => {
    e.stopPropagation();
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    handleSelectDay(lastDay);
  };

  // Build grid days
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    // Convert Sunday=0 to Monday=0 (0->6, 1->0, 2->1, etc.)
    let dayOfWeek = firstDayOfMonth.getDay() - 1;
    if (dayOfWeek < 0) dayOfWeek = 6;

    const grid = [];
    // Days from previous month
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      grid.push({
        date: new Date(viewYear, viewMonth - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // Days from current month
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push({
        date: new Date(viewYear, viewMonth, i),
        isCurrentMonth: true
      });
    }

    // Days from next month to complete 42 cells
    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
      grid.push({
        date: new Date(viewYear, viewMonth + 1, i),
        isCurrentMonth: false
      });
    }

    return grid;
  }, [viewYear, viewMonth]);

  const todayYMD = toYMD(new Date());

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="neu-btn flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-gray-700 hover:text-primary transition-all duration-200"
      >
        <CalendarIcon size={16} className="text-primary" />
        <span>{formatDisplayDate(value)}</span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-3 z-50 w-80 neu-flat p-5 rounded-2xl border border-white/60 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {/* Header Controls */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="neu-btn p-2 rounded-xl text-gray-600 hover:text-primary transition"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <span className="text-sm font-extrabold text-gray-800">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="neu-btn p-2 rounded-xl text-gray-600 hover:text-primary transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {WEEKDAY_NAMES.map((name) => (
              <span key={name} className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 py-1">
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarGrid.map(({ date, isCurrentMonth }, idx) => {
              const ymd = toYMD(date);
              const isSelected = value === ymd;
              const isToday = todayYMD === ymd;
              const isDisabled = (min && ymd < min) || (max && ymd > max);

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(date)}
                  className={`
                    h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-150 mx-auto
                    ${isDisabled ? 'opacity-25 cursor-not-allowed text-gray-400' : 'cursor-pointer'}
                    ${
                      isSelected
                        ? 'bg-primary text-white font-extrabold shadow-md scale-105'
                        : isToday
                        ? 'neu-pressed text-primary font-extrabold border border-primary/40'
                        : isCurrentMonth
                        ? 'text-gray-700 hover:neu-pressed hover:text-primary'
                        : 'text-gray-400 hover:text-gray-600'
                    }
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Quick Presets Footer */}
          <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleToday}
              className="text-primary font-extrabold hover:underline"
            >
              Сьогодні
            </button>
            <button
              type="button"
              onClick={handleMonthStart}
              className="text-gray-500 font-bold hover:text-gray-800"
            >
              1-ше число
            </button>
            <button
              type="button"
              onClick={handleMonthEnd}
              className="text-gray-500 font-bold hover:text-gray-800"
            >
              Кінець місяця
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
