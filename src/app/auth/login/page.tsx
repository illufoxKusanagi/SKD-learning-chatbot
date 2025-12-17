"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useEffect } from "react";
import { useAuth } from "@/app/context/auth-context";

const schema = z.object({
  identifier: z.string().min(1, "Email atau password harus diisi"),
  password: z.string().min(1, "Password harus diisi"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  // Edited here: Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      console.log("User already authenticated, redirecting to home");
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      console.log("Attempting login with:", data.identifier);

      await login(data.identifier, data.password);

      // Edited here: Show success message and redirect
      toast.success(`Login berhasil, Okaerinasai, ${data.identifier}-san!`);
      router.push("/");
    } catch (error) {
      console.error("Login error:", error);

      // Edited here: Better error handling
      if (error instanceof Error) {
        if (
          error.message.includes("Invalid credentials") ||
          error.message.includes("tidak valid")
        ) {
          form.setError("root", {
            type: "manual",
            message: "Email/username atau password tidak valid",
          });
        } else {
          form.setError("root", {
            type: "manual",
            message: error.message,
          });
        }
      } else {
        form.setError("root", {
          type: "manual",
          message: "Login gagal, silahkan coba lagi",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 body-big-bold">Checking authentication...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-xs">
        <CardHeader className="text-center m-2">
          <CardTitle>Login</CardTitle>
          <CardDescription>
            Masukkan email atau username anda untuk melanjutkan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username atau Email</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="john.doe@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Memproses..." : "Masuk"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <div className="flex flex-col w-full gap-1 items-center">
            <Separator />
            <p className="body-small-regular text-gray-400">Atau</p>
            <Separator />
          </div>
          <Button variant="outline" className="w-full">
            Masuk dengan Google
          </Button>
          <CardDescription className="text-center text-sm">
            Belum punya akun?{" "}
            <Link
              href={"/auth/register"}
              className="text-primary hover:underline"
            >
              Daftar disini
            </Link>
          </CardDescription>
        </CardFooter>
      </Card>
    </div>
  );
}
