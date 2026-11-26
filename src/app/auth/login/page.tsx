'use client';

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
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import React, { useEffect, Suspense, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';

const schema = z.object({
  identifier: z.string().min(1, 'Email atau Username harus diisi!'),
  password: z.string().min(1, 'Password harus diisi!'),
});

type FormData = z.infer<typeof schema>;

function formatLoginError(errorCode: string): string {
  if (errorCode.startsWith('RATE_LIMITED:')) {
    const seconds = Number(errorCode.split(':')[1]) || 60;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const waitText =
      minutes > 0
        ? remainingSeconds > 0
          ? `${minutes} menit ${remainingSeconds} detik`
          : `${minutes} menit`
        : `${seconds} detik`;
    return `Terlalu banyak percobaan login yang gagal. Silakan tunggu sekitar ${waitText} sebelum mencoba lagi.`;
  }

  if (
    errorCode === 'INVALID_CREDENTIALS' ||
    errorCode === 'CredentialsSignin'
  ) {
    return 'Email/username atau password tidak valid.';
  }

  return 'Gagal memproses login. Silakan coba lagi.';
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const rawReturnUrl = searchParams.get('returnUrl');
  const returnUrl =
    rawReturnUrl &&
    rawReturnUrl.startsWith('/') &&
    !rawReturnUrl.startsWith('//') &&
    !rawReturnUrl.includes('\\')
      ? rawReturnUrl
      : '/';
  const redirectMessage = searchParams.get('message');

  useEffect(() => {
    if (redirectMessage) {
      toast.info(redirectMessage);
    }
  }, [redirectMessage]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.push(returnUrl);
    }
  }, [status, router, returnUrl]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    form.clearErrors('root');
    try {
      const result = await signIn('credentials', {
        identifier: data.identifier,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        const errorMessage = formatLoginError(result.error);
        form.setError('root', {
          type: 'manual',
          message: errorMessage,
        });
        toast.error(errorMessage);
      } else {
        toast.success('Login berhasil, Selamat Datang!!');
        router.push(returnUrl);
        router.refresh();
      }
    } catch (error) {
      const fallbackMessage = 'Gagal memproses login. Silakan coba lagi.';
      form.setError('root', {
        type: 'manual',
        message: fallbackMessage,
      });
      toast.error(fallbackMessage);
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isBusy = isLoading || form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
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
                        disabled={isBusy}
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
                      <Input
                        type="password"
                        disabled={isBusy}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
                >
                  {form.formState.errors.root.message}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isBusy}>
                {isBusy ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Memproses...
                  </>
                ) : (
                  'Masuk'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <CardDescription className="text-center text-sm">
            Belum punya akun?{' '}
            <Link
              href={'/auth/register'}
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
