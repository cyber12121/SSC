import React, { useState, useEffect, useRef } from 'react';
import { Sun, Leaf, Check } from 'lucide-react';
import { AppTheme, THEME_CONFIG, getInitialTheme, setAppliedTheme } from '../utils/theme';

interface ThemeSelectorProps {
  className?: string;
  isCompact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ className = '' }) => {
  const [theme, setTheme] = useState<AppTheme>(() => getInitialTheme());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial sync
    const initial = getInitialTheme();
    setTheme(initial);
    setAppliedTheme(initial);

    // Listen for theme changes across app
    const handleThemeChange = (e: CustomEvent<AppTheme>) => {
      setTheme(e.detail);
    };

    window.addEventListener('cgl_theme_changed' as any, handleThemeChange);
    return () => window.removeEventListener('cgl_theme_changed' as any, handleThemeChange);
  }, []);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectTheme = (newTheme: AppTheme) => {
    setTheme(newTheme);
    setAppliedTheme(newTheme);
    setIsOpen(false);
  };

  const getThemeIcon = (t: AppTheme, iconClass = 'w-4 h-4') => {
    switch (t) {
      case 'sage':
        return <Leaf className={`${iconClass} text-[#88a065]`} />;
      default:
        return <Sun className={`${iconClass} text-amber-500`} />;
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Single Icon Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200/80 active:scale-95 text-slate-700 transition-all flex items-center justify-center cursor-pointer shadow-xs relative group focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        title={`Theme: ${THEME_CONFIG[theme].label} (Click to change)`}
        aria-label="Select theme"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {getThemeIcon(theme, 'w-4 h-4 transition-transform group-hover:scale-110 duration-200')}

        {/* Subtle theme pill dot */}
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{ backgroundColor: THEME_CONFIG[theme].colors[2] }}
        />
      </button>

      {/* Floating Theme Selection Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-52 py-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Select Theme</span>
            <span className="text-[10px] font-bold text-slate-500 capitalize">{THEME_CONFIG[theme].label} active</span>
          </div>

          <div className="p-1 space-y-0.5">
            {(['light', 'sage'] as AppTheme[]).map((t) => {
              const config = THEME_CONFIG[t];
              const isSelected = theme === t;

              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleSelectTheme(t)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                      isSelected ? 'bg-white border-blue-200 shadow-2xs' : 'bg-slate-50 border-slate-200/80'
                    }`}>
                      {getThemeIcon(t, 'w-3.5 h-3.5')}
                    </div>
                    <div className="text-left">
                      <div className="leading-tight">{config.label}</div>
                      {t === 'sage' && (
                        <div className="flex items-center gap-1 mt-0.5" title="#bfbb89, #bedab6, #e2eee4">
                          <span className="w-2 h-2 rounded-full border border-slate-300 bg-[#bfbb89]" />
                          <span className="w-2 h-2 rounded-full border border-slate-300 bg-[#bedab6]" />
                          <span className="w-2 h-2 rounded-full border border-slate-300 bg-[#e2eee4]" />
                          <span className="text-[9px] text-slate-400 font-normal">palette</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
