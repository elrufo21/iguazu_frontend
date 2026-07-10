import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Select } from '../../components/ui/select';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';

type EditableRole = 'RECEPTIONIST' | 'CASHIER';

const roles: { value: EditableRole; label: string }[] = [
  { value: 'RECEPTIONIST', label: 'Recepción' },
  { value: 'CASHIER', label: 'Caja' },
];

const moduleLabels: Record<string, string> = {
  audit: 'Auditoría',
  attendance: 'Asistencia',
  'cash-closures': 'Cierres de caja',
  'cash-movements': 'Movimientos de caja',
  'cash-shift': 'Caja',
  customers: 'Clientes',
  employees: 'Empleados',
  inventory: 'Stock',
  'price-types': 'Tipos de precio',
  products: 'Productos',
  reservations: 'Reservas',
  rooms: 'Habitaciones',
  'room-types': 'Tipos de habitación',
  'room-type-prices': 'Tarifas',
  sales: 'Ventas',
  stays: 'Estadías',
  'staff-advances': 'Adelantos',
  'staff-discounts': 'Descuentos',
  'staff-payments': 'Pagos de personal',
  users: 'Usuarios',
};

export function PermissionsPage() {
  const [role, setRole] = useState<EditableRole>('RECEPTIONIST');
  const [selected, setSelected] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const available = useQuery({
    queryKey: ['permissions', 'available'],
    queryFn: () => resourceApi.list('permissions/available') as Promise<string[]>,
  });

  const rolePermissions = useQuery({
    queryKey: ['permissions', role],
    queryFn: () => resourceApi.list(`permissions/${role}`) as Promise<string[]>,
  });

  useEffect(() => {
    setSelected(rolePermissions.data ?? []);
  }, [rolePermissions.data]);

  const groups = useMemo(() => {
    const byModule = new Map<string, string[]>();
    for (const permission of available.data ?? []) {
      const module = permission.split(' /')[1]?.split('/')[0] ?? 'otros';
      byModule.set(module, [...(byModule.get(module) ?? []), permission]);
    }
    return [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [available.data]);

  const save = useMutation({
    mutationFn: () => resourceApi.put(`permissions/${role}`, { permissions: selected }),
    onSuccess: () => {
      toast.success('Permisos guardados');
      void queryClient.invalidateQueries({ queryKey: ['permissions', role] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = (permission: string) => {
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  };

  const toggleGroup = (permissions: string[]) => {
    const allSelected = permissions.every((permission) => selected.includes(permission));
    setSelected((current) =>
      allSelected
        ? current.filter((permission) => !permissions.includes(permission))
        : Array.from(new Set([...current, ...permissions])),
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Permisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configura qué puede abrir y ejecutar cada rol.</p>
        </div>
        <div className="flex flex-col gap-2 sm:w-72">
          <Select value={role} onChange={(event) => setRole(event.target.value as EditableRole)}>
            {roles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Button onClick={() => save.mutate()} disabled={save.isPending || available.isLoading || rolePermissions.isLoading}>
            <Save className="h-4 w-4" />
            Guardar permisos
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              {selected.length} activos
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setSelected(available.data ?? [])}>
              Marcar todo
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelected([])}>
              Limpiar
            </Button>
          </div>

          {(available.isError || rolePermissions.isError) && (
            <p className="text-sm text-red-700">
              {errorMessage(available.error ?? rolePermissions.error)}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map(([module, permissions]) => (
              <div key={module} className="rounded-md border border-border p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{moduleLabels[module] ?? module}</h2>
                  <Button variant="outline" size="sm" onClick={() => toggleGroup(permissions)}>
                    {permissions.every((permission) => selected.includes(permission)) ? 'Quitar' : 'Marcar'}
                  </Button>
                </div>
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <label key={permission} className="flex min-h-9 items-center gap-3 rounded-md px-2 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={selected.includes(permission)}
                        onChange={() => toggle(permission)}
                      />
                      <span className="break-all">{permission}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
