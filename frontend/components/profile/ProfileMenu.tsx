"use client";

import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProfileIcon } from "./profile";

export default function ProfileMenu() {
    const router = useRouter();
    const { me, logout } = useAuthStore();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const btnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const onDown = (event: MouseEvent) => {
            if (!open) return;
            const target = event.target as Node;
            if (!panelRef.current?.contains(target) && !btnRef.current?.contains(target)) {
                setOpen(false);
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
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
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen((value) => !value)}
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
                        <MenuButton onClick={() => go("/mypage")}>마이페이지</MenuButton>
                        {me?.role === "ADMIN" && (
                            <>
                                <MenuButton onClick={() => go("/admin/server-test")}>서버 테스트</MenuButton>
                                <MenuButton onClick={() => go("/admin/payments")}>결제 관리하기</MenuButton>
                            </>
                        )}
                        <MenuButton onClick={() => void onLogout()}>로그아웃</MenuButton>
                    </div>
                </div>
            )}
        </div>
    );
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: "12px 14px",
                cursor: "pointer",
                textAlign: "left",
                background: "#fff",
                border: 0,
            }}
        >
            {children}
        </button>
    );
}
