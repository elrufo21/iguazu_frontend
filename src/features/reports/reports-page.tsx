import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BedDouble,
  Boxes,
  FileSpreadsheet,
  FileText,
  Package,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { DataTable, type AppColumn } from '../../components/data-table/data-table';
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
import { columnLabel, dateTime, money, valueLabel } from '../../lib/utils';
import type { AnyRow } from '../../types';
import { normalizeRows } from '../shared/resource-save';

type ReportKey =
  | 'cash-summary'
  | 'sales-full'
  | 'occupancy'
  | 'product-sales'
  | 'product-sales-by-user'
  | 'inventory'
  | 'staff';

type ReportDef = { value: ReportKey; label: string; icon: LucideIcon };

// Reportes definitivos para un hotel pequeño (~10 clientes/día).
const reports: ReportDef[] = [
  { value: 'cash-summary', label: 'Cierre de caja', icon: Wallet },
  { value: 'sales-full', label: 'Ventas e ingresos', icon: TrendingUp },
  { value: 'occupancy', label: 'Ocupación', icon: BedDouble },
  { value: 'product-sales', label: 'Productos vendidos', icon: Package },
  { value: 'product-sales-by-user', label: 'Productos por usuario', icon: Users },
  { value: 'inventory', label: 'Inventario y pérdidas', icon: Boxes },
  { value: 'staff', label: 'Planilla de personal', icon: Users },
];

const today = new Date();
const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const defaultTo = today.toISOString().slice(0, 10);

export function ReportsPage() {
  const [report, setReport] = useState<ReportKey>('cash-summary');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const path = useMemo(() => `reports/${report}?from=${from}&to=${to}`, [report, from, to]);
  const query = useQuery({ queryKey: ['reports', report, from, to], queryFn: () => resourceApi.list(path) });
  const data = (query.data ?? {}) as AnyRow;
  const selectedReport = reports.find((item) => item.value === report);
  const canExport = !query.isLoading && !query.isError && Boolean(query.data);
  const exportBaseName = `reporte-${report}-${from}-${to}`;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Reportes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Indicadores claros para caja, ventas, hotel, inventario y personal.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-5 lg:w-[820px]">
          <Field label="Reporte">
            <Select value={report} onChange={(event) => setReport(event.target.value as ReportKey)}>
              {reports.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Desde">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <Button
            className="self-end"
            variant="outline"
            disabled={!canExport}
            onClick={() => void downloadPdf(selectedReport?.label ?? 'Reporte', report, from, to, data, exportBaseName)}
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button
            className="self-end"
            variant="outline"
            disabled={!canExport}
            onClick={() => void downloadExcel(selectedReport?.label ?? 'Reporte', report, data, exportBaseName)}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {query.isLoading && <Card className="grid min-h-48 place-items-center p-6 text-sm text-muted-foreground">Cargando reporte...</Card>}
      {query.isError && <Card className="grid min-h-48 place-items-center p-6 text-sm text-red-700">{errorMessage(query.error)}</Card>}
      {!query.isLoading && !query.isError && <ReportBody report={report} data={data} />}
    </section>
  );
}

// ============================================================
// Router de reportes
// ============================================================
function ReportBody({ report, data }: { report: ReportKey; data: AnyRow }) {
  switch (report) {
    case 'cash-summary':
      return <CashSummaryReport data={data} />;
    case 'sales-full':
      return <SalesFullReport data={data} />;
    case 'occupancy':
      return <OccupancyReport data={data} />;
    case 'product-sales':
      return <ProductSalesReport data={data} />;
    case 'product-sales-by-user':
      return <ProductSalesByUserReport data={data} />;
    case 'inventory':
      return <InventoryReport data={data} />;
    case 'staff':
      return <StaffReport data={data} />;
  }
}

