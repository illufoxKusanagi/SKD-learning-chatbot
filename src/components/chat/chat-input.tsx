import { ArrowUp, Lightbulb } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import AddAttachment from "./add-attachment";
import { useState } from "react";

type ChatInputProps = {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
};

export default function ChatInput({
  onSendMessage,
  isLoading = false,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");

  const submitMessage = () => {
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue);
    setInputValue("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      form?.requestSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-3xl min-h-32 justify-center"
    >
      <div className="absolute bottom-5 right-5">
        <Button type="submit" size="icon" className="rounded-lg">
          <ArrowUp className="h-5 w-5" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
      <div className="absolute bottom-5 left-5 flex gap-2">
        <AddAttachment />
        <Button variant="outline" size="icon" className="rounded-lg w-18 ml-1">
          <p className="body-medium-regular">FAQ</p>
        </Button>
        <Button variant="outline" size="icon" aria-label="Saran">
          <Lightbulb />
        </Button>
      </div>
      <Textarea
        onKeyDown={handleKeyDown}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Berikan saya latihan soal SKD..."
        className="min-h-32 w-full resize-none rounded-xl p-5 pr-16 pb-20"
        disabled={isLoading}
        aria-disabled={isLoading}
      />
    </form>
  );
}
