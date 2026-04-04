"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { chatWithAI } from "@/features/ai-assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrainCircuit, Send, Loader2, User, Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

const SUGGESTIONS = [
    "Produk apa yang paling laris bulan ini?",
    "Produk apa yang stoknya menipis?",
    "Berapa total penjualan hari ini?",
    "Bagaimana performa kasir minggu ini?",
    "Rekomendasi produk yang perlu di-restock",
    "Penjualan per kategori 30 hari terakhir",
    "Produk apa yang tidak laku?",
    "Buatkan PO untuk produk yang hampir habis",
];

export function AIAssistantContent() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isPending, startTransition] = useTransition();
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = (text: string) => {
        if (!text.trim() || isPending) return;

        const userMsg: Message = { role: "user", content: text.trim(), timestamp: new Date() };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");

        startTransition(async () => {
            const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
            const result = await chatWithAI(allMessages);

            if (result.error) {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: `Error: ${result.error}`, timestamp: new Date() },
                ]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: result.response || "", timestamp: new Date() },
                ]);
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-200/50 flex items-center justify-center">
                    <BrainCircuit className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Assistant</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Tanya apapun tentang data penjualan, stok, dan operasional toko
                    </p>
                </div>
            </div>

            {/* Chat container */}
            <div
                className="rounded-2xl border border-border/40 bg-white shadow-sm overflow-hidden flex flex-col"
                style={{ height: "calc(100vh - 220px)" }}
            >
                {/* Messages area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 ? (
                        // Welcome state with suggestions
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-violet-500" />
                            </div>
                            <h2 className="text-lg font-semibold text-foreground mb-2">
                                Halo! Saya AI Assistant NusaPOS
                            </h2>
                            <p className="text-sm text-muted-foreground mb-6 max-w-md">
                                Saya bisa membantu menganalisis data penjualan, cek stok, melihat performa kasir, dan
                                bahkan membuat Purchase Order.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => sendMessage(s)}
                                        disabled={isPending}
                                        className="px-3 py-1.5 rounded-full text-xs font-medium border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // Chat messages
                        messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "flex gap-3",
                                    msg.role === "user" ? "justify-end" : "justify-start"
                                )}
                            >
                                {msg.role === "assistant" && (
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <div
                                    className={cn(
                                        "max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                        msg.role === "user"
                                            ? "bg-primary text-white rounded-br-md"
                                            : "bg-slate-50 border border-slate-100 text-foreground rounded-bl-md"
                                    )}
                                >
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                    <p
                                        className={cn(
                                            "text-[10px] mt-1.5",
                                            msg.role === "user"
                                                ? "text-white/60"
                                                : "text-muted-foreground/50"
                                        )}
                                    >
                                        {msg.timestamp.toLocaleTimeString("id-ID", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {/* Loading indicator */}
                    {isPending && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sedang menganalisis data...
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input area */}
                <div className="border-t border-border/40 p-4 bg-slate-50/50">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Tanya tentang penjualan, stok, kasir..."
                            disabled={isPending}
                            className="rounded-xl h-11 flex-1 bg-white"
                            autoFocus
                        />
                        <Button
                            type="submit"
                            disabled={isPending || !input.trim()}
                            className="rounded-xl h-11 px-5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-md shadow-purple-200/50"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
