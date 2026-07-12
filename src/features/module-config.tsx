import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import { StatusBadge } from "../components/status-badge/status-badge";
import type { FormValues } from "../components/forms/resource-form-dialog";
import { resourceApi } from "../lib/api";
import { dateTime, getValue, money } from "../lib/utils";
import type { ResourceConfig } from "./shared/crud-page";
import { normalizeRows } from "./shared/resource-save";

const req = z.string().min(1, "Requerido");
const opt = z.string().optional();
const num = z.coerce.number({ error: "Número inválido" });
const optNum = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().optional(),
);
const dateReq = z.string().min(1, "Requerido");
const bool = z.coerce.boolean().optional();
const form = (shape: z.ZodRawShape) => z.object(shape).passthrough();
const id = (path: string) => (row: { id?: number }) => `${path}/${row.id}`;

const roleOptions = [
  { label: "Administrador", value: "ADMIN" },
  { label: "Recepción", value: "RECEPTIONIST" },
  { label: "Caja", value: "CASHIER" },
];
const employeeDocumentOptions = [
  { label: "DNI", value: "DNI" },
  { label: "Carnet de extranjería", value: "CE" },
  { label: "Pasaporte", value: "PASAPORTE" },
];
const customerDocumentOptions = [
  ...employeeDocumentOptions,
  { label: "RUC", value: "RUC" },
];
const roomStatusOptions = [
  { label: "Disponible", value: "AVAILABLE" },
  { label: "Reservada", value: "RESERVED" },
  { label: "Fuera de servicio", value: "OUT_OF_SERVICE" },
];
const paymentOptions = [
  { label: "Efectivo", value: "CASH" },
  { label: "Tarjeta", value: "CARD" },
  { label: "Yape", value: "YAPE" },
  { label: "Plin", value: "PLIN" },
  { label: "Transferencia", value: "TRANSFER" },
];
const attendanceOptions = [
  { label: "Presente", value: "PRESENT" },
  { label: "Ausente", value: "ABSENT" },
  { label: "Tarde", value: "LATE" },
  { label: "Justificada", value: "JUSTIFIED" },
];
const itemTypeOptions = [
  { label: "Producto", value: "PRODUCT" },
  { label: "Alojamiento", value: "ROOM_RENT" },
  { label: "Penalidad", value: "PENALTY" },
  { label: "Otro", value: "OTHER" },
];
const cashExpenseCategoryOptions = [
  { label: "Retiro de caja", value: "CASH_WITHDRAWAL" },
  { label: "Ajuste de caja", value: "CASH_ADJUSTMENT" },
  { label: "Compra inventario", value: "INVENTORY_PURCHASE" },
];
const unitOptions = [
  { label: "Unidad", value: "UNIDAD" },
  { label: "Pack", value: "PACK" },
  { label: "Caja", value: "CAJA" },
  { label: "Bolsa", value: "BOLSA" },
  { label: "Botella", value: "BOTELLA" },
  { label: "Kilo", value: "KILO" },
  { label: "Litro", value: "LITRO" },
  { label: "Servicio", value: "SERVICIO" },
];

const today = new Date();
const from = new Date(today.getFullYear(), today.getMonth(), 1)
  .toISOString()
  .slice(0, 10);
const to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  .toISOString()
  .slice(0, 10);

