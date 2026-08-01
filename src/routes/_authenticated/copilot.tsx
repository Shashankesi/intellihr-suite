import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentEmployee, useProfile, useRoles, useSession } from "@/hooks/use-auth";
import { askCopilot } from "@/lib/copilot.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/copilot")({
  head: () => ({
    meta: [
      { title: "AI Copilot · Nexus HR" },
      { name: "description", content: "Ask the Nexus HR AI assistant about your attendance, leave, goals and more." },
      { property: "og:title", content: "AI Copilot · Nexus HR" },
      { property: "og:description", content: "Your personal HR assistant, aware of your live workspace data." },
    ],
  }),
  component: CopilotPage,
});

type ChatMessage = { role: "user" | "assistant"; content: string };

const EMPLOYEE_PROMPTS = [
  "What's my remaining leave balance this year?",
  "Summarize my attendance for the last month",
  "Do I have any pending leave requests?",
  "What are my active goals and their progress?",
];

const STAFF_PROMPTS = [
  "How many pending leave approvals are there?",
  "Give me a headcount breakdown by department",
  "What should I focus on as an HR manager today?",
  "Summarize the overall org health",
];

function CopilotPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const { isStaff } = useRoles(user?.id);
  const { data: employee } = useCurrentEmployee(user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: async (next: ChatMessage[]) => {
      const result = await askCopilot({ data: { messages: next } });
      return result.reply;
    },
    onError: (error: Error) => {
      toast.error(error.message || "The copilot couldn't respond. Please try again.");
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mutation.isPending]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    mutation.mutate(next, {
      onSuccess: (reply) => {
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      },
    });
  };

  const initials = (profile?.full_name || user?.email || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const prompts = isStaff ? STAFF_PROMPTS : EMPLOYEE_PROMPTS;

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Copilot</h1>
          <p className="text-sm text-muted-foreground">
            Ask about {employee ? "your" : "the"} attendance, leave, goals{isStaff ? " and org-wide insights" : ""}.
          </p>
        </div>
      </div>

      <Card className="surface-card flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-6" />
              </div>
              <div>
                <p className="font-medium">How can I help you today?</p>
                <p className="text-sm text-muted-foreground">Try one of these to get started</p>
              </div>
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {prompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-lg border border-border bg-card/50 px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex items-start gap-3", m.role === "user" && "flex-row-reverse")}
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className={cn(m.role === "assistant" && "bg-primary/10 text-primary")}>
                    {m.role === "user" ? initials : <Bot className="size-4" />}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                    m.role === "user"
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted",
                  )}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {mutation.isPending && (
            <div className="flex items-start gap-3">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Bot className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 border-t border-border p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask the copilot anything about your HR data..."
            className="min-h-[44px] flex-1 resize-none"
            rows={1}
          />
          <Button onClick={() => send(input)} disabled={mutation.isPending || !input.trim()} size="icon">
            <Send className="size-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
