import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, Plus, UserX, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ResourceFormDialog } from '../../components/forms/resource-form-dialog';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { ConfirmDialog } from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { dateTime, getValue, money } from '../../lib/utils';
import { modules } from '../module-config';
import { normalizeRows, saveResource } from '../shared/resource-save';

export function ReservationsPage() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; description: string; run: () => void } | null>(null);
  const queryClient = useQueryClient();
  const config = modules.reservations;
  const reservationsQuery = useQuery({ queryKey: ['reservations'], queryFn: () => resourceApi.list('reservations') });
  const reservations = normalizeRows(reservationsQuery.data);
  const pending = reservations.filter((reservation) => reservation.status === 'PENDING').length;
  const confirmed = reservations.filter((reservation) => reservation.status === 'CONFIRMED').length;

  const createReservation = useMutation({
    mutationFn: (values: Record<string, unknown>) => saveResource(config, values),
    onSuccess: () => {
      toast.success('Reserva creada');
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const action = useMutation({
    mutationFn: (path: string) => resourceApi.update(path),
    onSuccess: () => {
      toast.success('Reserva actualizada');
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const ask = (title: string, description: string, path: string) => {
    setConfirm({ title, description, run: () => action.mutate(path) });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Reservas</h1>
          <p className="text-sm text-muted-foreground">Agenda visual para confirmar, cancelar o preparar check-in.</p>
        </div>
        <Button className="h-11" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva reserva
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Pendientes" value={pending} />
        <Metric label="Confirmadas" value={confirmed} />
        <Metric label="Total" value={reservations.length} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {reservations.map((reservation) => (
          <Card key={String(reservation.id)} className="overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/60">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Reserva #{String(reservation.id)}</span>
                </div>
                <StatusBadge value={reservation.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-lg font-semibold">{String(getValue(reservation, 'customer.fullName') ?? 'Cliente')}</p>
                <p className="text-sm text-muted-foreground">Hab. {String(getValue(reservation, 'room.roomNumber') ?? '-')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Ingreso</p>
                  <p className="font-medium">{dateTime(reservation.startDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Salida</p>
                  <p className="font-medium">{dateTime(reservation.endDate)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Adelanto</span>
                <span className="font-semibold">{money(reservation.depositAmount)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => ask('Confirmar reserva', 'La reserva quedará confirmada.', `reservations/${reservation.id}/confirm`)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => ask('No llegó', 'La reserva se marcará como no show.', `reservations/${reservation.id}/no-show`)}>
                  <UserX className="h-4 w-4" />
                </Button>
                <Button variant="destructive" onClick={() => ask('Cancelar reserva', 'La reserva quedará cancelada.', `reservations/${reservation.id}/cancel`)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reservationsQuery.isError && <Card className="p-4 text-sm text-red-700">{errorMessage(reservationsQuery.error)}</Card>}
      {!reservationsQuery.isLoading && reservations.length === 0 && (
        <Card className="grid min-h-40 place-items-center p-6 text-sm text-muted-foreground">No hay reservas registradas.</Card>
      )}

      <ResourceFormDialog
        open={open}
        title="Nueva reserva"
        description="Elige cliente, habitación y rango de fechas."
        fields={config.fields}
        schema={config.schema}
        saving={createReservation.isPending}
        onOpenChange={setOpen}
        onSubmit={(values) => createReservation.mutate(values)}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        onOpenChange={(value) => !value && setConfirm(null)}
        onConfirm={() => {
          confirm?.run();
          setConfirm(null);
        }}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
