import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import React from "react";

export const metadata: Metadata = {
    title: "INTP",
    description: "Travel Route Optimization",
};

const infpFont = localFont({
    src: [
        { path: "../fonts/Paperlogy-1Thin.woff2", weight: "100", style: "normal" },
        { path: "../fonts/Paperlogy-2ExtraLight.woff2", weight: "200", style: "normal" },
        { path: "../fonts/Paperlogy-3Light.woff2", weight: "300", style: "normal" },
        { path: "../fonts/Paperlogy-4Regular.woff2", weight: "400", style: "normal" },
        { path: "../fonts/Paperlogy-5Medium.woff2", weight: "500", style: "normal" },
        { path: "../fonts/Paperlogy-6SemiBold.woff2", weight: "600", style: "normal" },
        { path: "../fonts/Paperlogy-7Bold.woff2", weight: "700", style: "normal" },
        { path: "../fonts/Paperlogy-8ExtraBold.ttf", weight: "800", style: "normal" },
        { path: "../fonts/Paperlogy-9Black.woff2", weight: "900", style: "normal" },
    ],
    variable: "--font-paperlogy",
    display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko" className={`${infpFont.variable} ${infpFont.className}`}>
        <body
            style={{
                margin: 0,
                fontFamily: "var(--font-paperlogy), system-ui, -apple-system, sans-serif",
            }}
        >
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
            <div style={{display: "flex", alignItems: "center", gap: 16}}>
                {/* SVG 로고 */}
                <svg width={56} height={56} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
                     aria-label="INTP logo" role="img">
                    <defs>
                        <linearGradient id="infpGradientDark" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#111111"/>
                            <stop offset="100%" stopColor="#000000"/>
                        </linearGradient>
                    </defs>
                    <rect width="100" height="100" rx="20" fill="url(#infpGradientDark)"/>
                    <circle cx="50" cy="48" r="30" stroke="white" strokeWidth="2.5" fill="none" opacity="0.9"/>
                    <circle cx="50" cy="48" r="26" stroke="white" strokeWidth="1" fill="none" opacity="0.3"/>
                    <path d="M50 48 L50 24 L45.5 33 Z" fill="white"/>
                    <path d="M50 48 L50 24 L54.5 33 Z" fill="white" opacity="0.85"/>
                    <path d="M50 48 L50 72 L45.5 63 Z" fill="white" opacity="0.5"/>
                    <path d="M50 48 L50 72 L54.5 63 Z" fill="white" opacity="0.35"/>
                    <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
                       opacity="0.9">
                        <path d="M47.5 13 L47.5 5 L52.5 13 L52.5 5"/>
                        <path d="M13 46 L13 54"/>
                        <path d="M89 46 L89 54 M85 46 L93 46"/>
                        <path d="M47.5 83 L47.5 93 M47.5 83 L51 83 Q52.5 83 52.5 85.5 Q52.5 88 51 88 L47.5 88"/>
                    </g>
                    <circle cx="50" cy="48" r="3" fill="white"/>
                </svg>
                <span style={{fontSize: 48, fontWeight: 900, lineHeight: 1}}>인팁</span>
            </div>

            <nav style={{display: "flex", gap: 28}}>
                <Link href="/mypage">My Page</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/login">Login</Link>
            </nav>
        </header>

        <main>{children}</main>
        </body>
        </html>
    );
}
