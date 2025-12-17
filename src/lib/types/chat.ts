export interface Source {
  title: string;
  url?: string;
  content?: string;
  page?: number;
  [key: string]: unknown;
}

export interface Message {
  content: string;
  role: "user" | "bot";
  timestamp?: string;
  sources?: Source[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}

export interface ChatResponse {
  reply: string;
  status?: string;
}

export interface ChatError {
  message: string;
  code?: string;
}
