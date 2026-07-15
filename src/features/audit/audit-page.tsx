import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { columnLabel, dateTime, getValue, money, valueLabel } from '../../lib/utils';
import type { AnyRow } from '../../types';
import { normalizeRows } from '../shared/resource-save';

export function AuditPage() {
  const [search, setSearch] = useState('');
  const logs = useQuery({
    queryKey: ['audit'],
    queryFn: () => resourceApi.list('audit'),
  });
  const rows = normalizeRows(logs.data);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [
        dateTime(row.createdAt),
        getValue(row, 'user.username'),
        row.action,
        row.entity,
        row.entityId,
        compactChange(row.oldData),
        compactChange(row.newData),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [rows, search]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Auditoría</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cambios importantes registrados por usuario.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-3 md:p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar" />
          </div>

          {logs.isLoading ? (
            <EmptyText>Cargando auditoría...</EmptyText>
          ) : logs.isError ? (
            <EmptyText className="text-red-700">{errorMessage(logs.error)}</EmptyText>
          ) : filtered.length === 0 ? (
            <EmptyText>No hay registros para mostrar.</EmptyText>
          ) : (
            <div className="space-y-3">
              {filtered.map((log) => (
                <AuditItem key={String(log.id)} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function AuditItem({ log }: { log: AnyRow }) {
  const user = getValue(log, 'user.username') ?? 'Sistema';

  return (
    <article className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={actionTone(log.action)}>{valueLabel(log.action)}</Badge>
            <span className="text-sm font-semibold">{String(log.entity ?? '-')} #{String(log.entityId ?? '-')}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {dateTime(log.createdAt)} · {String(user)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ChangeBox title="Antes" value={log.oldData} />
        <ChangeBox title="Después" value={log.newData} />
      </div>
    </article>
  );
}

function ChangeBox({ title, value }: { title: string; value: unknown }) {
  if (!value) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide">{title}</p>
        -
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">{changeRows(value)}</div>
    </div>
  );
}

function changeRows(value: unknown) {
  if (!value || typeof value !== 'object') {
    return <ChangeRow label="Valor" value={valueLabel(value ?? '-')} />;
  }

  return Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !['id', 'stayId', 'productId'].includes(key))
    .map(([key, val]) => <ChangeRow key={key} label={fieldLabel(key)} value={formatField(key, val)} />);
}

function ChangeRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-md bg-white px-3 py-2 text-sm sm:grid-cols-[140px_1fr]">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="min-w-0">{value}</div>
    </div>
  );
}

function formatField(key: string, value: unknown): ReactNode {
  if (key === 'details' && Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <SaleDetailLine key={index} item={item} />
        ))}
      </div>
    );
  }
  if (key === 'stockDeltas' && value && typeof value === 'object') {
    const changed = Object.entries(value as Record<string, unknown>).filter(([, qty]) => Number(qty) !== 0);
    return changed.length ? changed.map(([id, qty]) => `Producto #${id}: ${qty}`).join(', ') : 'Sin cambio';
  }
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value && typeof value === 'object') return compactChange(value);
  if (['total', 'subtotal', 'unitPrice'].includes(key)) return money(value);
  return valueLabel(value ?? '-');
}

function SaleDetailLine({ item }: { item: unknown }) {
  if (!item || typeof item !== 'object') return <p>{valueLabel(item ?? '-')}</p>;
  const row = item as Record<string, unknown>;
  return (
    <div className="rounded border border-border px-2 py-1">
      <p className="font-medium">
        {Number(row.quantity ?? 0)} x {String(row.description ?? valueLabel(row.itemType ?? 'Detalle'))}
      </p>
      <p className="text-xs text-muted-foreground">
        Precio {money(row.unitPrice)} · Subtotal {money(row.subtotal)}
      </p>
    </div>
  );
}

function fieldLabel(key: string) {
  if (key === 'details') return 'Detalle vendido';
  if (key === 'stockDeltas') return 'Stock';
  return columnLabel(key);
}

function compactChange(value: unknown) {
  if (!value || typeof value !== 'object') return valueLabel(value ?? '-');
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 5);
  if (!entries.length) return '-';
  return entries.map(([key, val]) => `${columnLabel(key)}: ${shortValue(val)}`).join(' · ');
}

function shortValue(value: unknown) {
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value && typeof value === 'object') return 'detalle';
  return valueLabel(value ?? '-');
}

function actionTone(value: unknown) {
  if (value === 'CREATE') return 'green';
  if (value === 'DELETE') return 'red';
  return 'blue';
}

function EmptyText({ children, className = '' }: { children: string; className?: string }) {
  return <div className={`grid min-h-44 place-items-center text-sm text-muted-foreground ${className}`}>{children}</div>;
}
