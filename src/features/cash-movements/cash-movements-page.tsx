import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CalendarClock,
  Moon,
  Plus,
  ReceiptText,
  Search,
  Sun,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ResourceFormDialog } from '../../components/forms/resource-form-dialog';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { dateTime, getValue, money, productTitle, valueLabel } from '../../lib/utils';
import type { AnyRow } from '../../types';
import { modules } from '../module-config';
import { normalizeRows, saveResource } from '../shared/resource-save';

type WorkShift = 'DAY' | 'NIGHT';

const cashMovementConfig = modules.cashMovements;

export function CashMovementsPage() {
  const [open, setOpen] = useState(false);
  const [cashShiftId, setCashShiftId] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const movementsQuery = useQuery({
    queryKey: ['cash-movements'],
    queryFn: () => resourceApi.list('cash-movements'),
  });

  const movements = useMemo(() => normalizeRows(movementsQuery.data), [movementsQuery.data]);
  const cashShifts = useMemo(() => uniqueBy(movements.map((movement) => movement.cashShift as AnyRow | undefined).filter(Boolean) as AnyRow[], 'id'), [movements]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return movements.filter((movement) => {
      const sale = movementSale(movement);
      const detailText = saleDetails(sale).map((detail) => String(detail.description ?? '')).join(' ');
      const haystack = [
        movement.description,
        movement.category,
        movement.paymentMethod,
        employeeName(movement.user as AnyRow | undefined),
        getValue(sale ?? {}, 'customer.fullName'),
        getValue(sale ?? {}, 'stay.room.roomNumber'),
        detailText,
      ]
        .join(' ')
        .toLowerCase();

      return (
        (!cashShiftId || String(movement.cashShiftId) === cashShiftId) &&
        (!term || haystack.includes(term))
      );
    });
  }, [movements, cashShiftId, search]);

  const totals = useMemo(() => {
    const income = filtered
      .filter((movement) => movement.type === 'INCOME')
      .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
    const expense = filtered
      .filter((movement) => movement.type === 'EXPENSE')
      .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const save = useMutation({
    mutationFn: (values: Record<string, unknown>) => saveResource(cashMovementConfig, values),
    onSuccess: () => {
      toast.success('Salida registrada');
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Movimientos de caja</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingresos, salidas y detalle de lo vendido por caja.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar salida
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Summary label="Ingresos" value={totals.income} icon={<ArrowUpCircle className="h-5 w-5 text-emerald-600" />} />
        <Summary label="Egresos" value={totals.expense} icon={<ArrowDownCircle className="h-5 w-5 text-red-600" />} />
        <Summary label="Neto" value={totals.net} icon={<Banknote className="h-5 w-5 text-primary" />} />
        <Summary label="Movimientos" text={String(filtered.length)} icon={<ReceiptText className="h-5 w-5 text-sky-600" />} />
      </div>

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_360px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar producto, cliente, usuario..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={cashShiftId} onChange={(event) => setCashShiftId(event.target.value)}>
            <option value="">Todas las cajas</option>
            {cashShifts.map((shift) => (
              <option key={String(shift.id)} value={String(shift.id)}>
                Caja #{String(shift.id)} - {employeeName(shift.openedBy as AnyRow | undefined)} - {dateTime(shift.openedAt)} - {shiftLabel(cashShiftWorkShift({ cashShift: shift }))}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {movementsQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando movimientos...</p>
      ) : movementsQuery.isError ? (
        <Card>
          <CardContent>
            <p className="text-sm text-red-700">{errorMessage(movementsQuery.error)}</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No hay movimientos con esos filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((movement) => (
            <MovementCard key={String(movement.id)} movement={movement} />
          ))}
        </div>
      )}

      <ResourceFormDialog
        open={open}
        title={cashMovementConfig.createLabel ?? 'Registrar salida'}
        description={cashMovementConfig.description}
        fields={cashMovementConfig.fields}
        schema={cashMovementConfig.schema}
        saving={save.isPending}
        onOpenChange={setOpen}
        onSubmit={(values) => save.mutate(values)}
      />
    </section>
  );
}

function Summary({ label, value, text, icon }: { label: string; value?: number; text?: string; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{text ?? money(value ?? 0)}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function MovementCard({ movement }: { movement: AnyRow }) {
  const sale = movementSale(movement);
  const details = saleDetails(sale);
  const shift = cashShiftWorkShift(movement);
  const isIncome = movement.type === 'INCOME';
  const roomNumber = getValue(sale ?? {}, 'stay.room.roomNumber');
  const employee = relatedEmployee(movement);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={movement.type} />
              <StatusBadge value={movement.category} />
              <StatusBadge value={movement.paymentMethod} />
              <Badge tone={shift === 'DAY' ? 'blue' : 'slate'}>
                {shift === 'DAY' ? <Sun className="mr-1 h-3 w-3" /> : <Moon className="mr-1 h-3 w-3" />}
                {shiftLabel(shift)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {String(movement.description ?? valueLabel(movement.category))}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {employeeName(movement.user as AnyRow | undefined)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" />
                Caja #{String(movement.cashShiftId)}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {dateTime(movement.occurredAt)}
              </span>
            </div>
          </div>
          <p className={`text-2xl font-bold ${isIncome ? 'text-emerald-700' : 'text-red-700'}`}>
            {isIncome ? '+' : '-'}{money(movement.amount)}
          </p>
        </div>

        {sale && (
          <div className="border-t border-border pt-3">
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Venta #{String(sale.id)}</span>
              <span>{String(getValue(sale, 'customer.fullName') ?? 'Consumidor final')}</span>
              {roomNumber ? <span>Hab. {String(roomNumber)}</span> : null}
            </div>
            <div className="space-y-1.5">
              {details.map((detail) => (
                <div key={String(detail.id)} className="grid grid-cols-[1fr_auto] gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {String(detail.quantity)} x {detailTitle(detail)}
                  </span>
                  <span className="font-medium">{money(detail.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!sale && employee ? (
          <div className="border-t border-border pt-3 text-sm text-muted-foreground">
            Relacionado con {String(employee)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function movementSale(movement: AnyRow) {
  return (getValue(movement, 'salePayment.sale') as AnyRow | undefined) ?? (movement.referenceSale as AnyRow | undefined);
}

function saleDetails(sale?: AnyRow) {
  return ((sale?.details as AnyRow[] | undefined) ?? []);
}

function detailTitle(detail: AnyRow) {
  const product = detail.product as AnyRow | undefined;
  return product ? productTitle(product, String(detail.description ?? 'Item')) : String(detail.description ?? 'Item');
}

function cashShiftWorkShift(movement: AnyRow): WorkShift {
  const date = cashShiftOpenedAt(movement);
  const hour = Number.isFinite(date.getTime()) ? date.getHours() : 0;
  return hour >= 15 || hour < 6 ? 'NIGHT' : 'DAY';
}

function cashShiftOpenedAt(movement: AnyRow) {
  const value = getValue(movement, 'cashShift.openedAt') ?? movement.occurredAt ?? movement.createdAt;
  return new Date(String(value ?? ''));
}

function shiftLabel(shift: string) {
  return shift === 'DAY' ? 'Turno día' : 'Turno noche';
}

function employeeName(row?: AnyRow) {
  return String(getValue(row ?? {}, 'employee.fullName') ?? row?.username ?? 'Usuario');
}

function relatedEmployee(movement: AnyRow) {
  return (
    getValue(movement, 'staffPayment.employee.fullName') ??
    getValue(movement, 'staffAdvance.employee.fullName') ??
    getValue(movement, 'staffDiscount.employee.fullName')
  );
}

function uniqueBy(rows: AnyRow[], key: string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = String(row[key] ?? '');
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
