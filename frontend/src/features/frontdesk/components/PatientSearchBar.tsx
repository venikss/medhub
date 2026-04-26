"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { searchPatients } from "@/features/frontdesk/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { ADTPatient } from "@/types";
import { cn } from "@/lib/utils";

interface PatientSearchBarProps {
    onSelect?: (patientId: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    showShortcutHint?: boolean;
    compact?: boolean;
    initialQuery?: string;
}

export function PatientSearchBar({
    onSelect,
    placeholder = "Search patients by name, MRN, phone, or email…",
    className,
    autoFocus = false,
    showShortcutHint = true,
    compact = false,
    initialQuery = "",
}: PatientSearchBarProps) {
    const [query, setQuery] = useState(initialQuery);
    const [isFocused, setIsFocused] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [results, setResults] = useState<ADTPatient[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const token = useAuthStore((state) => state.token);

    // Global Ctrl+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === "Escape") {
                inputRef.current?.blur();
                setQuery("");
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const handleSelect = useCallback(
        (patientId: string) => {
            if (onSelect) {
                onSelect(patientId);
            } else {
                router.push(`/frontdesk/patients/${patientId}`);
            }
            setQuery("");
            inputRef.current?.blur();
        },
        [onSelect, router]
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!results.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && results[highlightedIndex]) {
            e.preventDefault();
            handleSelect(results[highlightedIndex].id);
        }
    };

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (query.trim().length < 1) {
                setResults([]);
                return;
            }
            try {
                const data = await searchPatients(query, token);
                if (!cancelled) {
                    setResults(data);
                }
            } catch {
                if (!cancelled) {
                    setResults([]);
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [query, token]);

    const showDropdown = isFocused && query.trim().length >= 1;

    return (
        <div className={cn("relative", className)}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setHighlightedIndex(0);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className={cn(
                        "pl-10 pr-20 bg-background border-border/60 focus-visible:ring-primary/30",
                        compact ? "h-9 text-sm" : "h-11"
                    )}
                />
                {showShortcutHint && !query && (
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        ⌘K
                    </kbd>
                )}
                {query && (
                    <button
                        onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {showDropdown && (
                <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg overflow-hidden">
                    {results.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                            <p className="text-sm text-muted-foreground">No patients found for &ldquo;{query}&rdquo;</p>
                            <button
                                onClick={() => router.push(`/frontdesk/patients/register?name=${encodeURIComponent(query)}`)}
                                className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                                Register new patient <ArrowRight className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <ul className="max-h-72 overflow-y-auto py-1">
                            {results.map((patient, idx) => (
                                <li key={patient.id}>
                                    <button
                                        onClick={() => handleSelect(patient.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                                            idx === highlightedIndex ? "bg-accent" : "hover:bg-muted/50"
                                        )}
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                            {patient.firstName[0]}{patient.lastName[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{patient.firstName} {patient.lastName}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {patient.mrn} · {patient.dateOfBirth} · {patient.phone}
                                            </p>
                                        </div>
                                        <StatusBadge status={patient.status} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
