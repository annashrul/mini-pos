"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Building2, MapPin, Pencil, Phone, Plus, Search, Navigation, Loader2 } from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { createBranch, updateBranch } from "@/server/actions/branches";
import { toast } from "sonner";

const DEFAULT_CENTER = { lat: -6.2088, lng: 106.8456 };

const branchFormSchema = z.object({
    name: z.string().min(1, "Nama cabang wajib diisi"),
    phone: z.string(),
    address: z.string(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    isActive: z.boolean(),
});
type BranchFormValues = z.infer<typeof branchFormSchema>;

interface BranchesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing: { id: string; name: string; phone?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null; isActive: boolean } | null;
    canSubmit: boolean;
    cannotMessage: string;
    onSuccess: () => void;
}

export function BranchesDialog({ open, onOpenChange, editing, canSubmit, cannotMessage, onSuccess }: BranchesDialogProps) {
    const mapRef = useRef<google.maps.Map | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [isLoaded, setIsLoaded] = useState(typeof window !== "undefined" && !!window.google?.maps);
    useEffect(() => {
        if (isLoaded) return;
        const check = setInterval(() => { if (window.google?.maps) { setIsLoaded(true); clearInterval(check); } }, 200);
        return () => clearInterval(check);
    }, [isLoaded]);

    const form = useForm<BranchFormValues>({
        resolver: zodResolver(branchFormSchema),
        defaultValues: {
            name: "", phone: "", address: "", latitude: null, longitude: null, isActive: true,
        },
    });

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = form;
    const address = watch("address");
    const latitude = watch("latitude");
    const longitude = watch("longitude");
    const isActive = watch("isActive");
    const coords = latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null;

    // Reset form when dialog opens
    useEffect(() => {
        if (!open) return;
        reset({
            name: editing?.name || "",
            phone: editing?.phone || "",
            address: editing?.address || "",
            latitude: editing?.latitude ?? null,
            longitude: editing?.longitude ?? null,
            isActive: editing?.isActive !== false,
        });
        if (searchRef.current) searchRef.current.value = "";
    }, [open, editing, reset]);

    // Prevent Radix Dialog from stealing clicks on Google Places dropdown
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest(".pac-container")) e.stopPropagation();
        };
        document.addEventListener("mousedown", handler, true);
        document.addEventListener("pointerdown", handler, true);
        return () => {
            document.removeEventListener("mousedown", handler, true);
            document.removeEventListener("pointerdown", handler, true);
        };
    }, [open]);

    // Init Google Places Autocomplete
    useEffect(() => {
        if (!open || !isLoaded) return;
        const timer = setTimeout(() => {
            const input = searchRef.current;
            if (!input) return;
            document.querySelectorAll(".pac-container").forEach((el) => el.remove());

            const ac = new google.maps.places.Autocomplete(input, {
                componentRestrictions: { country: "id" },
                fields: ["formatted_address", "geometry", "name"],
            });
            ac.addListener("place_changed", () => {
                const place = ac.getPlace();
                if (!place?.geometry?.location) return;
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const addr = place.formatted_address || place.name || "";

                setValue("address", addr);
                setValue("latitude", lat);
                setValue("longitude", lng);
                input.value = "";
                input.blur();

                if (mapRef.current) {
                    mapRef.current.panTo({ lat, lng });
                    mapRef.current.setZoom(17);
                }
            });
        }, 300);
        return () => { clearTimeout(timer); };
    }, [open, isLoaded, setValue]);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        setValue("latitude", e.latLng.lat());
        setValue("longitude", e.latLng.lng());
    }, [setValue]);

    const onSubmit = async (values: BranchFormValues) => {
        if (!canSubmit) return;
        setSubmitting(true);
        const result = editing
            ? await updateBranch(editing.id, values)
            : await createBranch(values);
        setSubmitting(false);
        if (result.error) { toast.error(result.error); return; }
        toast.success(editing ? "Cabang berhasil diupdate" : "Cabang berhasil ditambahkan");
        onOpenChange(false);
        onSuccess();
    };

    const isEditing = !!editing;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="rounded-2xl max-w-[calc(100vw-1rem)] sm:max-w-4xl h-[90vh] sm:h-[80vh] flex flex-col overflow-hidden p-0 gap-0"
                onPointerDownOutside={(e) => { if ((e.target as HTMLElement).closest(".pac-container")) e.preventDefault(); }}
                onInteractOutside={(e) => { if ((e.target as HTMLElement).closest(".pac-container")) e.preventDefault(); }}
            >
                <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 rounded-t-2xl" />

                <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-0 shrink-0">
                    <DialogTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-lg font-bold">
                        <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-md shadow-cyan-200/50">
                            {isEditing ? <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />}
                        </div>
                        {isEditing ? "Edit Cabang" : "Tambah Cabang"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
                        {/* Left: Form */}
                        <div className="sm:w-[340px] shrink-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 sm:border-r border-border/30">
                            <div className="space-y-3">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Building2 className="w-3 h-3" /> Informasi
                                </p>
                                <div className="space-y-1">
                                    <Label className="text-xs font-medium">Nama Cabang <span className="text-red-400">*</span></Label>
                                    <Input {...register("name")} className="rounded-lg h-9 text-sm" autoFocus placeholder="Nama cabang" />
                                    {errors.name && <p className="text-[10px] text-red-500">{errors.name.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-medium flex items-center gap-1"><Phone className="w-3 h-3" /> Telepon</Label>
                                    <Input {...register("phone")} className="rounded-lg h-9 text-sm" placeholder="No. telepon" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3" /> Lokasi
                                </p>
                                <div className="relative" style={{ zIndex: 9999 }}>
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        autoComplete="off"
                                        className="w-full pl-9 pr-4 h-9 rounded-lg border border-input bg-background text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
                                        placeholder="Cari alamat atau nama tempat..."
                                    />
                                </div>
                                {address ? (
                                    <div className="space-y-1.5">
                                        <Textarea readOnly value={address} rows={2} className="rounded-lg border-emerald-200 bg-emerald-50/50 text-xs resize-none focus-visible:ring-0" />
                                        {coords && (
                                            <div className="flex items-center gap-1.5 px-1">
                                                <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                                                <span className="text-[10px] font-mono tabular-nums text-emerald-600">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground/60 px-1">Cari alamat atau klik peta</p>
                                )}
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5 bg-muted/20">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-medium">Status</Label>
                                    <p className="text-[9px] text-muted-foreground">Aktif dalam transaksi</p>
                                </div>
                                <Switch checked={isActive} onCheckedChange={(v) => setValue("isActive", v)} />
                            </div>
                        </div>

                        {/* Right: Map */}
                        <div className="flex-1 min-h-[250px] sm:min-h-0 relative">
                            {isLoaded ? (
                                <GoogleMap
                                    mapContainerStyle={{ width: "100%", height: "100%" }}
                                    center={coords || DEFAULT_CENTER}
                                    zoom={coords ? 16 : 12}
                                    onClick={handleMapClick}
                                    onLoad={(map) => { mapRef.current = map; }}
                                    options={{ disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: "greedy" }}
                                >
                                    {coords && (
                                        <Marker position={coords} draggable onDragEnd={(e) => {
                                            if (!e.latLng) return;
                                            setValue("latitude", e.latLng.lat());
                                            setValue("longitude", e.latLng.lng());
                                        }} />
                                    )}
                                </GoogleMap>
                            ) : (
                                <div className="w-full h-full bg-muted/30 flex items-center justify-center animate-pulse">
                                    <span className="text-xs text-muted-foreground">Memuat peta...</span>
                                </div>
                            )}
                            {!coords && isLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">Klik untuk menentukan lokasi</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 border-t border-border/30 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs sm:text-sm h-9">Batal</Button>
                        <DisabledActionTooltip disabled={!canSubmit} message={cannotMessage} menuKey="branches" actionKey={isEditing ? "update" : "create"}>
                            <Button type="submit" disabled={!canSubmit || submitting} className="rounded-xl shadow-md shadow-primary/20 text-xs sm:text-sm h-9">
                                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                                {isEditing ? "Update" : "Simpan"}
                            </Button>
                        </DisabledActionTooltip>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
