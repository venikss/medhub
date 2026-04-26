import { Activity } from "lucide-react";

interface LogoProps {
    collapsed?: boolean;
    className?: string;
}

export function Logo({ collapsed = false, className = "" }: LogoProps) {
    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 shadow-sm">
                <Activity className="h-5 w-5 text-sidebar-primary-foreground" />
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-sidebar animate-pulse" />
            </div>
            {!collapsed && (
                <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
                        MedHub
                    </span>
                    <span className="text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-widest">
                        Virtual Hospital
                    </span>
                </div>
            )}
        </div>
    );
}
