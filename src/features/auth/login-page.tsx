import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Hotel, LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { authApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { queryClient } from '../../lib/query-client';
import { useAuthStore } from '../../store/auth.store';

const schema = z.object({
  username: z.string().min(1, 'Ingresa tu usuario'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

type LoginValues = z.infer<typeof schema>;

export function LoginPage() {
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const form = useForm<LoginValues>({ resolver: zodResolver(schema) });
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.clear();
      setSession(data.accessToken, data.user);
      toast.success('Bienvenido a Iguazú');
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <main className="grid min-h-svh bg-[#10231f] p-4 md:grid-cols-[1fr_440px] md:p-8">
      <section className="hidden min-h-full flex-col justify-between rounded-lg bg-[linear-gradient(135deg,#0f766e,#10231f_48%,#f59e0b)] p-10 text-white md:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-white/95 text-[#10231f]">
            <Hotel className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xl font-semibold">Iguazú</p>
            <p className="text-sm text-white/75">Gestión hotelera</p>
          </div>
        </div>
        <div className="max-w-xl">
          <h1 className="text-5xl font-semibold tracking-normal">Recepción rápida, caja clara.</h1>
          <p className="mt-4 text-lg text-white/80">Habitaciones, estadías, ventas e inventario en una sola operación.</p>
        </div>
      </section>

      <section className="grid place-items-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="mb-6">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-primary text-white md:hidden">
                <Hotel className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-semibold tracking-normal">Iniciar sesión</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sistema hotelero Iguazú</p>
            </div>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => login.mutate(values))}>
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input id="username" autoComplete="username" {...form.register('username')} />
                <FieldError message={form.formState.errors.username?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
                <FieldError message={form.formState.errors.password?.message} />
              </div>
              <Button className="w-full" disabled={login.isPending}>
                <LogIn className="h-4 w-4" />
                {login.isPending ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-700">{message}</p>;
}
