import { useQuery } from '@tanstack/react-query';
import { Clock, UserCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { resourceApi } from '../../lib/api';
import { dateTime, getValue } from '../../lib/utils';
import type { AnyRow } from '../../types';
import { normalizeRows } from '../shared/resource-save';

const today = new Date();
const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1)
  .toISOString()
  .slice(0, 10);
const defaultTo = today.toISOString().slice(0, 10);

export function AttendancePage() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const query = useQuery({
    queryKey: ['attendance', from, to],
    queryFn: () => resourceApi.list(`attendance/range?from=${from}&to=${to}`),
  });
  const rows = normalizeRows(query.data);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Asistencias</h1>
          <p className="text-sm text-muted-foreground">
            Registro por turno: abrir caja marca entrada y cerrar caja marca salida.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-80">
          <Field label="Desde">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Turnos" value={rows.length} />
        <Metric label="Abiertos" value={rows.filter((row) => !row.checkOut).length} />
        <Metric label="Cerrados" value={rows.filter((row) => row.checkOut).length} />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Caja</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Salida</th>
                <th className="px-4 py-3">Duración</th>
                <th className="px-4 py-3">Estado caja</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    Cargando asistencias...
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((row) => (
                  <tr key={String(row.id)} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      {String(getValue(row, 'employee.fullName') ?? '-')}
                    </td>
                    <td className="px-4 py-3">#{String(row.cashShiftId ?? '-')}</td>
                    <td className="px-4 py-3">{dateTime(row.checkIn)}</td>
                    <td className="px-4 py-3">{row.checkOut ? dateTime(row.checkOut) : 'Turno abierto'}</td>
                    <td className="px-4 py-3">{duration(row)}</td>
                    <td className="px-4 py-3">{String(getValue(row, 'cashShift.status') ?? '-')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    Sin asistencias en el rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}

function duration(row: AnyRow) {
  if (!row.checkIn) return '-';
  const start = new Date(String(row.checkIn)).getTime();
  const end = row.checkOut ? new Date(String(row.checkOut)).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        {label === 'Turnos' ? <Clock className="h-5 w-5 text-primary" /> : <UserCheck className="h-5 w-5 text-primary" />}
      </CardContent>
    </Card>
  );
}
