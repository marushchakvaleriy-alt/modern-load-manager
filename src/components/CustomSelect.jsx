import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomSelect = ({ value, onChange, options, placeholder = 'Виберіть...', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize options array to [{ value, label }]
  const normalizedOptions = options.map((opt) =>
    typeof opt === 'object' && opt !== null ? opt : { value: opt, label: opt }
  );

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left text-xs ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full neu-btn px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 font-semibold text-gray-700 hover:text-primary transition-all select-none"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}
        />
      </button>

      {/* Floating Neumorphic Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-full min-w-[140px] neu-flat p-2 z-50 animate-in fade-in zoom-in-95 duration-150 shadow-2xl border border-gray-300/50">
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {normalizedOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={String(opt.value)}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer font-bold text-xs transition-all ${
                    isSelected
                      ? 'neu-menu-active text-primary'
                      : 'hover:bg-gray-300/30 text-gray-700 hover:text-primary'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="text-primary shrink-0 ml-1" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
