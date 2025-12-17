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
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Image from "next/image";

const schema = z.object({
  username: z
    .string()
    .min(4, "Username minimal 4 karakter")
    .max(20, "Username maksimal 20 karakter"),
  email: z.string().email("Alamat email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: z.number(),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: 1,
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          form.setError("email", {
            type: "manual",
            message: "Email sudah terdaftar.",
          });
        }
        throw new Error(result.error || "Gagal mendaftar.");
      }
      toast.success(
        "Akun berhasil dibuat! Anda akan dialihkan ke halaman login."
      );
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mendaftar, silakan coba lagi."
      );
    }
  };

  return (
    <div className="flex h-screen items-center justify-center overflow-auto">
      <Card className="w-full max-w-xs">
        <CardHeader className="text-center m-2">
          <CardTitle>Buat akun</CardTitle>
          <CardDescription>
            Masukkan detail Anda untuk membuat akun
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.keys(UserRole)
                          .filter((key) => !isNaN(Number(key)))
                          .map((key) => (
                            <SelectItem key={key} value={key}>
                              {UserRole[Number(key)]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        placeholder="Masukkan password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                disabled={form.formState.isSubmitting}
                type="submit"
                className="w-full"
              >
                {form.formState.isSubmitting ? "Membuat akun..." : "Daftar"}
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
            Lanjutkan dengan Google
          </Button>
          <CardDescription className="text-center">
            Sudah punya akun?{" "}
            <Link href={"/auth/login"} className="text-primary hover:underline">
              Login disini
            </Link>
          </CardDescription>
        </CardFooter>
      </Card>
    </div>
  );
}