// ============================================================
// 1. Cierre de caja
// ============================================================
function CashSummaryReport({ data }: { data: AnyRow }) {
  const difference = Number(data.differenceTotal ?? 0);
  const diffTone: Tone = difference === 0 ? 'green' : difference < 0 ? 'red' : 'amber';
  const closures = normalizeRows(data.closures);
  const unsettledCount = Number(data.unsettledCount ?? 0);

  const [settleClosure, setSettleClosure] = useState<AnyRow | null>(null);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const settle = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { reason: string } }) =>
      resourceApi.post(`cash-closures/${id}/settle`, body),
    onSuccess: () => {
      toast.success('Diferencia cuadrada.');
      setSettleClosure(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Turnos" value={data.shifts} tone="blue" />
        <KpiCard label="Ventas" value={data.salesCount} tone="blue" />
        <KpiCard label="Monto inicial" value={money(data.openingAmount)} tone="slate" />
        <KpiCard label="Ingresos" value={money(data.incomeTotal)} tone="green" />
        <KpiCard label="Egresos" value={money(data.expenseTotal)} tone="amber" />
        <KpiCard label="Esperado cerrado" value={money(data.expectedTotal)} tone="slate" />
        <KpiCard label="Diferencia" value={money(difference)} tone={diffTone} />
        <KpiCard
          label="Cuadres pendientes"
          value={unsettledCount}
          tone={unsettledCount > 0 ? 'red' : 'green'}
        />
      </KpiGrid>

      <SectionTitle>Cierres del periodo</SectionTitle>
      <SimpleTable
        rows={closures}
        columns={['openedBy', 'closedBy', 'totalExpected', 'totalCounted', 'difference', 'settled', 'createdAt']}
        moneyCols={['totalExpected', 'totalCounted', 'difference']}
        dateCols={['createdAt']}
        actions={(row) => {
          const diff = Number(row.difference ?? 0);
          if (diff === 0 || row.settled) return null;
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSettleClosure(row);
                setReason('');
              }}
            >
              Cuadrar
            </Button>
          );
        }}
        renderCol={(col, value, row) => {
          if (col === 'difference') return <DifferenceBadge value={Number(value ?? 0)} />;
          if (col === 'settled') return <SettledBadge row={row} />;
          return undefined;
        }}
      />

      <SectionTitle>Movimientos de caja</SectionTitle>
      <SimpleTable
        rows={normalizeRows(data.movements)}
        columns={['cashShiftId', 'type', 'category', 'paymentMethod', 'amount', 'user', 'customer', 'room', 'details', 'occurredAt']}
        moneyCols={['amount']}
        dateCols={['occurredAt']}
        emptyMessage="Sin movimientos en el periodo."
        renderCol={(col, value) => {
          if (col === 'type' || col === 'category' || col === 'paymentMethod') return <Badge tone="slate">{valueLabel(value)}</Badge>;
          return undefined;
        }}
      />

      <SettleDialog
        closure={settleClosure}
        reason={reason}
        onReasonChange={setReason}
        open={settleClosure !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSettleClosure(null);
            setReason('');
          }
        }}
        onConfirm={() => {
          if (!settleClosure) return;
          settle.mutate({ id: Number(settleClosure.id), body: { reason } });
        }}
        pending={settle.isPending}
      />
    </div>
  );
}

function SettledBadge({ row }: { row: AnyRow }) {
  const diff = Number(row.difference ?? 0);
  if (diff === 0) return <Badge tone="green">Cuadró</Badge>;
  if (row.settled) return <Badge tone="blue">Cuadrado</Badge>;
  return <Badge tone="red">Pendiente</Badge>;
}

