import React from "react";
import Link from "next/link";
import HeaderLogo from "@/components/logo/HeaderLogo";

export default function Header() {
    return (
        <header className="flex min-h-[64px] w-full items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2 sm:min-h-[84px] sm:px-8">
            {/* 로고 영역 → 메인으로 이동 */}
            <Link
                href="/"
                className="flex min-w-0 items-center gap-2 text-inherit no-underline sm:gap-4"
            >
                <div className="shrink-0 scale-75 sm:scale-100">
                    <HeaderLogo />
                </div>

                <span className="truncate text-3xl font-black leading-none text-black sm:text-5xl">
                    인팁
                </span>
            </Link>
        </header>
    );
}
