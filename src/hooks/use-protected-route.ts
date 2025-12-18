"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

interface UseProtectedRouteOptions {
  redirectTo?: string;
  message?: string;
}

export function useProtectedRoute(options: UseProtectedRouteOptions = {}) {
  const {
    redirectTo = "/auth/login",
    message = "Silakan login terlebih dahulu untuk mengakses halaman ini",
  } = options;

  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Show toast message
      toast.error(message);

      // Redirect with return URL so user can be redirected back after login
      const returnUrl = encodeURIComponent(pathname);
      router.replace(
        `${redirectTo}?returnUrl=${returnUrl}&message=${encodeURIComponent(
          message
        )}`
      );
    }
  }, [isAuthenticated, isLoading, router, redirectTo, message, pathname]);

  return {
    isAuthenticated,
    isLoading,
    isProtected: !isLoading && isAuthenticated,
  };
}
