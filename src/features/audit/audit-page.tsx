import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../../components/data-table/data-table';
import { Card, CardContent } from '../../components/ui/card';
import { resourceApi } from '../../lib/api';
import { errorMessage } from '../../lib/api-error';
import { dateTime, valueLabel } from '../../lib/utils';
import { normalizeRows } from '../shared/resource-save';

export function AuditPage() {
  const logs = useQuery({
    queryKey: ['audit'],
    queryFn: () => resourceApi.list('audit'),
  });

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Auditoría</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cambios importantes registrados por usuario.</p>
      </div>

      <Card>
        <CardContent className="p-3 md:p-4">
          <DataTable
            data={normalizeRows(logs.data)}
            loading={logs.isLoading}
            error={logs.isError ? errorMessage(logs.error) : undefined}
            columns={[
              { header: 'Fecha', accessor: 'createdAt', render: dateTime },
              { header: 'Usuario', accessor: 'user.username' },
              { header: 'Acción', accessor: 'action', render: valueLabel },
              { header: 'Entidad', accessor: 'entity' },
              { header: 'ID', accessor: 'entityId' },
              { header: 'Antes', accessor: 'oldData', render: jsonPreview },
              { header: 'Después', accessor: 'newData', render: jsonPreview },
            ]}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function jsonPreview(value: unknown) {
  if (!value) return '-';
  return (
    <pre className="max-w-xs overflow-hidden whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
