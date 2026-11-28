"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  History,
  Plus,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";

interface ChatHistoryItem {
  id: string;
  title: string;
  userId: string | null;
  createdAt: string;
}

const NAV_ITEMS = [
  { href: "/materi", label: "Bank Materi TWK", icon: BookOpen },
  { href: "/tryout", label: "Simulasi CAT BKN", icon: ClipboardCheck },
  { href: "/quiz-history", label: "Riwayat Latihan SKD", icon: History },
] as const;

function AppSidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get("id");
  const [conversations, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const authLoading = status === "loading";
  const user = session?.user;

  const userInfo = {
    name:
      user?.name ||
      (user?.email ? user.email.split("@")[0] : undefined) ||
      "User",
    email: user?.email || "guest@example.com",
  };

  const fetchChatHistory = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    abortControllerRef.current?.abort();

    if (authLoading) {
      abortControllerRef.current = null;
      return;
    }

    if (!isAuthenticated || !user) {
      abortControllerRef.current = null;
      setChatHistory([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat/history", {
        signal: controller.signal,
      });
      if (requestId !== requestIdRef.current) return;
      if (!response.ok) {
        if (response.status === 401) {
          console.warn("Unauthorized access to chat history");
          setChatHistory([]);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (requestId !== requestIdRef.current) return;
      setChatHistory(result.data?.chats || []);
    } catch (error) {
      if (
        requestId !== requestIdRef.current ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }
      console.error("Failed to fetch chat history:", error);
      setChatHistory([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, user, authLoading]);

  useEffect(() => {
    void fetchChatHistory();
    return () => {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, [fetchChatHistory]);

  useEffect(() => {
    const handleChatCreated = () => {
      void fetchChatHistory();
    };
    window.addEventListener("skd:chat-created", handleChatCreated);
    return () => {
      window.removeEventListener("skd:chat-created", handleChatCreated);
    };
  }, [fetchChatHistory]);

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Tutor SKD CPNS">
              <Link href="/chat">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Tutor SKD CPNS</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Personal Mastery
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-3 p-2">
        <SidebarGroup className="pb-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Percakapan Baru"
                className="h-9 bg-primary font-medium text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              >
                <Link href="/chat">
                  <Plus />
                  <span>Percakapan Baru</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Menu Belajar</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(href)}
                    tooltip={label}
                  >
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAuthenticated && (
          <SidebarGroup>
            <SidebarGroupLabel>Riwayat Percakapan</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled className="text-muted-foreground">
                      <span>Memuat...</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : conversations.length > 0 ? (
                  conversations.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === "/chat" && activeChatId === chat.id}
                        tooltip={chat.title}
                      >
                        <Link href={`/chat?id=${chat.id}`}>
                          <span className="truncate">{chat.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                ) : (
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled className="text-muted-foreground">
                      <span>Belum ada percakapan</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        <NavUser user={userInfo} />
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar() {
  return (
    <Suspense fallback={<Sidebar variant="sidebar" collapsible="icon" />}>
      <AppSidebarInner />
    </Suspense>
  );
}
