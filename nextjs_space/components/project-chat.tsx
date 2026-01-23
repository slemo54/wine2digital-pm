"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useSession } from "next-auth/react";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ProjectChatProps {
  projectId: string;
}

export function ProjectChat({ projectId }: ProjectChatProps) {
  const { data: session } = useSession() || {};
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const lastMessageAtRef = useRef<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    lastMessageAtRef.current = messages[messages.length - 1]?.createdAt || null;
  }, [messages]);

  useEffect(() => {
    void fetchInitialMessages();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchNewMessages, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchInitialMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/messages?projectId=${projectId}&take=50`);
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages || []);
        setHasMoreBefore(Boolean(data?.pageInfo?.hasMoreBefore));
        setOldestCursor(typeof data?.pageInfo?.oldest === "string" ? data.pageInfo.oldest : null);
        setTimeout(scrollToBottom, 50);
      } else {
        throw new Error(String(data?.error || "Failed to load messages"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNewMessages = async () => {
    const last = lastMessageAtRef.current;
    if (!last) return;
    try {
      const response = await fetch(
        `/api/messages?projectId=${projectId}&after=${encodeURIComponent(last)}&take=200`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const next = Array.isArray(data?.messages) ? (data.messages as Message[]) : [];
      if (next.length === 0) return;
      setMessages((prev) => [...prev, ...next]);
      setTimeout(scrollToBottom, 50);
    } catch {
      // silent for auto-refresh
    }
  };

  const loadOlderMessages = async () => {
    if (!oldestCursor || !hasMoreBefore) return;
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    const prevScrollTop = container?.scrollTop || 0;
    try {
      const response = await fetch(
        `/api/messages?projectId=${projectId}&before=${encodeURIComponent(oldestCursor)}&take=50`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(String(data?.error || "Failed to load older messages"));
      const older = Array.isArray(data?.messages) ? (data.messages as Message[]) : [];
      setMessages((prev) => [...older, ...prev]);
      setHasMoreBefore(Boolean(data?.pageInfo?.hasMoreBefore));
      setOldestCursor(typeof data?.pageInfo?.oldest === "string" ? data.pageInfo.oldest : oldestCursor);
      setTimeout(() => {
        const nextContainer = messagesContainerRef.current;
        if (!nextContainer) return;
        const nextScrollHeight = nextContainer.scrollHeight;
        nextContainer.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
      }, 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load older messages");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          content: newMessage,
        }),
      });

      if (response.ok) {
        setNewMessage("");
        if (lastMessageAtRef.current) {
          await fetchNewMessages();
          setTimeout(scrollToBottom, 50);
        } else {
          await fetchInitialMessages();
        }
      } else {
        const data = await response.json().catch(() => ({}));
        const message = String((data as any)?.error || "Failed to send message");
        throw new Error(message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const currentUserId = (session?.user as any)?.id;

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle>Project Chat</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsLoading(true);
            fetchInitialMessages();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Messages Area */}
          <div ref={messagesContainerRef} className="h-[400px] overflow-y-auto border rounded-lg p-4 space-y-3 bg-gray-50">
            {hasMoreBefore ? (
              <div className="flex justify-center pb-2">
                <Button variant="outline" size="sm" onClick={loadOlderMessages} disabled={isLoadingMore}>
                  {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carica messaggi precedenti"}
                </Button>
              </div>
            ) : null}
            {messages.map((message) => {
              const isOwnMessage = message.user.id === currentUserId;
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {getInitials(message.user.firstName, message.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex-1 ${isOwnMessage ? "text-right" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {message.user.firstName} {message.user.lastName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div
                      className={`inline-block px-4 py-2 rounded-lg ${
                        isOwnMessage
                          ? "bg-blue-600 text-white"
                          : "bg-white border"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500">
                {isLoading ? "Caricamento…" : "Nessun messaggio. Inizia la conversazione!"}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[60px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <Button type="submit" disabled={isSending || !newMessage.trim()}>
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
