import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CreditCard, Save, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { cn, dateTime, money, valueLabel } from '../../lib/utils';
import type { AnyRow } from '../../types';
import { normalizeRows } from '../shared/resource-save';

const methods = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'YAPE', label: 'Yape' },
  { value: 'PLIN', label: 'Plin' },
  { value: 'TRANSFER', label: 'Transferencia' },
];

export function CashClosuresPage() {
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const preview = useQuery({
    queryKey: ['cash-closures', 'preview'],
    queryFn: () => resourceApi.list('cash-closures/preview'),
    retry: false,
  });
  const closures = useQuery({
    queryKey: ['cash-closures'],
    queryFn: () => resourceApi.list('cash-closures'),
  });

  const expectedByMethod = (preview.data?.expectedByMethod ?? {}) as Record<string, number>;
  const countedTotal = methods.reduce((sum, method) => sum + Number(counted[method.value] || 0), 0);
  const expectedTotal = Number(preview.data?.totalExpected ?? 0);
  const difference = Number((countedTotal - expectedTotal).toFixed(2));

  const close = useMutation({
    mutationFn: () =>
      resourceApi.create('cash-closures/close', {
        countedAmounts: methods.map((method) => ({
          paymentMethod: method.value,
          countedAmount: Number(counted[method.value] || 0),
        })),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Caja cerrada');
      setCounted({});
      setNotes('');
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Cierres de caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cuadra el turno abierto y revisa cierres anteriores.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Arqueo del turno actual</h2>
              <p className="text-sm text-muted-foreground">
                {preview.data?.shiftId ? `Turno #${preview.data.shiftId}` : 'No hay caja abierta'}
              </p>
            </div>
            <WalletCards className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview.isError ? (
            <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">{errorMessage(preview.error)}</p>
          ) : (
            <>
              <SummaryGrid summary={preview.data} difference={difference} countedTotal={countedTotal} />

              <div className="grid gap-3 lg:grid-cols-5">
                {methods.map((method) => {
                  const expected = Number(expectedByMethod[method.value] ?? 0);
                  const countedAmount = Number(counted[method.value] || 0);
                  const methodDiff = Number((countedAmount - expected).toFixed(2));
                  return (
                    <div key={method.value} className="rounded-md border border-border p-3">
                      <Label>{method.label}</Label>
                      <Input
                        className="mt-2"
                        type="number"
                        step="0.01"
                        min="0"
                        value={counted[method.value] ?? ''}
                        placeholder="0.00"
                        onChange={(event) =>
                          setCounted((current) => ({ ...current, [method.value]: event.target.value }))
                        }
                      />
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p>Esperado: {money(expected)}</p>
                        <p className={cn(methodDiff < 0 && 'text-red-700', methodDiff > 0 && 'text-emerald-700')}>
                          Diferencia: {money(methodDiff)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notas del cierre" />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Badge tone={difference === 0 ? 'green' : difference < 0 ? 'red' : 'amber'}>
                  {difference === 0 ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
                  {difference === 0 ? 'Caja cuadrada' : difference < 0 ? `Falta ${money(Math.abs(difference))}` : `Sobra ${money(difference)}`}
                </Badge>
                <Button onClick={() => close.mutate()} disabled={close.isPending || preview.isLoading || !preview.data?.shiftId}>
                  <Save className="h-4 w-4" />
                  Cerrar caja
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">Historial de cierres</h2>
        {normalizeRows(closures.data).map((closure) => (
          <ClosureCard key={String(closure.id)} closure={closure} />
        ))}
        {!closures.isLoading && normalizeRows(closures.data).length === 0 && (
          <Card className="grid min-h-32 place-items-center p-6 text-sm text-muted-foreground">No hay cierres registrados.</Card>
        )}
      </div>
    </section>
  );
}

function SummaryGrid({ summary, countedTotal, difference }: { summary: AnyRow | undefined; countedTotal: number; difference: number }) {
  const items = useMemo<Array<[string, string | number | undefined]>>(
    () => [
      ['Monto inicial', Number(summary?.openingAmount ?? 0)],
      ['Abierta por', String(summary?.openedBy ?? '-')],
      ['Cerrada por', String(summary?.closedBy ?? '-')],
      ['Ventas del turno', `${summary?.salesCount ?? 0} (${money(Number(summary?.salesTotal ?? 0))})`],
      ['Pendientes', `${summary?.pendingSalesCount ?? 0} (${money(Number(summary?.pendingSalesTotal ?? 0))})`],
      ['Pérdidas', `${summary?.lossCount ?? 0} (${money(Number(summary?.lossTotal ?? 0))})`],
      ['Esperado', Number(summary?.totalExpected ?? 0)],
      ['Contado', countedTotal],
      ['Diferencia', difference],
    ],
    [summary, countedTotal, difference],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      {items.map(([label, value]) => (
        <div key={String(label)} className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold">{typeof value === 'number' ? money(value) : String(value ?? '-')}</p>
        </div>
      ))}
    </div>
  );
}

function ClosureCard({ closure }: { closure: AnyRow }) {
  const details = normalizeRows(closure.details);
  const difference = Number(closure.difference ?? 0);
  const summary = closure.summary as AnyRow | undefined;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold">Cierre #{String(closure.id)}</p>
            <p className="text-sm text-muted-foreground">{dateTime(closure.createdAt)}</p>
          </div>
          <Badge tone={difference === 0 ? 'green' : difference < 0 ? 'red' : 'amber'}>
            {difference === 0 ? 'Cuadrada' : difference < 0 ? `Faltó ${money(Math.abs(difference))}` : `Sobró ${money(difference)}`}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Mini label="Esperado" value={money(Number(closure.totalExpected ?? 0))} />
          <Mini label="Abierta por" value={String((summary as AnyRow | undefined)?.openedBy ?? '-')} />
          <Mini label="Cerrada por" value={String((summary as AnyRow | undefined)?.closedBy ?? '-')} />
          <Mini label="Contado" value={money(Number(closure.totalCounted ?? 0))} />
          <Mini label="Ventas" value={`${summary?.salesCount ?? 0} / ${money(Number(summary?.salesTotal ?? 0))}`} />
          <Mini label="Pendientes" value={`${summary?.pendingSalesCount ?? 0} / ${money(Number(summary?.pendingSalesTotal ?? 0))}`} />
          <Mini label="Pérdidas" value={`${summary?.lossCount ?? 0} / ${money(Number(summary?.lossTotal ?? 0))}`} />
        </div>

        <div className="grid gap-2 md:grid-cols-5">
          {details.map((detail) => (
            <div key={String(detail.id)} className="rounded-md bg-muted p-2 text-xs">
              <p className="flex items-center gap-1 font-semibold">
                <CreditCard className="h-3.5 w-3.5" />
                {valueLabel(detail.paymentMethod)}
              </p>
              <p>Esp. {money(Number(detail.expectedAmount ?? 0))}</p>
              <p>Cont. {money(Number(detail.countedAmount ?? 0))}</p>
              <p>Dif. {money(Number(detail.difference ?? 0))}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
