import React from 'react';
import { Check, Palette } from 'lucide-react';
import { APP_THEMES, AppThemeId } from '../../constants/themes';

interface ThemeSwitcherProps {
  activeThemeId: AppThemeId;
  onChange: (themeId: AppThemeId) => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ activeThemeId, onChange }) => {
  const activeTheme = APP_THEMES.find(theme => theme.id === activeThemeId) ?? APP_THEMES[0];

  return (
    <div className="relative group">
      <button
        type="button"
        title={`Theme: ${activeTheme.name}`}
        className="p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all"
      >
        <Palette className="w-4 h-4" />
      </button>

      <div className="absolute right-0 top-full pt-2 opacity-0 pointer-events-none translate-y-1 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 transition-all z-50">
        <div className="w-64 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-2">
          {APP_THEMES.map(theme => {
            const isActive = theme.id === activeThemeId;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onChange(theme.id)}
                className={`w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${
                  isActive ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {isActive && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{theme.name}</span>
                  <span className="block text-[11px] leading-relaxed text-slate-400 mt-0.5">
                    {theme.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThemeSwitcher;
