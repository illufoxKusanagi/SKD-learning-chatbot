"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { Button } from "@/components/ui/button";
import HelpButton from "@/components/ui/help-button";
import ModeToggleButton from "@/components/ui/mode-toggle-button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TryoutLobbyWorkspace } from "@/components/tryout/tryout-lobby-workspace";
import { isValidTryoutUuid } from "@/components/tryout/tryout-utils";
import { AlertTriangle, ClipboardCheck, MessageSquare } from "lucide-react";

export default function TryoutLobbyPage() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [returnChatHref, setReturnChatHref] = useState("/chat");

  useEffect(() => {
    try {
      const lastActive = sessionStorage.getItem("skd_last_active_chat_id");
      if (isValidTryoutUuid(lastActive)) {
        setReturnChatHref(`/chat?id=${encodeURIComponent(lastActive)}`);
        return;
      }
      const rawGuestIds = localStorage.getItem("skd_guest_chat_ids");
      if (rawGuestIds) {
        const ids: unknown = JSON.parse(rawGuestIds);
        if (Array.isArray(ids) && isValidTryoutUuid(ids[0])) {
          setReturnChatHref(`/chat?id=${encodeURIComponent(ids[0])}`);
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {!isAuthenticated && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-warning/10 py-2">
          <AlertTriangle className="text-warning" />
          <AlertDescription className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-foreground">
            <span>
              Mode Tamu: Progres &amp; hasil simulasi CAT disimpan sementara di
              perangkat ini.
            </span>
            <Link
              href="/auth/login"
              className="font-semibold text-primary underline hover:no-underline"
            >
              Login untuk sinkronisasi permanen
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <SidebarProvider
        defaultOpen={true}
        className="!min-h-0 flex-1 overflow-hidden"
      >
        <div className="flex h-full w-full flex-row overflow-hidden">
          {isAuthenticated ? <AppSidebar /> : null}

          <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
              <div className="flex min-w-0 items-center gap-2.5">
                {isAuthenticated ? <SidebarTrigger /> : null}
                <ClipboardCheck className="size-4 shrink-0 text-primary" />
                <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                  Simulasi CAT BKN
                </h1>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={returnChatHref}>
                    <MessageSquare data-icon="inline-start" />
                    <span>Kembali ke Chat</span>
                  </Link>
                </Button>
                <ModeToggleButton />
                <HelpButton />
              </div>
            </header>

            <TryoutLobbyWorkspace />
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
