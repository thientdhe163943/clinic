'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/endpoints/auth';
import { getRoleHome } from '@/lib/auth/routes';
import { useAuthStore } from '@/stores/auth.store';
import { LoginRequest, RegisterRequest } from '@/types/auth';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setSession, clearSession } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (input: LoginRequest) => authApi.login(input),
    onSuccess: (session) => {
      setSession(session);
      // A1.A5: accounts created by an admin must change their password before
      // accessing any other page.
      if (session.mustChangePassword) {
        router.replace('/change-password');
        return;
      }
      router.replace(getRoleHome(session.user.role));
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterRequest) => authApi.register(input),
    onSuccess: (session) => {
      setSession(session);
      router.replace(getRoleHome(session.user.role));
    },
  });

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: still clear the local session even if the server call fails.
    }

    clearSession();
    router.replace('/login');
  };

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutateAsync,
    loginStatus: loginMutation.status,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    registerStatus: registerMutation.status,
    registerError: registerMutation.error,
    logout,
  };
}
