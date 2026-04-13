"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Search, Loader2, Plus } from "lucide-react";

export interface SmartSelectOption {
    value: string;
    label: string;
    description?: string;
}

type SmartSelectSearchResult =
    | SmartSelectOption[]
    | {
        items: SmartSelectOption[];
        hasMore: boolean;
    };

interface SmartSelectProps {
    value?: string | undefined;
    onChange?: ((value: string) => void) | undefined;
    multiple?: boolean | undefined;
    values?: string[] | undefined;
    onValuesChange?: ((values: string[]) => void) | undefined;
    onSearch: (query: string, page: number) => Promise<SmartSelectSearchResult>;
    placeholder?: string | undefined;
    label?: string | undefined;
    required?: boolean | undefined;
    disabled?: boolean | undefined;
    className?: string | undefined;
    initialOptions?: SmartSelectOption[] | undefined;
    createLabel?: string | undefined;
    onCreateSubmit?: ((data: FormData) => Promise<{ id: string; name: string } | { error: string }>) | undefined;
    createFields?: { name: string; label: string; type?: string | undefined; required?: boolean | undefined }[] | undefined;
}

export function SmartSelect({
    value,
    onChange,
    multiple = false,
    values,
    onValuesChange,
    onSearch,
    placeholder = "Pilih...",
    label,
    required,
    disabled,
    className,
    initialOptions = [],
    createLabel,
    onCreateSubmit,
    createFields,
}: SmartSelectProps) {
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [options, setOptions] = useState<SmartSelectOption[]>(initialOptions);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState("");
    const [createSeed, setCreateSeed] = useState("");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const requestIdRef = useRef(0);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const canCreateInline = Boolean(createLabel && onCreateSubmit && createFields?.length);
    const selectedValues = multiple ? (values ?? []) : (value ? [value] : []);
    const selectedSet = new Set(selectedValues);



    // Set selected label from value
    useEffect(() => {
        if (multiple) return;
        if (value) {
            const found = [...initialOptions, ...options].find((o) => o.value === value);
            if (found) setSelectedLabel(found.label);
        }
    }, [multiple, value, options, initialOptions]);

    const onSearchRef = useRef(onSearch);
    onSearchRef.current = onSearch;

    const loadOptions = useCallback(async (query: string, nextPage = 1, append = false) => {
        const currentRequestId = ++requestIdRef.current;
        if (append) setLoadingMore(true);
        else setLoading(true);
        try {
            const result = await onSearchRef.current(query, nextPage);
            if (currentRequestId !== requestIdRef.current) return;

            const items = Array.isArray(result) ? result : result.items;
            const nextHasMore = Array.isArray(result) ? false : result.hasMore;

            setOptions((prev) => {
                if (!append) return items;
                const existing = new Set(prev.map((opt) => opt.value));
                const merged = [...prev];
                for (const item of items) {
                    if (!existing.has(item.value)) {
                        existing.add(item.value);
                        merged.push(item);
                    }
                }
                return merged;
            });
            setPage(nextPage);
            setHasMore(nextHasMore);
        } catch {
            if (!append) setOptions([]);
            setHasMore(false);
        } finally {
            if (currentRequestId === requestIdRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, []);
    // Load initial options
    useEffect(() => {
        if (open) {
            setSearchQuery("");
            void loadOptions("", 1, false);
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [open, loadOptions]);
    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { void loadOptions(query, 1, false); }, 300);
    }, [loadOptions]);

    const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
        const element = event.currentTarget;
        const threshold = 24;
        const reachedBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
        if (reachedBottom && hasMore && !loading && !loadingMore) {
            loadOptions(searchQuery, page + 1, true);
        }
    };

    const searchQueryRef = useRef(searchQuery);
    searchQueryRef.current = searchQuery;
    const pageRef = useRef(page);
    pageRef.current = page;

    useEffect(() => {
        if (!open || !hasMore || loading || loadingMore) return;
        const root = listContainerRef.current;
        const target = loadMoreRef.current;
        if (!root || !target) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting) return;
                void loadOptions(searchQueryRef.current, pageRef.current + 1, true);
            },
            { root, rootMargin: "48px", threshold: 0.1 }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [open, hasMore, loading, loadingMore, loadOptions]);

    const handleSelect = (opt: SmartSelectOption) => {
        if (multiple) {
            const nextValues = selectedSet.has(opt.value)
                ? selectedValues.filter((item) => item !== opt.value)
                : [...selectedValues, opt.value];
            onValuesChange?.(nextValues);
            return;
        }
        onChange?.(opt.value);
        setSelectedLabel(opt.label);
        setOpen(false);
        setSearchQuery("");
    };

    const handleCreate = async (formData: FormData) => {
        if (!onCreateSubmit) return;
        const result = await onCreateSubmit(formData);
        if ("error" in result) return;
        if (multiple) {
            onValuesChange?.([...(values ?? []), result.id]);
        } else {
            onChange?.(result.id);
        }
        setSelectedLabel(result.name);
        setCreateOpen(false);
        setOpen(false);
        setSearchQuery("");
        setCreateSeed("");
        loadOptions("", 1, false);
    };

    const openCreateModal = () => {
        setCreateSeed(searchQuery.trim());
        setCreateOpen(true);
        setOpen(false);
    };

    return (
        <div className={className}>
            {label && (
                <Label className="mb-1.5 block text-sm font-medium">
                    {label} {required && <span className="text-red-400">*</span>}
                </Label>
            )}
            <Popover open={open} onOpenChange={setOpen} modal={false}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className={cn(
                            "w-full justify-between rounded-lg font-normal h-9 text-sm",
                            selectedValues.length === 0 && "text-muted-foreground"
                        )}
                    >
                        <span className="truncate">
                            {multiple
                                ? (selectedValues.length > 0 ? `${selectedValues.length} dipilih` : placeholder)
                                : (value ? selectedLabel || placeholder : placeholder)}
                        </span>
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0 rounded-xl z-[60]"
                    align="start"
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    {/* Search */}
                    <div className="flex items-center border-b px-3 py-2">
                        <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        <input
                            ref={searchInputRef}
                            placeholder="Cari..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="flex h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin opacity-50" />}
                    </div>
                    {/* Options */}
                    <div ref={listContainerRef} className="max-h-[220px] overflow-y-auto overscroll-contain p-1" onScroll={handleScroll}>
                        {options.length === 0 && !loading && (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                                <p>Tidak ditemukan</p>
                                {canCreateInline && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-1 text-primary text-xs"
                                        onClick={openCreateModal}
                                    >
                                        <Plus className="w-3 h-3 mr-1" /> {createLabel}
                                    </Button>
                                )}
                            </div>
                        )}
                        {options.map((opt) => (
                            <button
                                type="button"
                                key={opt.value}
                                onClick={() => handleSelect(opt)}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                                    selectedSet.has(opt.value) && "bg-accent"
                                )}
                            >
                                <Check className={cn("h-3.5 w-3.5 shrink-0", selectedSet.has(opt.value) ? "opacity-100" : "opacity-0")} />
                                <div className="text-left min-w-0">
                                    <p className="truncate">{opt.label}</p>
                                    {opt.description && <p className="text-xs text-muted-foreground truncate">{opt.description}</p>}
                                </div>
                            </button>
                        ))}
                        {loadingMore && (
                            <div className="py-2 text-center text-xs text-muted-foreground">
                                <Loader2 className="inline-block h-3.5 w-3.5 animate-spin mr-1" />
                                Memuat data...
                            </div>
                        )}
                        <div ref={loadMoreRef} className="h-0.5" />
                    </div>
                    {/* Create button at bottom */}
                    {canCreateInline && options.length > 0 && (
                        <div className="border-t p-1">
                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-primary hover:bg-accent transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" /> {createLabel}
                            </button>
                        </div>
                    )}
                </PopoverContent>
            </Popover>

            {/* Inline Create Modal */}
            {canCreateInline && createFields && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogContent className="rounded-2xl max-w-sm">
                        <DialogHeader>
                            <DialogTitle>{createLabel}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={async (e) => { e.preventDefault(); e.stopPropagation(); await handleCreate(new FormData(e.currentTarget)); }} className="space-y-3">
                            {createFields.map((field) => (
                                <div key={field.name} className="space-y-1.5">
                                    <Label htmlFor={field.name} className="text-sm">
                                        {field.label} {field.required && <span className="text-red-400">*</span>}
                                    </Label>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        type={field.type || "text"}
                                        required={field.required}
                                        className="rounded-lg"
                                        defaultValue={createFields.indexOf(field) === 0 ? createSeed : ""}
                                        autoFocus={createFields.indexOf(field) === 0}
                                    />
                                </div>
                            ))}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" className="rounded-lg" onClick={() => setCreateOpen(false)}>
                                    Batal
                                </Button>
                                <Button type="submit" className="rounded-lg">Simpan</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
