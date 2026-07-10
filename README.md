# Iguazú Frontend MVP

Frontend del sistema hotelero Iguazú, conectado al backend NestJS existente.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- shadcn/ui con Radix UI
- Zustand para sesión JWT persistida
- TanStack Query para datos remotos
- TanStack Table para tablas responsive
- React Hook Form + Zod para formularios
- Axios para API HTTP
- React Router DOM
- lucide-react
- sonner

## Instalación

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run build
```

## Variables de entorno

Copia `.env.example` a `.env` y ajusta la URL del backend:

```bash
VITE_API_URL=/api
```

En desarrollo, Vite proxya `/api` hacia `http://localhost:3000` para evitar problemas de CORS. Si despliegas el frontend separado o tu backend ya permite CORS, puedes usar una URL absoluta:

```bash
VITE_API_URL=https://tu-backend.com
```

El token JWT se envía automáticamente como:

```txt
Authorization: Bearer token
```

## Rutas principales

- `/login`
- `/dashboard`
- `/employees`
- `/users`
- `/price-types`
- `/room-types`
- `/room-type-prices`
- `/rooms`
- `/cash-shifts`
- `/cash-movements`
- `/customers`
- `/reservations`
- `/stays`
- `/products`
- `/inventory`
- `/sales`
- `/attendance`
- `/staff-advances`
- `/staff-payments`
- `/staff-discounts`
- `/cash-closures`

## Estructura

```txt
src/
  app/              router y providers
  components/       ui, layout, tablas, formularios, badges
  features/         páginas y configuración de módulos
  lib/              axios API y utilidades
  store/            store Zustand de auth
  types/            tipos compartidos
```

## Conexión con backend

- Login: `POST auth/login`
- Usuario actual: `GET auth/me`
- CRUDs y acciones usan las rutas documentadas en `backend_iguazu/docs/endpoints-data.md`.
- La URL base nunca está hardcodeada: se lee desde `VITE_API_URL`.
- Si un endpoint falla, la pantalla muestra estado de error y los formularios muestran toast con `sonner`.
