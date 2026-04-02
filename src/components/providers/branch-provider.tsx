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
    branchReady: boolean; // true after branches have been loaded
    setBranches: (branches: Branch[]) => void;
    setSelectedBranchId: (id: string) => void;
}

const BranchContext = createContext<BranchContextType>({
    branches: [],
    selectedBranchId: "",
    selectedBranchName: "Semua Lokasi",
    branchReady: false,
    setBranches: () => { },
    setSelectedBranchId: () => { },
});

const STORAGE_KEY = "global-branch-filter";

export function BranchProvider({ children }: { children: React.ReactNode }) {
    const [branches, setBranchesState] = useState<Branch[]>([]);
    const [branchReady, setBranchReady] = useState(false);
    const [selectedBranchId, setSelectedBranchIdState] = useState(() => {
        if (typeof window === "undefined") return "";
        try {
            return localStorage.getItem(STORAGE_KEY) ?? "";
        } catch {
            return "";
        }
    });

    const setBranches = useCallback((newBranches: Branch[]) => {
        setBranchesState(newBranches);
        setBranchReady(true);
    }, []);

    const setSelectedBranchId = useCallback((id: string) => {
        setSelectedBranchIdState(id);
        try { localStorage.setItem(STORAGE_KEY, id); } catch { /* */ }
    }, []);

    const selectedBranchName = selectedBranchId
        ? branches.find((b) => b.id === selectedBranchId)?.name ?? "Semua Lokasi"
        : "Semua Lokasi";

    return (
        <BranchContext.Provider value={{ branches, selectedBranchId, selectedBranchName, branchReady, setBranches, setSelectedBranchId }}>
            {children}
        </BranchContext.Provider>
    );
}

export function useBranch() {
    return useContext(BranchContext);
}
