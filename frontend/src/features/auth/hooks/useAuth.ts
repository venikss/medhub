"use client";

import { useAuthStore } from "@/features/auth/stores/auth-store";

export function useAuth() {
    const { user, isAuthenticated, login, logout } = useAuthStore();

    return {
        user,
        isAuthenticated,
        login,
        logout,
        role: user?.role ?? null,
        fullName: user ? `${user.firstName} ${user.lastName}` : null,
    };
}
