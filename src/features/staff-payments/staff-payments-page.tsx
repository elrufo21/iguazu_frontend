import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DataTable, type AppColumn } from '../../components/data-table/data-table';
import { CashShiftSelect } from '../../components/cash-shift-select';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { dateTime, money } from '../../lib/utils';
import type { AnyRow } from '../../types';
import { normalizeRows } from '../shared/resource-save';

const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'YAPE', label: 'Yape' },
  { value: 'PLIN', label: 'Plin' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function StaffPaymentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ['staff-payments'],
    queryFn: () => resourceApi.list('staff-payments'),
  });

  const employees = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => resourceApi.list('employees'),
  });

  const rows = normalizeRows(list.data);

  const columns: AppColumn[] = [
    { header: 'Empleado', accessor: 'employee.fullName' },
    { header: 'Bruto', accessor: 'grossAmount', render: (v) => money(Number(v ?? 0)) },
    {
      header: 'Descuentos',
      accessor: 'penaltyAmount',
      render: (v) => {
        const n = Number(v ?? 0);
        return n > 0 ? <Badge tone="amber">{money(n)}</Badge> : <span className="text-muted-foreground">—</span>;
      },
    },
    { header: 'Neto', accessor: 'amount', render: (v) => <span className="font-semibold">{money(Number(v ?? 0))}</span> },
    { header: 'Inicio', accessor: 'periodStart', render: (v) => dateTime(v).split(' ')[0] },
    { header: 'Fin', accessor: 'periodEnd', render: (v) => dateTime(v).split(' ')[0] },
    { header: 'Fecha', accessor: 'createdAt', render: (v) => dateTime(v) },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Pagos de personal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pagos con cálculo de bruto, descuentos y neto por periodo.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo pago
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 md:p-4">
          <DataTable
            data={rows}
            columns={columns}
            loading={list.isLoading}
            error={list.isError ? errorMessage(list.error) : undefined}
          />
        </CardContent>
      </Card>

      <NewPaymentDialog
        open={open}
        onOpenChange={setOpen}
        employees={normalizeRows(employees.data)}
        onCreated={() => {
          setOpen(false);
          void queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
        }}
      />
    </section>
  );
}

function NewPaymentDialog({
  open,
  onOpenChange,
  employees,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: AnyRow[];
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [periodStart, setPeriodStart] = useState(todayStr());
  const [periodEnd, setPeriodEnd] = useState(todayStr());
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashShiftId, setCashShiftId] = useState('');
  const [selectedPenaltyIds, setSelectedPenaltyIds] = useState<number[]>([]);

  const employee = employees.find((e) => Number(e.id) === employeeId) ?? null;

  // Penalidades pendientes del empleado seleccionado.
  const penaltiesQuery = useQuery({
    queryKey: ['penalties', 'employee', employeeId],
    queryFn: () => resourceApi.list(`penalties/employee/${employeeId}`),
    enabled: Boolean(employeeId),
  });
  const pendingPenalties = useMemo(
    () =>
      normalizeRows(penaltiesQuery.data).filter(
        (p) => String(p.status) === 'PENDING',
      ),
    [penaltiesQuery.data],
  );

  useEffect(() => {
    setSelectedPenaltyIds(pendingPenalties.map((p) => Number(p.id)));
  }, [pendingPenalties]);

  // Cálculos en vivo.
  const dailyRate = Number(employee?.dailyRate ?? 0);
  const selectedPenalties = pendingPenalties.filter((p) =>
    selectedPenaltyIds.includes(Number(p.id)),
  );
  const penaltiesTotal = selectedPenalties.reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  );
  const manualGross = amount ? Number(amount) : 0;
  const gross = manualGross || dailyRate;
  const net = Math.max(0, gross - penaltiesTotal);

  const reset = () => {
    setEmployeeId(null);
    setPeriodStart(todayStr());
    setPeriodEnd(todayStr());
    setAmount('');
    setPaymentMethod('CASH');
    setCashShiftId('');
  };

  const create = useMutation({
    mutationFn: () =>
      resourceApi.create('staff-payments', {
        employeeId,
        periodStart,
        periodEnd,
        amount: manualGross || undefined,
        paymentMethod,
        ...(cashShiftId ? { cashShiftId: Number(cashShiftId) } : {}),
        penaltyIds: selectedPenaltyIds,
      }),
    onSuccess: () => {
      toast.success(`Pago registrado. Neto: ${money(net)}`);
      reset();
      onCreated();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const voidPenalty = useMutation({
    mutationFn: (id: number) => resourceApi.post(`penalties/${id}/void`),
    onSuccess: (_data, id) => {
      setSelectedPenaltyIds((ids) => ids.filter((item) => item !== id));
      void queryClient.invalidateQueries({ queryKey: ['penalties', 'employee', employeeId] });
      toast.success('Descuento descartado.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const canSubmit =
    Boolean(employeeId) &&
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    periodStart <= periodEnd &&
    net > 0 &&
    !create.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent className="md:w-[min(560px,calc(100vw-2rem))] p-5">
        <DialogTitle className="text-lg font-semibold">Nuevo pago de personal</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          Seleccioná el empleado y elegí qué descuentos aplicar en este pago.
        </DialogDescription>

        <div className="mt-4 grid gap-3">
          <div className="space-y-1.5">
            <Label>Empleado</Label>
            <Select
              value={String(employeeId ?? '')}
              onChange={(e) =>
                setEmployeeId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Seleccionar empleado...</option>
              {employees.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {String(e.fullName)}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Inicio período</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fin período</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Monto bruto manual (opcional)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder={dailyRate ? `Tarifa diaria: ${money(dailyRate)}` : '0.00'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Si lo dejás vacío, el backend calcula con la tarifa diaria × días trabajados.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          <CashShiftSelect value={cashShiftId} onChange={setCashShiftId} />
        </div>

        {/* Resumen de deducciones del empleado */}
        {employee && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold">
              Descuentos pendientes de {String(employee.fullName)}
            </p>

            {pendingPenalties.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin descuentos pendientes.</p>
            ) : (
              <div className="space-y-1">
                {pendingPenalties.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-1.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={selectedPenaltyIds.includes(Number(p.id))}
                        onChange={(e) =>
                          setSelectedPenaltyIds((ids) =>
                            e.target.checked
                              ? [...ids, Number(p.id)]
                              : ids.filter((id) => id !== Number(p.id)),
                          )
                        }
                      />
                      <span className="truncate text-amber-900">{String(p.reason)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold text-amber-700">{money(Number(p.amount))}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        disabled={voidPenalty.isPending}
                        onClick={() => {
                          if (window.confirm('¿Descartar este descuento pendiente?')) {
                            voidPenalty.mutate(Number(p.id));
                          }
                        }}
                      >
                        Descartar
                      </Button>
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 text-sm">
                  <span className="text-muted-foreground">Subtotal seleccionado</span>
                  <span className="font-semibold">{money(penaltiesTotal)}</span>
                </div>
              </div>
            )}

            {/* Total a pagar */}
            <div className="space-y-1 border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bruto</span>
                <span className="font-semibold">{money(gross)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total descuentos</span>
                <span className="font-semibold text-red-600">- {money(penaltiesTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 text-base">
                <span className="font-bold">Neto a pagar</span>
                <span className="font-bold text-emerald-600">{money(net)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit}>
            {create.isPending ? 'Registrando...' : 'Registrar pago'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
