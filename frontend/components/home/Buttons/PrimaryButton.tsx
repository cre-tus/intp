"use client";

import { createPaymentRequest } from "@/lib/payments";
import {
    createEmptyTravelPlan,
    createRouteSheetTravelPlan,
    createSpreadsheetTravelPlan,
    createTimelineTravelPlan,
    generatePlanId,
    saveTravelPlan,
    type ChildAgeBucket,
    type CompanionType,
    type GroupAgeBucket,
    type TravelCountryCode,
    type TravelPlanTemplate,
    type TravelPlanTier,
} from "@/lib/travelPlans";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

type Step = "template" | "tier" | "payment";

const companionOptions: Array<{ value: CompanionType; label: string }> = [
    { value: "unknown", label: "미정" },
    { value: "solo", label: "혼자" },
    { value: "couple", label: "커플/부부" },
    { value: "friends", label: "친구끼리" },
    { value: "parents_only", label: "부모끼리" },
    { value: "family_with_young_child", label: "어린 자녀와 가족" },
    { value: "family_with_child", label: "초등 자녀와 가족" },
    { value: "family_with_teen", label: "청소년 자녀와 가족" },
    { value: "multi_generation", label: "3대 가족" },
];

const childAgeOptions: Array<{ value: ChildAgeBucket; label: string }> = [
    { value: "none", label: "자녀 없음" },
    { value: "unknown", label: "미정" },
    { value: "infant", label: "영아" },
    { value: "toddler", label: "유아" },
    { value: "preschool", label: "미취학" },
    { value: "lower_elementary", label: "초등 저학년" },
    { value: "upper_elementary", label: "초등 고학년" },
    { value: "teen", label: "청소년" },
];

const groupAgeOptions: Array<{ value: GroupAgeBucket; label: string }> = [
    { value: "unknown", label: "미정" },
    { value: "10s", label: "10대" },
    { value: "20s", label: "20대" },
    { value: "30s", label: "30대" },
    { value: "40s", label: "40대" },
    { value: "50s", label: "50대" },
    { value: "60s_plus", label: "60대 이상" },
    { value: "mixed", label: "연령대 섞임" },
];

const countryOptions: Array<{ value: TravelCountryCode; label: string; description: string }> = [
    { value: "KR", label: "대한민국", description: "한국 OSM/GTFS 기준으로 장소를 검색합니다." },
    { value: "JP", label: "일본", description: "일본 지역 기준으로 장소를 검색합니다." },
];

