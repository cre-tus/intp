import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import React from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
    title: "INTP",
    description: "Travel Route Optimization",
};

const paperlogy = localFont({
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
        <html lang="ko" className={paperlogy.variable} suppressHydrationWarning>
        <body className={paperlogy.className} suppressHydrationWarning>
        {children}
        <ThemeToggle />
        </body>
        </html>
    );
}
