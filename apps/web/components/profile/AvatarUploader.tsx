'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

const TARGET_SIZE = 512;
const MAX_FILE_SIZE_MB = 5;

interface AvatarUploaderProps {
  currentUrl?: string | null;
  fallbackInitial: string;
  onUploadComplete: (url: string | null) => void;
}

export function AvatarUploader({ currentUrl, fallbackInitial, onUploadComplete }: AvatarUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Bitte ein Bild auswählen.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Datei zu groß. Max ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const cropAndUpload = async () => {
    if (!preview) return;
    setUploading(true);
    setError('');
    try {
      const img = new Image();
      img.src = preview;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar');
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, TARGET_SIZE, TARGET_SIZE);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Blob-Konvertierung fehlgeschlagen'))),
          'image/webp',
          0.85,
        );
      });

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const form = new FormData();
      form.append('avatar', blob, 'avatar.webp');
      const res = await fetch(`${apiBase}/api/account/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Upload fehlgeschlagen');

      onUploadComplete(data.url ?? null);
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const display = preview || currentUrl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative' }}>
        {display ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display}
            alt="Avatar"
            style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'var(--moss)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 600,
            }}
          >
            {fallbackInitial}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {!preview && (
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--div)',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'var(--font-ui)',
          }}
        >
          Bild auswählen
        </button>
      )}

      {preview && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={cropAndUpload}
            disabled={uploading}
            style={{
              padding: '10px 16px',
              background: uploading ? 'rgba(0,0,0,0.10)' : 'var(--moss)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 14,
              fontFamily: 'var(--font-ui)',
            }}
          >
            {uploading ? 'Lade hoch…' : 'Hochladen'}
          </button>
          <button
            onClick={() => {
              setPreview(null);
              setError('');
            }}
            disabled={uploading}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--div)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'var(--font-ui)',
            }}
          >
            Abbrechen
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--rust)', fontSize: 13, margin: 0 }}>{error}</p>
      )}

      <p style={{ color: 'var(--meta)', fontSize: 12, margin: 0, textAlign: 'center' }}>
        Max {MAX_FILE_SIZE_MB} MB. Wird auf 512×512 zugeschnitten und als WebP gespeichert.
      </p>
    </div>
  );
}