function SettleDialog({
  closure,
  reason,
  onReasonChange,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  closure: AnyRow | null;
  reason: string;
  onReasonChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  if (!closure) return null;
  const diff = Number(closure.difference ?? 0);
  const isShort = diff < 0;
  const label = isShort ? 'Faltante' : 'Sobrante';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))] p-5">
        <DialogTitle className="text-lg font-semibold">Cuadrar diferencia</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          Registra un movimiento de ajuste para que el turno quede cuadrado.
        </DialogDescription>

        <div className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <span className="font-semibold">{label}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Monto</span>
            <span className={`font-bold ${isShort ? 'text-red-600' : 'text-emerald-600'}`}>
              {money(Math.abs(diff))}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {isShort
              ? 'Se registrará un EGRESO: el faltante se asume o el cajero repone.'
              : 'Se registrará un INGRESO: el sobrante entra a caja.'}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Motivo</Label>
          <Input
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder={isShort ? 'Ej: Faltante, cajero repone' : 'Ej: Sobrante de turno'}
            maxLength={280}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending || !reason.trim()}
          >
            {pending ? 'Cuadrando...' : 'Cuadrar diferencia'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 2. Ventas e ingresos (sales-full)
// ============================================================
function SalesFullReport({ data }: { data: AnyRow }) {
  const summary = (data.summary ?? {}) as AnyRow;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Ventas" value={summary.count} tone="blue" />
        <KpiCard label="Total" value={money(summary.total)} tone="slate" />
        <KpiCard label="Pagado" value={money(summary.paid)} tone="green" />
        <KpiCard label="Pendiente" value={money(summary.pending)} tone="amber" />
        <KpiCard label="Anulado" value={money(summary.cancelled)} tone="red" />
      </KpiGrid>

      <SectionTitle>Ingresos por tipo de habitación</SectionTitle>
      <SimpleTable
        rows={normalizeRows(data.incomeByRoomType)}
        columns={['roomType', 'count', 'total']}
        moneyCols={['total']}
      />

      <SectionTitle>Desglose por tipo de ítem</SectionTitle>
      <SimpleTable
        rows={normalizeRows(data.byItemType)}
        columns={['itemType', 'quantity', 'total']}
        moneyCols={['total']}
        renderCol={(col, value) =>
          col === 'itemType' ? <ItemTypeBadge value={String(value)} /> : undefined
        }
      />

      <SectionTitle>Anulaciones</SectionTitle>
      <SimpleTable
        rows={normalizeRows(data.cancellations)}
        columns={['id', 'total', 'reason', 'cancelledBy', 'cancelledAt']}
        moneyCols={['total']}
        dateCols={['cancelledAt']}
        emptyMessage="Sin anulaciones en el periodo."
      />

      <SectionTitle>Detalle de ventas</SectionTitle>
      <SimpleTable
        rows={normalizeRows(data.sales)}
        columns={['id', 'status', 'customer', 'room', 'user', 'paymentMethod', 'total', 'details', 'createdAt']}
        moneyCols={['total']}
        dateCols={['createdAt']}
        emptyMessage="Sin ventas en el periodo."
        renderCol={(col, value) => {
          if (col === 'status') return <Badge tone="slate">{valueLabel(value)}</Badge>;
          if (col === 'paymentMethod') return String(value).split(' + ').map((item) => valueLabel(item)).join(' + ');
          return undefined;
        }}
      />
    </div>
  );
}

// ============================================================
// 3. Ocupación
// ============================================================
function OccupancyReport({ data }: { data: AnyRow }) {
  const percent = Number(data.occupancyPercent ?? 0);
  const barTone = percent >= 70 ? 'green' : percent >= 40 ? 'amber' : 'red';

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Habitaciones" value={data.totalRooms} tone="blue" />
        <KpiCard label="Ocupadas en rango" value={data.occupiedRoomsInRange} tone="slate" />
        <KpiCard label="Estadías activas" value={data.activeStays} tone="green" />
        <KpiCard label="Estadías cerradas" value={data.closedStays} tone="slate" />
        <KpiCard label="Promedio horas" value={data.averageHours} tone="blue" />
      </KpiGrid>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ocupación del periodo</h2>
            <span className="text-2xl font-bold">{percent}%</span>
          </div>
          <ProgressBar value={percent} tone={barTone} />
        </CardContent>
      </Card>

      <SectionTitle>Por tipo de habitación</SectionTitle>
      <SimpleTable rows={objectRowsArray(data.byRoomType)} columns={['Concepto', 'Valor']} />

      <SectionTitle>Estado actual</SectionTitle>
      <SimpleTable rows={objectRowsArray(data.currentRoomStatus)} columns={['Concepto', 'Valor']} />
    </div>
  );
}