export default function PrimaryButton() {
    const router = useRouter();
    const { me } = useAuthStore();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>("template");
    const [title, setTitle] = useState("새 여행 일정");
    const [template, setTemplate] = useState<TravelPlanTemplate>("basic");
    const [countryCode, setCountryCode] = useState<TravelCountryCode>("KR");
    const [companionType, setCompanionType] = useState<CompanionType>("unknown");
    const [childAgeBucket, setChildAgeBucket] = useState<ChildAgeBucket>("unknown");
    const [groupAgeBucket, setGroupAgeBucket] = useState<GroupAgeBucket>("unknown");
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
        setCountryCode("KR");
        setCompanionType("unknown");
        setChildAgeBucket("unknown");
        setGroupAgeBucket("unknown");
        setSubmitting(false);
    };

    const createPlan = async (tier: TravelPlanTier) => {
        const id = generatePlanId();
        const safeTitle = title.trim() || (
            template === "spreadsheet"
                ? "테이블형 여행 일정"
                : template === "timeline"
                    ? "트립 보드 여행 일정"
                    : template === "route_sheet"
                        ? "Route Plan 여행 일정"
                        : "새 여행 일정"
        );
        const plan = template === "spreadsheet"
            ? createSpreadsheetTravelPlan(id, safeTitle, tier)
            : template === "timeline"
                ? createTimelineTravelPlan(id, safeTitle, tier)
                : template === "route_sheet"
                    ? createRouteSheetTravelPlan(id, safeTitle, tier)
                    : createEmptyTravelPlan(id, safeTitle, "basic", tier);

        const usesChildAge = isChildFamilyCompanion(companionType);
        plan.tripContext = {
            countryCode,
            companionType,
            childAgeBucket: usesChildAge ? childAgeBucket : "none",
            groupAgeBucket: usesChildAge ? "mixed" : groupAgeBucket,
            monthBucket: "unknown",
            seasonBucket: "unknown",
            rainySeason: false,
        };

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
            setError(readRequestError(err, "여행 일정을 생성하지 못했습니다."));
        } finally {
            setSubmitting(false);
        }
    };

    const submitPaidRequest = async () => {
        if (submitting) return;
        if (!depositorName.trim() || !depositBank.trim() || !accountNumber.trim()) {
            setError("입금자명, 은행명, 계좌번호를 입력해주세요.");
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
                className="flex h-[52px] items-center justify-center rounded-xl bg-gray-950 px-6 font-[var(--font-paperlogy)] text-base font-semibold text-white shadow-lg shadow-gray-950/15 transition hover:-translate-y-0.5 hover:bg-black hover:shadow-xl sm:text-lg"
            >
                여행 만들기
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-2xl">
                        {step === "template" && (
                            <>
                                <DialogTitle title="일정 방식 선택" description="처음부터 만들거나 표 형태로 정리할 수 있습니다." />
                                <PlanNameInput title={title} setTitle={setTitle} />
                                <TripContextFields
                                    countryCode={countryCode}
                                    companionType={companionType}
                                    childAgeBucket={childAgeBucket}
                                    groupAgeBucket={groupAgeBucket}
                                    onCountryCodeChange={setCountryCode}
                                    onCompanionTypeChange={setCompanionType}
                                    onChildAgeBucketChange={setChildAgeBucket}
                                    onGroupAgeBucketChange={setGroupAgeBucket}
                                />
                                <TemplateButton
                                    active={template === "basic"}
                                    title="기본 일정"
                                    description="날짜별 코스, 체크리스트, 장소 기반 경로 계산을 포함합니다."
                                    onClick={() => setTemplate("basic")}
                                />
                                <TemplateButton
                                    active={template === "spreadsheet"}
                                    title="테이블형 일정"
                                    description="시간과 칸 크기를 직접 조절하며 셀 단위로 편집하는 방식입니다."
                                    onClick={() => setTemplate("spreadsheet")}
                                />
                                <TemplateButton
                                    active={template === "timeline"}
                                    title="트립 보드"
                                    description="Day별 보드와 스팟 카드로 여행 흐름을 한눈에 보는 디자인입니다."
                                    onClick={() => setTemplate("timeline")}
                                />
                                <TemplateButton
                                    active={template === "route_sheet"}
                                    title="Route Plan"
                                    description="경로도, 시간표, 맛집 정보를 한 화면에 정리하는 스타일입니다."
                                    onClick={() => setTemplate("route_sheet")}
                                />
                                <DialogActions onCancel={close} onNext={() => setStep("tier")} nextLabel="다음" />
                            </>
                        )}

                        {step === "tier" && (
                            <>
                                <DialogTitle title="버전 선택" description="필요한 기능 범위에 맞춰 선택해주세요." />
                                <TierButton
                                    active={selectedTier === "FREE"}
                                    title="무료 버전"
                                    price="0원"
                                    features={["TSP 노드 최대 10개", "기본 장소 검색과 경로 비교", "공유 일정 편집"]}
                                    onClick={() => setSelectedTier("FREE")}
                                />
                                <TierButton
                                    active={selectedTier === "PENDING_PAID"}
                                    title="유료 버전"
                                    price="3,500원"
                                    features={["TSP 노드 최대 20개", "Google 장소 검색 연동 준비", "템플릿 확장 기능"]}
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
                                <DialogTitle title="입금 정보 입력" description="관리자 확인 후 해당 일정이 유료 버전으로 전환됩니다." />
                                <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                                    <div>결제 금액: <strong>3,500원</strong></div>
                                    <div className="mt-2 border-t border-gray-200 pt-2 text-xs text-gray-500">
                                        입금 계좌: <strong className="font-bold text-gray-900">352-0358-5355-13 농협 윤진영</strong>
                                    </div>
                                </div>
                                <PaymentInput label="입금자명" value={depositorName} onChange={setDepositorName} />
                                <PaymentInput label="은행명" value={depositBank} onChange={setDepositBank} />
                                <PaymentInput label="계좌번호" value={accountNumber} onChange={setAccountNumber} />
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
            <label className="mt-5 block text-sm font-semibold text-gray-700">여행 이름</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950" />
        </>
    );
}

function PaymentInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <>
            <label className="mt-4 block text-sm font-semibold text-gray-700">{label}</label>
            <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950" />
        </>
    );
}

function TripContextFields({
    countryCode,
    companionType,
    childAgeBucket,
    groupAgeBucket,
    onCountryCodeChange,
    onCompanionTypeChange,
    onChildAgeBucketChange,
    onGroupAgeBucketChange,
}: {
    countryCode: TravelCountryCode;
    companionType: CompanionType;
    childAgeBucket: ChildAgeBucket;
    groupAgeBucket: GroupAgeBucket;
    onCountryCodeChange: (value: TravelCountryCode) => void;
    onCompanionTypeChange: (value: CompanionType) => void;
    onChildAgeBucketChange: (value: ChildAgeBucket) => void;
    onGroupAgeBucketChange: (value: GroupAgeBucket) => void;
}) {
    const usesChildAge = isChildFamilyCompanion(companionType);

    return (
        <div className="mt-5 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
                <SelectField label="여행 국가" value={countryCode} onChange={(value) => onCountryCodeChange(value as TravelCountryCode)}>
                    {countryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                    {countryOptions.find((option) => option.value === countryCode)?.description}
                </p>
            </div>
            <SelectField label="동행 유형" value={companionType} onChange={(value) => onCompanionTypeChange(value as CompanionType)}>
                {companionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            {usesChildAge ? (
                <SelectField label="자녀 연령" value={childAgeBucket} onChange={(value) => onChildAgeBucketChange(value as ChildAgeBucket)}>
                    {childAgeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
            ) : (
                <SelectField label="주 연령대" value={groupAgeBucket} onChange={(value) => onGroupAgeBucketChange(value as GroupAgeBucket)}>
                    {groupAgeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
            )}
        </div>
    );
}

function isChildFamilyCompanion(value: CompanionType) {
    return value === "family_with_young_child" || value === "family_with_child" || value === "family_with_teen";
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
    return (
        <label className="block">
            <span className="text-xs font-black text-gray-600">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-900 focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
            >
                {children}
            </select>
        </label>
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
