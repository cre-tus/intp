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
            <main className="flex items-center justify-center min-h-[calc(100vh-84px)]">
                {/* 중앙 묶음 */}
                <div className="flex flex-col items-center">
                    {/* 로그인 프레임 */}
                    <div className="w-[500px] p-12 py-16 border border-gray-200 rounded-xl">
                        <h1 className="mb-8 text-center font-[var(--font-paperlogy)] font-semibold text-3xl">
                            인팁 : Trip Planner
                        </h1>

                        {/* ✅ 로그인 폼 */}
                        <form className="flex flex-col gap-5" onSubmit={handleLogin}>
                            {/* 이메일 입력 */}
                            <div className="flex flex-col gap-2">
                                <label htmlFor="email">이메일</label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="이메일을 입력하세요"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="px-4 py-3 border border-gray-200 rounded-lg text-base"
                                />
                            </div>

                            {/* 비밀번호 입력 */}
                            <div className="flex flex-col gap-2">
                                <label htmlFor="password">비밀번호</label>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="비밀번호를 입력하세요"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="px-4 py-3 border border-gray-200 rounded-lg text-base"
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
                    <nav className="mt-8 flex items-center gap-6 text-sm text-gray-600">
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

