"use client";

import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import { approvePaymentRequest, loadPaymentRequests, type PaymentRequest } from "@/lib/payments";
import { useAuthStore } from "@/stores/authStore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function AdminPaymentsPage() {
    const { me, fetchMe } = useAuthStore();
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const refresh = async () => {
        setLoading(true);
        setError("");
        try {
            setRequests(await loadPaymentRequests());
        } catch (error) {
            setError(readPaymentError(error, "결제 요청 목록을 불러오지 못했습니다."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchMe();
    }, [fetchMe]);

    useEffect(() => {
        if (me?.role === "ADMIN") void refresh();
    }, [me?.role]);

    const sorted = useMemo(
        () => requests.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        [requests],
    );

    const approve = async (id: number) => {
        if (!window.confirm("입금 확인 완료 처리하고 해당 템플릿 ID를 유료 버전으로 변경할까요?")) return;
        try {
            await approvePaymentRequest(id);
            await refresh();
        } catch (error) {
            await refresh();
            setError(readPaymentError(error, "결제 승인 처리에 실패했습니다."));
        }
    };

    if (me?.role !== "ADMIN") {
        return (
            <RequireAuth>
                <Header />
                <main className="mx-auto max-w-3xl px-6 py-10">
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h1 className="text-2xl font-bold text-gray-950">접근 권한 없음</h1>
                        <p className="mt-2 text-sm text-gray-600">결제 관리는 관리자만 사용할 수 있습니다.</p>
                    </div>
                </main>
            </RequireAuth>
        );
    }

    return (
        <RequireAuth>
            <main className="min-h-screen bg-gray-50">
                <Header />
                <section className="mx-auto max-w-6xl px-6 py-10">
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-950">결제 관리하기</h1>
                            <p className="mt-2 text-sm text-gray-500">입금 확인 후 템플릿 ID별 유료 버전 적용을 처리합니다.</p>
                        </div>
                        <Link href="/admin/server-test" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                            서버 테스트
                        </Link>
                    </div>

                    {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

                    {loading ? (
                        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm font-semibold text-gray-500">
                            불러오는 중...
                        </div>
                    ) : sorted.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
                            결제 신청이 없습니다.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                            <div className="overflow-auto">
                                <table className="w-full min-w-[1080px] border-collapse text-sm">
                                    <thead className="bg-gray-50 text-left">
                                    <tr>
                                        <Th>상태</Th>
                                        <Th>템플릿</Th>
                                        <Th>요청자</Th>
                                        <Th>입금자명</Th>
                                        <Th>은행명</Th>
                                        <Th>입금계좌</Th>
                                        <Th align="right">금액</Th>
                                        <Th>요청일시</Th>
                                        <Th>승인일시</Th>
                                        <Th>관리</Th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {sorted.map((request) => (
                                        <tr key={request.id}>
                                            <Td><StatusBadge status={request.status} /></Td>
                                            <Td>
                                                <div className="font-bold text-gray-950">{request.planTitle}</div>
                                                <div className="mt-1 text-xs text-gray-500">{request.planId}</div>
                                                <div className="mt-1 text-xs text-gray-400">템플릿 ID별로 승인 상태가 적용됩니다.</div>
                                            </Td>
                                            <Td>
                                                <div>{request.requesterNickname || request.requesterEmail}</div>
                                                <div className="mt-1 text-xs text-gray-500">{request.requesterEmail}</div>
                                            </Td>
                                            <Td>{request.depositorName}</Td>
                                            <Td>{request.depositBank}</Td>
                                            <Td>{request.depositAccount}</Td>
                                            <Td align="right">{request.amount.toLocaleString()}원</Td>
                                            <Td>{new Date(request.createdAt).toLocaleString("ko-KR")}</Td>
                                            <Td>{request.approvedAt ? new Date(request.approvedAt).toLocaleString("ko-KR") : "-"}</Td>
                                            <Td>
                                                <button
                                                    type="button"
                                                    onClick={() => void approve(request.id)}
                                                    disabled={request.status === "APPROVED"}
                                                    className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                                                >
                                                    결제 확인 완료
                                                </button>
                                            </Td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </RequireAuth>
    );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
    return <th className={`border-b px-4 py-3 font-bold text-gray-700 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
    return <td className={`border-b px-4 py-3 text-gray-700 ${align === "right" ? "text-right" : "text-left"}`}>{children}</td>;
}

function StatusBadge({ status }: { status: PaymentRequest["status"] }) {
    return status === "APPROVED"
        ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">승인 완료</span>
        : <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">대기</span>;
}

function readPaymentError(error: unknown, fallback: string) {
    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as { response?: { data?: unknown; status?: number } }).response;
        if (typeof response?.data === "string" && response.data.trim()) return response.data;
        if (response?.status) return `${fallback} (HTTP ${response.status})`;
    }
    return fallback;
}