// ============================================================
// 4. Productos vendidos
// ============================================================
function ProductSalesReport({ data }: { data: AnyRow }) {
  const rows = normalizeRows(data.rows);
  const totalSold = rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);

  const columns: AppColumn[] = [
    { header: 'Producto', accessor: 'product' },
    { header: 'Unidad', accessor: 'unit' },
    { header: 'Cantidad', accessor: 'quantity' },
    { header: 'Total', accessor: 'total', render: (v) => money(Number(v ?? 0)) },
    { header: 'Costo', accessor: 'costTotal', render: (v) => money(Number(v ?? 0)) },
    { header: 'Ganancia', accessor: 'profitTotal', render: (v) => money(Number(v ?? 0)) },
    { header: 'Stock', accessor: 'stock' },
    {
      header: 'Estado',
      accessor: 'stock',
      render: (_v, row) => {
        const stock = Number(row.stock ?? 0);
        const min = Number(row.minStock ?? 0);
        return stock <= min ? <Badge tone="red">Stock bajo</Badge> : <Badge tone="green">OK</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Productos vendidos" value={totalSold} tone="blue" />
        <KpiCard label="Monto total" value={money(totalAmount)} tone="green" />
        <KpiCard label="Productos distintos" value={rows.length} tone="slate" />
      </KpiGrid>

      <DataTable data={rows} columns={columns} />
    </div>
  );
}

function ProductSalesByUserReport({ data }: { data: AnyRow }) {
  const rows = normalizeRows(data.rows);
  const totalSold = rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const columns: AppColumn[] = [
    { header: 'Producto', accessor: 'product' },
    { header: 'Usuario', accessor: 'user' },
    { header: 'Caja', accessor: 'cashShift' },
    { header: 'Apertura', accessor: 'cashOpenedAt', render: (v) => dateTime(v) },
    { header: 'Turno', accessor: 'workShift', render: (v) => <Badge tone="blue">{String(v ?? '-')}</Badge> },
    { header: 'Cantidad', accessor: 'quantity' },
    { header: 'Total', accessor: 'total', render: (v) => money(Number(v ?? 0)) },
  ];

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Unidades vendidas" value={totalSold} tone="blue" />
        <KpiCard label="Monto total" value={money(totalAmount)} tone="green" />
        <KpiCard label="Filas" value={rows.length} tone="slate" />
      </KpiGrid>
      <DataTable data={rows} columns={columns} />
    </div>
  );
}

// ============================================================
// 5. Inventario y pérdidas
// ============================================================
function InventoryReport({ data }: { data: AnyRow }) {
  const columns: AppColumn[] = [
    { header: 'Producto', accessor: 'product' },
    {
      header: 'Tipo',
      accessor: 'type',
      render: (v) => <MovementTypeBadge value={String(v)} />,
    },
    { header: 'Cantidad', accessor: 'quantity' },
    { header: 'Motivo', accessor: 'reason' },
    { header: 'Fecha', accessor: 'createdAt', render: (v) => dateTime(v) },
  ];

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Productos activos" value={data.productsActive ?? '—'} tone="blue" />
        <KpiCard label="Pérdidas" value={data.lossCount} tone="amber" />
        <KpiCard label="Valor pérdida" value={money(data.lossTotal)} tone="red" />
        <KpiCard label="Stock bajo" value={normalizeRows(data.lowStock).length} tone="red" />
      </KpiGrid>

      <SectionTitle>Stock bajo — por reponer</SectionTitle>
      <SimpleTable
        rows={normalizeRows(data.lowStock)}
        columns={['name', 'stock', 'minStock']}
        emptyMessage="No hay productos con stock bajo. ✅"
      />

      <SectionTitle>Movimientos</SectionTitle>
      <DataTable data={normalizeRows(data.movements)} columns={columns} />
    </div>
  );
}

