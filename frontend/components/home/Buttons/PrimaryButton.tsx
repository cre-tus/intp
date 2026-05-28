"use client";

import { createPaymentRequest } from "@/lib/payments";
import {
    createEmptyTravelPlan,
    createSpreadsheetTravelPlan,
    generatePlanId,
    saveTravelPlan,
    type TravelPlanTemplate,
    type TravelPlanTier,
} from "@/lib/travelPlans";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "template" | "tier" | "payment";

export default function PrimaryButton() {
    const router = useRouter();
    const { me } = useAuthStore();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>("template");
    const [title, setTitle] = useState("신규 여행 일정표");
    const [template, setTemplate] = useState<TravelPlanTemplate>("basic");
    const [selectedTier, setSelectedTier] = useState<TravelPlanTier>("FREE");
    const [depositorName, setDepositorName] = useState("");
    const [depositBank, setDepositBank] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const close = () => {
        setOpen(false);
        setStep("template");
        setError("");
        setDepositorName("");
        setDepositBank("");
        setAccountNumber("");
        setSelectedTier("FREE");
        setSubmitting(false);
    };

    const createPlan = async (tier: TravelPlanTier) => {
        const id = generatePlanId();
        const safeTitle = title.trim() || (template === "spreadsheet" ? "엑셀형 여행 일정표" : "신규 여행 일정표");
        const plan = template === "spreadsheet"
            ? createSpreadsheetTravelPlan(id, safeTitle, tier)
            : createEmptyTravelPlan(id, safeTitle, "basic", tier);

        if (me?.email) {
            plan.participants = [{
                id: me.id,
                name: me.nickname || me.email.split("@")[0] || me.email,
                email: me.email,
                role: "OWNER",
            }];
        }
        return saveTravelPlan(plan);
    };

    const createFreePlan = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const plan = await createPlan("FREE");
            close();
            router.push(`/createplan/${plan.id}`);
        } catch (err) {
            setError(readRequestError(err, "여행 계획 생성에 실패했습니다."));
        } finally {
            setSubmitting(false);
        }
    };

    const submitPaidRequest = async () => {
        if (submitting) return;
        if (!depositorName.trim() || !depositBank.trim() || !accountNumber.trim()) {
            setError("입금자명, 은행명, 계좌번호를 입력해 주세요.");
            return;
        }
        setSubmitting(true);
        try {
            const plan = await createPlan("PENDING_PAID");
            await createPaymentRequest({
                planId: plan.id,
                planTitle: plan.title,
                depositorName: depositorName.trim(),
                depositBank: depositBank.trim(),
                depositAccount: accountNumber.trim(),
            });
            close();
            router.push(`/createplan/${plan.id}`);
        } catch (err) {
            setError(readRequestError(err, "결제 요청 저장에 실패했습니다."));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-[50px] items-center justify-center rounded-[12px] bg-black px-[20px] font-[var(--font-paperlogy)] text-[18px] font-medium text-white transition hover:bg-gray-900"
            >
                Create
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-2xl">
                        {step === "template" && (
                            <>
                                <DialogTitle title="템플릿 선택" description="여행 계획 작성 방식을 선택해 주세요." />
                                <PlanNameInput title={title} setTitle={setTitle} />
                                <TemplateButton
                                    active={template === "basic"}
                                    title="기본형 템플릿"
                                    description="체크리스트, Day별 일정, 지도 TSP 경로 패널을 포함합니다."
                                    onClick={() => setTemplate("basic")}
                                />
                                <TemplateButton
                                    active={template === "spreadsheet"}
                                    title="엑셀형 템플릿"
                                    description="시간표와 비용 행을 셀 단위로 편집하는 일정표입니다."
                                    onClick={() => setTemplate("spreadsheet")}
                                />
                                <DialogActions onCancel={close} onNext={() => setStep("tier")} nextLabel="다음" />
                            </>
                        )}

                        {step === "tier" && (
                            <>
                                <DialogTitle title="버전 선택" description="템플릿 ID별로 적용되는 기능 범위를 선택해 주세요." />
                                <TierButton
                                    active={selectedTier === "FREE"}
                                    title="무료 버전"
                                    price="0원"
                                    features={["TSP 노드 최대 10개", "Leaflet + 로컬 타일 서버 고정", "기본 위치 검색 및 경로 비교"]}
                                    onClick={() => setSelectedTier("FREE")}
                                />
                                <TierButton
                                    active={selectedTier === "PENDING_PAID"}
                                    title="유료 버전"
                                    price="3,500원"
                                    features={["TSP 노드 최대 20개", "Google 장소 검색 연동 준비", "승인된 템플릿 ID에서만 유료 기능 사용"]}
                                    onClick={() => setSelectedTier("PENDING_PAID")}
                                />
                                {error && <ErrorBox message={error} />}
                                <div className="mt-6 flex justify-end gap-2">
                                    <button type="button" onClick={() => setStep("template")} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900">이전</button>
                                    <button
                                        type="button"
                                        onClick={selectedTier === "FREE" ? () => void createFreePlan() : () => setStep("payment")}
                                        disabled={submitting}
                                        className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300"
                                    >
                                        {selectedTier === "FREE" ? (submitting ? "생성 중..." : "무료로 생성") : "결제하기"}
                                    </button>
                                </div>
                            </>
                        )}

                        {step === "payment" && (
                            <>
                                <DialogTitle title="입금 정보 입력" description="관리자가 입금 확인 완료를 누르면 해당 템플릿 ID가 유료 버전으로 승격됩니다." />
                                <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                                    <div>결제 금액: <strong>3,500원</strong></div>
                                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                                        입금 계좌: <strong className="text-gray-900 font-bold">352-0358-5355-13 (농협 윤진영)</strong>
                                    </div>
                                </div>
                                <label className="mt-5 block text-sm font-semibold text-gray-700">입금자명</label>
                                <input value={depositorName} onChange={(event) => setDepositorName(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950" />
                                <label className="mt-4 block text-sm font-semibold text-gray-700">은행명</label>
                                <input value={depositBank} onChange={(event) => setDepositBank(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950" />
                                <label className="mt-4 block text-sm font-semibold text-gray-700">계좌번호</label>
                                <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950" />
                                {error && <ErrorBox message={error} />}
                                <div className="mt-6 flex justify-end gap-2">
                                    <button type="button" onClick={() => setStep("tier")} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900">이전</button>
                                    <button type="button" onClick={() => void submitPaidRequest()} disabled={submitting} className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300">
                                        {submitting ? "요청 중..." : "결제 요청"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

function readRequestError(err: unknown, fallback: string) {
    if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { data?: string | { message?: string } } }).response;
        if (typeof response?.data === "string" && response.data) return response.data;
        if (typeof response?.data === "object" && response.data?.message) return response.data.message;
    }
    return fallback;
}

function DialogTitle({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <div className="text-xl font-bold text-gray-950">{title}</div>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
    );
}

function PlanNameInput({ title, setTitle }: { title: string; setTitle: (value: string) => void }) {
    return (
        <>
            <label className="mt-5 block text-sm font-semibold text-gray-700">여행 계획 이름</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950" />
        </>
    );
}

function TemplateButton({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className={`mt-3 w-full rounded-lg border-2 p-4 text-left ${active ? "border-gray-950 bg-gray-50" : "border-gray-200 bg-white"}`}>
            <div className="font-bold text-gray-950">{title}</div>
            <div className="mt-1 text-sm text-gray-500">{description}</div>
        </button>
    );
}

function TierButton({ active, title, price, features, onClick }: { active: boolean; title: string; price: string; features: string[]; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className={`mt-4 w-full rounded-lg border-2 p-4 text-left ${active ? "border-gray-950 bg-gray-50" : "border-gray-200 bg-white"}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="font-bold text-gray-950">{title}</div>
                <div className="rounded-full bg-gray-950 px-3 py-1 text-xs font-bold text-white">{price}</div>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
                {features.map((feature) => <li key={feature}>- {feature}</li>)}
            </ul>
        </button>
    );
}

function DialogActions({ onCancel, onNext, nextLabel }: { onCancel: () => void; onNext: () => void; nextLabel: string }) {
    return (
        <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900">취소</button>
            <button type="button" onClick={onNext} className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white">{nextLabel}</button>
        </div>
    );
}

function ErrorBox({ message }: { message: string }) {
    return (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {message}
        </div>
    );
}
