"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { getLowStockProducts } from "@/features/notifications";

interface LowStockProduct {
    id: string;
    name: string;
    code: string;
    stock: number;
    minStock: number;
}

export function NotificationBell() {
    const [products, setProducts] = useState<LowStockProduct[]>([]);
    const [, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            try {
                const data = await getLowStockProducts();
                setProducts(data);
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
                    {products.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
                            {products.length > 9 ? "9+" : products.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 rounded-2xl p-0" align="end">
                <div className="p-3 border-b">
                    <h4 className="font-semibold text-sm">Notifikasi</h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                    {products.length === 0 ? (
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
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
