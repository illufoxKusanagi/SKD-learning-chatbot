'use client';

import { Suspense } from 'react';
import { ChatWorkspace } from '@/components/chat/chat-workspace';

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          Memuat aplikasi...
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
