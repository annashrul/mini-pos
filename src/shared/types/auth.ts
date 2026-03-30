export type UserRole = string;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface SessionUser extends AuthUser {
  isActive: boolean;
}
