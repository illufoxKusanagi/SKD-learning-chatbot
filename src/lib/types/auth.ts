import { UserRole } from "../definitions";

// src/types/auth.ts
export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  identifier: string; // email or username
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
}

export interface AuthError {
  message: string;
  field?: string;
}
