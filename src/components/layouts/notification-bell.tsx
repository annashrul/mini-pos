"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, AlertTriangle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { getLowStockProducts, getExpiringProducts } from "@/features/notifications";

interface LowStockProduct {
    id: string;
    name: string;
    code: string;
    stock: number;
    minStock: number;
}

interface ExpiringProduct {
    id: string;
    name: string;
    code: string;
    stock: number;
    expiryDate: Date | null;
}

function formatExpDate(date: Date | null): string {
    if (!date) return "-";
    const d = new Date(date);
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isExpired(date: Date | null): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
}

export function NotificationBell() {
    const [products, setProducts] = useState<LowStockProduct[]>([]);
    const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);
    const [, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            try {
                const [lowStock, expiring] = await Promise.all([
                    getLowStockProducts(),
                    getExpiringProducts(),
                ]);
                setProducts(lowStock);
                setExpiringProducts(expiring);
            } catch {
                // silently fail
            }
        });
    }, []);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl">
                    <Bell className="h-4 w-4" />
                    {(products.length + expiringProducts.length) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
                            {(products.length + expiringProducts.length) > 9 ? "9+" : products.length + expiringProducts.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 rounded-2xl p-0" align="end">
                <div className="p-3 border-b">
                    <h4 className="font-semibold text-sm">Notifikasi</h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                    {products.length === 0 && expiringProducts.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-400">
                            Tidak ada notifikasi
                        </div>
                    ) : (
                        <div className="divide-y">
                            {products.map((p) => (
                                <div key={p.id} className="flex items-start gap-3 p-3 hover:bg-slate-50">
                                    <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{p.name}</p>
                                        <p className="text-xs text-slate-500">
                                            Stok: <span className="text-red-600 font-semibold">{p.stock}</span> / Min: {p.minStock}
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] shrink-0 bg-red-100 text-red-700">Low</Badge>
                                </div>
                            ))}
                            {expiringProducts.map((p) => (
                                <div key={`exp-${p.id}`} className="flex items-start gap-3 p-3 hover:bg-slate-50">
                                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <CalendarDays className="h-4 w-4 text-red-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-medium truncate ${isExpired(p.expiryDate) ? "text-red-600" : ""}`}>{p.name}</p>
                                        <p className={`text-xs ${isExpired(p.expiryDate) ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                                            Exp: {formatExpDate(p.expiryDate)}
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${isExpired(p.expiryDate) ? "bg-red-200 text-red-800" : "bg-orange-100 text-orange-700"}`}>
                                        {isExpired(p.expiryDate) ? "Expired" : "Exp Soon"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