const fillAgreedPrice = async (
  _value: unknown,
  form: UseFormReturn<FormValues>,
) => {
  const roomId = form.getValues("roomId");
  const priceTypeId = form.getValues("priceTypeId");
  if (!roomId || !priceTypeId) return;

  try {
    const [rooms, prices] = await Promise.all([
      resourceApi.list("rooms"),
      resourceApi.list("room-type-prices"),
    ]);
    const room = normalizeRows(rooms).find(
      (entry) => String(entry.id) === String(roomId),
    );
    const roomTypeId =
      (room as Record<string, unknown>)?.roomTypeId ??
      getValue(room ?? {}, "roomType.id") ??
      (room as Record<string, unknown>)?.room_type_id;

    const price = normalizeRows(prices).find((entry) => {
      const row = entry as Record<string, unknown>;
      return (
        String(row.priceTypeId) === String(priceTypeId) &&
        String(row.roomTypeId) === String(roomTypeId)
      );
    });

    const amount = (price as Record<string, unknown>)?.amount;
    if (amount !== undefined && amount !== null && amount !== "") {
      form.setValue("agreedPrice", Number(amount), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  } catch {
    // Ignorar errores de carga y dejar el campo tal cual.
  }
};

export const modules: Record<string, ResourceConfig> = {
  employees: {
    key: "employees",
    title: "Empleados",
    description: "Personal operativo y administrativo.",
    listPath: "employees",
    createPath: "employees",
    updatePath: id("employees"),
    togglePath: (row) => `employees/${row.id}/deactivate`,
    createLabel: "Nuevo empleado",
    fields: [
      { name: "fullName", label: "Nombre completo" },
      {
        name: "documentType",
        label: "Tipo documento",
        type: "select",
        options: employeeDocumentOptions,
      },
      { name: "documentNumber", label: "Número documento" },
      { name: "phone", label: "Teléfono" },
      { name: "position", label: "Cargo" },
      {
        name: "dailyRate",
        label: "Tarifa diaria",
        type: "number",
        step: "0.01",
      },
      { name: "address", label: "Dirección", type: "textarea" },
    ],
    schema: form({
      fullName: req,
      documentType: req,
      documentNumber: req,
      phone: opt,
      position: req,
      dailyRate: optNum,
      address: opt,
    }),
    columns: [
      { header: "Nombre", accessor: "fullName" },
      { header: "Documento", accessor: "documentNumber" },
      { header: "Cargo", accessor: "position" },
      { header: "Tarifa", accessor: "dailyRate", render: money },
      {
        header: "Estado",
        accessor: "active",
        render: (value) => <StatusBadge value={value} />,
      },
    ],
  },
  users: {
    key: "users",
    title: "Usuarios",
    description: "Accesos al sistema.",
    listPath: "users",
    createPath: "users",
    updatePath: id("users"),
    togglePath: (row) => `users/${row.id}/toggle-active`,
    createLabel: "Nuevo usuario",
    fields: [
      {
        name: "employeeId",
        label: "Empleado",
        type: "relation",
        endpoint: "employees",
        labelKey: "fullName",
      },
      { name: "username", label: "Usuario" },
      { name: "password", label: "Contraseña", type: "password" },
      { name: "role", label: "Rol", type: "select", options: roleOptions },
    ],
    schema: form({
      employeeId: optNum,
      username: req,
      password: opt,
      role: req,
    }),
    toPayload: (values, editing) => {
      const password = String(values.password ?? "");
      if (!editing && password.length < 6)
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
      return {
        ...(values.employeeId ? { employeeId: Number(values.employeeId) } : {}),
        username: values.username,
        role: values.role,
        ...(password ? { password } : {}),
      };
    },
    columns: [
      { header: "Usuario", accessor: "username" },
      {
        header: "Rol",
        accessor: "role",
        render: (value) => <StatusBadge value={value} />,
      },
      { header: "Empleado", accessor: "employee.fullName" },
      {
        header: "Estado",
        accessor: "active",
        render: (value) => <StatusBadge value={value} />,
      },
    ],
  },
  priceTypes: {
    key: "price-types",
    title: "Tipos de precio",
    description: "Modalidades de cobro de habitación.",
    listPath: "price-types",
    createPath: "price-types",
    updatePath: id("price-types"),
    togglePath: (row) => `price-types/${row.id}/toggle-active`,
    createLabel: "Nuevo tipo",
    fields: [
      { name: "name", label: "Nombre" },
      { name: "description", label: "Descripción", type: "textarea" },
    ],
    schema: form({ name: req, description: opt }),
    columns: [
      { header: "Nombre", accessor: "name" },
      { header: "Descripción", accessor: "description" },
      {
        header: "Estado",
        accessor: "active",
        render: (value) => <StatusBadge value={value} />,
      },
    ],
  },
  roomTypes: {
    key: "room-types",
    title: "Tipos de habitación",
    description: "Categorías comerciales de habitaciones.",
    listPath: "room-types",
    createPath: "room-types",
    updatePath: id("room-types"),
    togglePath: (row) => `room-types/${row.id}/toggle-active`,
    createLabel: "Nuevo tipo",
    fields: [
      { name: "name", label: "Nombre" },
      { name: "description", label: "Descripción", type: "textarea" },
    ],
    schema: form({ name: req, description: opt }),
    columns: [
      { header: "Nombre", accessor: "name" },
      { header: "Descripción", accessor: "description" },
      {
        header: "Estado",
        accessor: "active",
        render: (value) => <StatusBadge value={value} />,
      },
    ],
  },
  roomTypePrices: {
    key: "room-type-prices",
    title: "Tarifas",
    description: "Precios por tipo de habitación y modalidad.",
    listPath: "room-type-prices",
    createPath: "room-type-prices",
    updatePath: id("room-type-prices"),
    togglePath: (row) => `room-type-prices/${row.id}/toggle-active`,
    createLabel: "Nueva tarifa",
    fields: [
      {
        name: "roomTypeId",
        label: "Tipo habitación",
        type: "relation",
        endpoint: "room-types",
        labelKey: "name",
      },
      {
        name: "priceTypeId",
        label: "Tipo precio",
        type: "relation",
        endpoint: "price-types",
        labelKey: "name",
      },
      { name: "amount", label: "Monto", type: "number", step: "0.01" },
    ],
    schema: form({ roomTypeId: num, priceTypeId: num, amount: num }),
    columns: [
      { header: "Habitación", accessor: "roomType.name" },
      { header: "Precio", accessor: "priceType.name" },
      { header: "Monto", accessor: "amount", render: money },
      {
        header: "Estado",
        accessor: "active",
        render: (value) => <StatusBadge value={value} />,
      },
    ],
  },
  rooms: {
    key: "rooms",
    title: "Habitaciones",
    description: "Estado operativo de habitaciones.",
    listPath: "rooms",
    createPath: "rooms",
    updatePath: id("rooms"),
    togglePath: (row) => `rooms/${row.id}/toggle-active`,
    createLabel: "Nueva habitación",
    fields: [
      { name: "roomNumber", label: "Número" },
      {
        name: "roomTypeId",
        label: "Tipo",
        type: "relation",
        endpoint: "room-types",
        labelKey: "name",
      },
      { name: "floor", label: "Piso", type: "number" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: roomStatusOptions,
      },
      { name: "description", label: "Descripción", type: "textarea" },
    ],
    schema: form({
      roomNumber: req,
      roomTypeId: num,
      floor: optNum,
      status: req,
      description: opt,
    }),
    columns: [
      { header: "Número", accessor: "roomNumber" },
      { header: "Tipo", accessor: "roomType.name" },
      { header: "Piso", accessor: "floor" },
      {
        header: "Estado",
        accessor: "status",
        render: (value) => <StatusBadge value={value} />,
      },
      {
        header: "Activo",
        accessor: "active",
        render: (value) => <StatusBadge value={value} />,
      },
    ],
  },
  customers: {
    key: "customers",
    title: "Clientes",
    description: "Huéspedes y empresas.",
    listPath: "customers",
    createPath: "customers",
    updatePath: id("customers"),
    createLabel: "Nuevo cliente",
    fields: [
      {
        name: "documentType",
        label: "Tipo documento",
        type: "select",
        options: customerDocumentOptions,
      },
      { name: "documentNumber", label: "Número documento" },
      { name: "fullName", label: "Nombre completo" },
      { name: "businessName", label: "Razón social" },
      { name: "phone", label: "Teléfono" },
      { name: "email", label: "Email" },
      { name: "address", label: "Dirección", type: "textarea" },
    ],
    schema: form({
      documentType: req,
      documentNumber: req,
      fullName: req,
      businessName: opt,
      phone: opt,
      email: opt,
      address: opt,
    }),
    columns: [
      { header: "Nombre", accessor: "fullName" },
      { header: "Documento", accessor: "documentNumber" },
      { header: "Teléfono", accessor: "phone" },
      { header: "Email", accessor: "email" },
    ],
  },
  products: {
    key: "products",
    title: "Productos",
    description: "Artículos para venta e inventario.",
    listPath: "products",
    createPath: "products",
    updatePath: id("products"),
    togglePath: (row) => `products/${row.id}/toggle-active`,
    createLabel: "Nuevo producto",
    fields: [
      { name: "name", label: "Nombre" },
      { name: "description", label: "Descripción" },
      { name: "purchasePrice", label: "Costo", type: "number", step: "0.01" },
      {
        name: "salePrice",
        label: "Precio venta",
        type: "number",
        step: "0.01",
      },
      {
        name: "unit",
        label: "Unidad de venta",
        type: "select",
        options: unitOptions,
      },
      {
        name: "purchaseFactor",
        label: "Factor de compra (unidades por paquete)",
        type: "number",
        helper: "Ej: si comprás cajas de 12, el factor es 12. Al ingresar 1 caja, el stock sube 12.",
      },
      {
        name: "stock",
        label: "Stock inicial (paquetes/cajas)",
        type: "number",
      },
      { name: "minStock", label: "Stock mínimo", type: "number" },
    ],
    schema: form({
      name: req,
      description: opt,
      purchasePrice: num,
      salePrice: num,
      unit: opt,
      purchaseFactor: optNum,
      stock: optNum,
      minStock: optNum,
    }),
    toFormValues: (row) => {
      if (!row) return row;
      const factor = Number(row.purchaseFactor ?? 1);
      return {
        ...row,
        stock: factor > 1 ? Number(row.stock ?? 0) / factor : row.stock,
      };
    },
    columns: [
      { header: "Producto", accessor: "name" },
      { header: "Precio", accessor: "salePrice", render: money },
      { header: "Unidad", accessor: "unit" },
      { header: "Stock", accessor: "stock" },
      { header: "Mínimo", accessor: "minStock" },
      {
        header: "Estado",
        accessor: "active",
        render: (value) => <StatusBadge value={value} />,
      },
    ],
    exportRows: {
      fileName: "productos",
      columns: [
        { header: "Producto", accessor: "name" },
        { header: "Descripción", accessor: "description" },
        { header: "Costo", accessor: "purchasePrice", type: "money" },
        { header: "Precio venta", accessor: "salePrice", type: "money" },
        {
          header: "Ganancia unitaria",
          value: (row) => Number(row.salePrice ?? 0) - Number(row.purchasePrice ?? 0),
          type: "money",
        },
        {
          header: "Margen %",
          value: (row) => {
            const price = Number(row.salePrice ?? 0);
            if (!price) return "0%";
            return `${(((price - Number(row.purchasePrice ?? 0)) / price) * 100).toFixed(2)}%`;
          },
        },
        { header: "Unidad", accessor: "unit" },
        { header: "Factor compra", accessor: "purchaseFactor" },
        { header: "Stock", accessor: "stock" },
        { header: "Stock mínimo", accessor: "minStock" },
        { header: "Estado", accessor: "active", type: "status" },
      ],
    },
  },
  inventory: {
    key: "inventory",
    title: "Stock",
    description: "Aumenta, corrige o descuenta unidades. Las salidas quedan pendientes para revisión del admin.",
    listPath: "inventory/movements",
    createPath: (values) => `inventory/${values.movementType}`,
    createLabel: "Actualizar stock",
    fields: [
      {
        name: "movementType",
        label: "Qué pasó con el stock",
        type: "select",
        options: [
          { label: "Compré o ingresé productos", value: "in" },
          { label: "Saqué productos manualmente", value: "out" },
          { label: "Se perdió o dañó producto", value: "loss" },
          { label: "Corregir conteo de stock", value: "adjust" },
        ],
      },
      {
        name: "productId",
        label: "Producto",
        type: "relation",
        endpoint: "products",
        labelKey: "name",
      },
      {
        name: "quantity",
        label: "Cantidad",
        type: "number",
        helper: "Ingreso: cantidad de paquetes/cajas (se multiplica por el factor del producto). Corrección: puede ser negativo.",
      },
      {
        name: "reason",
        label: "Motivo",
        placeholder: "Ej: compra, conteo físico, producto dañado",
        helper: "Si el usuario tiene empleado asociado y baja stock, queda pendiente para revisión del admin.",
      },
    ],
    schema: form({
      movementType: req,
      productId: num,
      quantity: num,
      reason: req,
    }),
    toPayload: (values) => {
      const payload = { ...values };
      delete payload.movementType;
      return {
        ...payload,
        productId: Number(payload.productId),
        quantity: Number(payload.quantity),
      };
    },
    columns: [
      { header: "Producto", accessor: "product.name" },
      {
        header: "Tipo",
        accessor: "type",
        render: (value) => <StatusBadge value={value} />,
      },
      { header: "Cantidad", accessor: "quantity" },
      { header: "Motivo", accessor: "reason" },
      { header: "Fecha", accessor: "createdAt", render: dateTime },
    ],
  },
  reservations: {
    key: "reservations",
    title: "Reservas",
    description: "Reservas pendientes y confirmadas.",
    listPath: "reservations",
    createPath: "reservations",
    createLabel: "Nueva reserva",
    fields: [
      {
        name: "customerId",
        label: "Cliente",
        type: "customer",
        createCustomer: true,
      },
      {
        name: "roomId",
        label: "Habitación",
        type: "relation",
        endpoint: "rooms",
        labelKey: "roomNumber",
      },
      { name: "startDate", label: "Inicio", type: "datetime-local" },
      { name: "endDate", label: "Fin", type: "datetime-local" },
      {
        name: "depositAmount",
        label: "Adelanto",
        type: "number",
        step: "0.01",
      },
      {
        name: "cashShiftId",
        label: "Caja abierta",
        type: "relation",
        endpoint: "cash-shift/open/all",
        labelKey: "openedBy.employee.fullName",
        optional: true,
        adminOnly: true,
      },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
    schema: form({
      customerId: optNum,
      roomId: num,
      startDate: dateReq,
      endDate: dateReq,
      depositAmount: optNum,
      cashShiftId: optNum,
      notes: opt,
    }),
    requiresCustomer: true,
    columns: [
      { header: "Cliente", accessor: "customer.fullName" },
      { header: "Habitación", accessor: "room.roomNumber" },
      { header: "Inicio", accessor: "startDate", render: dateTime },
      { header: "Fin", accessor: "endDate", render: dateTime },
      {
        header: "Estado",
        accessor: "status",
        render: (value) => <StatusBadge value={value} />,
      },
    ],
    actions: [
      {
        label: "Confirmar",
        path: (row) => `reservations/${row.id}/confirm`,
        confirm: "La reserva quedará confirmada.",
      },
      {
        label: "Cancelar",
        path: (row) => `reservations/${row.id}/cancel`,
        confirm: "La reserva quedará cancelada.",
      },
      {
        label: "No llegó",
        path: (row) => `reservations/${row.id}/no-show`,
        confirm: "La reserva se marcará como no show.",
      },
    ],
  },
  stays: {
    key: "stays",
    title: "Estadías",
    description: "Check-in activo y salida de huéspedes.",
    listPath: "stays/active",
    createPath: "stays/check-in",
    createLabel: "Nuevo check-in",
    fields: [
      {
        name: "customerId",
        label: "Cliente",
        type: "customer",
        optional: true,
        createCustomer: true,
      },
      {
        name: "roomId",
        label: "Habitación",
        type: "relation",
        endpoint: "rooms",
        labelKey: "roomNumber",
        onChange: fillAgreedPrice,
      },
      {
        name: "priceTypeId",
        label: "Tipo precio",
        type: "relation",
        endpoint: "price-types",
        labelKey: "name",
        onChange: fillAgreedPrice,
      },
      {
        name: "agreedPrice",
        label: "Precio pactado / custom",
        type: "number",
        step: "0.01",
        helper:
          "Déjalo vacío para usar la tarifa de la habitación. Llénalo para precio especial.",
      },
      {
        name: "expectedCheckOut",
        label: "Salida esperada",
        type: "datetime-local",
      },
      {
        name: "cashShiftId",
        label: "Caja abierta",
        type: "relation",
        endpoint: "cash-shift/open/all",
        labelKey: "openedBy.employee.fullName",
        optional: true,
        adminOnly: true,
      },
    ],
    schema: form({
      customerId: optNum,
      roomId: num,
      priceTypeId: num,
      agreedPrice: optNum,
      expectedCheckOut: opt,
      cashShiftId: optNum,
    }),
    columns: [
      { header: "Habitación", accessor: "room.roomNumber" },
      { header: "Cliente", accessor: "customer.fullName" },
      { header: "Ingreso", accessor: "checkIn", render: dateTime },
      { header: "Precio", accessor: "agreedPrice", render: money },
      {
        header: "Estado",
        accessor: "status",
        render: (value) => <StatusBadge value={value} />,
      },
    ],
    actions: [
      {
        label: "Check-out",
        path: (row) => `stays/${row.id}/check-out`,
        confirm: "Se cerrará la estadía.",
      },
    ],
  },
  sales: {
    key: "sales",
    title: "Ventas",
    description: "Ventas rápidas y cargos a estadía.",
    listPath: "sales",
    createPath: "sales",
    createLabel: "Nueva venta",
    fields: [
      {
        name: "customerId",
        label: "Cliente",
        type: "customer",
        optional: true,
        createCustomer: true,
      },
      {
        name: "stayId",
        label: "Estadía",
        type: "relation",
        endpoint: "stays/active",
        labelKey: "room.roomNumber",
        optional: true,
      },
      {
        name: "itemType",
        label: "Tipo item",
        type: "select",
        options: itemTypeOptions,
      },
      {
        name: "productId",
        label: "Producto",
        type: "relation",
        endpoint: "products",
        labelKey: "name",
        optional: true,
      },
      { name: "description", label: "Descripción" },
      { name: "quantity", label: "Cantidad", type: "number" },
      {
        name: "unitPrice",
        label: "Precio unitario",
        type: "number",
        step: "0.01",
      },
      {
        name: "paymentMethod",
        label: "Pago",
        type: "select",
        options: paymentOptions,
      },
    ],
    schema: form({
      customerId: optNum,
      stayId: optNum,
      itemType: req,
      productId: optNum,
      description: req,
      quantity: num,
      unitPrice: num,
      paymentMethod: req,
    }),
    toPayload: (values) => {
      const quantity = Number(values.quantity);
      const unitPrice = Number(values.unitPrice);
      const itemType = String(values.itemType);
      const detail = {
        itemType,
        description: values.description,
        quantity,
        unitPrice,
        ...(values.productId ? { productId: Number(values.productId) } : {}),
        ...(values.stayId ? { stayId: Number(values.stayId) } : {}),
      };
      return {
        ...(values.customerId ? { customerId: Number(values.customerId) } : {}),
        ...(values.stayId ? { stayId: Number(values.stayId) } : {}),
        details: [detail],
        payments: [
          { paymentMethod: values.paymentMethod, amount: quantity * unitPrice },
        ],
      };
    },
    columns: [
      { header: "N°", accessor: "id" },
      { header: "Cliente", accessor: "customer.fullName" },
      { header: "Total", accessor: "total", render: money },
      {
        header: "Estado",
        accessor: "status",
        render: (value) => <StatusBadge value={value === "OPEN" ? "OPEN_SALE" : value} />,
      },
      { header: "Fecha", accessor: "createdAt", render: dateTime },
    ],
  },
  cashShifts: {
    key: "cash-shifts",
    title: "Caja",
    description: "Aperturas y cierres de turno.",
    listPath: "cash-shift/history",
    createPath: "cash-shift/open",
    createLabel: "Abrir caja",
    fields: [
      {
        name: "openingAmount",
        label: "Monto inicial",
        type: "number",
        step: "0.01",
      },
    ],
    schema: form({ openingAmount: num }),
    columns: [
      { header: "ID", accessor: "id" },
      {
        header: "Usuario apertura",
        accessor: "openedBy.employee.fullName",
        render: (value, row) => String(value ?? getValue(row, "openedBy.username") ?? "-"),
      },
      { header: "Apertura", accessor: "openedAt", render: dateTime },
      { header: "Monto inicial", accessor: "openingAmount", render: money },
      {
        header: "Estado",
        accessor: "status",
        render: (value) => <StatusBadge value={value} />,
      },
      {
        header: "Usuario cierre",
        accessor: "closedBy.employee.fullName",
        render: (value, row) => String(value ?? getValue(row, "closedBy.username") ?? "-"),
      },
      { header: "Cierre", accessor: "closedAt", render: dateTime },
    ],
  },
  cashMovements: {
    key: "cash-movements",
    title: "Movimientos de caja",
    description: "Ingresos y egresos registrados.",
    listPath: "cash-movements",
    createPath: "cash-movements/expense",
    createLabel: "Registrar salida",
    fields: [
      {
        name: "category",
        label: "Tipo de salida",
        type: "select",
        options: cashExpenseCategoryOptions,
      },
      { name: "amount", label: "Monto", type: "number", step: "0.01" },
      {
        name: "paymentMethod",
        label: "Método",
        type: "select",
        options: paymentOptions,
      },
      {
        name: "cashShiftId",
        label: "Caja abierta",
        type: "relation",
        endpoint: "cash-shift/open/all",
        labelKey: "openedBy.employee.fullName",
        optional: true,
        adminOnly: true,
      },
      { name: "description", label: "Motivo", type: "textarea" },
    ],
    schema: form({
      category: req,
      amount: num,
      paymentMethod: req,
      cashShiftId: optNum,
      description: req,
    }),
    columns: [
      {
        header: "Tipo",
        accessor: "type",
        render: (value) => <StatusBadge value={value} />,
      },
      {
        header: "Usuario",
        accessor: "user.employee.fullName",
        render: (value, row) => String(value ?? getValue(row, "user.username") ?? "-"),
      },
      {
        header: "Categoría",
        accessor: "category",
        render: (value) => <StatusBadge value={value} />,
      },
      {
        header: "Método",
        accessor: "paymentMethod",
        render: (value) => <StatusBadge value={value} />,
      },
      { header: "Monto", accessor: "amount", render: money },
      { header: "Fecha", accessor: "occurredAt", render: dateTime },
    ],
  },
  cashClosures: {
    key: "cash-closures",
    title: "Cierres de caja",
    description: "Arqueo por método de pago.",
    listPath: "cash-closures",
    createPath: "cash-closures/close",
    createLabel: "Cerrar caja",
    fields: [
      { name: "CASH", label: "Efectivo contado", type: "number", step: "0.01" },
      { name: "CARD", label: "Tarjeta contado", type: "number", step: "0.01" },
      { name: "YAPE", label: "Yape contado", type: "number", step: "0.01" },
      { name: "PLIN", label: "Plin contado", type: "number", step: "0.01" },
      {
        name: "TRANSFER",
        label: "Transferencia contado",
        type: "number",
        step: "0.01",
      },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
    schema: form({
      CASH: optNum,
      CARD: optNum,
      YAPE: optNum,
      PLIN: optNum,
      TRANSFER: optNum,
      notes: opt,
    }),
    toPayload: (values) => ({
      countedAmounts: paymentOptions.map((method) => ({
        paymentMethod: method.value,
        countedAmount: Number(values[method.value] || 0),
      })),
      notes: values.notes || undefined,
    }),
    columns: [
      { header: "ID", accessor: "id" },
      { header: "Esperado", accessor: "totalExpected", render: money },
      { header: "Contado", accessor: "totalCounted", render: money },
      { header: "Diferencia", accessor: "difference", render: money },
      { header: "Fecha", accessor: "createdAt", render: dateTime },
    ],
  },
  attendance: {
    key: "attendance",
    title: "Asistencia",
    description: "Control mensual del personal.",
    listPath: `attendance/range?from=${from}&to=${to}`,
    createPath: "attendance",
    createLabel: "Registrar asistencia",
    fields: [
      {
        name: "employeeId",
        label: "Empleado",
        type: "relation",
        endpoint: "employees",
        labelKey: "fullName",
      },
      { name: "date", label: "Fecha", type: "date" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: attendanceOptions,
      },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
    schema: form({ employeeId: num, date: dateReq, status: req, notes: opt }),
    columns: [
      { header: "Empleado", accessor: "employee.fullName" },
      { header: "Fecha", accessor: "date", render: dateTime },
      {
        header: "Estado",
        accessor: "status",
        render: (value) => <StatusBadge value={value} />,
      },
      { header: "Entrada", accessor: "checkIn", render: dateTime },
      { header: "Salida", accessor: "checkOut", render: dateTime },
    ],
    actions: [
      {
        label: "Marcar entrada",
        path: (row) => `attendance/${row.id}/check-in`,
      },
      {
        label: "Marcar salida",
        path: (row) => `attendance/${row.id}/check-out`,
      },
    ],
  },
  staffAdvances: {
    key: "staff-advances",
    title: "Adelantos",
    description: "Adelantos de sueldo al personal.",
    listPath: "staff-advances",
    createPath: "staff-advances",
    createLabel: "Nuevo adelanto",
    fields: [
      {
        name: "employeeId",
        label: "Empleado",
        type: "relation",
        endpoint: "employees",
        labelKey: "fullName",
      },
      { name: "amount", label: "Monto", type: "number", step: "0.01" },
      {
        name: "paymentMethod",
        label: "Pago",
        type: "select",
        options: paymentOptions,
      },
      { name: "reason", label: "Motivo", type: "textarea" },
    ],
    schema: form({
      employeeId: num,
      amount: num,
      paymentMethod: req,
      reason: opt,
    }),
    columns: [
      { header: "Empleado", accessor: "employee.fullName" },
      { header: "Monto", accessor: "amount", render: money },
      { header: "Motivo", accessor: "reason" },
      { header: "Fecha", accessor: "createdAt", render: dateTime },
    ],
  },
  staffPayments: {
    key: "staff-payments",
    title: "Pagos de personal",
    description: "Pagos con cálculo de bruto, penalidades y neto por periodo.",
    listPath: "staff-payments",
    createPath: "staff-payments",
    createLabel: "Nuevo pago",
    fields: [
      {
        name: "employeeId",
        label: "Empleado",
        type: "relation",
        endpoint: "employees",
        labelKey: "fullName",
      },
      { name: "periodStart", label: "Inicio periodo", type: "date" },
      { name: "periodEnd", label: "Fin periodo", type: "date" },
      { name: "amount", label: "Monto bruto manual (opcional)", type: "number", step: "0.01" },
      {
        name: "paymentMethod",
        label: "Pago",
        type: "select",
        options: paymentOptions,
      },
    ],
    schema: form({
      employeeId: num,
      periodStart: dateReq,
      periodEnd: dateReq,
      amount: optNum,
      paymentMethod: req,
    }),
    columns: [
      { header: "Empleado", accessor: "employee.fullName" },
      { header: "Bruto", accessor: "grossAmount", render: money },
      { header: "Penaliz.", accessor: "penaltyAmount", render: money },
      { header: "Neto", accessor: "amount", render: money },
      { header: "Inicio", accessor: "periodStart", render: (v: unknown) => dateTime(v).split(" ")[0] },
      { header: "Fin", accessor: "periodEnd", render: (v: unknown) => dateTime(v).split(" ")[0] },
      { header: "Fecha", accessor: "createdAt", render: dateTime },
    ],
  },
  staffDiscounts: {
    key: "staff-discounts",
    title: "Descuentos",
    description: "Descuentos por pérdidas o daños.",
    listPath: "staff-discounts",
    createPath: "staff-discounts",
    createLabel: "Nuevo descuento",
    fields: [
      {
        name: "employeeId",
        label: "Empleado",
        type: "relation",
        endpoint: "employees",
        labelKey: "fullName",
      },
      { name: "amount", label: "Monto", type: "number", step: "0.01" },
      { name: "reason", label: "Motivo" },
      {
        name: "productId",
        label: "Producto tomado",
        type: "relation",
        endpoint: "products",
        labelKey: "name",
        optional: true,
      },
      { name: "quantity", label: "Cantidad tomada", type: "number" },
      {
        name: "inventoryMovementId",
        label: "Movimiento inventario",
        type: "number",
      },
      { name: "chargeNow", label: "Cobrar ahora", type: "checkbox" },
      {
        name: "paymentMethod",
        label: "Pago",
        type: "select",
        options: paymentOptions,
      },
    ],
    schema: form({
      employeeId: num,
      amount: num,
      reason: req,
      productId: optNum,
      quantity: optNum,
      inventoryMovementId: optNum,
      chargeNow: bool,
      paymentMethod: opt,
    }),
    columns: [
      { header: "Empleado", accessor: "employee.fullName" },
      { header: "Monto", accessor: "amount", render: money },
      { header: "Motivo", accessor: "reason" },
      { header: "Fecha", accessor: "createdAt", render: dateTime },
    ],
  },
  penalties: {
    key: "penalties",
    title: "Penalidades",
    description: "Descuentos al personal que se aplican en el próximo pago.",
    listPath: "penalties",
    createPath: "penalties",
    createLabel: "Nueva penalidad",
    fields: [
      {
        name: "employeeId",
        label: "Empleado",
        type: "relation",
        endpoint: "employees",
        labelKey: "fullName",
      },
      { name: "amount", label: "Monto", type: "number", step: "0.01" },
      { name: "reason", label: "Motivo", type: "textarea" },
      { name: "date", label: "Fecha", type: "date" },
    ],
    schema: form({
      employeeId: num,
      amount: num,
      reason: req,
      date: dateReq,
    }),
    columns: [
      { header: "Empleado", accessor: "employee.fullName" },
      { header: "Monto", accessor: "amount", render: money },
      { header: "Motivo", accessor: "reason" },
      { header: "Estado", accessor: "status" },
      { header: "Fecha", accessor: "date", render: (v: unknown) => dateTime(v).split(" ")[0] },
    ],
  },
};
