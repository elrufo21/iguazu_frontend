import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/app-layout';
import { ProtectedRoute } from '../components/layout/protected-route';
import { AttendancePage } from '../features/attendance/attendance-page';
import { BillingPage } from '../features/billing/billing-page';
import { LoginPage } from '../features/auth/login-page';
import { CashClosuresPage } from '../features/cash-closures/cash-closures-page';
import { CashMovementsPage } from '../features/cash-movements/cash-movements-page';
import { CashShiftsPage } from '../features/cash-shifts/cash-shifts-page';
import { CustomersPage } from '../features/customers/customers-page';
import { DashboardPage } from '../features/dashboard/dashboard-page';
import { EmployeesPage } from '../features/employees/employees-page';
import { InventoryPage } from '../features/inventory/inventory-page';
import { PriceTypesPage } from '../features/price-types/price-types-page';
import { PermissionsPage } from '../features/permissions/permissions-page';
import { ProductsPage } from '../features/products/products-page';
import { ReservationsPage } from '../features/reservations/reservations-page';
import { ReportsPage } from '../features/reports/reports-page';
import { RoomTypePricesPage } from '../features/room-type-prices/room-type-prices-page';
import { RoomTypesPage } from '../features/room-types/room-types-page';
import { RoomsPage } from '../features/rooms/rooms-page';
import { SalesPage } from '../features/sales/sales-page';
import { SalesHistoryPage } from '../features/sales/sales-history-page';
import { StaffAdvancesPage } from '../features/staff-advances/staff-advances-page';
import { StaffDiscountsPage } from '../features/staff-discounts/staff-discounts-page';
import { StaffPaymentsPage } from '../features/staff-payments/staff-payments-page';
import { StaysPage } from '../features/stays/stays-page';
import { UsersPage } from '../features/users/users-page';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'price-types', element: <PriceTypesPage /> },
      { path: 'room-types', element: <RoomTypesPage /> },
      { path: 'room-type-prices', element: <RoomTypePricesPage /> },
      { path: 'rooms', element: <RoomsPage /> },
      { path: 'cash-shifts', element: <CashShiftsPage /> },
      { path: 'cash-movements', element: <CashMovementsPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'reservations', element: <ReservationsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'stays', element: <StaysPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'sales', element: <SalesPage /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'sales/history', element: <SalesHistoryPage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'staff-advances', element: <StaffAdvancesPage /> },
      { path: 'staff-payments', element: <StaffPaymentsPage /> },
      { path: 'staff-discounts', element: <StaffDiscountsPage /> },
      { path: 'cash-closures', element: <CashClosuresPage /> },
      { path: 'permissions', element: <PermissionsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
