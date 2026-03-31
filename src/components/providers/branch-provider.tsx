"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface Branch {
    id: string;
    name: string;
}

interface BranchContextType {
    branches: Branch[];
    selectedBranchId: string; // "" means all branches
    selectedBranchName: string;
    setBranches: (branches: Branch[]) => void;
    setSelectedBranchId: (id: string) => void;
}

const BranchContext = createContext<BranchContextType>({
    branches: [],
    selectedBranchId: "",
    selectedBranchName: "Semua Lokasi",
    setBranches: () => { },
    setSelectedBranchId: () => { },
});

const STORAGE_KEY = "global-branch-filter";

export function BranchProvider({ children }: { children: React.ReactNode }) {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchIdState] = useState(() => {
        if (typeof window === "undefined") return "";
        try {
            return localStorage.getItem(STORAGE_KEY) ?? "";
        } catch {
            return "";
        }
    });

    const setSelectedBranchId = useCallback((id: string) => {
        setSelectedBranchIdState(id);
        try { localStorage.setItem(STORAGE_KEY, id); } catch { /* */ }
    }, []);

    const selectedBranchName = selectedBranchId
        ? branches.find((b) => b.id === selectedBranchId)?.name ?? "Semua Lokasi"
        : "Semua Lokasi";

    return (
        <BranchContext.Provider value={{ branches, selectedBranchId, selectedBranchName, setBranches, setSelectedBranchId }}>
            {children}
        </BranchContext.Provider>
    );
}

export function useBranch() {
    return useContext(BranchContext);
}
