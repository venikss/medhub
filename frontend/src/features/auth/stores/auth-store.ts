import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User, UserRole } from "@/types";
import { roleMeta } from "@/config/roles";
import { apiFetch } from "@/lib/api";

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    token: string | null;
    refreshToken: string | null;
    login: (email: string, password: string, role: UserRole) => Promise<{ success: boolean; redirectTo: string }>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            token: null,
            refreshToken: null,

            login: async (email: string, password: string, role: UserRole) => {
                const data = await apiFetch("/auth/login", {
                    method: "POST",
                    body: JSON.stringify({ email, password, role }),
                });

                const user = data.user as User;
                const token = data.token as string;
                const refreshToken = data.refreshToken as string;

                set({
                    user,
                    token,
                    refreshToken,
                    isAuthenticated: true,
                });

                return {
                    success: true,
                    redirectTo: roleMeta[user.role].defaultRoute,
                };
            },

            logout: async () => {
                const { refreshToken, token } = useAuthStore.getState();
                try {
                    if (refreshToken) {
                        await apiFetch("/auth/logout", {
                            method: "POST",
                            token,
                            body: JSON.stringify({ refreshToken }),
                        });
                    }
                } catch {
                    // Ignore logout transport errors and clear local auth state anyway.
                } finally {
                    set({
                        user: null,
                        token: null,
                        refreshToken: null,
                        isAuthenticated: false,
                    });
                }
            },
        }),
        {
            name: "medhub-auth",
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                token: state.token,
                refreshToken: state.refreshToken,
            }),
        }
    )
);
