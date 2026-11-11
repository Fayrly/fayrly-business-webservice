export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar_url: string;
  status: UserStatus;
  roles: string[];
  permissions?: string[];
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string;
  is_system: boolean;
  user_count: number;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface Permission {
  key: string;
  resource: string;
  action: string;
  description: string;
}

export interface AccessMatrix {
  permissions: Permission[];
  roles: Role[];
}

export interface UserQuery {
  q?: string;
  status?: UserStatus | '';
  role?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  phone?: string;
  roles: string[];
  password?: string;
}

export interface CreateUserResponse {
  data: User;
  temporary_password?: string;
  notice?: string;
}

export interface ResetPasswordResponse {
  temporary_password: string;
  notice: string;
}

export interface MatrixRole {
  role_id: string;
  permissions: string[];
}

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  suspended: 'Ditangguhkan',
};
