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
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white cursor-pointer hover:scale-105 transition"
            >
                <ProfileIcon size={26} />
            </button>

            {open && (
                <div
                    ref={panelRef}
                    className="absolute right-0 z-50 w-[220px] rounded-[14px] border border-gray-200 bg-white shadow-xl overflow-hidden"
                    style={{
                        top: "calc(100% + 10px)",
                    }}
                >
                    <div className="border-b border-gray-100 px-[14px] py-[12px]">
                        <div className="text-sm font-bold text-gray-900">
                            {me?.nickname ?? me?.email ?? "User"}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{me?.email ?? ""}</div>
                    </div>

                    <div className="flex flex-col">
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
            className="w-full bg-white px-[14px] py-[12px] text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 transition-colors"
        >
            {children}
        </button>
    );
}
