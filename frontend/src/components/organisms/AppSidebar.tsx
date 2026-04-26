"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarHeader,
    SidebarFooter,
    SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, ChevronUp } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/atoms/Logo";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { roleNavigation } from "@/config/navigation";
import { roleMeta } from "@/config/roles";

export function AppSidebar() {
    const pathname = usePathname();
    const { user, logout, role, fullName } = useAuth();

    if (!role || !user) return null;

    const navigation = roleNavigation[role];
    const meta = roleMeta[role];

    return (
        <Sidebar collapsible="icon" className="border-r-0">
            {/* Header */}
            <SidebarHeader className="p-4">
                <Logo />
            </SidebarHeader>

            <SidebarSeparator className="bg-sidebar-border/50" />

            {/* Navigation */}
            <SidebarContent className="px-2 pt-2">
                {navigation.map((section) => (
                    <SidebarGroup key={section.label}>
                        <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-2 mb-1">
                            {section.label}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {section.items.map((item) => {
                                    const isActive = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));
                                    return (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuButton
                                                render={<Link href={item.href} />}
                                                isActive={isActive}
                                                tooltip={item.title}
                                                className="h-10 rounded-lg transition-all duration-150"
                                            >
                                                <item.icon className="h-4 w-4" />
                                                <span className="font-medium">{item.title}</span>
                                                {item.badge && (
                                                    <span className="ml-auto text-[10px] font-bold bg-sidebar-primary/20 text-sidebar-primary px-1.5 py-0.5 rounded-full">
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            {/* Footer — user profile */}
            <SidebarFooter className="p-3">
                <SidebarSeparator className="bg-sidebar-border/50 mb-2" />
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-sidebar-accent transition-colors" />
                        }
                    >
                        <Avatar className="h-8 w-8 border border-sidebar-border">
                            <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold">
                                {user.firstName[0]}
                                {user.lastName[0]}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                            <p className="text-sm font-medium text-sidebar-foreground truncate">
                                {fullName}
                            </p>
                            <p className="text-[11px] text-sidebar-foreground/50 truncate">
                                {meta.label}
                            </p>
                        </div>
                        <ChevronUp className="h-4 w-4 text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-56">
                        <div className="px-3 py-2">
                            <p className="text-sm font-medium">{fullName}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={logout}
                            className="text-destructive focus:text-destructive cursor-pointer"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
