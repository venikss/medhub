import { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { Activity } from "lucide-react";

export const metadata: Metadata = {
    title: "Sign In — MedHub",
    description: "Sign in to access your MedHub portal",
};

export default function LoginPage() {
    return (
        <div className="w-full max-w-md">
            {/* Header / Branding */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20 mb-5">
                    <Activity className="h-7 w-7 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Welcome to MedHub
                </h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                    Sign in to access your hospital portal
                </p>
            </div>

            {/* Login Card */}
            <div className="bg-card rounded-2xl border border-border/50 shadow-xl shadow-black/5 p-7">
                <LoginForm />
            </div>

            {/* Footer */}
            <p className="text-xs text-muted-foreground/60 text-center mt-6">
                MedHub Virtual Hospital © 2026 — All rights reserved
            </p>
        </div>
    );
}
