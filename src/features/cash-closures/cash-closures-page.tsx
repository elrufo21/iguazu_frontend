import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CreditCard, Pencil, Save, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { cn, dateTime, money, valueLabel } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
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
  const [correctionClosure, setCorrectionClosure] = useState<AnyRow | null>(null);
  const [correctionCounted, setCorrectionCounted] = useState<Record<string, string>>({});
  const [correctionReason, setCorrectionReason] = useState('');
  const [openedDate, setOpenedDate] = useState('');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canCorrectClosures = user?.role === 'ADMIN';

  const preview = useQuery({
    queryKey: ['cash-closures', 'preview'],
    queryFn: () => resourceApi.list('cash-closures/preview'),
    retry: false,
  });
  const closures = useQuery({
    queryKey: ['cash-closures', openedDate],
    queryFn: () => resourceApi.list(openedDate ? `cash-closures?openedDate=${openedDate}` : 'cash-closures'),
  });

  const expectedByMethod = (preview.data?.expectedByMethod ?? {}) as Record<string, number>;
  const countedTotal = methods.reduce((sum, method) => sum + Number(counted[method.value] || 0), 0);
  const expectedTotal = Number(preview.data?.totalExpected ?? 0);
  const difference = Number((countedTotal - expectedTotal).toFixed(2));
  const visibleClosures = useMemo(
    () =>
      normalizeRows(closures.data).filter(
        (closure) =>
          !openedDate ||
          dateInputValue(new Date(String((closure.summary as AnyRow | undefined)?.openedAt ?? ''))) === openedDate,
      ),
    [closures.data, openedDate],
  );

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

  const correctCounts = useMutation({
    mutationFn: () => {
      if (!correctionClosure?.id) throw new Error('Selecciona un cierre.');
      return resourceApi.update(`cash-closures/${correctionClosure.id}/counts`, {
        countedAmounts: methods.map((method) => ({
          paymentMethod: method.value,
          countedAmount: Number(correctionCounted[method.value] || 0),
        })),
        reason: correctionReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success('Conteo corregido');
      setCorrectionClosure(null);
      setCorrectionCounted({});
      setCorrectionReason('');
      void queryClient.invalidateQueries({ queryKey: ['cash-closures'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reviewSaleEdit = useMutation({
    mutationFn: ({ closureId, auditLogId, action }: { closureId: number; auditLogId: number; action: 'penalty' | 'loss' }) =>
      resourceApi.post(`cash-closures/${closureId}/sale-edits/${auditLogId}/${action}`, {}),
    onSuccess: (_data, variables) => {
      toast.success(variables.action === 'penalty' ? 'Penalidad creada' : 'Edición aceptada');
      void queryClient.invalidateQueries({ queryKey: ['cash-closures'] });
      void queryClient.invalidateQueries({ queryKey: ['penalties'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const openCorrection = (closure: AnyRow) => {
    const details = normalizeRows(closure.details);
    setCorrectionCounted(
      Object.fromEntries(
        methods.map((method) => {
          const detail = details.find((item) => item.paymentMethod === method.value);
          return [method.value, String(Number(detail?.countedAmount ?? 0))];
        }),
      ),
    );
    setCorrectionReason('');
    setCorrectionClosure(closure);
  };

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold">Historial de cierres</h2>
          <div className="w-full sm:w-48">
            <Label>Fecha de apertura</Label>
            <Input type="date" value={openedDate} onChange={(event) => setOpenedDate(event.target.value)} />
          </div>
        </div>
        {visibleClosures.map((closure) => (
          <ClosureCard
            key={String(closure.id)}
            closure={closure}
            canCorrect={canCorrectClosures && !closure.settled}
            onCorrect={() => openCorrection(closure)}
            canReviewEdits={canCorrectClosures}
            reviewingEditId={Number(reviewSaleEdit.variables?.auditLogId ?? 0)}
            onReviewEdit={(auditLogId, action) =>
              reviewSaleEdit.mutate({ closureId: Number(closure.id), auditLogId, action })
            }
          />
        ))}
        {!closures.isLoading && visibleClosures.length === 0 && (
          <Card className="grid min-h-32 place-items-center p-6 text-sm text-muted-foreground">No hay cierres registrados.</Card>
        )}
      </div>

      <CorrectCountsDialog
        closure={correctionClosure}
        counted={correctionCounted}
        reason={correctionReason}
        pending={correctCounts.isPending}
        onCountedChange={(paymentMethod, value) =>
          setCorrectionCounted((current) => ({ ...current, [paymentMethod]: value }))
        }
        onReasonChange={setCorrectionReason}
        onOpenChange={(open) => !open && setCorrectionClosure(null)}
        onConfirm={() => correctCounts.mutate()}
      />
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

function ClosureCard({
  closure,
  canCorrect,
  onCorrect,
  canReviewEdits,
  reviewingEditId,
  onReviewEdit,
}: {
  closure: AnyRow;
  canCorrect: boolean;
  onCorrect: () => void;
  canReviewEdits: boolean;
  reviewingEditId: number;
  onReviewEdit: (auditLogId: number, action: 'penalty' | 'loss') => void;
}) {
  const details = normalizeRows(closure.details);
  const difference = Number(closure.difference ?? 0);
  const summary = closure.summary as AnyRow | undefined;
  const notes = String(closure.notes ?? '').trim();
  const settleReason = String(closure.settleReason ?? '').trim();
  const saleEditsAfterClose = normalizeRows(closure.saleEditsAfterClose);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold">Cierre #{String(closure.id)}</p>
            <p className="text-sm text-muted-foreground">{dateTime(closure.createdAt)}</p>
            <p className="text-xs text-muted-foreground">
              Apertura: {dateTime(summary?.openedAt)} · {shiftLabel(summary?.openedAt)}
            </p>
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

        {notes && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripción</p>
            <p className="mt-1 whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {settleReason && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="text-xs font-medium uppercase tracking-wide">Motivo de cuadre</p>
            <p className="mt-1 whitespace-pre-wrap">{settleReason}</p>
          </div>
        )}

        {saleEditsAfterClose.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
              <AlertTriangle className="h-4 w-4" />
              Ediciones después del cierre
            </p>
            <div className="mt-3 space-y-2">
              {saleEditsAfterClose.map((edit) => (
                <SaleEditAfterClose
                  key={String(edit.id)}
                  edit={edit}
                  canReview={canReviewEdits}
                  busy={reviewingEditId === Number(edit.id)}
                  onReview={onReviewEdit}
                />
              ))}
            </div>
          </div>
        )}

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

        {canCorrect && difference !== 0 && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onCorrect}>
              <Pencil className="h-4 w-4" />
              Corregir conteo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SaleEditAfterClose({
  edit,
  canReview,
  busy,
  onReview,
}: {
  edit: AnyRow;
  canReview: boolean;
  busy: boolean;
  onReview: (auditLogId: number, action: 'penalty' | 'loss') => void;
}) {
  const oldData = (edit.oldData ?? {}) as AnyRow;
  const newData = (edit.newData ?? {}) as AnyRow;
  const reason = String(newData.reason ?? oldData.reason ?? '-');
  const review = (edit.review ?? null) as AnyRow | null;
  const amount = Math.max(0, Number(oldData.total ?? 0) - Number(newData.total ?? 0));
  return (
    <div className="rounded-md bg-white/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Venta #{String(edit.saleId)}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {review ? (
            <Badge tone={review.action === 'SALE_EDIT_PENALTY' ? 'red' : 'amber'}>
              {review.action === 'SALE_EDIT_PENALTY' ? 'Descontado' : 'Edición aceptada'}
            </Badge>
          ) : null}
          <span>{dateTime(edit.createdAt)} · {String(edit.user ?? 'Sistema')}</span>
        </div>
      </div>
      <p className="mt-1">
        Total: <b>{money(Number(oldData.total ?? 0))}</b> → <b>{money(Number(newData.total ?? 0))}</b>
      </p>
      <p className="mt-1 text-xs">Motivo: {reason}</p>
      <p className="mt-1 text-xs">{saleEditDetails(newData.details)}</p>
      {canReview && !review && amount > 0 && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onReview(Number(edit.id), 'loss')}
          >
            Aceptar edición
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => onReview(Number(edit.id), 'penalty')}
          >
            Descontar {money(amount)}
          </Button>
        </div>
      )}
    </div>
  );
}

function saleEditDetails(details: unknown) {
  const rows = Array.isArray(details) ? details : [];
  if (!rows.length) return 'Sin detalle de productos.';
  return rows
    .map((detail: AnyRow) =>
      `${Number(detail.quantity ?? 0)} x ${String(detail.description ?? 'Detalle')} (${money(Number(detail.subtotal ?? 0))})`,
    )
    .join(', ');
}

function CorrectCountsDialog({
  closure,
  counted,
  reason,
  pending,
  onCountedChange,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: {
  closure: AnyRow | null;
  counted: Record<string, string>;
  reason: string;
  pending: boolean;
  onCountedChange: (paymentMethod: string, value: string) => void;
  onReasonChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const details = normalizeRows(closure?.details);
  const expectedTotal = Number(closure?.totalExpected ?? 0);
  const countedTotal = methods.reduce((sum, method) => sum + Number(counted[method.value] || 0), 0);
  const difference = Number((countedTotal - expectedTotal).toFixed(2));

  return (
    <Dialog open={closure !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(620px,calc(100vw-2rem))] p-5">
        <DialogTitle className="text-lg font-semibold">Corregir conteo de cierre #{String(closure?.id ?? '')}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          Ajusta solo el dinero contado por método. El motivo queda guardado en auditoría.
        </DialogDescription>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {methods.map((method) => {
            const detail = details.find((item) => item.paymentMethod === method.value);
            const expected = Number(detail?.expectedAmount ?? 0);
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
                  onChange={(event) => onCountedChange(method.value, event.target.value)}
                />
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>Esperado: {money(expected)}</p>
                  <p className={cn(methodDiff < 0 && 'text-red-700', methodDiff > 0 && 'text-emerald-700')}>
                    Diferencia: {money(methodDiff)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contado corregido</span>
            <span className="font-semibold">{money(countedTotal)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Nueva diferencia</span>
            <span className="font-semibold">{money(difference)}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Motivo</Label>
          <Textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Ej: Se digitó 735.50 en efectivo, pero el conteo real era 135.50"
            maxLength={280}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={pending || !reason.trim()}>
            {pending ? 'Guardando...' : 'Guardar corrección'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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

function shiftLabel(openedAt: unknown) {
  const date = new Date(String(openedAt ?? ''));
  const hour = Number.isFinite(date.getTime()) ? date.getHours() : 0;
  return hour >= 15 || hour < 6 ? 'Turno noche' : 'Turno día';
}

function dateInputValue(date: Date) {
  if (!Number.isFinite(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
