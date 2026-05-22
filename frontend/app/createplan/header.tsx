"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import ProfileMenu from "@/components/profile/ProfileMenu";
import HeaderLogo from "@/components/logo/HeaderLogo";

export default function Header() {
    const router = useRouter();
    const { isLoggedIn, fetchMe, logout } = useAuthStore();

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    const onLogout = async () => {
        await logout();
        router.push("/");
    };

    return (
        <header className="flex min-h-[64px] w-full items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2 sm:min-h-[84px] sm:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-2 text-inherit no-underline sm:gap-4">
                <div className="shrink-0 scale-75 sm:scale-100">
                    <HeaderLogo />
                </div>
                <span className="truncate text-3xl font-black leading-none text-black sm:text-5xl">
                    인팁
                </span>
            </Link>

            <nav className="flex shrink-0 items-center gap-3 sm:gap-7">
                {isLoggedIn === null && <span className="text-sm text-gray-500">...</span>}
                {isLoggedIn === false && (
                    <Link href="/login" className="text-sm font-semibold text-gray-900 sm:text-base">
                        로그인
                    </Link>
                )}
                {isLoggedIn === true && <ProfileMenu />}
            </nav>
        </header>
    );
}
