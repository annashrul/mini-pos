"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, AlertTriangle } from "lucide-react";
import { usePosScreenContext } from "../hooks";
import type { PosReadyScreenContextValue } from "../hooks/use-pos-screen-context";

export function PosReadySection() {
    const {
        activeBranchName,
        setupRegister,
        setupErrors,
        setSelectedRegister,
        activeShift,
        closedToday,
        openingCash,
        setOpeningCash,
        onBack,
        onStartSession,
        startingShift,
    } = usePosScreenContext<PosReadyScreenContextValue>();

    // Block if already closed today and no active shift
    if (closedToday && !activeShift) {
        return (
            <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-white rounded-2xl border border-border/40 shadow-sm p-6 space-y-5 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-7 h-7 text-amber-500" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-slate-800">Shift Sudah Ditutup</h2>
                        <p className="text-sm text-muted-foreground">
                            Anda sudah melakukan closing hari ini. Tidak dapat membuka shift baru di hari yang sama.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Hubungi admin untuk melakukan reclosing jika diperlukan, atau kembali besok untuk memulai shift baru.
                        </p>
                    </div>
                    <Button variant="outline" onClick={onBack} className="rounded-lg">
                        Kembali ke Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-6">
            <div className="w-full max-w-xl bg-white rounded-2xl border border-border/40 shadow-sm p-6 space-y-5">
                <div className="space-y-1">
                    <h2 className="text-xl font-bold">Mulai Sesi Kasir</h2>
                    <p className="text-sm text-muted-foreground">Pilih lokasi dan kassa sebelum memulai transaksi.</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">Lokasi Aktif</span>
                    </div>
                    <Badge variant="secondary" className="rounded-md">{activeBranchName}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Kassa</Label>
                        <Input
                            {...setupRegister("register")}
                            onChange={(e) => {
                                setupRegister("register").onChange(e);
                                setSelectedRegister(e.target.value);
                            }}
                            placeholder="Contoh: Kassa 1"
                            className="rounded-lg"
                        />
                        {setupErrors.register?.message && <p className="text-xs text-red-500">{setupErrors.register.message}</p>}
                    </div>
                    {!activeShift && (
                        <div className="space-y-2">
                            <Label>Saldo Awal</Label>
                            <Input
                                type="number"
                                min={0}
                                {...setupRegister("openingCash")}
                                value={openingCash}
                                onChange={(e) => {
                                    setupRegister("openingCash").onChange(e);
                                    setOpeningCash(e.target.value);
                                }}
                                placeholder="0"
                                className="rounded-lg"
                            />
                            {setupErrors.openingCash?.message && <p className="text-xs text-red-500">{setupErrors.openingCash.message}</p>}
                        </div>
                    )}
                </div>
                {activeShift && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        Shift aktif ditemukan. Pilih lokasi dan kassa untuk melanjutkan transaksi.
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onBack} className="rounded-lg">Kembali</Button>
                    <Button onClick={onStartSession} className="rounded-lg" disabled={startingShift}>
                        {startingShift ? "Memproses..." : activeShift ? "Lanjutkan" : "Mulai Shift"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
