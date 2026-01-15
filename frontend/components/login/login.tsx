import LoginStayCheckBox from "@/components/login/checkbox/LoginStayCheckBox";
import LoginButton from "@/components/login/button/LoginButton";
import Link from "next/link";


export default function Login() {
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

                        <form className="flex flex-col gap-5">
                            <div className="flex flex-col gap-2">
                                <label htmlFor="username">아이디</label>
                                <input
                                    id="username"
                                    type="text"
                                    placeholder="아이디를 입력하세요"
                                    className="px-4 py-3 border border-gray-200 rounded-lg text-base"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="password">비밀번호</label>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="비밀번호를 입력하세요"
                                    className="px-4 py-3 border border-gray-200 rounded-lg text-base"
                                />
                            </div>

                            <LoginStayCheckBox />
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

