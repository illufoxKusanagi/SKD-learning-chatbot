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
import React, { useEffect, Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

const schema = z.object({
  identifier: z.string().min(1, "Email atau Username harus diisi!"),
  password: z.string().min(1, "Password harus diisi!"),
});

type FormData = z.infer<typeof schema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const returnUrl = searchParams.get("returnUrl") || "/";
  const redirectMessage = searchParams.get("message");

  useEffect(() => {
    if (redirectMessage) {
      toast.info(redirectMessage);
    }
  }, [redirectMessage]);

  useEffect(() => {
    if (status === "authenticated") {
      console.log("User already authenticated, redirecting to:", returnUrl);
      router.push(returnUrl);
    }
  }, [status, router, returnUrl]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        identifier: data.identifier,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        form.setError("root", {
          type: "manual",
          message: "Email/username atau password tidak valid",
        });
        toast.error("Login gagal");
      } else {
        toast.success("Login berhasil, Selamat Datang!!");
        router.push(returnUrl);
        router.refresh();
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat login");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
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
            <Image
              src="/google_icon.svg"
              alt="Google logo"
              width={16}
              height={16}
              className="mr-2"
            />
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
