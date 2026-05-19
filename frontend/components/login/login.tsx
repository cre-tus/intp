"use client";

import LoginButton from "@/components/login/button/LoginButton";
import LoginStayCheckBox from "@/components/login/checkbox/LoginStayCheckBox";
import { useAuthStore } from "@/stores/authStore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
    const router = useRouter();
    const { fetchMe } = useAuthStore();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password,
                    rememberMe,
                }),
            });

            if (!res.ok) {
                setError(res.status === 401
                    ? "아이디 또는 비밀번호가 틀렸습니다."
                    : "서버와 연결이 끊어졌습니다.");
                return;
            }

            await fetchMe();
            router.push("/");
        } catch {
            setError("서버와 연결이 끊어졌습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen">
            <main className="flex min-h-[calc(100vh-84px)] items-center justify-center px-4 py-8 sm:px-6">
                <div className="flex w-full flex-col items-center">
                    <div className="w-full max-w-[640px] rounded-2xl border border-gray-200 bg-white p-7 py-10 shadow-sm sm:p-12 lg:p-14">
                        <h1 className="mb-10 text-center font-[var(--font-paperlogy)] text-3xl font-semibold sm:text-4xl">
                            인팁 : Trip Planner
                        </h1>

                        <form className="flex flex-col gap-6" onSubmit={handleLogin}>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="email" className="text-base font-semibold">이메일</label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="이메일을 입력하세요"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="rounded-xl border border-gray-200 px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                    autoComplete="email"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="password" className="text-base font-semibold">비밀번호</label>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="비밀번호를 입력하세요"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="rounded-xl border border-gray-200 px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                    autoComplete="current-password"
                                />
                            </div>

                            <LoginStayCheckBox checked={rememberMe} onChange={setRememberMe} />

                            {error && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    {error}
                                </div>
                            )}

                            <LoginButton disabled={loading} />
                        </form>
                    </div>

                    <nav className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600 sm:gap-6">
                        <Link href="/find-id" className="transition-colors hover:text-black">아이디 찾기</Link>
                        <span className="text-gray-300">|</span>
                        <Link href="/find-password" className="transition-colors hover:text-black">비밀번호 찾기</Link>
                        <span className="text-gray-300">|</span>
                        <Link href="/signup" className="transition-colors hover:text-black">회원가입</Link>
                    </nav>
                </div>
            </main>
        </div>
    );
}
