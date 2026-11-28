"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import MainContent from "@/components/chat/main-chat-page";
import Link from "next/link";
import HelpButton from "@/components/ui/help-button";
import ModeToggleButton from "@/components/ui/mode-toggle-button";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Suspense } from "react";

function HomeContent() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";
  const user = session?.user;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  // Home page should be accessible to everyone - no authentication blocking
  return (
    <div className="flex flex-col h-screen relative">
      <div className="flex gap-4 absolute top-4 right-4 z-10">
        <ModeToggleButton />
        <HelpButton />
        {!isAuthenticated ? (
          <Button asChild>
            <Link href="/auth/login">Login</Link>
          </Button>
        ) : (
          <div className="flex items-center">
            {isLoading ? (
              <p className="body-medium-regular">Loading...</p>
            ) : (
              <p className="body-medium-regular">
                Hello, {user?.name || user?.email?.split("@")[0] || "User"}
              </p>
            )}
          </div>
        )}
      </div>
      <SidebarProvider defaultOpen={true}>
        <div className="flex flex-row h-full w-full">
          {isAuthenticated && (
            <>
              <AppSidebar />
              <SidebarTrigger className="ml-4 mt-4" size={"xl"} />
            </>
          )}
          <main className="flex-1 overflow-y-auto">
            <MainContent />
          </main>
        </div>
      </SidebarProvider>
      <footer className="flex flex-col w-full items-center absolute h-fit bg-accent p-2 bottom-0">
        <p className="body-small-regular">
          Made with 💗 by{" "}
          <span className="hover:underline">
            <Link
              href={"https://github.com/illufoxKusanagi"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Illufox Kasunagi
            </Link>
          </span>
        </p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Spinner className="size-8 text-primary" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
