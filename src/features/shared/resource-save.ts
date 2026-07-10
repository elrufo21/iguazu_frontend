import type { FieldConfig } from '../../components/forms/resource-form-dialog';
import { resourceApi } from '../../lib/api';
import type { AnyRow } from '../../types';

type FormValues = Record<string, unknown>;

export type SaveConfig = {
  fields: FieldConfig[];
  createPath?: string | ((values: FormValues) => string);
  updatePath?: (row: AnyRow) => string;
  toPayload?: (values: FormValues, editing?: AnyRow | null) => unknown;
  requiresCustomer?: boolean;
};

export async function saveResource(config: SaveConfig, values: FormValues, editing?: AnyRow | null) {
  const readyValues = await withNewCustomer(values, config.requiresCustomer);
  const payload = config.toPayload?.(readyValues, editing) ?? cleanPayload(readyValues, config.fields);
  if (editing && config.updatePath) return resourceApi.update(config.updatePath(editing), payload);
  const path = typeof config.createPath === 'function' ? config.createPath(readyValues) : config.createPath;
  if (!path) throw new Error('Este módulo no tiene endpoint de creación.');
  return resourceApi.create(path, payload);
}

export function normalizeRows(data: unknown): AnyRow[] {
  if (Array.isArray(data)) return data as AnyRow[];
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: AnyRow[] }).data;
  }
  return [];
}

async function withNewCustomer(values: FormValues, required?: boolean) {
  const newCustomer = values.newCustomer as FormValues | undefined;
  const hasNewCustomer = Boolean(newCustomer?.fullName || newCustomer?.documentNumber);
  const customerId = values.customerId ? Number(values.customerId) : undefined;

  if (hasNewCustomer) {
    if (!newCustomer?.documentType || !newCustomer.documentNumber || !newCustomer.fullName) {
      throw new Error('Completa tipo, número de documento y nombre del nuevo cliente.');
    }
    const customer = await resourceApi.create('customers', cleanObject(newCustomer));
    return { ...values, customerId: customer.id };
  }

  if (required && !customerId) throw new Error('Selecciona un cliente o crea uno nuevo.');
  return values;
}

function cleanObject(values: FormValues) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== undefined && value !== null));
}

function cleanPayload(values: FormValues, fields: FieldConfig[]) {
  const payload: FormValues = {};
  for (const field of fields) {
    const value = values[field.name];
    if (value === '' || value === undefined || value === null) continue;
    if (field.type === 'number' || field.type === 'relation' || field.type === 'customer') payload[field.name] = Number(value);
    else if (field.type === 'checkbox') payload[field.name] = Boolean(value);
    else if (field.type === 'datetime-local') payload[field.name] = new Date(String(value)).toISOString();
    else payload[field.name] = value;
  }
  return payload;
}
