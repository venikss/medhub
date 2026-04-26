"use client";

import { Bell, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { roleMeta } from "@/config/roles";
import { useNotificationStore } from "@/features/notifications/stores/notification-store";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
    const { role } = useAuth();
    const meta = role ? roleMeta[role] : null;
    const { notifications, unreadCount, markAllAsRead, clearAll } = useNotificationStore();
    const router = useRouter();

    function handleSearch(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
        if (!q) return;
        if (role === "doctor") {
            router.push(`/doctor/patients?q=${encodeURIComponent(q)}`);
        } else if (role === "pharmacist") {
            router.push(`/pharmacy/profiles?q=${encodeURIComponent(q)}`);
        } else {
            router.push(`/frontdesk/patients?q=${encodeURIComponent(q)}`);
        }
    }

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/40 bg-background/80 backdrop-blur-md px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="h-5" />

            {/* Portal label */}
            {meta && (
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                        {meta.label} Portal
                    </span>
                </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search */}
            <div className="hidden md:flex items-center">
                <form 
                    onSubmit={handleSearch}
                    className="relative"
                >
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        name="q"
                        placeholder="Search patients..."
                        className="h-8 w-56 pl-8 bg-muted/50 border-0 text-sm focus:bg-background focus:border-border transition-all"
                    />
                </form>
            </div>

            {/* Notifications */}
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button variant="ghost" size="icon" className="relative h-8 w-8" />
                    }
                >
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-destructive text-[9px] text-white font-bold border-2 border-background">
                            {unreadCount}
                        </span>
                    )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                    <div className="px-3 py-2.5 border-b flex items-center justify-between">
                        <p className="text-sm font-semibold">Notifications</p>
                        <div className="flex gap-2">
                           {unreadCount > 0 && (
                             <button onClick={markAllAsRead} className="text-[10px] text-primary hover:underline font-medium">
                               Mark all read
                             </button>
                           )}
                           {notifications.length > 0 && (
                             <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:underline font-medium">
                               Clear
                             </button>
                           )}
                        </div>
                    </div>
                    
                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center px-4">
                                <p className="text-sm text-muted-foreground">No notifications yet.</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <DropdownMenuItem key={n.id} className="py-3 cursor-pointer focus:bg-accent border-b border-border/40 last:border-0">
                                    <div className="flex gap-3 w-full">
                                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-primary'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm leading-snug ${n.read ? 'text-foreground/70' : 'font-semibold'}`}>
                                                {n.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                {n.message}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground/60 mt-1.5 uppercase font-medium tracking-wider">
                                                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                            ))
                        )}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
