"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type EmailCheckState = "idle" | "checking" | "available" | "unavailable";

export default function Signup() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [nickname, setNickname] = useState("");
    const [birth, setBirth] = useState("");
    const [emailCheck, setEmailCheck] = useState<EmailCheckState>("idle");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const normalizedEmail = email.trim().toLowerCase();
    const canSubmit = useMemo(() => {
        return normalizedEmail
            && password.length >= 4
            && password === passwordConfirm
            && firstName.trim()
            && lastName.trim()
            && nickname.trim()
            && birth
            && emailCheck === "available";
    }, [birth, emailCheck, firstName, lastName, nickname, normalizedEmail, password, passwordConfirm]);

    const handleEmailChange = (value: string) => {
        setEmail(value);
        setEmailCheck("idle");
        setMessage("");
    };

    const checkEmail = async () => {
        if (!normalizedEmail) {
            setMessage("이메일을 입력해주세요.");
            return;
        }

        setEmailCheck("checking");
        setMessage("");
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(normalizedEmail)}`);
        if (!res.ok) {
            setEmailCheck("idle");
            setMessage(await readError(res));
            return;
        }

        const data = await res.json() as { available: boolean };
        setEmailCheck(data.available ? "available" : "unavailable");
        setMessage(data.available ? "사용 가능한 이메일입니다." : "이미 사용 중인 이메일입니다.");
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmit) {
            setMessage("필수 입력값과 이메일 중복확인을 완료해주세요.");
            return;
        }

        setSubmitting(true);
        setMessage("");
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: normalizedEmail,
                password,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                nickname: nickname.trim(),
                birth,
            }),
        });

        setSubmitting(false);
        if (!res.ok) {
            setMessage(await readError(res));
            return;
        }

        alert("회원가입이 완료되었습니다. 로그인해주세요.");
        router.push("/login");
    };

    return (
        <div className="min-h-screen">
            <main className="flex min-h-[calc(100vh-84px)] items-center justify-center px-4 py-10">
                <div className="w-full max-w-[560px] rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-10">
                    <h1 className="mb-8 text-center font-[var(--font-paperlogy)] text-2xl font-semibold sm:text-3xl">
                        회원가입
                    </h1>

                    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="email" className="font-medium">이메일</label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(event) => handleEmailChange(event.target.value)}
                                    placeholder="이메일을 입력하세요"
                                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base"
                                />
                                <button
                                    type="button"
                                    onClick={checkEmail}
                                    disabled={emailCheck === "checking"}
                                    className="shrink-0 rounded-lg bg-gray-950 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-300"
                                >
                                    {emailCheck === "checking" ? "확인 중" : "중복확인"}
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="성" value={firstName} onChange={setFirstName} placeholder="홍" />
                            <Input label="이름" value={lastName} onChange={setLastName} placeholder="길동" />
                        </div>

                        <Input label="닉네임" value={nickname} onChange={setNickname} placeholder="닉네임을 입력하세요" />

                        <div className="flex flex-col gap-2">
                            <label htmlFor="birth" className="font-medium">생년월일</label>
                            <input
                                id="birth"
                                type="date"
                                required
                                value={birth}
                                onChange={(event) => setBirth(event.target.value)}
                                className="rounded-lg border border-gray-200 px-4 py-3 text-base"
                            />
                        </div>

                        <Input
                            label="비밀번호"
                            type="password"
                            value={password}
                            onChange={setPassword}
                            placeholder="4자 이상 입력하세요"
                        />
                        <Input
                            label="비밀번호 확인"
                            type="password"
                            value={passwordConfirm}
                            onChange={setPasswordConfirm}
                            placeholder="비밀번호를 다시 입력하세요"
                        />

                        {passwordConfirm && password !== passwordConfirm && (
                            <p className="text-sm font-medium text-red-600">비밀번호가 일치하지 않습니다.</p>
                        )}
                        {message && (
                            <p className={`text-sm font-medium ${emailCheck === "available" ? "text-emerald-600" : "text-red-600"}`}>
                                {message}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={!canSubmit || submitting}
                            className="mt-2 rounded-lg bg-black px-4 py-3 font-bold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {submitting ? "가입 중" : "회원가입"}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-gray-600">
                        이미 계정이 있나요?{" "}
                        <Link href="/login" className="font-semibold text-black hover:underline">
                            로그인
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}

function Input({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: string;
}) {
    const id = label.replaceAll(" ", "-");
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className="font-medium">{label}</label>
            <input
                id={id}
                type={type}
                required
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="rounded-lg border border-gray-200 px-4 py-3 text-base"
            />
        </div>
    );
}

async function readError(res: Response) {
    const text = await res.text();
    return text || "요청 처리에 실패했습니다.";
}
