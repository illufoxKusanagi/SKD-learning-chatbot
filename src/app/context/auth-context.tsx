"use client";

import { useRouter } from "next/navigation";
import type { User } from "@/lib/types/auth";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
  logout: () => Promise<void>;
  getAuthHeaders: () => { [key: string]: string };
  getToken: () => string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

interface AuthProviderProps {
  children: ReactNode;
}

const AUTH_STORAGE_KEY = "auth_token";
const REFRESH_STORAGE_KEY = "refresh_token";

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const router = useRouter();

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Edited here: Your superior centralized API call pattern
  const apiCall = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const token = localStorage.getItem(AUTH_STORAGE_KEY);
      const response = await fetch(`/api/auth${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      return data;
    },
    []
  );

  const storeTokens = useCallback(
    (accessToken: string, refreshToken: string) => {
      localStorage.setItem(AUTH_STORAGE_KEY, accessToken);
      localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    },
    []
  );

  const clearTokens = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(REFRESH_STORAGE_KEY);
  }, []);

  const getToken = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(AUTH_STORAGE_KEY);
  }, []);

  const getAuthHeaders = useCallback(() => {
    const token = getToken();
    const headers: { [key: string]: string } = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Login failed");
      }

      // Edited here: Store token BEFORE setting state
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTH_STORAGE_KEY, data.data.accessToken);
      }

      if (data.success) {
      }

      // Edited here: Map the response structure correctly
      const userData = {
        id: data.data.user.id,
        email: data.data.user.email,
        username: data.data.user.username,
        name: data.data.user.username,
        role: data.data.user.role,
      };

      setState({
        user: userData,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      console.log("Login successful, user set:", userData); // Debug log
      // toast.success(`Login berhasil, Okaerinasai, ${userData.username}-san!`);
    } catch (error) {
      console.error("Login error:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Login failed",
        isLoading: false,
        isAuthenticated: false,
        user: null,
      }));
      throw error;
    }
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || "Registration failed");
        }

        // Edited here: Store token BEFORE setting state
        if (typeof window !== "undefined") {
          localStorage.setItem(AUTH_STORAGE_KEY, data.data.accessToken);
        }

        // Edited here: Map the response structure correctly
        const userData = {
          id: data.data.user.id,
          email: data.data.user.email,
          username: data.data.user.username,
          name: data.data.user.username,
          role: data.data.user.role,
        };

        setState({
          user: userData,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        console.log("Registration successful, user set:", userData); // Debug log
        toast.success(
          `Okaerinasai, ${userData.username}-san! Akun berhasil dibuat.`
        );
      } catch (error) {
        console.error("Registration error:", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Registration failed",
          isLoading: false,
          isAuthenticated: false,
          user: null,
        }));
        throw error;
      }
    },
    []
  );

  // Edited here: Your superior logout pattern - client-side cleanup
  const logout = useCallback(async () => {
    clearTokens();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    if (typeof window !== "undefined") {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("chat_") || key.startsWith("app_")) {
          localStorage.removeItem(key);
        }
      });
    }
    toast.info("Logout berhasil!");
    router.push("/auth/login");
  }, [clearTokens, router]);

  const refreshAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!token) {
        console.log("No token found, user not authenticated");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
          user: null,
        }));
        return;
      }

      console.log("Refreshing auth with token...");

      const response = await fetch("/api/auth/me", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.log("Auth refresh failed:", data.message);
        throw new Error(data.message || "Auth refresh failed");
      }

      const userData = {
        id: data.data.user.id,
        email: data.data.user.email,
        username: data.data.user.username,
        name: data.data.user.username,
        role: data.data.user.role,
      };

      setState({
        user: userData,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      console.log("Auth refreshed successfully, user:", userData); // Debug log
    } catch (error) {
      console.error("Auth refresh failed:", error);
      clearTokens();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, [clearTokens]);

  useEffect(() => {
    console.log("AuthProvider mounted, refreshing auth...");
    refreshAuth();
  }, [refreshAuth]);

  // Edited here: Add debug logging for state changes
  useEffect(() => {
    console.log("Auth state changed:", {
      isAuthenticated: state.isAuthenticated,
      user: state.user?.username,
      isLoading: state.isLoading,
      hasToken: !!getToken(),
    });
  }, [state.isAuthenticated, state.user, state.isLoading]);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    register,
    refreshAuth,
    clearError,
    getAuthHeaders,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
