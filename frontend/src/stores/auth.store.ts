'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser, LoginResponse } from '@/types/auth';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (session: LoginResponse) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  // Unlike updateUser (which only merges into an *existing* user), this sets
  // one from scratch — used to self-heal when the client-side store has no
  // user (e.g. localStorage was cleared) but the httpOnly session cookie is
  // still valid, by re-fetching GET /users/me. See (dashboard)/layout.tsx.
  setUser: (user: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setSession: (session) => {
        set({ user: session.user, isAuthenticated: true });
      },
      updateUser: (patch) => {
        set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user }));
      },
      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },
      clearSession: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'clinic-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
