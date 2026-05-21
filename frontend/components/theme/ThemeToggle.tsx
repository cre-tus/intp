"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const saved = window.localStorage.getItem("theme-mode");
        const initialDarkMode = saved === "dark";
        setDarkMode(initialDarkMode);
        document.documentElement.classList.toggle("dark-mode", initialDarkMode);
    }, []);

    const toggleTheme = () => {
        setDarkMode((current) => {
            const next = !current;
            document.documentElement.classList.toggle("dark-mode", next);
            window.localStorage.setItem("theme-mode", next ? "dark" : "light");
            return next;
        });
    };

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={darkMode ? "라이트 모드로 변경" : "다크 모드로 변경"}
            title={darkMode ? "Light" : "Dark"}
            className="fixed right-5 bottom-5 z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-black shadow-lg transition hover:scale-105"
        >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
    );
}
