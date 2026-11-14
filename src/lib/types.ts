/* eslint-disable @typescript-eslint/no-explicit-any */
export type Role = 'super_admin' | 'admin_staff' | 'shop_owner' | 'employee';
export type Row = Record<string, any>;

export interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  shopId?: string;
  permissions: string[];
  status: 'active' | 'blocked';
}
export interface Subscription {
  status: 'trial' | 'active' | 'expired';
  endsAt?: string;
  daysLeft: number;
  planId?: string;
}
export interface Restriction {
  active: boolean;
  until?: string;
  message?: string;
}
export interface Me {
  user: User;
  shop: Row | null;
  subscription: Subscription | null;
  restriction: Restriction | null;
}
export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paged<T = Row> {
  data: T[];
  meta?: Meta;
}
