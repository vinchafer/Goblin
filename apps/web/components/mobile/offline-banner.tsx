'use client';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const onOffline = () => { setIsOffline(true); setWasOffline(true); };
    const onOnline = () => {
      setIsOffline(false);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [wasOffline]);

  if (!isOffline && !showReconnected) return null;

  if (showReconnected) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: '#4A7C3B', color: '#fff',
        padding: '8px 16px', textAlign: 'center',
        fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
        zIndex: 1000, animation: 'slideDown 0.2s ease',
      }}>
        ✓ Back online
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: '#B85C3C', color: '#fff',
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
      zIndex: 1000,
    }}>
      <span>⚡</span>
      <span>You&apos;re offline — your work is safe. Reconnect to continue.</span>
    </div>
  );
}
