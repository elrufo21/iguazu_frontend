import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { getValue, valueLabel } from '../../lib/utils';
import type { AnyRow } from '../../types';
import { Card } from '../ui/card';
import { Input } from '../ui/input';

export type AppColumn = {
  header: string;
  accessor: string;
  render?: (value: unknown, row: AnyRow) => ReactNode;
};

export function DataTable({
  data,
  columns,
  actions,
  loading,
  error,
}: {
  data: AnyRow[];
  columns: AppColumn[];
  actions?: (row: AnyRow) => ReactNode;
  loading?: boolean;
  error?: string;
}) {
  const [filter, setFilter] = useState('');
  const defs = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      ...columns.map((column) => ({
        header: column.header,
        accessorFn: (row: AnyRow) => getValue(row, column.accessor),
        cell: (context: CellContext<AnyRow, unknown>) => {
          const value = context.getValue();
          return column.render?.(value, context.row.original) ?? valueLabel(value ?? '-');
        },
      })),
      ...(actions
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => <div className="flex justify-end gap-2">{actions(row.original)}</div>,
            } satisfies ColumnDef<AnyRow>,
          ]
        : []),
    ],
    [actions, columns],
  );

  const table = useReactTable({
    data,
    columns: defs,
    state: { globalFilter: filter },
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) {
    return <Card className="grid min-h-48 place-items-center p-6 text-sm text-muted-foreground">Cargando datos...</Card>;
  }

  if (error) {
    return <Card className="grid min-h-48 place-items-center p-6 text-center text-sm text-red-700">{error}</Card>;
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={filter} onChange={(event) => setFilter(event.target.value)} className="pl-9" placeholder="Buscar" />
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-semibold">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {table.getRowModel().rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="space-y-3">
              {columns.slice(0, 5).map((column) => (
                <div key={column.accessor} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{column.header}</span>
                  <span className="text-right font-medium">
                    {column.render?.(getValue(row.original, column.accessor), row.original) ??
                      valueLabel(getValue(row.original, column.accessor) ?? '-')}
                  </span>
                </div>
              ))}
              {actions && <div className="flex justify-end gap-2 border-t border-border pt-3">{actions(row.original)}</div>}
            </div>
          </Card>
        ))}
      </div>

      {table.getRowModel().rows.length === 0 && (
        <Card className="grid min-h-44 place-items-center p-6 text-sm text-muted-foreground">No hay registros para mostrar.</Card>
      )}
    </div>
  );
}
