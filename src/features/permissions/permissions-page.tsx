import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  BedDouble,
  Boxes,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Hotel,
  Package,
  Receipt,
  Save,
  ShieldAlert,
  ShieldCheck,
  Tags,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
  type LucideIcon,
} from 'lucide-react';
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

// ============================================================
// Traducción de cada permiso a una etiqueta humana.
// Estructura: { 'METODO /ruta': { label, group, icon } }
// ============================================================
type PermMeta = { label: string; group: string; icon: LucideIcon; description?: string };

const PERM_META: Record<string, PermMeta> = {
  // Habitaciones
  'POST /rooms': { label: 'Crear habitación', group: 'Habitaciones', icon: BedDouble },
  'GET /rooms': { label: 'Ver habitaciones', group: 'Habitaciones', icon: BedDouble },
  'GET /rooms/:id': { label: 'Ver detalle de habitación', group: 'Habitaciones', icon: BedDouble },
  'GET /rooms/:id/products': { label: 'Ver minibar de habitación', group: 'Habitaciones', icon: BedDouble },
  'PATCH /rooms/:id': { label: 'Editar habitación', group: 'Habitaciones', icon: BedDouble },
  'PATCH /rooms/:id/products': { label: 'Asignar productos a habitación', group: 'Habitaciones', icon: BedDouble },
  'PATCH /rooms/:id/toggle-active': { label: 'Activar/desactivar habitación', group: 'Habitaciones', icon: BedDouble },

  // Tipos de habitación
  'POST /room-types': { label: 'Crear tipo de habitación', group: 'Tipos de habitación', icon: BedDouble },
  'GET /room-types': { label: 'Ver tipos de habitación', group: 'Tipos de habitación', icon: BedDouble },
  'GET /room-types/:id': { label: 'Ver tipo de habitación', group: 'Tipos de habitación', icon: BedDouble },
  'PATCH /room-types/:id': { label: 'Editar tipo de habitación', group: 'Tipos de habitación', icon: BedDouble },
  'PATCH /room-types/:id/toggle-active': { label: 'Activar/desactivar tipo de habitación', group: 'Tipos de habitación', icon: BedDouble },

  // Tipos de precio
  'POST /price-types': { label: 'Crear tipo de precio', group: 'Tipos de precio', icon: Tags },
  'GET /price-types': { label: 'Ver tipos de precio', group: 'Tipos de precio', icon: Tags },
  'GET /price-types/:id': { label: 'Ver tipo de precio', group: 'Tipos de precio', icon: Tags },
  'PATCH /price-types/:id': { label: 'Editar tipo de precio', group: 'Tipos de precio', icon: Tags },
  'PATCH /price-types/:id/toggle-active': { label: 'Activar/desactivar tipo de precio', group: 'Tipos de precio', icon: Tags },

  // Tarifas
  'POST /room-type-prices': { label: 'Crear tarifa', group: 'Tarifas', icon: CreditCard },
  'GET /room-type-prices': { label: 'Ver tarifas', group: 'Tarifas', icon: CreditCard },
  'GET /room-type-prices/:id': { label: 'Ver tarifa', group: 'Tarifas', icon: CreditCard },
  'PATCH /room-type-prices/:id': { label: 'Editar tarifa', group: 'Tarifas', icon: CreditCard },
  'PATCH /room-type-prices/:id/toggle-active': { label: 'Activar/desactivar tarifa', group: 'Tarifas', icon: CreditCard },

  // Clientes
  'POST /customers': { label: 'Crear cliente', group: 'Clientes', icon: Users },
  'GET /customers': { label: 'Ver clientes', group: 'Clientes', icon: Users },
  'GET /customers/:id': { label: 'Ver cliente', group: 'Clientes', icon: Users },
  'GET /customers/by-document': { label: 'Buscar cliente por documento', group: 'Clientes', icon: Users },
  'PATCH /customers/:id': { label: 'Editar cliente', group: 'Clientes', icon: Users },

  // Reservas
  'POST /reservations': { label: 'Crear reserva', group: 'Reservas', icon: CalendarDays },
  'GET /reservations': { label: 'Ver reservas', group: 'Reservas', icon: CalendarDays },
  'GET /reservations/:id': { label: 'Ver reserva', group: 'Reservas', icon: CalendarDays },
  'PATCH /reservations/:id/confirm': { label: 'Confirmar reserva', group: 'Reservas', icon: CalendarDays },
  'PATCH /reservations/:id/cancel': { label: 'Cancelar reserva', group: 'Reservas', icon: CalendarDays },
  'PATCH /reservations/:id/no-show': { label: 'Marcar no-show', group: 'Reservas', icon: CalendarDays },
  'POST /reservations/:id/check-in': { label: 'Check-in desde reserva', group: 'Reservas', icon: CalendarDays },

  // Estadías
  'POST /stays/check-in': { label: 'Hacer check-in', group: 'Estadías', icon: Hotel },
  'PATCH /stays/:id/check-out': { label: 'Hacer check-out (con cobro)', group: 'Estadías', icon: Hotel },
  'GET /stays/active': { label: 'Ver estadías activas', group: 'Estadías', icon: Hotel },
  'GET /stays/history': { label: 'Ver historial de estadías', group: 'Estadías', icon: Hotel },
  'GET /stays/:id': { label: 'Ver estadía', group: 'Estadías', icon: Hotel },

  // Ventas
  'POST /sales': { label: 'Crear venta', group: 'Ventas', icon: Receipt },
  'POST /sales/retroactive': { label: 'Registrar venta en caja cerrada', group: 'Ventas', icon: Receipt },
  'POST /sales/:id/pay': { label: 'Cobrar venta pendiente', group: 'Ventas', icon: Receipt },
  'POST /sales/:id/cancel': { label: 'Anular venta', group: 'Ventas', icon: Receipt },
  'PATCH /sales/:id': { label: 'Editar venta pendiente', group: 'Ventas', icon: Receipt },
  'GET /sales': { label: 'Ver ventas', group: 'Ventas', icon: Receipt },
  'GET /sales/:id': { label: 'Ver venta', group: 'Ventas', icon: Receipt },
  'GET /sales/by-shift/:cashShiftId': { label: 'Ver ventas por turno', group: 'Ventas', icon: Receipt },
  'GET /sales/by-stay/:stayId': { label: 'Ver ventas por estadía', group: 'Ventas', icon: Receipt },
  'GET /sales/pending/by-stay/:stayId': { label: 'Ver cargos pendientes', group: 'Ventas', icon: Receipt },
  'GET /sales/account/by-stay/:stayId': { label: 'Ver cuenta de habitación', group: 'Ventas', icon: Receipt },

  // Productos
  'POST /products': { label: 'Crear producto', group: 'Productos', icon: Package },
  'GET /products': { label: 'Ver productos', group: 'Productos', icon: Package },
  'GET /products/:id': { label: 'Ver producto', group: 'Productos', icon: Package },
  'PATCH /products/:id': { label: 'Editar producto', group: 'Productos', icon: Package },
  'PATCH /products/:id/toggle-active': { label: 'Activar/desactivar producto', group: 'Productos', icon: Package },

  // Inventario
  'POST /inventory/in': { label: 'Ingreso de stock', group: 'Inventario', icon: Boxes },
  'POST /inventory/out': { label: 'Salida de stock', group: 'Inventario', icon: Boxes },
  'POST /inventory/loss': { label: 'Registrar pérdida', group: 'Inventario', icon: Boxes },
  'POST /inventory/adjust': { label: 'Ajustar stock', group: 'Inventario', icon: Boxes },
  'GET /inventory/movements': {
    label: 'Ver historial de stock',
    group: 'Inventario',
    icon: Boxes,
    description: 'Lista entradas, salidas, ajustes y pérdidas de inventario.',
  },
  'GET /inventory/movements/product/:productId': {
    label: 'Ver historial de un producto',
    group: 'Inventario',
    icon: Boxes,
    description: 'Consulta movimientos filtrados por producto.',
  },

  // Caja
  'POST /cash-shift/open': { label: 'Abrir caja', group: 'Caja', icon: WalletCards },
  'GET /cash-shift/open': { label: 'Ver caja abierta', group: 'Caja', icon: WalletCards },
  'GET /cash-shift/history': { label: 'Ver historial de cajas', group: 'Caja', icon: WalletCards },
  'GET /cash-shift/:id': { label: 'Ver caja', group: 'Caja', icon: WalletCards },

  // Movimientos de caja
  'GET /cash-movements': {
    label: 'Ver lista de movimientos',
    group: 'Movimientos de caja',
    icon: Banknote,
    description: 'Muestra la pantalla de movimientos. Usuarios ven solo sus cajas; ADMIN ve todo.',
  },
  'GET /cash-movements/:id': {
    label: 'Ver detalle de movimiento',
    group: 'Movimientos de caja',
    icon: Banknote,
    description: 'Permite consultar un movimiento específico.',
  },
  'GET /cash-movements/by-shift/:cashShiftId': {
    label: 'Ver movimientos de una caja',
    group: 'Movimientos de caja',
    icon: Banknote,
    description: 'Permite consultar movimientos filtrados por caja/turno.',
  },
  'POST /cash-movements/expense': {
    label: 'Registrar salida de dinero',
    group: 'Movimientos de caja',
    icon: Banknote,
    description: 'Permite registrar egresos como retiro, compra o ajuste.',
  },
  'POST /cash-movements/:id/reverse': {
    label: 'Revertir movimiento',
    group: 'Movimientos de caja',
    icon: Banknote,
    description: 'Crea un movimiento contrario para corregir uno ya registrado.',
  },

  // Cierres de caja
  'POST /cash-closures/close': { label: 'Cerrar caja (arqueo)', group: 'Cierres de caja', icon: CreditCard },
  'GET /cash-closures/preview': { label: 'Ver resumen antes de cerrar', group: 'Cierres de caja', icon: CreditCard },
  'GET /cash-closures': { label: 'Ver cierres', group: 'Cierres de caja', icon: CreditCard },
  'GET /cash-closures/:id': { label: 'Ver cierre', group: 'Cierres de caja', icon: CreditCard },
  'POST /cash-closures/:id/reopen': { label: 'Reabrir caja (solo ADMIN)', group: 'Cierres de caja', icon: CreditCard },
  'PATCH /cash-closures/:id/counts': { label: 'Corregir conteo de cierre (solo ADMIN)', group: 'Cierres de caja', icon: CreditCard },
  'POST /cash-closures/:id/settle': { label: 'Cuadrar diferencia', group: 'Cierres de caja', icon: CreditCard },
  'POST /cash-closures/:id/sale-edits/:auditLogId/penalty': { label: 'Descontar edición post cierre', group: 'Cierres de caja', icon: CreditCard },
  'POST /cash-closures/:id/sale-edits/:auditLogId/loss': { label: 'Aceptar edición post cierre', group: 'Cierres de caja', icon: CreditCard },

  // Comprobantes / Facturación
  'POST /billing/issue-from-sale/:saleId': { label: 'Emitir comprobante', group: 'Comprobantes', icon: FileText },
  'POST /billing/:id/credit-note': { label: 'Emitir nota de crédito', group: 'Comprobantes', icon: FileText },
  'GET /billing': { label: 'Ver comprobantes', group: 'Comprobantes', icon: FileText },
  'GET /billing/:id': { label: 'Ver comprobante', group: 'Comprobantes', icon: FileText },
  'GET /billing/:id/pdf': { label: 'Descargar PDF', group: 'Comprobantes', icon: FileText },

  // Personal - Adelantos
  'POST /staff-advances': { label: 'Solicitar adelanto', group: 'Adelantos', icon: Banknote },
  'POST /staff-advances/:id/approve': { label: 'Aprobar adelanto', group: 'Adelantos', icon: Banknote },
  'POST /staff-advances/:id/reject': { label: 'Rechazar adelanto', group: 'Adelantos', icon: Banknote },
  'GET /staff-advances': { label: 'Ver adelantos', group: 'Adelantos', icon: Banknote },

  // Personal - Pagos
  'POST /staff-payments': { label: 'Registrar pago', group: 'Pagos de personal', icon: Banknote },
  'GET /staff-payments': { label: 'Ver pagos', group: 'Pagos de personal', icon: Banknote },

  // Personal - Descuentos
  'POST /staff-discounts': { label: 'Registrar descuento por pérdida', group: 'Descuentos', icon: Tags },
  'GET /staff-discounts': { label: 'Ver descuentos', group: 'Descuentos', icon: Tags },

  // Personal - Penalidades
  'POST /penalties': { label: 'Crear penalidad', group: 'Penalidades', icon: ShieldAlert },
  'GET /penalties': { label: 'Ver penalidades', group: 'Penalidades', icon: ShieldAlert },
  'GET /penalties/employee/:employeeId': { label: 'Ver penalidades por empleado', group: 'Penalidades', icon: ShieldAlert },
  'POST /penalties/:id/void': { label: 'Anular penalidad', group: 'Penalidades', icon: ShieldAlert },

  // Personal - Asistencia
  'POST /attendance': { label: 'Registrar asistencia', group: 'Asistencia', icon: ClipboardList },
  'PATCH /attendance/:id/check-in': { label: 'Marcar entrada', group: 'Asistencia', icon: ClipboardList },
  'PATCH /attendance/:id/check-out': { label: 'Marcar salida', group: 'Asistencia', icon: ClipboardList },
  'GET /attendance/employee/:employeeId': { label: 'Ver asistencia por empleado', group: 'Asistencia', icon: ClipboardList },
  'GET /attendance/range': { label: 'Ver asistencia por rango', group: 'Asistencia', icon: ClipboardList },

  // Empleados
  'POST /employees': { label: 'Crear empleado', group: 'Empleados', icon: Users },
  'GET /employees': { label: 'Ver empleados', group: 'Empleados', icon: Users },
  'GET /employees/:id': { label: 'Ver empleado', group: 'Empleados', icon: Users },
  'PATCH /employees/:id': { label: 'Editar empleado', group: 'Empleados', icon: Users },
  'PATCH /employees/:id/deactivate': { label: 'Desactivar empleado', group: 'Empleados', icon: Users },

  // Usuarios
  'POST /users': { label: 'Crear usuario', group: 'Usuarios', icon: Users },
  'GET /users': { label: 'Ver usuarios', group: 'Usuarios', icon: Users },
  'GET /users/:id': { label: 'Ver usuario', group: 'Usuarios', icon: Users },
  'PATCH /users/:id': { label: 'Editar usuario', group: 'Usuarios', icon: Users },
  'PATCH /users/:id/toggle-active': { label: 'Activar/desactivar usuario', group: 'Usuarios', icon: Users },

  // Reportes
  'GET /reports/cash-summary': { label: 'Reporte de caja', group: 'Reportes', icon: TrendingUp },
  'GET /reports/sales-summary': { label: 'Reporte de ventas (simple)', group: 'Reportes', icon: TrendingUp },
  'GET /reports/sales-full': { label: 'Reporte de ventas e ingresos', group: 'Reportes', icon: TrendingUp },
  'GET /reports/sales-by-item-type': { label: 'Ventas por tipo de ítem', group: 'Reportes', icon: TrendingUp },
  'GET /reports/product-sales': { label: 'Productos vendidos', group: 'Reportes', icon: TrendingUp },
  'GET /reports/product-sales-by-user': { label: 'Productos por usuario', group: 'Reportes', icon: TrendingUp },
  'GET /reports/occupancy': { label: 'Reporte de ocupación', group: 'Reportes', icon: TrendingUp },
  'GET /reports/inventory': { label: 'Reporte de inventario', group: 'Reportes', icon: TrendingUp },
  'GET /reports/staff': { label: 'Reporte de personal', group: 'Reportes', icon: TrendingUp },
  'GET /reports/audit': { label: 'Reporte de auditoría', group: 'Reportes', icon: TrendingUp },

  // Auditoría
  'GET /audit': { label: 'Ver auditoría', group: 'Auditoría', icon: ClipboardList },
  'GET /audit/:id': { label: 'Ver evento de auditoría', group: 'Auditoría', icon: ClipboardList },
};

