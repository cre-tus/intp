"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { isLoggedIn, fetchMe } = useAuthStore();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let mounted = true;
        fetchMe().finally(() => {
            if (mounted) setChecking(false);
        });
        return () => {
            mounted = false;
        };
    }, [fetchMe]);

    useEffect(() => {
        if (isLoggedIn === false) {
            router.replace("/login");
        }
    }, [isLoggedIn, router]);

    if (checking || isLoggedIn !== true) return null;

    return <>{children}</>;
}
