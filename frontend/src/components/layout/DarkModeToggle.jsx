import { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '../icons';

const STORAGE_KEY = 'danypathmart-theme';

function getInitial() {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function DarkModeToggle() {
  const [dark, setDark] = useState(getInitial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle day/night mode"
      className="rounded-full p-2 transition hover:bg-black/5 dark:hover:bg-white/10"
    >
      {dark ? (
        <SunIcon className="h-5 w-5 text-brand-gold" />
      ) : (
        <MoonIcon className="h-5 w-5 text-brand-green" />
      )}
    </button>
  );
}
