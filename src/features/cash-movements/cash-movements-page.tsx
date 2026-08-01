import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CalendarClock,
  Pencil,
  Moon,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Sun,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { useAuthStore } from '../../store/auth.store';
import type { AnyRow } from '../../types';
import { modules } from '../module-config';
import { normalizeRows, saveResource } from '../shared/resource-save';

type WorkShift = 'DAY' | 'NIGHT';

const cashMovementConfig = modules.cashMovements;
const cashIncomeConfig = {
  ...cashMovementConfig,
  createPath: 'cash-movements/income',
  createLabel: 'Registrar ingreso',
  description: 'Ingreso manual a la caja actual.',
  fields: cashMovementConfig.fields.map((field) =>
    field.name === 'category'
      ? {
          ...field,
          label: 'Tipo de ingreso',
          options: [{ label: 'Ingreso de dinero', value: 'CASH_ADJUSTMENT' }],
        }
        : field.name === 'cashShiftId'
        ? {
            ...field,
            label: 'Caja',
            endpoint: 'cash-shift/history',
            helper: 'Como ADMIN puedes registrar ingresos en cajas abiertas o cerradas.',
          }
        : field,
  ),
};
const correctionSchema = z.object({
  reason: z.string().min(1, 'Requerido'),
}).passthrough();
const openingCorrectionSchema = z.object({
  openingAmount: z.coerce.number({ error: 'Número inválido' }).min(0, 'Debe ser mayor o igual a cero'),
  reason: z.string().min(1, 'Requerido'),
}).passthrough();
const reverseFields = [{ name: 'reason', label: 'Motivo', type: 'textarea' as const }];
const openingCorrectionFields = [
  { name: 'openingAmount', label: 'Monto inicial correcto', type: 'number' as const, step: '0.01' },
  { name: 'reason', label: 'Motivo', type: 'textarea' as const },
];

