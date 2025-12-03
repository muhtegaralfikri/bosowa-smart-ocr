'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '../../services/authService';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
        await register(email, password);
      }
      const res = await login(email, password);
      localStorage.setItem('accessToken', res.accessToken);
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Auth error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-12 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.25em] text-ink/60">Bosowa Smart OCR</p>
        <h1 className="text-3xl font-semibold text-ink">{mode === 'login' ? 'Masuk' : 'Registrasi'}</h1>
        <p className="text-sm text-ink/70">
          {mode === 'login'
            ? 'Gunakan email dan password Anda untuk mendapatkan token JWT.'
            : 'Buat akun baru lalu otomatis login.'}
        </p>
      </header>

      <div className="field-card p-5 bg-white flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">{mode === 'login' ? 'Login' : 'Register'}</p>
          <button
            type="button"
            className="text-xs text-primary underline"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Daftar baru' : 'Sudah punya akun?'}
          </button>
        </div>

        <div className="grid gap-3">
          <div>
            <label className="text-xs font-semibold text-ink/70">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/70">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Minimal 6 karakter"
            />
          </div>
        </div>

        <button
          type="button"
          className="button-primary w-full"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Daftar & Masuk'}
        </button>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
