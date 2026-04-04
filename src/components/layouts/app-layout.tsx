"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useBranch } from "@/components/providers/branch-provider";
import { Sidebar } from "./sidebar";
import { NotificationBell } from "./notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, Search, MapPin, BrainCircuit, X, Send, Loader2, Bot, User as UserIcon, Sparkles } from "lucide-react";
import { chatWithAI } from "@/server/actions/ai-assistant";
import { useTransition, useRef, useEffect, useCallback } from "react";

const pageTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/pos": "POS Kasir",
    "/products": "Produk",
    "/categories": "Kategori",
    "/brands": "Brand",
    "/suppliers": "Supplier",
    "/customers": "Customer",
    "/transactions": "Riwayat Transaksi",
    "/stock": "Manajemen Stok",
    "/stock-opname": "Stock Opname",
    "/stock-transfers": "Transfer Stok",
    "/purchases": "Purchase Order",
    "/shifts": "Shift Kasir",
    "/closing-reports": "Laporan Closing",
    "/expenses": "Pengeluaran",
    "/promotions": "Promo",
    "/reports": "Laporan",
    "/analytics": "Business Intelligence",
    "/customer-intelligence": "Customer Intelligence",
    "/users": "Pengguna",
    "/branches": "Cabang",
    "/branch-prices": "Harga Cabang",
    "/access-control": "Hak Akses",
    "/audit-logs": "Audit Log",
    "/settings": "Pengaturan",
    "/debts": "Hutang Piutang",
    "/cashier-performance": "Performa Kasir",
    "/ai-assistant": "AI Assistant",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();
    const isPOS = pathname === "/pos";
    const { data: session } = useSession();
    const { selectedBranchName } = useBranch();

    if (isPOS) {
        return (
            <div className="h-screen bg-[#F1F5F9] overflow-hidden">
                {children}
            </div>
        );
    }

    const pageTitle = pageTitles[pathname] || "";

    return (
        <div className="flex h-screen bg-[#F8FAFC]">
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto
                transition-transform duration-300
                ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}>
                <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onMobileClose={() => setMobileOpen(false)} />
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Top bar */}
                <header className="h-14 border-b border-border/50 bg-white/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        {/* Mobile menu button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl lg:hidden"
                            onClick={() => setMobileOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>

                        {/* Page title */}
                        {pageTitle && (
                            <div className="hidden sm:flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-foreground">{pageTitle}</h2>
                                {selectedBranchName && selectedBranchName !== "Semua Lokasi" && (
                                    <Badge variant="secondary" className="text-[10px] rounded-full px-2 py-0.5 bg-primary/5 text-primary border-primary/10 gap-1">
                                        <MapPin className="w-2.5 h-2.5" />
                                        {selectedBranchName}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search shortcut hint */}
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 cursor-default">
                            <Search className="w-3.5 h-3.5" />
                            <span className="text-xs">Cari...</span>
                            <kbd className="ml-2 text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400">⌘K</kbd>
                        </div>

                        {/* Notification */}
                        <NotificationBell />

                        {/* User avatar (mobile) */}
                        <div className="flex items-center gap-2 lg:hidden">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xs font-bold">
                                {session?.user?.name?.charAt(0) || "U"}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto">
                    <div className="p-4 lg:p-6 max-w-[1600px]">{children}</div>
                </main>
            </div>

            {/* AI Floating Chat */}
            <AIFloatingChat />
        </div>
    );
}

// ─── AI Floating Chat Component ────────────────────────────────────────────

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

const QUICK_PROMPTS = [
    "Produk terlaris bulan ini?",
    "Stok yang menipis?",
    "Total penjualan hari ini?",
    "Rekomendasi restock",
];

function AIFloatingChat() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isPending, startTransition] = useTransition();
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isPending]);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const sendMessage = useCallback((text: string) => {
        if (!text.trim() || isPending) return;
        const userMsg: ChatMessage = { role: "user", content: text.trim() };
        const updated = [...messages, userMsg];
        setMessages(updated);
        setInput("");

        startTransition(async () => {
            const result = await chatWithAI(updated.map((m) => ({ role: m.role, content: m.content })));
            setMessages((prev) => [...prev, {
                role: "assistant",
                content: result.error ? `❌ ${result.error}` : result.response || "Maaf, tidak bisa memproses.",
            }]);
        });
    }, [messages, isPending]);

    return (
        <>
            {/* Floating button */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
                    open
                        ? "bg-slate-700 hover:bg-slate-800 rotate-0"
                        : "bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-purple-200/50 hover:shadow-purple-300/60 hover:scale-105"
                }`}
            >
                {open ? <X className="w-5 h-5 text-white" /> : <BrainCircuit className="w-6 h-6 text-white" />}
            </button>

            {/* Chat panel */}
            <div className={`fixed bottom-24 right-6 z-50 w-[400px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
                open ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
            }`}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-violet-500 to-purple-600 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                        <BrainCircuit className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-white">AI Assistant</p>
                        <p className="text-[10px] text-white/70">Tanya apapun tentang data toko</p>
                    </div>
                    <button type="button" onClick={() => setMessages([])} className="text-white/60 hover:text-white text-[10px] font-medium px-2 py-1 rounded-md hover:bg-white/10 transition-colors">
                        Clear
                    </button>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-8">
                            <Sparkles className="w-10 h-10 text-violet-300 mb-3" />
                            <p className="text-sm font-medium text-foreground mb-1">Halo! Ada yang bisa dibantu?</p>
                            <p className="text-xs text-muted-foreground mb-4">Saya bisa analisis data penjualan, stok, dan lainnya</p>
                            <div className="flex flex-wrap justify-center gap-1.5">
                                {QUICK_PROMPTS.map((q) => (
                                    <button key={q} type="button" onClick={() => sendMessage(q)} disabled={isPending}
                                        className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50">
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                {msg.role === "assistant" && (
                                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <Bot className="w-3 h-3 text-white" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                    msg.role === "user"
                                        ? "bg-primary text-white rounded-br-sm"
                                        : "bg-slate-50 border border-slate-100 text-foreground rounded-bl-sm"
                                }`}>
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <UserIcon className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    {isPending && (
                        <div className="flex gap-2 justify-start">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                                <Bot className="w-3 h-3 text-white" />
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" /> Menganalisis...
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="border-t border-border/40 p-3">
                    <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
                        <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ketik pertanyaan..." disabled={isPending} className="rounded-xl h-9 text-xs flex-1" />
                        <Button type="submit" disabled={isPending || !input.trim()} size="icon" className="h-9 w-9 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shrink-0">
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </Button>
                    </form>
                </div>
            </div>
        </>
    );
}
