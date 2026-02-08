"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { ProfileIcon } from  "./profile"

export default function ProfileMenu() {
    const router = useRouter();
    const { me, logout } = useAuthStore();

    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const btnRef = useRef<HTMLButtonElement | null>(null);

    // 바깥 클릭/ESC로 닫기
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (!open) return;
            const target = e.target as Node;

            const inPanel = panelRef.current?.contains(target);
            const inButton = btnRef.current?.contains(target);

            if (!inPanel && !inButton) setOpen(false);
        };

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const go = (path: string) => {
        setOpen(false);
        router.push(path);
    };

    const onLogout = async () => {
        await logout();
        setOpen(false);
        router.push("/");
    };

    return (
        <div style={{ position: "relative" }}>
            {/* 아이콘 버튼 */}
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                style={{
                    border: "1px solid #e5e5e5",
                    background: "#fff",
                    borderRadius: 999,
                    padding: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <ProfileIcon size={26} />
            </button>

            {/* 아이콘 밑 패널 */}
            {open && (
                <div
                    ref={panelRef}
                    style={{
                        position: "absolute",
                        top: "calc(100% + 10px)",
                        right: 0,
                        width: 220,
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: 14,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                        overflow: "hidden",
                        zIndex: 50,
                    }}
                >
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid #f2f2f2" }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {me?.nickname ?? me?.email ?? "User"}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.65 }}>{me?.email ?? ""}</div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => go("/mypage")}
                            onKeyDown={(e) => e.key === "Enter" && go("/mypage")}
                            style={{
                                padding: "12px 14px",
                                cursor: "pointer",
                                userSelect: "none",
                            }}
                        >
                            내 정보
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            onClick={onLogout}
                            onKeyDown={(e) => e.key === "Enter" && onLogout()}
                            style={{
                                padding: "12px 14px",
                                cursor: "pointer",
                                userSelect: "none",
                            }}
                        >
                            로그아웃
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
