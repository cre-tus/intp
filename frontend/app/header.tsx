"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import {ProfileIcon} from "@/components/profile/profile";
import ProfileMenu from "@/components/profile/ProfileMenu";
import HeaderLogo from "@/components/logo/HeaderLogo";


export default function Header() {
    const router = useRouter();
    const { isLoggedIn, me, fetchMe, logout } = useAuthStore();

    // 최초 1회: /api/auth/me로 로그인 상태 판별
    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    const onLogout = async () => {
        await logout();     // 서버 로그아웃 + store 초기화
        router.push("/");   // 홈으로 이동
    };

    return (
        <header
            style={{
                height: 84,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 32px",
                background: "#fff",
            }}
        >
            {/* 로고 영역 → 메인으로 이동 */}
            <Link
                href="/"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    textDecoration: "none",
                    color: "inherit",
                }}
            >
                <HeaderLogo />

                <span
                    style={{
                        fontSize: 48,
                        fontWeight: 900,
                        lineHeight: 1,
                        color: "#000000",
                    }}
                >
          인팁
        </span>
            </Link>

            <nav style={{display: "flex", gap: 28, alignItems: "center"}}>

                {/*  판별 중: 깜빡임 방지 */}
                {isLoggedIn === null && <span style={{opacity: 0.6}}>...</span>}

                {/* 비로그인 */}
                {isLoggedIn === false && (
                    <>
                        <Link href="/login">로그인</Link>
                    </>
                )}

                {/* 로그인 */}
                {isLoggedIn === true && <ProfileMenu />}
            </nav>

        </header>
    );
}
