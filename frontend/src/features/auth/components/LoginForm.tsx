"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { loginSchema, type LoginFormData } from "@/features/auth/schemas/login";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { roleMeta } from "@/config/roles";
import { UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

export function LoginForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login } = useAuth();
    const router = useRouter();

    const form = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
            role: undefined,
        },
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await login(data.email, data.password, data.role);
            if (result.success) {
                router.push(result.redirectTo);
            }
        } catch (error) {
            setError(
                error instanceof Error && error.message
                    ? error.message
                    : "Invalid credentials. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {error && (
                    <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20">
                        {error}
                    </div>
                )}

                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-foreground/80">
                                Sign in as
                            </FormLabel>
                            <Select value={field.value ?? ""} onValueChange={field.onChange}>
                                <FormControl>
                                    <SelectTrigger className="h-11 bg-background border-border/60 focus:border-primary/50">
                                        <SelectValue placeholder="Select your role..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {Object.values(UserRole).map((role) => {
                                        const meta = roleMeta[role];
                                        const Icon = meta.icon;
                                        return (
                                            <SelectItem key={role} value={role}>
                                                <span className="flex items-center gap-2.5">
                                                    <Icon className={`h-4 w-4 ${meta.color}`} />
                                                    <span>{meta.label}</span>
                                                </span>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-foreground/80">
                                Email
                            </FormLabel>
                            <FormControl>
                                <Input
                                    type="email"
                                    placeholder="you@medhub.io"
                                    className="h-11 bg-background border-border/60 focus:border-primary/50"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-foreground/80">
                                Password
                            </FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="h-11 bg-background border-border/60 focus:border-primary/50"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all duration-200 shadow-sm hover:shadow-md mt-2"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <LogIn className="h-4 w-4 mr-2" />
                    )}
                    {isLoading ? "Signing in..." : "Sign In"}
                </Button>

                <p className="text-xs text-muted-foreground text-center pt-2">
                    Sign in with a real backend user account and matching role.
                </p>
            </form>
        </Form>
    );
}
