import { Open_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
// import { AuthProvider } from "@/app/context/auth-context";
import AuthProviders from "@/components/providers/session-provider";

// TODO : Change app branding from public information RAG to SKD AI learning

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});

export const metadata = {
  title: "SKD AI Learning",
  description: "Chatbot Pembelajaran SKD berbasis AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
