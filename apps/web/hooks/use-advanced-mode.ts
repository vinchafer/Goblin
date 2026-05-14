'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import { API_URL } from '@/lib/api';

interface AdvancedModeContextValue {
  isAdvancedMode: boolean;
  loading: boolean;
}

const AdvancedModeContext = createContext<AdvancedModeContextValue>({
  isAdvancedMode: false,
  loading: true,
});

export function useAdvancedMode(): AdvancedModeContextValue {
  return useContext(AdvancedModeContext);
}

export function useAdvancedModeState(): AdvancedModeContextValue {
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = sessionStorage.getItem('goblin_advanced_mode');
    if (cached !== null) {
      setIsAdvancedMode(cached === 'true');
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/api/users/me`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const val = typeof d.advanced_mode === 'boolean' ? d.advanced_mode : false;
        setIsAdvancedMode(val);
        sessionStorage.setItem('goblin_advanced_mode', String(val));
      })
      .catch(() => setIsAdvancedMode(false))
      .finally(() => setLoading(false));
  }, []);

  return { isAdvancedMode, loading };
}

export { AdvancedModeContext };
