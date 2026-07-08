"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type EmailCheckState = "idle" | "checking" | "available" | "unavailable";

const TERMS_VERSION = "2026-07-08";
const PRIVACY_POLICY_VERSION = "2026-07-08";

export default function Signup() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [nickname, setNickname] = useState("");
    const [birth, setBirth] = useState("");
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [privacyNoticeConfirmed, setPrivacyNoticeConfirmed] = useState(false);
    const [emailCheck, setEmailCheck] = useState<EmailCheckState>("idle");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const normalizedEmail = email.trim().toLowerCase();
    const passwordError = password ? validatePassword(password, normalizedEmail) : "";
    const passwordMatches = Boolean(password) && password === passwordConfirm;

    const canSubmit = useMemo(() => {
        return Boolean(
            normalizedEmail
            && !passwordError
            && passwordMatches
            && firstName.trim()
            && lastName.trim()
            && nickname.trim()
            && birth
            && termsAgreed
            && privacyNoticeConfirmed
            && emailCheck === "available"
        );
    }, [
        birth,
        emailCheck,
        firstName,
        lastName,
        nickname,
        normalizedEmail,
        passwordError,
        passwordMatches,
        privacyNoticeConfirmed,
        termsAgreed,
    ]);

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
            setMessage("필수 입력값, 이메일 중복 확인, 비밀번호 규칙, 동의 항목을 확인해주세요.");
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
                termsAgreed,
                privacyNoticeConfirmed,
                termsVersion: TERMS_VERSION,
                privacyPolicyVersion: PRIVACY_POLICY_VERSION,
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
        <div className="min-h-screen bg-gray-50">
            <main className="flex min-h-[calc(100vh-84px)] items-center justify-center px-4 py-10">
                <div className="w-full max-w-[640px] rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-10">
                    <div className="mb-8 text-center">
                        <h1 className="font-[var(--font-paperlogy)] text-2xl font-semibold text-gray-950 sm:text-3xl">
                            회원가입
                        </h1>
                        <p className="mt-2 text-sm text-gray-500">
                            계정 정보와 여행 계획 저장에 필요한 최소 정보를 입력해주세요.
                        </p>
                    </div>

                    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="email" className="font-medium text-gray-900">이메일</label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(event) => handleEmailChange(event.target.value)}
                                    placeholder="name@example.com"
                                    autoComplete="email"
                                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base"
                                />
                                <button
                                    type="button"
                                    onClick={checkEmail}
                                    disabled={emailCheck === "checking"}
                                    className="shrink-0 rounded-lg bg-gray-950 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-300"
                                >
                                    {emailCheck === "checking" ? "확인 중" : "중복 확인"}
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="성" value={firstName} onChange={setFirstName} placeholder="홍" autoComplete="family-name" />
                            <Input label="이름" value={lastName} onChange={setLastName} placeholder="길동" autoComplete="given-name" />
                        </div>

                        <Input label="닉네임" value={nickname} onChange={setNickname} placeholder="서비스에 표시할 이름" autoComplete="nickname" />

                        <div className="flex flex-col gap-2">
                            <label htmlFor="birth" className="font-medium text-gray-900">생년월일</label>
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
                            placeholder="영문, 숫자, 특수문자 포함 8~64자"
                            autoComplete="new-password"
                        />
                        {password && <PasswordRuleList password={password} email={normalizedEmail} />}

                        <Input
                            label="비밀번호 확인"
                            type="password"
                            value={passwordConfirm}
                            onChange={setPasswordConfirm}
                            placeholder="비밀번호를 다시 입력하세요"
                            autoComplete="new-password"
                        />

                        {passwordConfirm && !passwordMatches && (
                            <p className="text-sm font-medium text-red-600">비밀번호가 일치하지 않습니다.</p>
                        )}

                        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <AgreementCheck
                                checked={termsAgreed}
                                onChange={setTermsAgreed}
                                title="서비스 이용약관 확인"
                                description="여행 계획 생성, 저장, 공유 기능 제공을 위한 서비스 이용 조건을 확인했습니다."
                            />
                            <AgreementCheck
                                checked={privacyNoticeConfirmed}
                                onChange={setPrivacyNoticeConfirmed}
                                title="개인정보 처리 안내 확인"
                                description="이메일, 성명, 닉네임, 생년월일, 비밀번호 해시는 회원 식별과 서비스 제공 목적으로 처리되며, 회원 탈퇴 시까지 보관됩니다. 법령상 보존 의무가 있는 경우 해당 기간 동안 보관될 수 있습니다."
                            />
                            <p className="text-xs leading-5 text-gray-500">
                                비밀번호는 원문으로 저장하지 않고 BCrypt 해시로 저장합니다. 입력하신 정보는 회원 서비스 제공과 계정 보안을 위해 사용됩니다.
                            </p>
                        </div>

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
    autoComplete,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: string;
    autoComplete?: string;
}) {
    const id = label.replaceAll(" ", "-");
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className="font-medium text-gray-900">{label}</label>
            <input
                id={id}
                type={type}
                required
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                autoComplete={autoComplete}
                className="rounded-lg border border-gray-200 px-4 py-3 text-base"
            />
        </div>
    );
}

function AgreementCheck({
    checked,
    onChange,
    title,
    description,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    title: string;
    description: string;
}) {
    return (
        <label className="flex cursor-pointer gap-3 rounded-lg bg-white p-3">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <span>
                <span className="block text-sm font-bold text-gray-950">{title}</span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span>
            </span>
        </label>
    );
}

function PasswordRuleList({ password, email }: { password: string; email: string }) {
    const rules = [
        { label: "8~64자", ok: password.length >= 8 && password.length <= 64 },
        { label: "영문 포함", ok: /[A-Za-z]/.test(password) },
        { label: "숫자 포함", ok: /\d/.test(password) },
        { label: "특수문자 포함", ok: /[^A-Za-z\d\s]/.test(password) },
        { label: "이메일 아이디 미포함", ok: !emailName(email) || !password.toLowerCase().includes(emailName(email)) },
    ];

    return (
        <div className="grid gap-1 rounded-lg bg-gray-50 px-3 py-2 text-xs sm:grid-cols-2">
            {rules.map((rule) => (
                <span key={rule.label} className={rule.ok ? "text-emerald-600" : "text-gray-400"}>
                    {rule.ok ? "통과" : "필요"} {rule.label}
                </span>
            ))}
        </div>
    );
}

function validatePassword(password: string, email: string) {
    if (password.length < 8 || password.length > 64) return "비밀번호는 8~64자로 입력해주세요.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z\d\s]/.test(password)) {
        return "비밀번호는 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.";
    }
    const name = emailName(email);
    if (name && password.toLowerCase().includes(name)) return "비밀번호에는 이메일 아이디를 포함할 수 없습니다.";
    return "";
}

function emailName(email: string) {
    return email.includes("@") ? email.slice(0, email.indexOf("@")).toLowerCase() : "";
}

async function readError(res: Response) {
    const text = await res.text();
    return text || "요청 처리에 실패했습니다.";
}
