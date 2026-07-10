import {
  Banknote,
  BarChart3,
  BedDouble,
  Boxes,
  CalendarDays,
  CreditCard,
  FileText,
  Gauge,
  HandCoins,
  Hotel,
  Package,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  Tags,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: Gauge },
  { label: "Reportes", path: "/reports", icon: BarChart3, permission: "GET /reports/cash-summary" },
  { label: "Habitaciones", path: "/rooms", icon: BedDouble, permission: "GET /rooms" },
  { label: "Reservas", path: "/reservations", icon: CalendarDays, permission: "GET /reservations" },
  { label: "Estadías", path: "/stays", icon: Hotel, permission: "GET /stays/active" },
  { label: "Ventas", path: "/sales", icon: Receipt, permission: "GET /products" },
  { label: "Comprobantes", path: "/billing", icon: FileText, permission: "GET /billing" },
  { label: "Clientes", path: "/customers", icon: Users, permission: "GET /customers" },
  { label: "Productos", path: "/products", icon: Package, permission: "GET /products" },
  { label: "Stock", path: "/inventory", icon: Boxes, permission: "GET /inventory/movements" },
  { label: "Caja", path: "/cash-shifts", icon: WalletCards, permission: "GET /cash-shift/history" },
  { label: "Movimientos", path: "/cash-movements", icon: Banknote, permission: "GET /cash-movements" },
  { label: "Cierres", path: "/cash-closures", icon: CreditCard, permission: "GET /cash-closures" },
  { label: "Empleados", path: "/employees", icon: UserCog, permission: "GET /employees" },
  { label: "Usuarios", path: "/users", icon: Users, permission: "GET /users" },
  //{ label: 'Asistencia', path: '/attendance', icon: ClipboardCheck },
  { label: "Adelantos", path: "/staff-advances", icon: HandCoins, permission: "GET /staff-advances" },
  { label: "Pagos", path: "/staff-payments", icon: Banknote, permission: "GET /staff-payments" },
  { label: "Descuentos", path: "/staff-discounts", icon: Tags, permission: "GET /staff-discounts" },
  { label: "Penalidades", path: "/penalties", icon: ShieldAlert, permission: "GET /penalties" },
  { label: "Tipos precio", path: "/price-types", icon: Tags, permission: "GET /price-types" },
  { label: "Tipos habitación", path: "/room-types", icon: BedDouble, permission: "GET /room-types" },
  { label: "Tarifas", path: "/room-type-prices", icon: CreditCard, permission: "GET /room-type-prices" },
  { label: "Permisos", path: "/permissions", icon: ShieldCheck, adminOnly: true },
];

const getNavItems = (paths: string[]) =>
  navItems.filter((item) => paths.includes(item.path));

export const navGroups = [
  {
    label: "Principal",
    defaultOpen: true,
    items: getNavItems(["/dashboard", "/reports"]),
  },
  {
    label: "Recepción",
    defaultOpen: true,
    items: getNavItems(["/rooms", "/reservations", "/stays", "/customers"]),
  },
  {
    label: "Ventas e inventario",
    defaultOpen: true,
    items: getNavItems(["/sales", "/billing", "/products", "/inventory"]),
  },
  {
    label: "Caja",
    defaultOpen: true,
    items: getNavItems(["/cash-shifts", "/cash-movements", "/cash-closures"]),
  },
  {
    label: "Personal",
    items: getNavItems([
      "/employees",
      "/users",
      "/staff-advances",
      "/staff-payments",
      "/staff-discounts",
      "/penalties",
      "/price-types",
      "/room-types",
    ]),
  },
  {
    label: "Configuración",
    items: getNavItems(["/room-type-prices", "/permissions"]),
  },
];

export const mobileNavItems = navItems.slice(0, 5);
