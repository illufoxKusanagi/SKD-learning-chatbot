'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const formSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(20, 'Username maksimal 20 karakter')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username hanya boleh berisi huruf, angka, dan underscore (tanpa spasi)'
    ),
  email: z.email('Masukkan alamat email yang valid').trim(),
  password: z
    .string()
    .min(6, 'Password minimal 6 karakter')
    .max(72, 'Password maksimal 72 karakter'),
});

type FormData = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    form.clearErrors('root');
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (Array.isArray(result.details)) {
          for (const detail of result.details) {
            if (
              detail.field === 'username' ||
              detail.field === 'email' ||
              detail.field === 'password'
            ) {
              form.setError(detail.field, { message: detail.message });
            }
          }
        }
        if (
          result.code === 'EMAIL_ALREADY_EXISTS' ||
          result.code === 'EMAIL_ALREADY_REGISTERED'
        ) {
          form.setError('email', { message: result.error });
        }
        if (
          result.code === 'USERNAME_ALREADY_EXISTS' ||
          result.code === 'USERNAME_ALREADY_TAKEN'
        ) {
          form.setError('username', { message: result.error });
        }
        form.setError('root', {
          message: result.error || 'Registrasi gagal. Silakan coba lagi.',
        });
        throw new Error(result.error || 'Registrasi gagal. Silakan coba lagi.');
      }
      toast.success(
        'Akun berhasil dibuat! Anda akan dialihkan ke halaman login.'
      );
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Gagal mendaftar, silakan coba lagi.'
      );
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center overflow-auto p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Buat akun</CardTitle>
          <CardDescription>
            Masukkan detail Anda untuk membuat akun
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-5"
            >
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="john_doe"
                        autoComplete="username"
                        disabled={isSubmitting}
                        {...field}
                      />
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
                        autoComplete="email"
                        disabled={isSubmitting}
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
                      <InputGroup>
                        <InputGroupInput
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          disabled={isSubmitting}
                          {...field}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            type="button"
                            size="icon-xs"
                            aria-label={
                              showPassword
                                ? 'Sembunyikan password'
                                : 'Tampilkan password'
                            }
                            onClick={() => setShowPassword((prev) => !prev)}
                            disabled={isSubmitting}
                          >
                            {showPassword ? <EyeOff /> : <Eye />}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>
                    {form.formState.errors.root.message}
                  </AlertDescription>
                </Alert>
              )}
              <Button
                disabled={isSubmitting}
                type="submit"
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Membuat akun...
                  </>
                ) : (
                  'Daftar'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <CardDescription className="text-center">
            Sudah punya akun?{' '}
            <Link href={'/auth/login'} className="text-primary hover:underline">
              Login disini
            </Link>
          </CardDescription>
        </CardFooter>
      </Card>
    </div>
  );
}
