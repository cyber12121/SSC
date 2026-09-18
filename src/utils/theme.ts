export type AppTheme = 'light' | 'sage';

const THEME_STORAGE_KEY = 'cgl_app_theme';

export const THEME_CONFIG: Record<AppTheme, { id: AppTheme; label: string; icon: string; description: string; colors: string[] }> = {
  light: {
    id: 'light',
    label: 'Light',
    icon: 'Sun',
    description: 'Clean, high-clarity daylight mode',
    colors: ['#ffffff', '#f1f5f9', '#2563eb'],
  },
  sage: {
    id: 'sage',
    label: 'Sage',
    icon: 'Leaf',
    description: 'Earthy tea garden palette with olive accents',
    colors: ['#e2eee4', '#bedab6', '#bfbb89'],
  },
};

export function getInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'sage') {
      return stored;
    }
    if (stored === 'dark') {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  } catch (e) {
    // localStorage may be disabled or restricted
  }
  return 'light';
}

export function setAppliedTheme(theme: AppTheme): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.remove('dark');
    if (theme === 'sage') {
      root.classList.add('sage');
    } else {
      root.classList.remove('sage');
    }
    window.dispatchEvent(new CustomEvent('cgl_theme_changed', { detail: theme }));
  } catch (e) {
    console.error('Failed to set theme:', e);
  }
}
