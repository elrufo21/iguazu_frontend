import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../components/ui/dialog';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { dateTime, getValue, money } from '../../lib/utils';
import type { AnyRow } from '../../types';
import { normalizeRows } from '../shared/resource-save';

const TYPE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'Nota de Crédito',
  '08': 'Nota de Débito',
};

const STATUS_META: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'slate'; icon: React.ReactNode }> = {
  ACCEPTED: { label: 'Aceptado', tone: 'green', icon: <ShieldCheck className="h-3 w-3" /> },
  OBSERVED: { label: 'Observado', tone: 'amber', icon: <ShieldAlert className="h-3 w-3" /> },
  REJECTED: { label: 'Rechazado', tone: 'red', icon: <ShieldX className="h-3 w-3" /> },
  PENDING: { label: 'En SUNAT', tone: 'amber', icon: <ShieldAlert className="h-3 w-3" /> },
  CANCELED: { label: 'Anulado', tone: 'red', icon: <ShieldX className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <Badge tone={meta.tone}>
      {meta.icon}
      <span className="ml-1">{meta.label}</span>
    </Badge>
  );
}

export function BillingPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pdfInvoice, setPdfInvoice] = useState<AnyRow | null>(null);
  const [creditInvoice, setCreditInvoice] = useState<AnyRow | null>(null);
  const [creditReason, setCreditReason] = useState('');
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['billing'],
    queryFn: () => resourceApi.list('billing'),
  });

  // Botón "Actualizar estado SUNAT": consulta los tickets pendientes en SUNAT
  // bajo demanda. No hay polling automático, así el usuario controla cuándo gastar.
  const processPending = useMutation({
    mutationFn: () => resourceApi.post('billing/process-pending', {}),
    onSuccess: (res: AnyRow) => {
      const resolved = Number(res?.resolvedInvoices ?? 0);
      const pending = Number(res?.stillPending ?? 0);
      if (resolved > 0) {
        toast.success(
          `${resolved} comprobante(s) actualizado(s) por SUNAT.`,
        );
      } else if (pending > 0) {
        toast.info(`SUNAT sigue procesando ${pending} comprobante(s). Intenta de nuevo en unos minutos.`);
      } else {
        toast.info('No hay comprobantes pendientes de SUNAT.');
      }
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const viewPdf = useMutation({
    mutationFn: (invoice: AnyRow) => resourceApi.list(`billing/${invoice.id}`),
    onSuccess: (full: AnyRow) => {
      if (!full?.pdfBase64) {
        toast.error('Este comprobante no tiene PDF generado.');
        return;
      }
      setPdfInvoice(full);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const creditNote = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { reason: string } }) =>
      resourceApi.post(`billing/${id}/credit-note`, body),
    onSuccess: () => {
      toast.success('Nota de crédito emitida. El comprobante quedó anulado.');
      setCreditInvoice(null);
      setCreditReason('');
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const downloadFile = async (invoice: AnyRow, kind: 'xml' | 'cdr') => {
    try {
      await resourceApi.download(
        `billing/${invoice.id}/${kind}`,
        `${kind === 'cdr' ? 'R-' : ''}${String(invoice.docNumber ?? 'comprobante')}.xml`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const invoices = normalizeRows(query.data);

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (statusFilter) list = list.filter((i) => String(i.status) === statusFilter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((i) => {
        return (
          String(i.docNumber ?? '').toLowerCase().includes(term) ||
          String(i.customerName ?? '').toLowerCase().includes(term) ||
          String(i.customerDocNumber ?? '').includes(term)
        );
      });
    }
    return list;
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    const accepted = invoices.filter((i) => String(i.status) === 'ACCEPTED');
    const rejected = invoices.filter((i) => String(i.status) === 'REJECTED');
    const canceled = invoices.filter((i) => String(i.status) === 'CANCELED');
    const pending = invoices.filter((i) => String(i.status) === 'PENDING');
    return {
      count: invoices.length,
      accepted: accepted.length,
      rejected: rejected.length,
      canceled: canceled.length,
      pending: pending.length,
      total: accepted.reduce((sum, i) => sum + Number(i.total ?? 0), 0),
    };
  }, [invoices]);

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Comprobantes Electrónicos</h1>
          <p className="text-sm text-muted-foreground">
            Comprobantes emitidos a SUNAT (facturas, boletas y notas de crédito).
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => processPending.mutate()}
          disabled={processPending.isPending}
          className="gap-1.5 shrink-0"
          title="Consulta en SUNAT el estado de las boletas enviadas en Resumen Diario (sendSummary). No se ejecuta automáticamente: solo cuando presionas este botón."
        >
          <RefreshCw className={`h-4 w-4 ${processPending.isPending ? 'animate-spin' : ''}`} />
          {processPending.isPending ? 'Consultando SUNAT...' : 'Actualizar estado SUNAT'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Comprobantes', value: String(stats.count), icon: <Receipt className="h-5 w-5 text-primary" /> },
          { label: 'Aceptados', value: String(stats.accepted), icon: <ShieldCheck className="h-5 w-5 text-emerald-600" /> },
          { label: 'En SUNAT', value: String(stats.pending), icon: <ShieldAlert className="h-5 w-5 text-amber-600" /> },
          { label: 'Rechazados', value: String(stats.rejected), icon: <ShieldX className="h-5 w-5 text-red-600" /> },
          { label: 'Facturado (aceptado)', value: money(stats.total), icon: <FileText className="h-5 w-5 text-violet-600" /> },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 leading-none">{stat.value}</p>
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
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 bg-muted/50"
                placeholder="Buscar por Nº, cliente o documento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="ACCEPTED">Aceptados</option>
              <option value="OBSERVED">Observados</option>
              <option value="PENDING">En SUNAT</option>
              <option value="REJECTED">Rechazados</option>
              <option value="CANCELED">Anulados</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listado */}
      {query.isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando comprobantes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
          No hay comprobantes. Emití uno desde una venta pagada (Historial de Ventas).
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((invoice) => (
            <InvoiceCard
              key={String(invoice.id)}
              invoice={invoice}
              onViewPdf={(inv) => viewPdf.mutate(inv)}
              onDownloadXml={(inv) => void downloadFile(inv, 'xml')}
              onDownloadCdr={(inv) => void downloadFile(inv, 'cdr')}
              onCreditNote={(inv) => {
                setCreditInvoice(inv);
                setCreditReason('');
              }}
              isLoading={viewPdf.isPending && viewPdf.variables?.id === invoice.id}
            />
          ))}
        </div>
      )}

      {/* Visor de PDF */}
      <PdfViewerDialog
        invoice={pdfInvoice}
        open={pdfInvoice !== null}
        onOpenChange={(open) => {
          if (!open) setPdfInvoice(null);
        }}
      />

      {/* Modal nota de crédito */}
      <Dialog
        open={creditInvoice !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreditInvoice(null);
            setCreditReason('');
          }
        }}
      >
          <DialogContent className="w-[min(480px,calc(100vw-2rem))] p-5">
            <DialogTitle className="text-lg font-semibold">Emitir nota de crédito</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Anula el comprobante {String(creditInvoice?.docNumber ?? '')} con una nota de crédito enviada a SUNAT.
          </DialogDescription>
          <div className="mt-4 space-y-2">
            <Label>Motivo de anulación</Label>
            <Input
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              placeholder="Ej: Error en el monto facturado"
              maxLength={280}
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreditInvoice(null);
                setCreditReason('');
              }}
              disabled={creditNote.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!creditInvoice) return;
                creditNote.mutate({ id: Number(creditInvoice.id), body: { reason: creditReason } });
              }}
              disabled={creditNote.isPending || !creditReason.trim()}
            >
              {creditNote.isPending ? 'Enviando...' : 'Emitir nota de crédito'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function InvoiceCard({
  invoice,
  onViewPdf,
  onDownloadXml,
  onDownloadCdr,
  onCreditNote,
  isLoading,
}: {
  invoice: AnyRow;
  onViewPdf: (invoice: AnyRow) => void;
  onDownloadXml: (invoice: AnyRow) => void;
  onDownloadCdr: (invoice: AnyRow) => void;
  onCreditNote: (invoice: AnyRow) => void;
  isLoading: boolean;
}) {
  const type = String(invoice.invoiceType ?? '03');
  const status = String(invoice.status ?? 'PENDING');
  const isCreditNote = type === '07';
  const canCancel = status === 'ACCEPTED' && !isCreditNote;
  // Boleta en Resumen Diario: el CDR aún no está disponible hasta que SUNAT procese el ticket.
  const isPending = status === 'PENDING';

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-bold text-primary text-sm">
              {TYPE_LABELS[type] ?? type} {String(invoice.docNumber ?? '')}
            </span>
            <StatusBadge status={status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{String(invoice.customerName ?? '-')}</span>
            <span>Doc.: {String(invoice.customerDocNumber ?? '-')}</span>
            <span>{dateTime(invoice.createdAt)}</span>
          </div>
          {Boolean(invoice.sunatCode) && (
            <p className="text-xs text-muted-foreground mt-1">
              SUNAT código: <span className="font-mono">{String(invoice.sunatCode)}</span>
              {invoice.sunatDescription ? ` — ${String(invoice.sunatDescription)}` : ''}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xl font-bold ${isCreditNote ? 'text-red-600' : ''}`}>
            {isCreditNote ? '-' : ''}{money(invoice.total)}
          </p>
          {Boolean(invoice.affectedInvoice) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Anula: {String(getValue(invoice, 'affectedInvoice.docNumber') ?? '')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border/40">
        {canCancel && (
          <Button variant="outline" size="sm" onClick={() => onCreditNote(invoice)} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Anular con NC
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewPdf(invoice)}
          disabled={isLoading}
          className="gap-1.5"
        >
          <FileText className="h-4 w-4" />
          Ver PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDownloadXml(invoice)}
          disabled={isPending}
          title={isPending ? 'El XML estará disponible cuando SUNAT procese el resumen' : ''}
        >
          XML
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDownloadCdr(invoice)}
          disabled={isPending}
          title={isPending ? 'El CDR aún no llegó de SUNAT (boleta en Resumen Diario)' : ''}
        >
          CDR
        </Button>
      </div>
    </div>
  );
}

function PdfViewerDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: AnyRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!invoice) return null;
  const src = invoice.pdfBase64
    ? `data:application/pdf;base64,${invoice.pdfBase64}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:w-[min(900px,calc(100vw-2rem))] md:max-h-[90vh] p-2">
        <DialogTitle className="sr-only">PDF del comprobante {String(invoice.docNumber ?? '')}</DialogTitle>
        <DialogDescription className="sr-only">
          Vista previa del comprobante electrónico.
        </DialogDescription>
        {src ? (
          <iframe src={src} title="PDF" className="w-full h-[80vh] rounded-lg border border-border" />
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Este comprobante no tiene PDF generado.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
