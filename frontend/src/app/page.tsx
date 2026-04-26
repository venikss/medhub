"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { roleMeta } from "@/config/roles";

export default function HomePage() {
  const { isAuthenticated, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && role) {
      router.replace(roleMeta[role].defaultRoute);
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, role, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}