// ============================================================
// 6. Planilla de personal
// ============================================================
function StaffReport({ data }: { data: AnyRow }) {
  const columns: AppColumn[] = [
    { header: 'Empleado', accessor: 'employee' },
    { header: 'Días', accessor: 'attendanceDays' },
    { header: 'Bruto', accessor: 'gross', render: (v) => money(Number(v ?? 0)) },
    { header: 'Penaliz.', accessor: 'penaltiesApplied', render: (v) => money(Number(v ?? 0)) },
    { header: 'Descuentos', accessor: 'discounts', render: (v) => money(Number(v ?? 0)) },
    { header: 'Neto', accessor: 'net', render: (v) => money(Number(v ?? 0)) },
    { header: 'Adelantos', accessor: 'advances', render: (v) => money(Number(v ?? 0)) },
    {
      header: 'Pendiente descontar',
      accessor: 'pendingPenalties',
      render: (v) => {
        const n = Number(v ?? 0);
        return n > 0 ? <Badge tone="amber">{money(n)}</Badge> : <span className="text-muted-foreground">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Pagado (neto)" value={money(data.paymentsTotal)} tone="green" />
        <KpiCard label="Bruto" value={money(data.paymentsGrossTotal)} tone="slate" />
        <KpiCard label="Penaliz. aplicadas" value={money(data.penaltiesAppliedTotal)} tone="amber" />
        <KpiCard label="Descuentos (pérdidas)" value={money(data.discountsTotal)} tone="amber" />
        <KpiCard label="Adelantos" value={money(data.advancesTotal)} tone="slate" />
        <KpiCard label="Pendiente descontar" value={money(data.pendingPenaltiesTotal)} tone="red" />
      </KpiGrid>

      <DataTable data={normalizeRows(data.byEmployee)} columns={columns} />
    </div>
  );
}

// ============================================================
// Componentes reutilizables
// ============================================================

type Tone = 'default' | 'green' | 'amber' | 'red' | 'blue' | 'slate';

const toneText: Record<Tone, string> = {
  default: 'text-primary',
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  blue: 'text-sky-600',
  slate: 'text-slate-700',
};

const barFill: Record<Tone, string> = {
  default: 'bg-primary',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-sky-500',
  slate: 'bg-slate-400',
};

function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{children}</div>;
}

function KpiCard({ label, value, tone = 'slate' }: { label: string; value: unknown; tone?: Tone }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-semibold ${toneText[tone]}`}>{displayValue(value)}</p>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ value, tone = 'default' }: { value: number; tone?: Tone }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${barFill[tone]}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

function DifferenceBadge({ value }: { value: number }) {
  if (value === 0) return <Badge tone="green">Cuadra</Badge>;
  return <Badge tone={value < 0 ? 'red' : 'amber'}>{money(value)}</Badge>;
}

function ItemTypeBadge({ value }: { value: string }) {
  const map: Record<string, Tone> = {
    ROOM_RENT: 'blue',
    PRODUCT: 'green',
    PENALTY: 'red',
    OTHER: 'slate',
  };
  return <Badge tone={map[value] ?? 'slate'}>{valueLabel(value)}</Badge>;
}

function MovementTypeBadge({ value }: { value: string }) {
  const map: Record<string, Tone> = {
    IN: 'green',
    OUT: 'blue',
    LOSS: 'red',
    ADJUSTMENT: 'amber',
  };
  return <Badge tone={map[value] ?? 'slate'}>{valueLabel(value)}</Badge>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function displayValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value ?? 0);
}

function asRow(value: unknown): AnyRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRow) : {};
}

function objectRowsArray(data?: unknown) {
  return Object.entries(asRow(data)).map(([Concepto, Valor]) => ({ Concepto: valueLabel(Concepto), Valor: displayValue(Valor) }));
}

// ============================================================
// Tabla simple (listas cortas) con render personalizado opcional
// ============================================================
function SimpleTable({
  rows,
  columns,
  moneyCols = [],
  dateCols = [],
  renderCol,
  actions,
  emptyMessage = 'Sin datos para mostrar.',
}: {
  rows: AnyRow[];
  columns: string[];
  moneyCols?: string[];
  dateCols?: string[];
  renderCol?: (column: string, value: unknown, row: AnyRow) => ReactNode | undefined;
  actions?: (row: AnyRow) => ReactNode;
  emptyMessage?: string;
}) {
  if (!rows.length) {
    return <Card className="grid min-h-32 place-items-center p-6 text-sm text-muted-foreground">{emptyMessage}</Card>;
  }
  const hasActions = Boolean(actions);
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-semibold">{columnLabel(column)}</th>
              ))}
              {hasActions && <th className="px-4 py-3 font-semibold text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)} className="border-t border-border">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3">
                    {renderCol?.(column, row[column], row) ?? format(row[column], column, moneyCols, dateCols)}
                  </td>
                ))}
                {hasActions && (
                  <td className="px-4 py-3 text-right">{actions?.(row)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function format(value: unknown, column: string, moneyCols: string[], dateCols: string[]) {
  if (moneyCols.includes(column)) return money(Number(value ?? 0));
  if (dateCols.includes(column)) return dateTime(value);
  if (typeof value === 'string') return valueLabel(value);
  return String(value ?? '-');
}

// ============================================================
// Exportación PDF / Excel
// ============================================================
async function downloadExcel(title: string, report: ReportKey, data: AnyRow, fileName: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const sections = buildExportSections(report, data);
  const sheets = sections.map((section, index) => {
    const rows = section.rows.length ? section.rows : [{ Mensaje: 'Sin datos' }];
    const headers = Object.keys(rows[0] ?? {});
    return {
      sheet: sheetName(`${title} - ${section.title}`, index),
      data: [
        headers.map((value) => ({ value: columnLabel(value), fontWeight: 'bold' as const })),
        ...rows.map((row) => headers.map((header) => excelValue(row[header]))),
      ],
    };
  });
  const file = await writeXlsxFile(sheets as any);
  await file.toFile(`${fileName}.xlsx`);
}

async function downloadPdf(title: string, _report: ReportKey, from: string, to: string, data: AnyRow, fileName: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  let y = 42;
  doc.setFontSize(16);
  doc.text(title, 40, y);
  y += 20;
  doc.setFontSize(10);
  doc.text(`Periodo: ${from} al ${to}`, 40, y);
  y += 22;

  for (const section of buildExportSections(_report, data)) {
    if (y > 500) {
      doc.addPage();
      y = 42;
    }
    doc.setFontSize(12);
    doc.text(section.title, 40, y);
    y += 8;

    const rows = section.rows.length ? section.rows : [{ Mensaje: 'Sin datos' }];
    const headers = Object.keys(rows[0] ?? {});
    autoTable(doc, {
      startY: y,
      head: [headers.map(columnLabel)],
      body: rows.map((row) => headers.map((header) => printable(row[header]))),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [16, 35, 31] },
      margin: { left: 40, right: 40 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 24;
  }

  doc.save(`${fileName}.pdf`);
}

function buildExportSections(report: ReportKey, data: AnyRow): ExportSection[] {
  const sections: ExportSection[] = [{ title: 'Resumen', rows: summaryRows(report, data) }];
  switch (report) {
    case 'cash-summary':
      sections.push({ title: 'Cierres', rows: normalizeRows(data.closures) });
      sections.push({ title: 'Movimientos de caja', rows: normalizeRows(data.movements) });
      break;
    case 'sales-full':
      sections.push({ title: 'Ingresos por tipo de habitación', rows: normalizeRows(data.incomeByRoomType) });
      sections.push({ title: 'Por tipo de ítem', rows: normalizeRows(data.byItemType) });
      sections.push({ title: 'Anulaciones', rows: normalizeRows(data.cancellations) });
      sections.push({ title: 'Detalle de ventas', rows: normalizeRows(data.sales) });
      break;
    case 'occupancy':
      sections.push({ title: 'Por tipo de habitación', rows: objectRows(data.byRoomType) });
      sections.push({ title: 'Estado actual', rows: objectRows(data.currentRoomStatus) });
      break;
    case 'product-sales':
      sections.push({ title: 'Productos vendidos', rows: normalizeRows(data.rows) });
      break;
    case 'product-sales-by-user':
      sections.push({ title: 'Productos por usuario', rows: normalizeRows(data.rows) });
      break;
    case 'inventory':
      sections.push({ title: 'Stock bajo', rows: normalizeRows(data.lowStock) });
      sections.push({ title: 'Movimientos', rows: normalizeRows(data.movements) });
      break;
    case 'staff':
      sections.push({ title: 'Por empleado', rows: normalizeRows(data.byEmployee) });
      sections.push({ title: 'Penalidades pendientes', rows: normalizeRows(data.pendingPenaltiesByEmployee) });
      break;
  }
  return sections;
}

function summaryRows(report: ReportKey, data: AnyRow) {
  switch (report) {
    case 'cash-summary':
      return metricRows([
        ['Turnos', data.shifts],
        ['Ventas', data.salesCount],
        ['Monto inicial', data.openingAmount],
        ['Ingresos', data.incomeTotal],
        ['Egresos', data.expenseTotal],
        ['Esperado', data.expectedTotal],
        ['Diferencia', data.differenceTotal],
      ]);
    case 'sales-full': {
      const s = (data.summary ?? {}) as AnyRow;
      return metricRows([
        ['Ventas', s.count],
        ['Total', s.total],
        ['Pagado', s.paid],
        ['Pendiente', s.pending],
        ['Anulado', s.cancelled],
      ]);
    }
    case 'occupancy':
      return metricRows([
        ['Habitaciones', data.totalRooms],
        ['Ocupadas', data.occupiedRoomsInRange],
        ['Ocupación %', data.occupancyPercent],
        ['Activas', data.activeStays],
        ['Cerradas', data.closedStays],
        ['Promedio horas', data.averageHours],
      ]);
    case 'product-sales':
      return metricRows([['Productos distintos', normalizeRows(data.rows).length]]);
    case 'product-sales-by-user':
      return metricRows([['Filas', normalizeRows(data.rows).length]]);
    case 'inventory':
      return metricRows([
        ['Pérdidas', data.lossCount],
        ['Valor pérdida', data.lossTotal],
      ]);
    case 'staff':
      return metricRows([
        ['Pagado neto', data.paymentsTotal],
        ['Bruto', data.paymentsGrossTotal],
        ['Penaliz. aplicadas', data.penaltiesAppliedTotal],
        ['Descuentos (pérdidas)', data.discountsTotal],
        ['Adelantos', data.advancesTotal],
        ['Pendiente descontar', data.pendingPenaltiesTotal],
      ]);
  }
}

type ExportSection = { title: string; rows: Record<string, unknown>[] };

function metricRows(items: Array<[string, unknown]>) {
  return items.map(([Métrica, Valor]) => ({ Métrica, Valor }));
}

function objectRows(data?: unknown) {
  return Object.entries(asRow(data)).map(([Concepto, Valor]) => ({
    Concepto: valueLabel(Concepto),
    Valor: displayValue(Valor),
  }));
}

function printable(value: unknown) {
  if (value instanceof Date) return dateTime(value);
  if (typeof value === 'string') return valueLabel(value);
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value ?? '');
}

function sheetName(title: string, index: number) {
  return `${index + 1} ${title}`.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
}

function excelValue(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return valueLabel(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}
