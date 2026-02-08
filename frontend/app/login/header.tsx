import React from "react";
import Link from "next/link";
import HeaderLogo from "@/components/logo/HeaderLogo";

export default function Header() {
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
                    }}
                >
          인팁
        </span>
            </Link>

        </header>
    );
}
