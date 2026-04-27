import { SettingsLayout } from '@/components/settings/settings-layout';

export default function SettingsPage() {
  return (
    <SettingsLayout>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 28 }}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 24, color: 'var(--moss)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.5px' }}>General</h2>
        <p style={{ fontSize: 14, color: 'var(--meta)', marginBottom: 28 }}>Your account preferences</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { label: 'Display Name', value: 'Vince', type: 'text' },
            { label: 'Email', value: '', type: 'email', placeholder: 'your@email.com' },
          ].map(field => (
            <div key={field.label}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{field.label}</label>
              <input
                type={field.type}
                defaultValue={field.value}
                placeholder={field.placeholder}
                style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
                onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          ))}
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button style={{ background: 'var(--moss)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Save changes</button>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
