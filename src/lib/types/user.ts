export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: string;
  profileUrl?: string;
}
export interface CreateUserRequest {
  email: string;
  password: string;
  username: string;
  role?: string;
}
export interface UserWithoutPassword {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}
