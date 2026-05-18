"use client";

import { useState} from "react";
import { useRouter } from "next/navigation";
import { useAuthStore} from "@/stores/authStore";
import LoginStayCheckBox from "@/components/login/checkbox/LoginStayCheckBox";
import LoginButton from "@/components/login/button/LoginButton";
import Link from "next/link";


export default function Login() {

    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const { fetchMe } = useAuthStore();

    // 로그인 요청 처리
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); // form 기본 새로고침 방지

        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                email,
                password,
                rememberMe,
            }),
        });
        if (!res.ok) {
            alert("로그인 실패");
            return;
        }
        await fetchMe();

        router.push("/");

    }


    return (
        <div className="min-h-screen">
            <main className="flex min-h-[calc(100vh-84px)] items-center justify-center px-4 py-8 sm:px-6">
                {/* 중앙 묶음 */}
                <div className="flex w-full flex-col items-center">
                    {/* 로그인 프레임 */}
                    <div className="w-full max-w-[640px] rounded-2xl border border-gray-200 bg-white p-7 py-10 shadow-sm sm:p-12 lg:p-14">
                        <h1 className="mb-10 text-center font-[var(--font-paperlogy)] text-3xl font-semibold sm:text-4xl">
                            인팁 : Trip Planner
                        </h1>

                        {/* ✅ 로그인 폼 */}
                        <form className="flex flex-col gap-6" onSubmit={handleLogin}>
                            {/* 이메일 입력 */}
                            <div className="flex flex-col gap-2">
                                <label htmlFor="email" className="text-base font-semibold">이메일</label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="이메일을 입력하세요"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="rounded-xl border border-gray-200 px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                />
                            </div>

                            {/* 비밀번호 입력 */}
                            <div className="flex flex-col gap-2">
                                <label htmlFor="password" className="text-base font-semibold">비밀번호</label>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="비밀번호를 입력하세요"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="rounded-xl border border-gray-200 px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                />
                            </div>

                            {/* 로그인 상태 유지 체크박스 */}
                            {/* 내부에서 setRememberMe 호출하도록 구현되어 있어야 함 */}
                            <LoginStayCheckBox
                                checked={rememberMe}
                                onChange={setRememberMe}
                            />

                            {/* submit 버튼 (로직 없음) */}
                            <LoginButton />
                        </form>
                    </div>

                    {/* 하단 nav */}
                    <nav className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600 sm:gap-6">
                        <Link href="/find-id" className="hover:text-black transition-colors">
                            아이디 찾기
                        </Link>
                        <span className="text-gray-300">|</span>
                        <Link href="/find-password" className="hover:text-black transition-colors">
                            비밀번호 찾기
                        </Link>
                        <span className="text-gray-300">|</span>
                        <Link href="/signup" className="hover:text-black transition-colors">
                            회원가입
                        </Link>
                    </nav>
                </div>
            </main>
        </div>
    );
}

