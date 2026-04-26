"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { apiFetch } from "@/lib/api";
import { DashboardLayout } from "@/components/templates/DashboardLayout";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAuthenticated } = useAuth();
    const logout = useAuthStore((s) => s.logout);
    const router = useRouter();
    const [hydrated, setHydrated] = useState(false);
    useNotifications();

    // Wait for Zustand persist rehydration before making auth decisions
    useEffect(() => {
        const unsub = useAuthStore.persist.onFinishHydration(() => {
            setHydrated(true);
        });
        // If already hydrated (e.g. hot reload), set immediately
        if (useAuthStore.persist.hasHydrated()) {
            setHydrated(true);
        }
        return unsub;
    }, []);

    // Validate the stored token against the server on every mount.
    useEffect(() => {
        if (hydrated && isAuthenticated) {
            apiFetch("/auth/me").catch(() => {
                void logout().then(() => router.replace("/login"));
            });
        }
    }, [hydrated, isAuthenticated, logout, router]);

    useEffect(() => {
        if (hydrated && !isAuthenticated) {
            router.replace("/login");
        }
    }, [hydrated, isAuthenticated, router]);

    if (!hydrated || !isAuthenticated) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        );
    }

    return <DashboardLayout>{children}</DashboardLayout>;
}
