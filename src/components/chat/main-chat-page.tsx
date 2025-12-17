"use client";

import ChatInput from "./chat-input";
import { useChat } from "@/hooks/use-chat";

export default function MainContent() {
  const { isLoading, handleSendMessage } = useChat();
  return (
    <div className="flex-1 flex flex-col gap-12 items-center h-full justify-center w-full">
      <div className="flex flex-col w-full max-w-[40rem] gap-4 items-center text-center">
       
        <h1 className="heading-1 text-wrap">
          Chatbot Pembelajaran SKD berbasis AI
        </h1>
        <p>Minta chatbot untuk memberikan latihan soal SKD untuk memulai</p>
      </div>
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}