export function CashMovementsPage() {
  const [open, setOpen] = useState(false);
  const [movementForm, setMovementForm] = useState<'income' | 'expense'>('expense');
  const [reverseMovement, setReverseMovement] = useState<AnyRow | null>(null);
  const [openingDialog, setOpeningDialog] = useState(false);
  const [cashShiftId, setCashShiftId] = useState('');
  const [openedDate, setOpenedDate] = useState('');
  const [search, setSearch] = useState('');
  const [showCorrections, setShowCorrections] = useState(false);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const formConfig = movementForm === 'income' ? cashIncomeConfig : cashMovementConfig;

  const movementsQuery = useQuery({
    queryKey: ['cash-movements', cashShiftId],
    queryFn: () => resourceApi.list(`cash-movements/by-shift/${cashShiftId}`),
    enabled: Boolean(cashShiftId),
  });
  const cashShiftsQuery = useQuery({
    queryKey: ['cash-shifts', 'history', openedDate],
    queryFn: () => resourceApi.list(`cash-shift/history?openedDate=${openedDate}`),
    enabled: Boolean(openedDate),
  });

  const movements = useMemo(() => normalizeRows(movementsQuery.data), [movementsQuery.data]);
  const cashShifts = useMemo(() => normalizeRows(cashShiftsQuery.data), [cashShiftsQuery.data]);
  const selectedShift = useMemo(
    () => cashShifts.find((shift) => String(shift.id) === cashShiftId),
    [cashShifts, cashShiftId],
  );
  const reversedMovementIds = useMemo(
    () =>
      new Set(
        movements
          .filter((movement) => movement.referenceType === 'MANUAL_REVERSAL')
          .map((movement) => String(movement.referenceId)),
      ),
    [movements],
  );
  const correctionCount = useMemo(
    () =>
      movements.filter((movement) =>
        isCorrectionMovement(movement, reversedMovementIds),
      ).length,
    [movements, reversedMovementIds],
  );
  const visibleCashShifts = useMemo(
    () =>
      cashShifts.filter(
        (shift) => !openedDate || dateInputValue(new Date(String(shift.openedAt ?? ''))) === openedDate,
      ),
    [cashShifts, openedDate],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return movements.filter((movement) => {
      if (!showCorrections && isCorrectionMovement(movement, reversedMovementIds)) {
        return false;
      }
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
        (!term || haystack.includes(term))
      );
    });
  }, [movements, reversedMovementIds, search, showCorrections]);

  const totals = useMemo(() => {
    const opening = Number(selectedShift?.openingAmount ?? 0);
    const income = filtered
      .filter((movement) => movement.type === 'INCOME')
      .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
    const expense = filtered
      .filter((movement) => movement.type === 'EXPENSE')
      .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
    const cashIncome = filtered
      .filter((movement) => movement.type === 'INCOME' && movement.paymentMethod === 'CASH')
      .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
    const cashExpense = filtered
      .filter((movement) => movement.type === 'EXPENSE' && movement.paymentMethod === 'CASH')
      .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
    return {
      income,
      expense,
      cashBalance: opening + cashIncome - cashExpense,
      expectedTotal: opening + income - expense,
    };
  }, [filtered, selectedShift?.openingAmount]);

  const save = useMutation({
    mutationFn: (values: Record<string, unknown>) => saveResource(formConfig, values),
    onSuccess: () => {
      toast.success(movementForm === 'income' ? 'Ingreso registrado' : 'Salida registrada');
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const reverse = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      resourceApi.post(`cash-movements/${String(reverseMovement?.id)}/reverse`, {
        reason: values.reason,
      }),
    onSuccess: () => {
      toast.success('Movimiento reversado');
      setReverseMovement(null);
      void queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const correctOpening = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      resourceApi.update(`cash-shift/${cashShiftId}/opening-amount`, {
        openingAmount: values.openingAmount,
        reason: values.reason,
      }),
    onSuccess: () => {
      toast.success('Monto inicial corregido');
      setOpeningDialog(false);
      void queryClient.invalidateQueries({ queryKey: ['cash-shifts'] });
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setMovementForm('income');
              setOpen(true);
            }}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Registrar ingreso
          </Button>
          <Button
            onClick={() => {
              setMovementForm('expense');
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Registrar salida
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Summary label="Entrada" value={Number(selectedShift?.openingAmount ?? 0)} icon={<Banknote className="h-5 w-5 text-primary" />} />
        <Summary label={showCorrections ? 'Ingresos' : 'Ingresos reales'} value={totals.income} icon={<ArrowUpCircle className="h-5 w-5 text-emerald-600" />} />
        <Summary label={showCorrections ? 'Egresos' : 'Egresos reales'} value={totals.expense} icon={<ArrowDownCircle className="h-5 w-5 text-red-600" />} />
        <Summary label="Sencillo esperado" value={totals.cashBalance} icon={<Banknote className="h-5 w-5 text-primary" />} />
        <Summary label="Esperado general" value={totals.expectedTotal} icon={<ReceiptText className="h-5 w-5 text-sky-600" />} />
      </div>

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_160px_minmax(280px,420px)_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar producto, cliente, usuario..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Input
            type="date"
            value={openedDate}
            onChange={(event) => {
              setOpenedDate(event.target.value);
              setCashShiftId('');
            }}
          />
          <Select value={cashShiftId} onChange={(event) => setCashShiftId(event.target.value)}>
            <option value="">Selecciona una caja</option>
            {visibleCashShifts.map((shift) => (
              <option key={String(shift.id)} value={String(shift.id)}>
                Caja #{String(shift.id)} - {employeeName(shift.openedBy as AnyRow | undefined)} - {dateTime(shift.openedAt)} - {shiftLabel(cashShiftWorkShift({ cashShift: shift }))}
              </option>
            ))}
          </Select>
          {correctionCount > 0 ? (
            <Button
              variant={showCorrections ? 'secondary' : 'outline'}
              onClick={() => setShowCorrections((value) => !value)}
            >
              <RotateCcw className="h-4 w-4" />
              {showCorrections ? 'Ocultar anulados' : `Ver anulados (${correctionCount})`}
            </Button>
          ) : null}
          {user?.role === 'ADMIN' && selectedShift ? (
            <Button variant="outline" onClick={() => setOpeningDialog(true)}>
              <Pencil className="h-4 w-4" />
              Corregir entrada
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {!cashShiftId ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Selecciona una fecha y luego una caja para ver sus movimientos.
        </div>
      ) : movementsQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando movimientos...</p>
      ) : movementsQuery.isError ? (
        <Card>
          <CardContent>
            <p className="text-sm text-red-700">{errorMessage(movementsQuery.error)}</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {correctionCount > 0 && !showCorrections ? 'No hay movimientos reales con esos filtros.' : 'No hay movimientos con esos filtros.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((movement) => (
            <MovementCard
              key={String(movement.id)}
              movement={movement}
              reversed={reversedMovementIds.has(String(movement.id))}
              onReverse={
                user?.role === 'ADMIN' && movement.referenceType === 'MANUAL' && !reversedMovementIds.has(String(movement.id))
                  ? () => setReverseMovement(movement)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <ResourceFormDialog
        open={open}
        title={formConfig.createLabel ?? 'Registrar movimiento'}
        description={formConfig.description}
        fields={formConfig.fields}
        schema={formConfig.schema}
        saving={save.isPending}
        initialValue={cashShiftId ? { cashShiftId } : null}
        onOpenChange={setOpen}
        onSubmit={(values) => save.mutate(values)}
      />
      <ResourceFormDialog
        open={Boolean(reverseMovement)}
        title="Reversar movimiento"
        description="Se creará el movimiento opuesto en la misma caja."
        fields={reverseFields}
        schema={correctionSchema}
        saving={reverse.isPending}
        onOpenChange={(value) => !value && setReverseMovement(null)}
        onSubmit={(values) => reverse.mutate(values)}
      />
      <ResourceFormDialog
        open={openingDialog}
        title="Corregir entrada de caja"
        description="Actualiza el monto inicial del turno con auditoría."
        fields={openingCorrectionFields}
        schema={openingCorrectionSchema}
        initialValue={{
          openingAmount: selectedShift?.openingAmount ?? '',
          reason: '',
        }}
        saving={correctOpening.isPending}
        onOpenChange={setOpeningDialog}
        onSubmit={(values) => correctOpening.mutate(values)}
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

function MovementCard({ movement, reversed, onReverse }: { movement: AnyRow; reversed?: boolean; onReverse?: () => void }) {
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
        {(reversed || onReverse) && (
          <div className="flex justify-end border-t border-border pt-3">
            {reversed ? (
              <Badge tone="slate">Reversado</Badge>
            ) : (
              <Button variant="outline" size="sm" onClick={onReverse}>
                <RotateCcw className="h-4 w-4" />
                Reversar
              </Button>
            )}
          </div>
        )}

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

function dateInputValue(date: Date) {
  if (!Number.isFinite(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
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

function isCorrectionMovement(movement: AnyRow, reversedMovementIds: Set<string>) {
  return movement.referenceType === 'MANUAL_REVERSAL' || reversedMovementIds.has(String(movement.id));
}
