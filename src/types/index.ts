export type User = {
  id: number;
  username: string;
  role: 'ADMIN' | 'RECEPTIONIST' | 'CASHIER';
  permissions?: string[];
  active?: boolean;
  employee?: {
    id: number;
    fullName: string;
  } | null;
};

export type LoginResponse = {
  accessToken: string;
  user: User;
};

export type AnyRow = Record<string, unknown> & { id?: number };
