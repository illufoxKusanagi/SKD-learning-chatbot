import { Open_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
import AuthProviders from "@/components/providers/auth-provider";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});

export const metadata = {
  title: "Tutor SKD CPNS - AI Learning Assistant",
  description: "Platform pembelajaran dan latihan soal interaktif Seleksi Kompetensi Dasar (SKD) CPNS berbasis AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${openSans.variable} ${openSans.className}`}>
        <AuthProviders>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthProviders>
      </body>
    </html>
  );
}