"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;

  useEffect(() => {
    if (chatId) {
      router.replace(`/chat?id=${chatId}`);
    }
  }, [chatId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <Spinner className="size-8 text-primary" />
        <p className="text-sm text-muted-foreground">Loading chat...</p>
      </div>
    </div>
  );
}
