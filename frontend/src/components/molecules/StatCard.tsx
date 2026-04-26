import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        label: string;
    };
    className?: string;
    iconClassName?: string;
}

export function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    className,
    iconClassName,
}: StatCardProps) {
    const TrendIcon =
        trend && trend.value > 0
            ? TrendingUp
            : trend && trend.value < 0
                ? TrendingDown
                : Minus;

    const trendColor =
        trend && trend.value > 0
            ? "text-emerald-600"
            : trend && trend.value < 0
                ? "text-red-500"
                : "text-muted-foreground";

    return (
        <Card
            className={cn(
                "relative overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200",
                className
            )}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-2xl font-bold tracking-tight text-foreground">
                            {value}
                        </p>
                        {trend && (
                            <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
                                <TrendIcon className="h-3 w-3" />
                                <span>{Math.abs(trend.value)}%</span>
                                <span className="text-muted-foreground font-normal">
                                    {trend.label}
                                </span>
                            </div>
                        )}
                    </div>
                    <div
                        className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-xl",
                            iconClassName || "bg-primary/10 text-primary"
                        )}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
