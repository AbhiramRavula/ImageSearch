// ── Theme management ──

export type Theme = 'light' | 'dark' | 'system';

/** Get the effective theme based on user preference and system setting */
export function getEffectiveTheme(preference: Theme): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

/** Apply theme to the document */
export function applyTheme(theme: Theme): void {
  const effective = getEffectiveTheme(theme);
  document.documentElement.setAttribute('data-theme', effective);
}

/** Load saved theme preference */
export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem('img-search-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {}
  return 'system';
}

/** Save theme preference */
export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem('img-search-theme', theme);
  } catch {}
}

/** Listen for system theme changes */
export function onSystemThemeChange(callback: (isDark: boolean) => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
