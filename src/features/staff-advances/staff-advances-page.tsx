import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, HandCoins, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CashShiftSelect } from '../../components/cash-shift-select';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { dateTime, getValue, money } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import type { AnyRow } from '../../types';
import { normalizeRows } from '../shared/resource-save';

const paymentOptions = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Yape', value: 'YAPE' },
  { label: 'Plin', value: 'PLIN' },
  { label: 'Transferencia', value: 'TRANSFER' },
];

export function StaffAdvancesPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [reason, setReason] = useState('');
  const [review, setReview] = useState<{ advance: AnyRow; action: 'approve' | 'reject' } | null>(null);
  const [cashShiftId, setCashShiftId] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  const advancesQuery = useQuery({
    queryKey: ['staff-advances'],
    queryFn: () => resourceApi.list('staff-advances'),
  });
  const advances = normalizeRows(advancesQuery.data);
  const pending = advances.filter((advance) => advance.status === 'PENDING');

  const create = useMutation({
    mutationFn: () =>
      resourceApi.create('staff-advances', {
        amount: Number(amount),
        paymentMethod,
        reason,
      }),
    onSuccess: () => {
      toast.success('Solicitud enviada');
      setAmount('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['staff-advances'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reviewRequest = useMutation({
    mutationFn: () => {
      if (!review) throw new Error('Sin solicitud');
      return resourceApi.post(`staff-advances/${review.advance.id}/${review.action}`, {
        ...(review.action === 'approve' && cashShiftId ? { cashShiftId: Number(cashShiftId) } : {}),
        paymentMethod,
        note: reviewNote,
      });
    },
    onSuccess: () => {
      toast.success(review?.action === 'approve' ? 'Adelanto aprobado' : 'Solicitud rechazada');
      setReview(null);
      setCashShiftId('');
      setReviewNote('');
      void queryClient.invalidateQueries({ queryKey: ['staff-advances'] });
      void queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Adelantos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Solicitudes, aprobación y descuento automático al personal.</p>
      </div>

      {!isAdmin && (
        <Card>
          <CardContent className="grid gap-3 md:grid-cols-[150px_170px_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label>Monto</Label>
            <Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Pago solicitado</Label>
            <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              {paymentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Motivo</Label>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Emergencia familiar" />
          </div>
          <Button disabled={!Number(amount) || create.isPending} onClick={() => create.mutate()}>
            <HandCoins className="h-4 w-4" />
            Solicitar
          </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && pending.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Solicitudes pendientes</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((advance) => (
              <AdvanceCard
                key={String(advance.id)}
                advance={advance}
                admin
                onApprove={() => {
                  setReview({ advance, action: 'approve' });
                  setPaymentMethod(String(advance.paymentMethod ?? 'CASH'));
                }}
                onReject={() => setReview({ advance, action: 'reject' })}
              />
            ))}
          </div>
        </>
      )}

      <h2 className="text-lg font-semibold">Historial</h2>
      {advancesQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando adelantos...</p>
      ) : advances.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No hay solicitudes.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {advances.map((advance) => (
            <AdvanceCard key={String(advance.id)} advance={advance} />
          ))}
        </div>
      )}

      <Dialog open={Boolean(review)} onOpenChange={(open) => !open && setReview(null)}>
        <DialogContent className="w-[min(480px,calc(100vw-2rem))] p-5">
          <DialogTitle>{review?.action === 'approve' ? 'Aprobar adelanto' : 'Rechazar solicitud'}</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            {review?.advance ? `${employeeName(review.advance)} - ${money(review.advance.amount)}` : ''}
          </DialogDescription>
          {review?.action === 'approve' && (
            <div className="mt-4 space-y-3">
              <CashShiftSelect value={cashShiftId} onChange={setCashShiftId} />
              <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                {paymentOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="mt-4 space-y-2">
            <Label>Nota</Label>
            <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Opcional" />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReview(null)}>Cancelar</Button>
            <Button
              variant={review?.action === 'reject' ? 'destructive' : 'default'}
              disabled={reviewRequest.isPending || (review?.action === 'approve' && !cashShiftId)}
              onClick={() => reviewRequest.mutate()}
            >
              {review?.action === 'approve' ? 'Aprobar' : 'Rechazar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AdvanceCard({
  advance,
  admin,
  onApprove,
  onReject,
}: {
  advance: AnyRow;
  admin?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={advance.status} />
              <StatusBadge value={advance.paymentMethod} />
            </div>
            <p className="mt-2 font-semibold">{employeeName(advance)}</p>
            <p className="text-sm text-muted-foreground">{String(advance.reason ?? 'Sin motivo')}</p>
          </div>
          <p className="text-2xl font-bold">{money(advance.amount)}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Solicitado por {String(getValue(advance, 'requestedBy.employee.fullName') ?? getValue(advance, 'requestedBy.username') ?? '-')}</span>
          <span>{dateTime(advance.createdAt)}</span>
          {advance.reviewedAt ? <span>Revisado {dateTime(advance.reviewedAt)}</span> : null}
        </div>
        {advance.reviewNote ? <p className="text-sm text-muted-foreground">{String(advance.reviewNote)}</p> : null}
        {admin && advance.status === 'PENDING' && (
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={onReject}>
              <X className="h-4 w-4" />
              Rechazar
            </Button>
            <Button onClick={onApprove}>
              <Check className="h-4 w-4" />
              Aprobar
            </Button>
          </div>
        )}
        {advance.status === 'PENDING' && !admin && (
          <p className="flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Pendiente de aprobación.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function employeeName(advance: AnyRow) {
  return String(getValue(advance, 'employee.fullName') ?? 'Empleado');
}
