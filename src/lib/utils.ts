import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function dateTime(value: unknown) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(String(value)));
}

export function getValue(row: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, row);
}

export const valueLabels: Record<string, string> = {
  true: 'Activo',
  false: 'Inactivo',
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepción',
  CASHIER: 'Caja',
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  OUT_OF_SERVICE: 'Fuera de servicio',
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
  NO_SHOW: 'No llegó',
  ACTIVE: 'Activa',
  CLOSED: 'Cerrada',
  OPEN: 'Abierta',
  OPEN_SALE: 'Pendiente',
  PAID: 'Pagada',
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFER: 'Transferencia',
  PRODUCT: 'Producto',
  ROOM_RENT: 'Alojamiento',
  PENALTY: 'Penalidad',
  OTHER: 'Otro',
  PRODUCT_SALE: 'Venta de producto',
  ROOM_RENT_CHARGE: 'Alojamiento',
  STAFF_PAYMENT: 'Pago personal',
  STAFF_ADVANCE: 'Adelanto',
  PRODUCT_LOSS_CHARGE: 'Cobro por pérdida',
  INVENTORY_PURCHASE: 'Compra inventario',
  CASH_WITHDRAWAL: 'Retiro de caja',
  CASH_ADJUSTMENT: 'Ajuste de caja',
  RESERVATION_DEPOSIT: 'Adelanto reserva',
  INCOME: 'Ingreso',
  EXPENSE: 'Egreso',
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  LATE: 'Tarde',
  JUSTIFIED: 'Justificada',
  IN: 'Ingreso',
  OUT: 'Salida',
  ADJUSTMENT: 'Corrección',
  LOSS: 'Pérdida',
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
  CASH_OPEN: 'Apertura de caja',
  CASH_CLOSE: 'Cierre de caja',
  CASH_EXPENSE: 'Egreso de caja',
};

export const columnLabels: Record<string, string> = {
  id: 'ID',
  cashShiftId: 'Turno de caja',
  openedBy: 'Abierta por',
  closedBy: 'Cerrada por',
  totalExpected: 'Esperado',
  totalCounted: 'Contado',
  difference: 'Diferencia',
  createdAt: 'Fecha',
  itemType: 'Tipo',
  quantity: 'Cantidad',
  total: 'Total',
  costTotal: 'Costo total',
  profitTotal: 'Ganancia total',
  purchasePrice: 'Costo unitario',
  salePrice: 'Precio venta',
  product: 'Producto',
  unit: 'Unidad',
  stock: 'Stock',
  name: 'Nombre',
  minStock: 'Stock mínimo',
  type: 'Tipo',
  reason: 'Motivo',
  employee: 'Empleado',
  payments: 'Pagos',
  advances: 'Adelantos',
  discounts: 'Descuentos',
  action: 'Acción',
  entity: 'Entidad',
  entityId: 'ID entidad',
  user: 'Usuario',
  userName: 'Usuario',
  paymentMethod: 'Método de pago',
  expectedAmount: 'Esperado',
  countedAmount: 'Contado',
};

export function valueLabel(value: unknown) {
  const key = String(value);
  return valueLabels[key] ?? key;
}

export function columnLabel(value: string) {
  return columnLabels[value] ?? value;
}

export function productTitle(product: Record<string, unknown>, fallback = 'Producto') {
  const name = String(product.name ?? fallback).trim();
  const description = String(product.description ?? '').trim();
  return description ? `${name} - ${description}` : name;
}
