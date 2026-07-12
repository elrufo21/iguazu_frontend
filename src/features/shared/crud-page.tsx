import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, FileSpreadsheet, FileText, MoreHorizontal, Plus, Power, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { DataTable, type AppColumn } from '../../components/data-table/data-table';
import { ResourceFormDialog, type FieldConfig } from '../../components/forms/resource-form-dialog';
import { ConfirmDialog } from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { dateTime, getValue, money, valueLabel } from '../../lib/utils';
import type { AnyRow } from '../../types';
import { normalizeRows, saveResource } from './resource-save';

type FormValues = Record<string, unknown>;

export type ResourceAction = {
  label: string;
  kind?: 'patch' | 'post';
  path: (row: AnyRow) => string;
  confirm?: string;
};

export type ResourceConfig = {
  key: string;
  title: string;
  description: string;
  listPath: string;
  createPath?: string | ((values: FormValues) => string);
  updatePath?: (row: AnyRow) => string;
  togglePath?: (row: AnyRow) => string;
  createLabel?: string;
  fields: FieldConfig[];
  schema: z.ZodType<any>;
  columns: AppColumn[];
  readOnly?: boolean;
  toPayload?: (values: FormValues, editing?: AnyRow | null) => unknown;
  toFormValues?: (row: AnyRow | null) => AnyRow | null;
  actions?: ResourceAction[];
  requiresCustomer?: boolean;
  exportRows?: {
    fileName: string;
    columns: {
      header: string;
      accessor?: string;
      type?: 'money' | 'date' | 'status';
      value?: (row: AnyRow) => unknown;
    }[];
  };
};

export function CrudPage({ config }: { config: ResourceConfig }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; run: () => void } | null>(null);
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: [config.key, config.listPath],
    queryFn: () => resourceApi.list(config.listPath),
  });

  const rows = useMemo(() => normalizeRows(list.data), [list.data]);
  const exportData = useMemo(
    () =>
      config.exportRows
        ? rows.map((row) =>
            Object.fromEntries(
              config.exportRows!.columns.map((column) => [
                column.header,
                exportValue(
                  column.value ? column.value(row) : getValue(row, column.accessor ?? ''),
                  column.type,
                ),
              ]),
            ),
          )
        : [],
    [config.exportRows, rows],
  );

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      return saveResource(config, values, editing);
    },
    onSuccess: () => {
      toast.success('Registro guardado');
      setOpen(false);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: [config.key] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const action = useMutation({
    mutationFn: (item: { path: string; kind: 'patch' | 'post' }) =>
      item.kind === 'post' ? resourceApi.post(item.path) : resourceApi.update(item.path),
    onSuccess: () => {
      toast.success('Acción realizada');
      void queryClient.invalidateQueries({ queryKey: [config.key] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const startCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const startEdit = (row: AnyRow) => {
    setEditing(row);
    setOpen(true);
  };

  const runAction = (row: AnyRow, item: ResourceAction) => {
    const exec = () => action.mutate({ path: item.path(row), kind: item.kind ?? 'patch' });
    if (item.confirm) {
      setConfirm({ title: item.label, description: item.confirm, run: exec });
      return;
    }
    exec();
  };

  const rowActions = (row: AnyRow): ReactNode => {
    const items: ReactNode[] = [];
    if (config.updatePath) {
      items.push(
        <DropdownMenuItem key="edit" onSelect={() => startEdit(row)}>
          <Edit className="h-4 w-4" />
          Editar
        </DropdownMenuItem>,
      );
    }
    if (config.togglePath) {
      items.push(
        <DropdownMenuItem
          key="toggle"
          onSelect={() =>
            setConfirm({
              title: 'Confirmar acción',
              description: 'Se cambiará el estado del registro.',
              run: () => action.mutate({ path: config.togglePath?.(row) ?? '', kind: 'patch' }),
            })
          }
        >
          <Power className="h-4 w-4" />
          Activar/desactivar
        </DropdownMenuItem>,
      );
    }
    config.actions?.forEach((item) => {
      items.push(
        <DropdownMenuItem key={item.label} onSelect={() => runAction(row, item)}>
          <Trash2 className="h-4 w-4" />
          {item.label}
        </DropdownMenuItem>,
      );
    });

    if (items.length === 0) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{items}</DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.exportRows && (
            <>
              <Button variant="outline" disabled={rows.length === 0} onClick={() => void downloadRowsPdf(config.title, exportData, config.exportRows!.fileName)}>
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" disabled={rows.length === 0} onClick={() => void downloadRowsExcel(config.title, exportData, config.exportRows!.fileName)}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </>
          )}
          {!config.readOnly && config.createPath && (
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" />
              {config.createLabel ?? 'Crear'}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-3 md:p-4">
          <DataTable
            data={rows}
            columns={config.columns}
            actions={rowActions}
            loading={list.isLoading}
            error={list.isError ? errorMessage(list.error) : undefined}
          />
        </CardContent>
      </Card>

      <ResourceFormDialog
        open={open}
        title={editing ? `Editar ${config.title}` : config.createLabel ?? `Crear ${config.title}`}
        description={config.description}
        fields={config.fields}
        schema={config.schema}
        initialValue={config.toFormValues?.(editing) ?? editing}
        saving={save.isPending}
        onOpenChange={setOpen}
        onSubmit={(values) => save.mutate(values)}
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

function exportValue(value: unknown, type?: 'money' | 'date' | 'status') {
  if (type === 'money') return money(value);
  if (type === 'date') return dateTime(value);
  if (type === 'status') return valueLabel(value);
  return String(value ?? '');
}

async function downloadRowsExcel(title: string, rows: Record<string, string>[], fileName: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const data = rows.length ? rows : [{ Mensaje: 'Sin datos' }];
  const headers = Object.keys(data[0] ?? {});
  const file = await writeXlsxFile([
    {
      sheet: title.slice(0, 31),
      data: [
        headers.map((value) => ({ value, fontWeight: 'bold' as const })),
        ...data.map((row) => headers.map((header) => ({ value: row[header] ?? '' }))),
      ],
    },
  ] as any);
  await file.toFile(`${fileName}.xlsx`);
}

async function downloadRowsPdf(title: string, rows: Record<string, string>[], fileName: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const data = rows.length ? rows : [{ Mensaje: 'Sin datos' }];
  const headers = Object.keys(data[0] ?? {});
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.text(title, 40, 42);
  autoTable(doc, {
    startY: 62,
    head: [headers],
    body: data.map((row) => headers.map((header) => row[header] ?? '')),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [16, 35, 31] },
    margin: { left: 40, right: 40 },
  });
  doc.save(`${fileName}.pdf`);
}
