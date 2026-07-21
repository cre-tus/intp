"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import ProfileMenu from "@/components/profile/ProfileMenu";
import HeaderLogo from "@/components/logo/HeaderLogo";

export default function Header() {
    const { isLoggedIn, fetchMe } = useAuthStore();

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    return (
        <header className="home-card sticky top-0 z-40 flex min-h-[64px] w-full items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur sm:min-h-[84px] sm:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-2 text-inherit no-underline sm:gap-4">
                <div className="shrink-0 scale-75 sm:scale-100">
                    <HeaderLogo />
                </div>
                <span className="home-text truncate font-[var(--font-paperlogy)] text-2xl font-bold leading-none sm:text-4xl">
                    인팁 : INTP
                </span>
            </Link>

            <nav className="flex shrink-0 items-center gap-3 sm:gap-7">
                <Link href="/community" className="home-text text-sm font-semibold transition opacity-90 hover:opacity-60 sm:text-base">
                    커뮤니티
                </Link>
                {isLoggedIn === null && <span className="home-muted text-sm">...</span>}
                {isLoggedIn === false && (
                    <Link href="/login" className="home-text text-sm font-semibold transition opacity-90 hover:opacity-60 sm:text-base">
                        로그인
                    </Link>
                )}
                {isLoggedIn === true && <ProfileMenu />}
            </nav>
        </header>
    );
}
