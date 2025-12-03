const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export interface AuthResponse {
  accessToken: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error('Login gagal, periksa email/password');
  }

  return (await res.json()) as AuthResponse;
}

export async function register(email: string, password: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error('Registrasi gagal, gunakan email lain atau cek password');
  }
}

export function getAuthHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
