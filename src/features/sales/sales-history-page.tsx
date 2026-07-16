import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BedDouble,
  Ban,
  Box,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Package,
  Pencil,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { CashShiftSelect } from '../../components/cash-shift-select';
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
import { Textarea } from '../../components/ui/textarea';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { dateTime, getValue, money, productTitle } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import type { AnyRow } from '../../types';
import { normalizeRows } from '../shared/resource-save';

const ITEM_TYPE_LABELS: Record<string, { label: string; icon: ReactNode; color: string }> = {
  PRODUCT: { label: 'Producto', icon: <Box className="h-3 w-3" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  ROOM_RENT: { label: 'Alojamiento', icon: <BedDouble className="h-3 w-3" />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  PENALTY: { label: 'Penalidad', icon: <Zap className="h-3 w-3" />, color: 'text-red-600 bg-red-50 border-red-200' },
  OTHER: { label: 'Cargo extra', icon: <Package className="h-3 w-3" />, color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFER: 'Transferencia',
};

const INVOICE_LABELS: Record<string, string> = {
  TICKET: 'Ticket',
  BOLETA: 'Boleta',
  FACTURA: 'Factura',
};

// Tipo de comprobante electrónico SUNAT (Invoice.invoiceType).
const SUNAT_TYPE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'Nota de Crédito',
  '08': 'Nota de Débito',
};

type EditDetail = {
  id?: number;
  itemType: string;
  productId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number;
};

function SaleCard({
  sale,
  onPay,
  onInvoice,
  onEdit,
  onCancel,
  isPaying,
  isInvoicing,
  isCancelling,
  canEdit,
}: {
  sale: AnyRow;
  onPay: (sale: AnyRow) => void;
  onInvoice: (sale: AnyRow) => void;
  onEdit: (sale: AnyRow) => void;
  onCancel: (sale: AnyRow) => void;
  isPaying: boolean;
  isInvoicing: boolean;
  isCancelling: boolean;
  canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const details = (sale.details as AnyRow[] | undefined) ?? [];
  const payments = (sale.payments as AnyRow[] | undefined) ?? [];

  const hasRoom = details.some((d) => String(d.itemType) === 'ROOM_RENT');
  const hasProduct = details.some((d) => String(d.itemType) === 'PRODUCT');
  const hasExtra = details.some((d) => ['PENALTY', 'OTHER'].includes(String(d.itemType)));
  const isUnified = [hasRoom, hasProduct, hasExtra].filter(Boolean).length > 1;

  const customerName = sale.customer ? String(getValue(sale, 'customer.fullName') ?? 'Consumidor final') : 'Consumidor final';
  const roomNumber = sale.stayId ? String(getValue(sale, 'stay.room.roomNumber') ?? `Est. #${sale.stayId}`) : null;
  const invoiceLabel = INVOICE_LABELS[String(sale.invoiceType ?? 'TICKET')] ?? 'Ticket';
  const status = String(sale.status ?? 'OPEN');
  const invoice = (sale.invoice as AnyRow | undefined) ?? undefined;
  const invoiceStatus = String(invoice?.status ?? '');
  // Comprobante aceptado/observado → bloqueado (no se puede reemitir).
  const invoiceAccepted = invoiceStatus === 'ACCEPTED' || invoiceStatus === 'OBSERVED';
  // Comprobante rechazado → se puede reintentar.
  const invoiceRejected = invoiceStatus === 'REJECTED';
  // Puede emitir si está pagada, con cliente, y (sin comprobante o con comprobante rechazado).
  const canInvoice = status === 'PAID' && Boolean(sale.customer) && (!invoice || invoiceRejected);
  const canCancel = status !== 'CANCELLED' && !invoiceAccepted;

  return (
    <div className={`rounded-xl border bg-card shadow-sm transition-all overflow-hidden ${
      status === 'OPEN'
        ? 'border-amber-300 shadow-amber-100'
        : status === 'PAID'
        ? 'border-border'
        : 'border-border opacity-60'
    }`}>
      {/* Encabezado de la tarjeta */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-bold text-primary text-sm">
                {invoiceLabel} #{String(sale.invoiceNumber ?? sale.id)}
              </span>
              <StatusBadge value={status} />
              {isUnified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                  <ShoppingBag className="h-3 w-3" />
                  Venta completa
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {customerName}
              </span>
              {roomNumber && (
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5" />
                  Hab. {roomNumber}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" />
                {dateTime(sale.createdAt)}
              </span>
            </div>
            {/* Iconos de qué incluye */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {details.map((d) => {
                const type = String(d.itemType);
                const meta = ITEM_TYPE_LABELS[type];
                if (!meta) return null;
                return (
                  <span
                    key={String(d.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.color}`}
                  >
                    {meta.icon}
                    {String(d.description).length > 24
                      ? String(d.description).slice(0, 22) + '…'
                      : String(d.description)}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{money(sale.total)}</p>
            {payments.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {payments.map((p) => PAYMENT_LABELS[String(p.paymentMethod)] ?? String(p.paymentMethod)).join(' + ')}
              </p>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            <FileText className="h-4 w-4" />
            {expanded ? 'Ocultar detalle' : `Ver detalle (${details.length} ítem${details.length !== 1 ? 's' : ''})`}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <div className="flex items-center gap-2">
            {canInvoice && (
              <Button
                size="sm"
                variant={invoiceRejected ? 'destructive' : 'outline'}
                disabled={isInvoicing}
                onClick={() => onInvoice(sale)}
                className="gap-1.5"
              >
                <FileText className="h-4 w-4" />
                {isInvoicing
                  ? 'Enviando...'
                  : invoiceRejected
                    ? `Reintentar ${invoice?.sunatCode ? `(${String(invoice.sunatCode)})` : ''}`
                    : 'Comprobante'}
              </Button>
            )}
            {invoiceAccepted && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                <FileText className="h-3 w-3" />
                {SUNAT_TYPE_LABELS[String(invoice?.invoiceType ?? '03')] ?? 'Comprobante'} {String(invoice?.docNumber ?? '')}
              </span>
            )}
            {invoiceRejected && !canInvoice && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                <FileText className="h-3 w-3" />
                {SUNAT_TYPE_LABELS[String(invoice?.invoiceType ?? '03')] ?? 'Comprobante'} rechazado ({String(invoice?.sunatCode ?? 'error')})
              </span>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => onEdit(sale)} className="gap-1.5">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}
            {status === 'OPEN' && (
              <Button size="sm" disabled={isPaying} onClick={() => onPay(sale)} className="gap-1.5">
                <CreditCard className="h-4 w-4" />
                Cobrar {money(sale.total)}
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" disabled={isCancelling} onClick={() => onCancel(sale)} className="gap-1.5">
                <Ban className="h-4 w-4" />
                Anular
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Detalle expandible */}
      {expanded && (
        <div className="border-t border-border/60 bg-muted/30 px-4 py-3 space-y-3">
          {/* Líneas de detalle */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Detalle de ítems</p>
            {details.map((d) => {
              const type = String(d.itemType);
              const meta = ITEM_TYPE_LABELS[type];
              return (
                <div key={String(d.id)} className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${meta?.color ?? 'bg-muted text-muted-foreground border-border'}`}
                  >
                    {meta?.icon}
                    {meta?.label ?? type}
                  </span>
                  <span className="flex-1 text-sm">{String(d.description)}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {String(d.quantity)} × {money(d.unitPrice)}
                  </span>
                  <span className="text-sm font-semibold whitespace-nowrap w-20 text-right">
                    {money(d.subtotal)}
                  </span>
                </div>
              );
            })}
            <div className="flex justify-between items-center pt-2 border-t border-border font-bold text-base">
              <span>Total</span>
              <span>{money(sale.total)}</span>
            </div>
          </div>

          {/* Formas de pago */}
          {payments.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Cobrado con</p>
              <div className="flex flex-wrap gap-2">
                {payments.map((p) => (
                  <div key={String(p.id)} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{PAYMENT_LABELS[String(p.paymentMethod)] ?? String(p.paymentMethod)}</span>
                    <span className="text-muted-foreground">{money(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SalesHistoryPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [invoiceSale, setInvoiceSale] = useState<AnyRow | null>(null);
  const [invoiceType, setInvoiceType] = useState<'auto' | '01' | '03'>('auto');
  const [cancelSale, setCancelSale] = useState<AnyRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCashShiftId, setCancelCashShiftId] = useState('');
  const [editSale, setEditSale] = useState<AnyRow | null>(null);
  const [editReason, setEditReason] = useState('');
  const [editDetails, setEditDetails] = useState<EditDetail[]>([]);
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [editCashShiftId, setEditCashShiftId] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editStayId, setEditStayId] = useState('');
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const salesQuery = useQuery({
    queryKey: ['sales'],
    queryFn: () => resourceApi.list('sales'),
  });
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: () => resourceApi.list('products'),
  });
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => resourceApi.list('users'),
    enabled: isAdmin,
  });
  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: () => resourceApi.list('customers'),
  });
  const staysQuery = useQuery({
    queryKey: ['stays', 'history'],
    queryFn: () => resourceApi.list('stays/history'),
    enabled: isAdmin,
  });
  const cashShiftsQuery = useQuery({
    queryKey: ['cash-shifts', 'history'],
    queryFn: () => resourceApi.list('cash-shift/history'),
    enabled: isAdmin,
  });

  const paySale = useMutation({
    mutationFn: (sale: AnyRow) =>
      resourceApi.post(`sales/${sale.id}/pay`, {
        payments: [{ paymentMethod: 'CASH', amount: Number(sale.total ?? 0) }],
      }),
    onSuccess: () => {
      toast.success('Venta cobrada');
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const issueInvoice = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { invoiceType?: '01' | '03' } }) =>
      resourceApi.post(`billing/issue-from-sale/${id}`, body),
    onSuccess: (res: AnyRow) => {
      const code = String(res.sunatCode ?? '');
      if (res.status === 'ACCEPTED') {
        toast.success(`Comprobante ${res.docNumber} aceptado por SUNAT.`);
      } else if (res.status === 'OBSERVED') {
        toast.warning(`Comprobante ${res.docNumber} observado (código ${code}).`);
      } else {
        toast.error(`SUNAT rechazó el comprobante (código ${code}).`);
      }
      setInvoiceSale(null);
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason, cashShiftId }: { id: number; reason: string; cashShiftId?: number }) =>
      resourceApi.post(`sales/${id}/cancel`, {
        reason,
        ...(cashShiftId ? { cashShiftId } : {}),
      }),
    onSuccess: () => {
      toast.success('Venta anulada');
      setCancelSale(null);
      setCancelReason('');
      setCancelCashShiftId('');
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const edit = useMutation({
    mutationFn: () =>
      resourceApi.update(`sales/${editSale?.id}`, {
        reason: editReason.trim(),
        ...(editPaymentMethod ? { paymentMethod: editPaymentMethod } : {}),
        ...(isAdmin && editUserId ? { userId: Number(editUserId) } : {}),
        ...(isAdmin && editCashShiftId ? { cashShiftId: Number(editCashShiftId) } : {}),
        ...(editCustomerId ? { customerId: Number(editCustomerId) } : {}),
        ...(isAdmin && editStayId ? { stayId: Number(editStayId) } : {}),
        details: editDetails.map((detail) => ({
          ...(detail.id ? { id: detail.id } : {}),
          ...(detail.productId ? { productId: detail.productId } : {}),
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
        })),
      }),
    onSuccess: () => {
      toast.success('Venta editada');
      setEditSale(null);
      setEditReason('');
      setEditDetails([]);
      setEditPaymentMethod('');
      setEditUserId('');
      setEditCashShiftId('');
      setEditCustomerId('');
      setEditStayId('');
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      void queryClient.invalidateQueries({ queryKey: ['cash-closures'] });
      void queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const sales = normalizeRows(salesQuery.data);
  const products = normalizeRows(productsQuery.data).filter((product) => product.active !== false);
  const users = normalizeRows(usersQuery.data).filter((item) => item.active !== false);
  const customers = normalizeRows(customersQuery.data);
  const stays = normalizeRows(staysQuery.data);
  const cashShifts = normalizeRows(cashShiftsQuery.data);

  const filtered = useMemo(() => {
    let list = [...sales];
    if (statusFilter) list = list.filter((s) => String(s.status) === statusFilter);
    if (invoiceFilter) list = list.filter((s) => String(s.invoiceType ?? 'TICKET') === invoiceFilter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((s) => {
        const name = String(getValue(s, 'customer.fullName') ?? '').toLowerCase();
        const id = String(s.id);
        const num = String(s.invoiceNumber ?? '').toLowerCase();
        const room = String(getValue(s, 'stay.room.roomNumber') ?? '').toLowerCase();
        return name.includes(term) || id.includes(term) || num.includes(term) || room.includes(term);
      });
    }
    return list;
  }, [sales, search, statusFilter, invoiceFilter]);

  const stats = useMemo(() => {
    const paid = sales.filter((s) => String(s.status) === 'PAID');
    const open = sales.filter((s) => String(s.status) === 'OPEN');
    const totalRevenue = paid.reduce((sum, s) => sum + Number(s.total ?? 0), 0);
    const totalPending = open.reduce((sum, s) => sum + Number(s.total ?? 0), 0);
    return { paid: paid.length, open: open.length, totalRevenue, totalPending, count: sales.length };
  }, [sales]);

  const canEditSale = (sale: AnyRow) =>
    String(sale.status) !== 'CANCELLED' &&
    !['ACCEPTED', 'OBSERVED'].includes(String(getValue(sale, 'invoice.status') ?? '')) &&
    (user?.role === 'ADMIN' || Number(sale.userId) === Number(user?.id));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Historial de Ventas</h1>
        <p className="text-sm text-muted-foreground">Visualiza todas las ventas con su detalle completo.</p>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total ventas', value: String(stats.count), sub: 'registradas', icon: <Receipt className="h-5 w-5 text-primary" /> },
          { label: 'Cobradas', value: String(stats.paid), sub: money(stats.totalRevenue), icon: <CreditCard className="h-5 w-5 text-emerald-600" /> },
          { label: 'Pendientes', value: String(stats.open), sub: money(stats.totalPending), icon: <ShoppingBag className="h-5 w-5 text-amber-600" /> },
          { label: 'Ingresos totales', value: money(stats.totalRevenue), sub: 'de ventas cobradas', icon: <Zap className="h-5 w-5 text-violet-600" /> },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 leading-none">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </div>
                {stat.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 bg-muted/50"
                placeholder="Buscar por cliente, habitación, Nº comprobante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="PAID">Cobradas</option>
              <option value="OPEN">Pendientes</option>
              <option value="CANCELLED">Canceladas</option>
            </Select>
            <Select value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value)}>
              <option value="">Todos los comprobantes</option>
              <option value="TICKET">Ticket</option>
              <option value="BOLETA">Boleta</option>
              <option value="FACTURA">Factura</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listado */}
      {salesQuery.isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando ventas...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
          No se encontraron ventas con los filtros actuales.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sale) => (
            <SaleCard
              key={String(sale.id)}
              sale={sale}
              onPay={(s) => paySale.mutate(s)}
              onInvoice={(s) => {
                setInvoiceSale(s);
                setInvoiceType('auto');
              }}
              onEdit={(s) => {
                setEditSale(s);
                setEditReason('');
                setEditPaymentMethod(String(getValue(s, 'payments.0.paymentMethod') ?? ''));
                setEditUserId(String(s.userId ?? ''));
                setEditCashShiftId(String(s.cashShiftId ?? ''));
                setEditCustomerId(String(s.customerId ?? ''));
                setEditStayId(String(s.stayId ?? ''));
                setEditDetails(
                  ((s.details as AnyRow[] | undefined) ?? []).map((detail) => ({
                    id: Number(detail.id),
                    itemType: String(detail.itemType),
                    productId: detail.productId ? Number(detail.productId) : undefined,
                    description: String(detail.description ?? ''),
                    quantity: Number(detail.quantity ?? 1),
                    unitPrice: Number(detail.unitPrice ?? 0),
                    originalUnitPrice: Number(detail.unitPrice ?? 0),
                  })),
                );
              }}
              onCancel={(s) => {
                setCancelSale(s);
                setCancelReason('');
                setCancelCashShiftId('');
              }}
              isPaying={paySale.isPending}
              isInvoicing={issueInvoice.isPending && issueInvoice.variables?.id === sale.id}
              isCancelling={cancel.isPending && cancel.variables?.id === sale.id}
              canEdit={canEditSale(sale)}
            />
          ))}
        </div>
      )}

      {/* Modal de emisión de comprobante */}
      <IssueInvoiceDialog
        sale={invoiceSale}
        invoiceType={invoiceType}
        onInvoiceTypeChange={setInvoiceType}
        open={invoiceSale !== null}
        onOpenChange={(open) => {
          if (!open) setInvoiceSale(null);
        }}
        onConfirm={() => {
          if (!invoiceSale) return;
          issueInvoice.mutate({
            id: Number(invoiceSale.id),
            body: invoiceType === 'auto' ? {} : { invoiceType },
          });
        }}
        pending={issueInvoice.isPending}
      />

      <CancelSaleDialog
        sale={cancelSale}
        reason={cancelReason}
        cashShiftId={cancelCashShiftId}
        showCashShift={user?.role === 'ADMIN' && String(cancelSale?.status ?? '') === 'PAID'}
        onReasonChange={setCancelReason}
        onCashShiftChange={setCancelCashShiftId}
        onOpenChange={(open) => {
          if (!open) setCancelSale(null);
        }}
        onConfirm={() => {
          if (!cancelSale) return;
          const reason = cancelReason.trim();
          if (!reason) {
            toast.error('Ingresa el motivo de anulación.');
            return;
          }
          if (user?.role === 'ADMIN' && String(cancelSale.status ?? '') === 'PAID' && !cancelCashShiftId) {
            toast.error('Selecciona la caja abierta para registrar la salida.');
            return;
          }
          cancel.mutate({
            id: Number(cancelSale.id),
            reason,
            cashShiftId: cancelCashShiftId ? Number(cancelCashShiftId) : undefined,
          });
        }}
        pending={cancel.isPending}
      />

      <EditSaleDialog
        sale={editSale}
        reason={editReason}
        details={editDetails}
        products={products}
        users={users}
        customers={customers}
        stays={stays}
        cashShifts={cashShifts}
        paymentMethod={editPaymentMethod}
        userId={editUserId}
        cashShiftId={editCashShiftId}
        customerId={editCustomerId}
        stayId={editStayId}
        isAdmin={isAdmin}
        onReasonChange={setEditReason}
        onDetailsChange={setEditDetails}
        onPaymentMethodChange={setEditPaymentMethod}
        onUserIdChange={setEditUserId}
        onCashShiftIdChange={setEditCashShiftId}
        onCustomerIdChange={setEditCustomerId}
        onStayIdChange={setEditStayId}
        onOpenChange={(open) => {
          if (!open) setEditSale(null);
        }}
        onConfirm={() => {
          if (!editReason.trim()) {
            toast.error('Ingresa el motivo de la edición.');
            return;
          }
          if (editDetails.length === 0) {
            toast.error('La venta debe conservar al menos un detalle.');
            return;
          }
          edit.mutate();
        }}
        pending={edit.isPending}
      />
    </section>
  );
}

function EditSaleDialog({
  sale,
  reason,
  details,
  products,
  users,
  customers,
  stays,
  cashShifts,
  paymentMethod,
  userId,
  cashShiftId,
  customerId,
  stayId,
  isAdmin,
  onReasonChange,
  onDetailsChange,
  onPaymentMethodChange,
  onUserIdChange,
  onCashShiftIdChange,
  onCustomerIdChange,
  onStayIdChange,
  onOpenChange,
  onConfirm,
  pending,
}: {
  sale: AnyRow | null;
  reason: string;
  details: EditDetail[];
  products: AnyRow[];
  users: AnyRow[];
  customers: AnyRow[];
  stays: AnyRow[];
  cashShifts: AnyRow[];
  paymentMethod: string;
  userId: string;
  cashShiftId: string;
  customerId: string;
  stayId: string;
  isAdmin: boolean;
  onReasonChange: (value: string) => void;
  onDetailsChange: (value: EditDetail[]) => void;
  onPaymentMethodChange: (value: string) => void;
  onUserIdChange: (value: string) => void;
  onCashShiftIdChange: (value: string) => void;
  onCustomerIdChange: (value: string) => void;
  onStayIdChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const [productId, setProductId] = useState('');
  if (!sale) return null;
  const total = details.reduce((sum, detail) => sum + detail.quantity * detail.unitPrice, 0);
  const totalDiscount = details.reduce(
    (sum, detail) =>
      sum + Math.max(0, Number(detail.originalUnitPrice ?? detail.unitPrice) - detail.unitPrice) * detail.quantity,
    0,
  );
  const addProduct = () => {
    const product = products.find((item) => String(item.id) === productId);
    if (!product) return;
    const id = Number(product.id);
    const exists = details.find((detail) => detail.productId === id);
    if (exists) {
      onDetailsChange(
        details.map((detail) =>
          detail === exists ? { ...detail, quantity: detail.quantity + 1 } : detail,
        ),
      );
    } else {
      onDetailsChange([
        ...details,
        {
          itemType: 'PRODUCT',
          productId: id,
          description: productTitle(product),
          quantity: 1,
          unitPrice: Number(product.salePrice ?? 0),
          originalUnitPrice: Number(product.salePrice ?? 0),
        },
      ]);
    }
    setProductId('');
  };

  return (
    <Dialog open={sale !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(620px,calc(100vw-2rem))] p-5">
        <DialogTitle className="text-lg font-semibold">Editar venta #{String(sale.id)}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          Corrige productos, precios, método de pago y datos asociados.
        </DialogDescription>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <Select value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value)}>
              <option value="">Sin cambio</option>
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={customerId} onChange={(event) => onCustomerIdChange(event.target.value)}>
              <option value="">Sin cambio</option>
              {customers.map((customer) => (
                <option key={String(customer.id)} value={String(customer.id)}>
                  {String(customer.fullName ?? customer.documentNumber ?? customer.id)}
                </option>
              ))}
            </Select>
          </div>
          {isAdmin && (
            <>
              <div className="space-y-2">
                <Label>Usuario responsable</Label>
                <Select value={userId} onChange={(event) => onUserIdChange(event.target.value)}>
                  <option value="">Sin cambio</option>
                  {users.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {String(getValue(item, 'employee.fullName') ?? item.username ?? item.id)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Caja</Label>
                <Select value={cashShiftId} onChange={(event) => onCashShiftIdChange(event.target.value)}>
                  <option value="">Sin cambio</option>
                  {cashShifts.map((shift) => (
                    <option key={String(shift.id)} value={String(shift.id)}>
                      {cashShiftLabel(shift)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Habitación / estadía</Label>
                <Select value={stayId} onChange={(event) => onStayIdChange(event.target.value)}>
                  <option value="">Sin cambio</option>
                  {stays.map((stay) => (
                    <option key={String(stay.id)} value={String(stay.id)}>
                      Hab. {String(getValue(stay, 'room.roomNumber') ?? stay.id)} - {String(getValue(stay, 'customer.fullName') ?? 'sin cliente')} - {dateTime(stay.checkIn)}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {details.map((detail) => {
            const isProduct = detail.itemType === 'PRODUCT';
            const discount = Math.max(0, Number(detail.originalUnitPrice ?? detail.unitPrice) - detail.unitPrice) * detail.quantity;
            return (
              <div key={detail.id ?? `new-${detail.productId}`} className="rounded-md border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_110px_130px_auto] sm:items-end">
                  <div>
                    <p className="text-sm font-medium">{detail.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ITEM_TYPE_LABELS[detail.itemType]?.label ?? detail.itemType}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input
                      disabled={!isProduct}
                      min="0"
                      step="1"
                      type="number"
                      value={String(detail.quantity)}
                      onChange={(event) =>
                        onDetailsChange(
                          details.map((item) =>
                            item === detail
                              ? { ...item, quantity: Math.max(0, Number(event.target.value || 0)) }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio</Label>
                    <Input
                      min="0"
                      step="0.01"
                      type="number"
                      value={String(detail.unitPrice)}
                      onChange={(event) =>
                        onDetailsChange(
                          details.map((item) =>
                            item === detail
                              ? { ...item, unitPrice: Math.max(0, Number(event.target.value || 0)) }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!isProduct}
                    onClick={() => onDetailsChange(details.filter((item) => item !== detail))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Subtotal {money(detail.quantity * detail.unitPrice)}</span>
                  {discount > 0 && (
                    <span className="font-medium text-amber-700">Descuento {money(discount)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <Select value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">Agregar producto...</option>
            {products.map((product) => (
              <option key={String(product.id)} value={String(product.id)}>
                {productTitle(product)} · {money(product.salePrice)}
              </option>
            ))}
          </Select>
          <Button type="button" variant="outline" onClick={addProduct} disabled={!productId}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Motivo</Label>
          <Textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Ej. Precio corregido por promoción autorizada..."
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="text-sm">
            <p className="font-semibold">Nuevo total: {money(total)}</p>
            {totalDiscount > 0 && (
              <p className="text-xs font-medium text-amber-700">Descuento total: {money(totalDiscount)}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={onConfirm} disabled={pending}>
              {pending ? 'Guardando...' : 'Guardar edición'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CancelSaleDialog({
  sale,
  reason,
  cashShiftId,
  showCashShift,
  onReasonChange,
  onCashShiftChange,
  onOpenChange,
  onConfirm,
  pending,
}: {
  sale: AnyRow | null;
  reason: string;
  cashShiftId: string;
  showCashShift: boolean;
  onReasonChange: (value: string) => void;
  onCashShiftChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  if (!sale) return null;

  return (
    <Dialog open={sale !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))] p-5">
        <DialogTitle className="text-lg font-semibold">Anular venta #{String(sale.id)}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          Se devolverá el stock de productos y, si ya fue cobrada, se registrará una salida de caja por {money(sale.total)}.
        </DialogDescription>

        <div className="mt-4 space-y-2">
          <Label>Motivo</Label>
          <Textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Ej. Error en venta, producto devuelto..."
          />
        </div>

        {showCashShift && (
          <div className="mt-4">
            <CashShiftSelect value={cashShiftId} onChange={onCashShiftChange} />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'Anulando...' : 'Anular venta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function cashShiftLabel(shift: AnyRow) {
  return `Caja #${String(shift.id)} - ${String(getValue(shift, 'openedBy.employee.fullName') ?? getValue(shift, 'openedBy.username') ?? '-')} - ${dateTime(shift.openedAt)} - ${shiftLabel(shift.openedAt)}`;
}

function shiftLabel(openedAt: unknown) {
  const date = new Date(String(openedAt ?? ''));
  const hour = Number.isFinite(date.getTime()) ? date.getHours() : 0;
  return hour >= 15 || hour < 6 ? 'Turno noche' : 'Turno día';
}

function IssueInvoiceDialog({
  sale,
  invoiceType,
  onInvoiceTypeChange,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  sale: AnyRow | null;
  invoiceType: 'auto' | '01' | '03';
  onInvoiceTypeChange: (value: 'auto' | '01' | '03') => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  if (!sale) return null;
  const doc = String(getValue(sale, 'customer.documentNumber') ?? '').replace(/\D/g, '');
  const suggested = doc.length === 11 ? 'Factura (RUC)' : 'Boleta (DNI)';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))] p-5">
        <DialogTitle className="text-lg font-semibold">Emitir comprobante electrónico</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          Genera y envía el comprobante a SUNAT desde la venta #{sale.id} ({money(sale.total)}).
        </DialogDescription>

        <div className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-medium">{String(getValue(sale, 'customer.fullName') ?? '-')}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Documento</span>
            <span className="font-medium">{doc || '-'}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Sugerido</span>
            <span className="font-bold">{suggested}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Tipo de comprobante</Label>
          <Select
            value={invoiceType}
            onChange={(e) => onInvoiceTypeChange(e.target.value as 'auto' | '01' | '03')}
          >
            <option value="auto">Automático ({suggested})</option>
            <option value="03">Boleta</option>
            <option value="01">Factura (requiere RUC)</option>
          </Select>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? 'Enviando a SUNAT...' : 'Emitir comprobante'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
