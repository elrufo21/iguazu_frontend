import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BedDouble, CalendarClock, DoorOpen, PackagePlus, Receipt, WalletCards } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { hasPermission } from '../../lib/permissions';
import { getValue, money } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import type { AnyRow } from '../../types';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [openCash, setOpenCash] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('0');
  const queryClient = useQueryClient();
  const canReadCash = hasPermission(user, 'GET /cash-shift/open');
  const canOpenCash = hasPermission(user, 'POST /cash-shift/open');
  const canCloseCash = hasPermission(user, 'POST /cash-closures/close');
  const canReadRooms = hasPermission(user, 'GET /rooms');
  const canReadReservations = hasPermission(user, 'GET /reservations');
  const canReadSales = hasPermission(user, 'GET /sales');
  const openShift = useQuery({ queryKey: ['cash-shift', 'open'], queryFn: () => resourceApi.list('cash-shift/open'), enabled: canReadCash });
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: () => resourceApi.list('rooms'), enabled: canReadRooms });
  const reservations = useQuery({ queryKey: ['reservations'], queryFn: () => resourceApi.list('reservations'), enabled: canReadReservations });
  const sales = useQuery({ queryKey: ['sales'], queryFn: () => resourceApi.list('sales'), enabled: canReadSales });

  const openCashMutation = useMutation({
    mutationFn: () => resourceApi.create('cash-shift/open', { openingAmount: Number(openingAmount || 0) }),
    onSuccess: () => {
      toast.success('Caja abierta');
      setOpenCash(false);
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const roomRows = rows(rooms.data);
  const reservationRows = rows(reservations.data);
  const saleRows = rows(sales.data);
  const todaySales = saleRows.filter((sale) => new Date(String(sale.createdAt)).toDateString() === new Date().toDateString());
  const available = roomRows.filter((room) => room.status === 'AVAILABLE').length;
  const occupied = roomRows.filter((room) => room.status === 'OCCUPIED').length;
  const pending = reservationRows.filter((reservation) => reservation.status === 'PENDING').length;
  const totalSales = todaySales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vista rápida de recepción y caja.</p>
        </div>
        <div className="flex gap-2">
          {canOpenCash && (
            <Button variant="outline" onClick={() => setOpenCash(true)}>
              Abrir caja
            </Button>
          )}
          {canCloseCash && (
            <Button asChild variant="secondary">
              <Link to="/cash-closures">Cerrar caja</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          title="Caja"
          value={openShift.data?.id ? 'Abierta' : 'Cerrada'}
          icon={<WalletCards />}
          badge={<StatusBadge value={openShift.data?.id ? 'OPEN' : 'CLOSED'} />}
          to="/cash-closures"
        />
        <Metric title="Disponibles" value={available} icon={<DoorOpen />} />
        <Metric title="Ocupadas" value={occupied} icon={<BedDouble />} />
        <Metric title="Reservas pendientes" value={pending} icon={<CalendarClock />} />
        <Metric title="Ventas del día" value={money(totalSales)} icon={<Receipt />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Habitaciones</h2>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roomRows.slice(0, 12).map((room) => (
              <div key={String(room.id)} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Hab. {String(room.roomNumber ?? room.id)}</span>
                  <StatusBadge value={room.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{String(getValue(room, 'roomType.name') ?? 'Sin tipo')}</p>
              </div>
            ))}
            {rooms.isError && <p className="text-sm text-red-700">{errorMessage(rooms.error)}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Accesos rápidos</h2>
          </CardHeader>
          <CardContent className="grid gap-2">
            {hasPermission(user, 'GET /stays/active') && <QuickLink to="/stays" icon={<BedDouble />} label="Nueva estadía / check-in" />}
            {hasPermission(user, 'GET /products') && <QuickLink to="/sales" icon={<Receipt />} label="Nueva venta" />}
            {hasPermission(user, 'GET /products') && <QuickLink to="/products" icon={<PackagePlus />} label="Registrar producto" />}
            {hasPermission(user, 'GET /cash-closures') && <QuickLink to="/cash-closures" icon={<WalletCards />} label="Cerrar caja" />}
          </CardContent>
        </Card>
      </div>

      <Dialog open={openCash} onOpenChange={setOpenCash}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">Abrir caja</DialogTitle>
          <div className="mt-5 space-y-2">
            <Label htmlFor="openingAmount">Monto inicial</Label>
            <Input id="openingAmount" type="number" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenCash(false)}>
              Cancelar
            </Button>
            <Button onClick={() => openCashMutation.mutate()} disabled={openCashMutation.isPending}>
              Abrir caja
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </section>
  );
}

function Metric({ title, value, icon, badge, to }: { title: string; value: string | number; icon: ReactNode; badge?: ReactNode; to?: string }) {
  const content = (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary">{icon}</div>
          {badge}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
  if (!to) return content;
  return <Link to={to}>{content}</Link>;
}

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Button asChild variant="outline" className="h-12 justify-start">
      <Link to={to}>
        {icon}
        {label}
      </Link>
    </Button>
  );
}

function rows(data: unknown): AnyRow[] {
  return Array.isArray(data) ? (data as AnyRow[]) : [];
}
