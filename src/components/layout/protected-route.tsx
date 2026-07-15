import { useQuery } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);

  const me = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: authApi.me,
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (token && me.data) setUser(me.data);
  }, [me.data, setUser, token]);

  if (!token) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