const METHOD_TONES: Record<string, 'blue' | 'green' | 'amber'> = {
  GET: 'blue',
  POST: 'green',
  PATCH: 'amber',
  PUT: 'amber',
};

const METHOD_LABELS: Record<string, string> = {
  GET: 'Ver',
  POST: 'Hacer',
  PATCH: 'Editar',
  PUT: 'Editar',
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

  // Agrupar permisos por su grupo humano, preservando orden lógico.
  const groups = useMemo(() => {
    const byGroup = new Map<string, { perm: string; meta: PermMeta }[]>();
    const order = [
      'Habitaciones', 'Tipos de habitación', 'Tipos de precio', 'Tarifas',
      'Clientes', 'Reservas', 'Estadías', 'Ventas', 'Productos', 'Inventario',
      'Caja', 'Movimientos de caja', 'Cierres de caja', 'Comprobantes',
      'Adelantos', 'Pagos de personal', 'Descuentos', 'Penalidades', 'Asistencia',
      'Empleados', 'Usuarios', 'Reportes', 'Auditoría',
    ];
    for (const permission of available.data ?? []) {
      const meta = PERM_META[permission] ?? {
        label: permission,
        group: 'Otros',
        icon: Zap,
      };
      const list = byGroup.get(meta.group) ?? [];
      list.push({ perm: permission, meta });
      byGroup.set(meta.group, list);
    }
    return order
      .filter((g) => byGroup.has(g))
      .map((g) => [g, byGroup.get(g)!] as const)
      .concat(
        [...byGroup.entries()]
          .filter(([g]) => !order.includes(g))
          .map(([g, list]) => [g, list] as const),
      );
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

  const toggleGroup = (perms: string[]) => {
    const allSelected = perms.every((permission) => selected.includes(permission));
    setSelected((current) =>
      allSelected
        ? current.filter((permission) => !perms.includes(permission))
        : Array.from(new Set([...current, ...perms])),
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Permisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurá qué puede ver y hacer cada rol. <strong>ADMIN</strong> siempre tiene acceso a todo.
          </p>
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
              {selected.length} permisos activos
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
            {groups.map(([group, items]) => {
              const perms = items.map((i) => i.perm);
              const allSelected = perms.every((p) => selected.includes(p));
              const Icon = items[0]?.meta.icon ?? Zap;
              return (
                <div key={group} className="rounded-lg border border-border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 font-semibold">
                      <Icon className="h-4 w-4 text-primary" />
                      {group}
                    </h2>
                    <Button variant="outline" size="sm" onClick={() => toggleGroup(perms)}>
                      {allSelected ? 'Quitar todos' : 'Marcar todos'}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {items.map(({ perm, meta }) => {
                      const method = perm.split(' ')[0];
                      const isOn = selected.includes(perm);
                      return (
                        <label
                          key={perm}
                          className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1 text-sm transition hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={isOn}
                            onChange={() => toggle(perm)}
                          />
                          <Badge tone={METHOD_TONES[method] ?? 'slate'} className="shrink-0">
                            {METHOD_LABELS[method] ?? method}
                          </Badge>
                          <span className="flex-1">
                            <span className="block font-medium">{meta.label}</span>
                            {meta.description && (
                              <span className="block text-xs text-muted-foreground">{meta.description}</span>
                            )}
                            <span className="block text-[11px] text-muted-foreground/70">{perm}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
