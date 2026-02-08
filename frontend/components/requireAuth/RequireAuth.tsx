"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { isLoggedIn, fetchMe } = useAuthStore();

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    useEffect(() => {
        if (isLoggedIn === false) {
            router.replace("/login");
        }
    }, [isLoggedIn, router]);

    if (isLoggedIn === null) return;

    return <>{children}</>;
}
