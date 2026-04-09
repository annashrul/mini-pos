"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Loader2, SwitchCamera } from "lucide-react";

interface BarcodeScannerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (code: string) => void;
}

type ScannerStep = "permission" | "loading" | "scanning" | "error";

export function BarcodeScannerDialog({ open, onOpenChange, onScan }: BarcodeScannerDialogProps) {
    const scannerRef = useRef<HTMLDivElement>(null);
    const html5QrCodeRef = useRef<any>(null);
    const [step, setStep] = useState<ScannerStep>("permission");
    const [errorMessage, setErrorMessage] = useState("");
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const lastScannedRef = useRef<string>("");
    const lastScannedTimeRef = useRef<number>(0);

    const stopScanner = useCallback(async () => {
        try {
            if (html5QrCodeRef.current) {
                const state = html5QrCodeRef.current.getState();
                if (state === 2) {
                    await html5QrCodeRef.current.stop();
                }
                html5QrCodeRef.current.clear();
                html5QrCodeRef.current = null;
            }
        } catch {
            html5QrCodeRef.current = null;
        }
    }, []);

    const startScanner = useCallback(async () => {
        await stopScanner();
        setStep("loading");
        setErrorMessage("");

        // Wait for DOM to render the scanner container
        await new Promise((r) => setTimeout(r, 100));

        if (!scannerRef.current) {
            setStep("error");
            setErrorMessage("Gagal menginisialisasi scanner.");
            return;
        }

        try {
            const { Html5Qrcode } = await import("html5-qrcode");
            const scannerId = "pos-barcode-scanner";
            scannerRef.current.id = scannerId;

            const scanner = new Html5Qrcode(scannerId);
            html5QrCodeRef.current = scanner;

            await scanner.start(
                { facingMode },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1,
                },
                (decodedText) => {
                    const now = Date.now();
                    if (decodedText === lastScannedRef.current && now - lastScannedTimeRef.current < 2000) {
                        return;
                    }
                    lastScannedRef.current = decodedText;
                    lastScannedTimeRef.current = now;
                    onScan(decodedText);
                    onOpenChange(false);
                },
                () => {}
            );
            setStep("scanning");
        } catch (err: any) {
            const message = err?.message || String(err);
            if (message.includes("NotAllowedError") || message.includes("Permission")) {
                setErrorMessage("Izin kamera ditolak. Silakan aktifkan izin kamera di pengaturan browser.");
            } else if (message.includes("NotFoundError") || message.includes("no camera")) {
                setErrorMessage("Kamera tidak ditemukan pada perangkat ini.");
            } else {
                setErrorMessage("Gagal membuka kamera. Pastikan kamera tidak digunakan aplikasi lain.");
            }
            setStep("error");
        }
    }, [facingMode, onScan, onOpenChange, stopScanner]);

    // Reset to permission step when dialog opens
    useEffect(() => {
        if (open) {
            setStep("permission");
            setErrorMessage("");
        } else {
            void stopScanner();
        }
    }, [open, stopScanner]);

    // Restart scanner when facingMode changes (only if already scanning)
    useEffect(() => {
        if (open && step === "scanning") {
            void startScanner();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facingMode]);

    const handleFlipCamera = useCallback(() => {
        setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    }, []);

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) void stopScanner(); onOpenChange(v); }}>
            <DialogContent className="rounded-2xl w-[95vw] sm:w-auto max-w-sm p-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-sm">
                        <Camera className="w-4 h-4" /> Scan Barcode / QR
                    </DialogTitle>
                </DialogHeader>
                <div className="px-4 pb-4">
                    {step === "permission" && (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Camera className="w-8 h-8 text-primary" />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-semibold">Izinkan Akses Kamera</p>
                                <p className="text-xs text-muted-foreground leading-relaxed max-w-[250px]">
                                    Aplikasi membutuhkan akses kamera untuk memindai barcode atau QR code produk.
                                </p>
                            </div>
                            <Button className="rounded-xl px-6" onClick={() => void startScanner()}>
                                <Camera className="w-4 h-4 mr-2" /> Buka Kamera
                            </Button>
                        </div>
                    )}

                    {step === "error" && (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                            <CameraOff className="w-10 h-10 text-muted-foreground/40" />
                            <p className="text-xs text-muted-foreground max-w-[250px]">{errorMessage}</p>
                            <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => void startScanner()}>
                                Coba Lagi
                            </Button>
                        </div>
                    )}

                    {(step === "loading" || step === "scanning") && (
                        <div className="relative">
                            <div className="rounded-xl overflow-hidden bg-black min-h-[280px]">
                                <div ref={scannerRef} className="w-full" />
                            </div>
                            {step === "loading" && (
                                <div className="absolute inset-0 rounded-xl bg-black/80 flex flex-col items-center justify-center space-y-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                                    <p className="text-xs text-white/70">Membuka kamera...</p>
                                </div>
                            )}
                            <div className="flex items-center justify-between mt-3">
                                <p className="text-[11px] text-muted-foreground">Arahkan kamera ke barcode atau QR code</p>
                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={handleFlipCamera} title="Ganti kamera">
                                    <SwitchCamera className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
