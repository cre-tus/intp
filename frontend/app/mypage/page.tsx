"use client";

import Header from "@/app/header";
import PrimaryButton from "@/components/home/Buttons/PrimaryButton";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import {
    deleteTravelPlan,
    loadSharedTravelPlanIndex,
    loadTravelPlanIndex,
    type TravelPlanIndexItem,
} from "@/lib/travelPlans";
import { useAuthStore } from "@/stores/authStore";
import {
    loadMyFollowers,
    loadMyFollowing,
    loadMyFollowStats,
    toggleUserFollow,
    type FollowStats,
    type FollowUser,
} from "@/lib/follows";
import { Bell, Camera, ChevronRight, Globe2, LockKeyhole, Minus, Pencil, Plus, Shield, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

export default function MyPage() {
    const { me, fetchMe } = useAuthStore();
    const [plans, setPlans] = useState<TravelPlanIndexItem[]>([]);
    const [sharedPlans, setSharedPlans] = useState<TravelPlanIndexItem[]>([]);
    const [showAllPlans, setShowAllPlans] = useState(false);
    const [showAllSharedPlans, setShowAllSharedPlans] = useState(false);
    const [followStats, setFollowStats] = useState<FollowStats>({ userId: 0, followers: 0, following: 0 });
    const [followDialogOpen, setFollowDialogOpen] = useState(false);
    const [followDialogTab, setFollowDialogTab] = useState<"followers" | "following">("followers");
    const [followers, setFollowers] = useState<FollowUser[]>([]);
    const [following, setFollowing] = useState<FollowUser[]>([]);
    const [followListLoading, setFollowListLoading] = useState(false);
    const [accountInfoUnlocked, setAccountInfoUnlocked] = useState(false);
    const [accountInfoUnlocking, setAccountInfoUnlocking] = useState(false);
    const [accountPasswordDialogOpen, setAccountPasswordDialogOpen] = useState(false);
    const [accountPassword, setAccountPassword] = useState("");
    const [accountPasswordError, setAccountPasswordError] = useState("");
    const [profileStatusMessage, setProfileStatusMessage] = useState("");
    const [profileImageUrl, setProfileImageUrl] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileNotice, setProfileNotice] = useState("");
    const [statusEditing, setStatusEditing] = useState(false);
    const [statusDraft, setStatusDraft] = useState("");
    const [cropSource, setCropSource] = useState("");

    useEffect(() => {
        void fetchMe();
        const refresh = () => {
            void Promise.all([
                loadTravelPlanIndex().catch(() => []),
                loadSharedTravelPlanIndex().catch(() => []),
                loadMyFollowStats().catch(() => ({ userId: me?.id ?? 0, followers: 0, following: 0 })),
            ]).then(([owned, shared, stats]) => {
                setPlans(owned);
                setSharedPlans(shared);
                setFollowStats(stats);
            });
        };
        refresh();
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [fetchMe, me?.id]);

    useEffect(() => {
        setAccountInfoUnlocked(false);
        setAccountPasswordDialogOpen(false);
        setAccountPassword("");
        setAccountPasswordError("");
        setProfileStatusMessage(me?.statusMessage ?? "");
        setStatusDraft(me?.statusMessage ?? "");
        setProfileImageUrl(me?.profileImageUrl ?? "");
        setProfileNotice("");
    }, [me?.email, me?.profileImageUrl, me?.statusMessage]);

    useEffect(() => {
        setProfileStatusMessage(me?.statusMessage ?? "");
        setStatusDraft(me?.statusMessage ?? "");
        setProfileImageUrl(me?.profileImageUrl ?? "");
    }, [me?.profileImageUrl, me?.statusMessage]);

    const sortedPlans = useSortedPlans(plans);
    const sortedSharedPlans = useSortedPlans(sharedPlans);
    const visiblePlans = showAllPlans ? sortedPlans : sortedPlans.slice(0, 3);
    const visibleSharedPlans = showAllSharedPlans ? sortedSharedPlans : sortedSharedPlans.slice(0, 3);
    const roleLabel = me?.role === "ADMIN" ? "관리자" : "사용자";
    const fullName = [me?.firstName, me?.lastName].filter(Boolean).join(" ") || "-";

    const openFollowDialog = async (tab: "followers" | "following") => {
        setFollowDialogTab(tab);
        setFollowDialogOpen(true);
        setFollowListLoading(true);
        try {
            const [nextFollowers, nextFollowing] = await Promise.all([
                loadMyFollowers().catch(() => []),
                loadMyFollowing().catch(() => []),
            ]);
            setFollowers(nextFollowers);
            setFollowing(nextFollowing);
        } finally {
            setFollowListLoading(false);
        }
    };

    const handleToggleFollow = async (user: FollowUser) => {
        const result = await toggleUserFollow(user.userId);
        const patch = (item: FollowUser) => item.userId === user.userId ? { ...item, following: result.following } : item;
        setFollowers((current) => current.map(patch));
        setFollowing((current) => result.following
            ? current.map(patch)
            : current.filter((item) => item.userId !== user.userId));
        setFollowStats((current) => ({
            ...current,
            followers: result.userId === current.userId ? result.followers : current.followers,
            following: result.followingCount,
        }));
    };

    const openAccountPasswordDialog = () => {
        setAccountPassword("");
        setAccountPasswordError("");
        setAccountPasswordDialogOpen(true);
    };

    const closeAccountPasswordDialog = () => {
        if (accountInfoUnlocking) return;
        setAccountPasswordDialogOpen(false);
        setAccountPassword("");
        setAccountPasswordError("");
    };

    const unlockAccountInfo = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!me?.email || accountInfoUnlocking) return;
        const password = accountPassword.trim();
        if (!password) {
            setAccountPasswordError("비밀번호를 입력해주세요.");
            return;
        }

        setAccountPasswordError("");
        setAccountInfoUnlocking(true);
        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    email: me.email.trim().toLowerCase(),
                    password,
                    rememberMe: false,
                }),
            });

            if (!response.ok) {
                setAccountPasswordError("비밀번호가 일치하지 않습니다.");
                return;
            }

            setAccountInfoUnlocked(true);
            setAccountPasswordDialogOpen(false);
            setAccountPassword("");
            void fetchMe();
        } catch {
            setAccountPasswordError("비밀번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setAccountInfoUnlocking(false);
        }
    };

    const handleProfileImage = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                setCropSource(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const saveProfilePatch = async (patch?: { statusMessage?: string; profileImageUrl?: string }) => {
        const nextStatusMessage = patch?.statusMessage ?? profileStatusMessage;
        const nextProfileImageUrl = patch?.profileImageUrl ?? profileImageUrl;
        setProfileStatusMessage(nextStatusMessage);
        setStatusDraft(nextStatusMessage);
        setProfileImageUrl(nextProfileImageUrl);
        await saveProfileWithValues(nextStatusMessage, nextProfileImageUrl);
    };

    const saveProfileWithValues = async (nextStatusMessage: string, nextProfileImageUrl: string) => {
        setProfileSaving(true);
        setProfileNotice("");
        try {
            const response = await fetch("/api/auth/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    statusMessage: nextStatusMessage,
                    profileImageUrl: nextProfileImageUrl,
                }),
            });
            if (!response.ok) {
                setProfileNotice("프로필 저장에 실패했습니다.");
                return;
            }
            setStatusEditing(false);
            await fetchMe();
            setProfileNotice("프로필이 저장되었습니다.");
        } catch {
            setProfileNotice("프로필 저장 중 오류가 발생했습니다.");
        } finally {
            setProfileSaving(false);
        }
    };

    const removePlan = async (plan: TravelPlanIndexItem) => {
        if (!window.confirm(`"${plan.title}" 여행 계획을 정말로 삭제하시겠습니까?`)) return;
        if (
            plan.tier !== "FREE"
            && !window.confirm("유료 버전 여행 계획입니다. 삭제하면 복구할 수 없습니다. 다시 한번 삭제하시겠습니까?")
        ) {
            return;
        }

        try {
            await deleteTravelPlan(plan.id);
        } catch (error) {
            window.alert(readDeleteError(error));
        } finally {
            setPlans(await loadTravelPlanIndex());
            setSharedPlans(await loadSharedTravelPlanIndex());
        }
    };

    return (
        <RequireAuth>
            <main className="min-h-screen bg-gray-50">
                <Header />
                <section className="mx-auto max-w-3xl px-5 py-8">
                    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <div className="h-24 bg-gradient-to-r from-slate-900 to-slate-600" />
                        <div className="px-6 pb-6">
                            <div className="-mt-12 flex items-end gap-3">
                                <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-black text-3xl font-black text-white shadow-sm">
                                    {profileImageUrl ? (
                                        <img src={profileImageUrl} alt="프로필 사진" className="h-full w-full object-cover" />
                                    ) : (
                                        (me?.nickname || me?.email || "U").slice(0, 1)
                                    )}
                                </div>
                                <label className="mb-1 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition hover:border-gray-950 hover:text-gray-950">
                                    <Camera className="h-4 w-4" />
                                    사진 변경
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={(event) => handleProfileImage(event.target.files?.[0])}
                                    />
                                </label>
                            </div>
                            <div className="mt-4">
                                <div className="flex items-baseline gap-2">
                                    <h1 className="text-2xl font-bold text-gray-950">{me?.nickname || "사용자"}</h1>
                                    <span className="text-sm font-medium text-gray-400">{roleLabel}</span>
                                </div>
                                <div className="mt-1 flex min-w-0 items-center gap-2">
                                    {statusEditing ? (
                                        <>
                                            <input
                                                value={statusDraft}
                                                onChange={(event) => setStatusDraft(event.target.value)}
                                                maxLength={160}
                                                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-950 focus:bg-white"
                                                placeholder="상태메시지를 입력하세요"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void saveProfilePatch({ statusMessage: statusDraft })}
                                                disabled={profileSaving}
                                                className="rounded-lg bg-gray-950 px-3 py-1.5 text-xs font-black text-white transition hover:bg-black disabled:cursor-wait disabled:bg-gray-400"
                                            >
                                                저장
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setStatusDraft(profileStatusMessage);
                                                    setStatusEditing(false);
                                                }}
                                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-black text-gray-600 transition hover:border-gray-950 hover:text-gray-950"
                                            >
                                                취소
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="min-w-0 truncate text-sm text-gray-500">{profileStatusMessage || "상태메시지를 입력하세요"}</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setStatusDraft(profileStatusMessage);
                                                    setStatusEditing(true);
                                                }}
                                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-gray-950 hover:text-gray-950"
                                                aria-label="상태메시지 수정"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                                {profileNotice && <p className="mt-2 text-xs font-bold text-blue-600">{profileNotice}</p>}
                            </div>
                            <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-100 sm:grid-cols-5">
                                <Stat value={plans.length} label="내 계획" />
                                <Stat value={sharedPlans.length} label="참여 계획" />
                                <Stat value={followStats.followers} label="팔로워" onClick={() => void openFollowDialog("followers")} />
                                <Stat value={followStats.following} label="팔로우" onClick={() => void openFollowDialog("following")} />
                                <Stat value={plans.length + sharedPlans.length} label="전체" />
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Link
                                    href="/community/me"
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 transition hover:border-gray-950 hover:text-gray-950"
                                >
                                    나의 피드 보기
                                </Link>
                            </div>
                        </div>
                    </section>

                    <SectionTitle title="계정 정보" />
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        {accountInfoUnlocked ? (
                            <div>
                                <InfoRow label="성명" value={fullName} />
                                <InfoRow label="닉네임" value={me?.nickname || "-"} />
                                <InfoRow label="이메일" value={me?.email || "-"} />
                                <InfoRow label="생년월일" value={me?.birth || "-"} />
                                <InfoRow label="권한" value={roleLabel} />
                            </div>
                        ) : (
                            <div className="select-none blur-[3px]" aria-hidden="true">
                                <InfoRow label="성명" value="홍길동" />
                                <InfoRow label="닉네임" value="여행자" />
                                <InfoRow label="이메일" value="sample@example.com" />
                                <InfoRow label="생년월일" value="1999-01-01" />
                                <InfoRow label="권한" value="사용자" />
                            </div>
                        )}
                        {!accountInfoUnlocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                <button
                                    type="button"
                                    onClick={openAccountPasswordDialog}
                                    disabled={accountInfoUnlocking}
                                    className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                                >
                                    <LockKeyhole className="h-4 w-4" />
                                    {accountInfoUnlocking ? "확인 중..." : "비밀번호 입력"}
                                </button>
                            </div>
                        )}
                    </div>

                    <PlanSection
                        title="내 여행 계획"
                        plans={visiblePlans}
                        totalCount={sortedPlans.length}
                        showAll={showAllPlans}
                        onToggleShowAll={() => setShowAllPlans((value) => !value)}
                        emptyText="아직 만든 계획이 없습니다."
                        emptyAction
                        onRemove={(plan) => void removePlan(plan)}
                    />

                    <PlanSection
                        title="참여 가능한 계획"
                        plans={visibleSharedPlans}
                        totalCount={sortedSharedPlans.length}
                        showAll={showAllSharedPlans}
                        onToggleShowAll={() => setShowAllSharedPlans((value) => !value)}
                        emptyText="참여 가능한 계획이 없습니다."
                    />

                    <SectionTitle title="설정" />
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <SettingRow
                            icon={<Bell className="h-4 w-4" />}
                            label="알림"
                            trailing={<span className="h-6 w-11 rounded-full bg-black p-1"><span className="ml-auto block h-4 w-4 rounded-full bg-white" /></span>}
                        />
                        <SettingRow icon={<Globe2 className="h-4 w-4" />} label="언어" trailing={<span className="text-sm text-gray-400">한국어</span>} />
                        <SettingRow icon={<Shield className="h-4 w-4" />} label="보안 설정" trailing={<ChevronRight className="h-4 w-4 text-gray-300" />} />
                    </div>
                </section>
                {accountPasswordDialogOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-5">
                        <form
                            onSubmit={unlockAccountInfo}
                            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
                        >
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                                    <LockKeyhole className="h-5 w-5" />
                                </span>
                                <div>
                                    <h2 className="text-base font-black text-gray-950">비밀번호 입력</h2>
                                    <p className="mt-1 text-xs font-medium text-gray-500">계정 정보를 확인합니다.</p>
                                </div>
                            </div>

                            <div className="mt-5">
                                <label htmlFor="account-password" className="text-sm font-bold text-gray-800">
                                    비밀번호
                                </label>
                                <input
                                    id="account-password"
                                    type="password"
                                    value={accountPassword}
                                    onChange={(event) => {
                                        setAccountPassword(event.target.value);
                                        setAccountPasswordError("");
                                    }}
                                    autoComplete="current-password"
                                    autoFocus
                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-gray-400 focus:ring-4 focus:ring-gray-900/5"
                                />
                                {accountPasswordError && (
                                    <p className="mt-2 text-sm font-semibold text-red-600">{accountPasswordError}</p>
                                )}
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeAccountPasswordDialog}
                                    disabled={accountInfoUnlocking}
                                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={accountInfoUnlocking}
                                    className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                                >
                                    {accountInfoUnlocking ? "확인 중..." : "확인"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                {cropSource && (
                    <ProfileCropDialog
                        source={cropSource}
                        onClose={() => setCropSource("")}
                        onApply={(cropped) => {
                            setCropSource("");
                            void saveProfilePatch({ profileImageUrl: cropped });
                        }}
                    />
                )}
                {followDialogOpen && (
                    <FollowListDialog
                        activeTab={followDialogTab}
                        followers={followers}
                        following={following}
                        loading={followListLoading}
                        onTabChange={setFollowDialogTab}
                        onClose={() => setFollowDialogOpen(false)}
                        onToggleFollow={(user) => void handleToggleFollow(user)}
                    />
                )}
            </main>
        </RequireAuth>
    );
}

function useSortedPlans(plans: TravelPlanIndexItem[]) {
    return useMemo(
        () => [...plans].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        [plans],
    );
}

function readDeleteError(error: unknown) {
    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as { response?: { data?: unknown } }).response;
        if (typeof response?.data === "string" && response.data.trim()) return response.data;
    }
    return "계획을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function PlanSection({
    title,
    plans,
    totalCount,
    showAll,
    onToggleShowAll,
    emptyText,
    emptyAction = false,
    onRemove,
}: {
    title: string;
    plans: TravelPlanIndexItem[];
    totalCount: number;
    showAll: boolean;
    onToggleShowAll: () => void;
    emptyText: string;
    emptyAction?: boolean;
    onRemove?: (plan: TravelPlanIndexItem) => void;
}) {
    return (
        <>
            <div className="mt-7 mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-500">{title}</h2>
                {totalCount > 3 && (
                    <button type="button" onClick={onToggleShowAll} className="text-sm font-semibold text-gray-600 hover:text-gray-950">
                        {showAll ? "접기" : "전체 보기"}
                    </button>
                )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {plans.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                        <p className="text-sm font-semibold text-gray-700">{emptyText}</p>
                        {emptyAction && (
                            <div className="mt-4 flex justify-center">
                                <PrimaryButton />
                            </div>
                        )}
                    </div>
                ) : (
                    plans.map((plan) => <PlanRow key={plan.id} plan={plan} onRemove={onRemove ? () => onRemove(plan) : undefined} />)
                )}
            </div>
        </>
    );
}

function Stat({ value, label, onClick }: { value: number; label: string; onClick?: () => void }) {
    const Component = onClick ? "button" : "div";
    return (
        <Component
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={`border-b border-r border-gray-100 px-4 py-4 text-center even:border-r-0 last:border-b-0 sm:border-b-0 sm:even:border-r sm:last:border-r-0 ${
                onClick ? "transition hover:bg-gray-50" : ""
            }`}
        >
            <div className="text-lg font-black text-gray-950">{value}</div>
            <div className="mt-1 text-xs font-medium text-gray-500">{label}</div>
        </Component>
    );
}

function SectionTitle({ title }: { title: string }) {
    return <h2 className="mt-7 mb-3 text-sm font-bold text-gray-500">{title}</h2>;
}

function FollowListDialog({
    activeTab,
    followers,
    following,
    loading,
    onTabChange,
    onClose,
    onToggleFollow,
}: {
    activeTab: "followers" | "following";
    followers: FollowUser[];
    following: FollowUser[];
    loading: boolean;
    onTabChange: (tab: "followers" | "following") => void;
    onClose: () => void;
    onToggleFollow: (user: FollowUser) => void;
}) {
    const users = activeTab === "followers" ? followers : following;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
            <section className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="relative border-b border-gray-200 px-5 py-4 text-center">
                    <h2 className="text-base font-black text-gray-950">팔로우</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-3 top-3 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950"
                        aria-label="닫기"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>
                <div className="grid grid-cols-2 border-b border-gray-200">
                    <FollowTabButton active={activeTab === "followers"} onClick={() => onTabChange("followers")}>
                        팔로워 {followers.length.toLocaleString("ko-KR")}
                    </FollowTabButton>
                    <FollowTabButton active={activeTab === "following"} onClick={() => onTabChange("following")}>
                        팔로우 {following.length.toLocaleString("ko-KR")}
                    </FollowTabButton>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="px-5 py-12 text-center text-sm font-bold text-gray-500">목록을 불러오는 중입니다.</div>
                    ) : users.length === 0 ? (
                        <div className="px-5 py-12 text-center text-sm font-bold text-gray-500">
                            {activeTab === "followers" ? "아직 팔로워가 없습니다." : "아직 팔로우한 사용자가 없습니다."}
                        </div>
                    ) : (
                        users.map((user) => (
                            <div key={user.userId} className="flex items-center gap-3 px-4 py-3">
                                <ProfileAvatar value={user.avatar} />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-black text-gray-950">{user.nickname}</div>
                                    <div className="truncate text-xs font-semibold text-gray-500">{user.handle}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onToggleFollow(user)}
                                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                                        user.following
                                            ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                            : "bg-blue-600 text-white hover:bg-blue-700"
                                    }`}
                                >
                                    {user.following ? "팔로잉" : "팔로우"}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}

function FollowTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`border-b-2 px-4 py-3 text-sm font-black transition ${
                active ? "border-gray-950 text-gray-950" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
        >
            {children}
        </button>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 last:border-b-0">
            <div>
                <div className="text-xs font-medium text-gray-400">{label}</div>
                <div className="mt-1 text-sm font-semibold text-gray-950">{value}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
        </div>
    );
}

function PlanRow({ plan, onRemove }: { plan: TravelPlanIndexItem; onRemove?: () => void }) {
    return (
        <div className="flex items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-black text-gray-500">
                {new Date(plan.updatedAt).getDate()}일
            </div>
            <Link href={`/createplan/${plan.id}`} className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-black text-gray-950">{plan.title}</span>
                    <PlanBadge>{templateLabel(plan.template)}</PlanBadge>
                    <PlanBadge tone={plan.tier === "PAID" ? "paid" : plan.tier === "PENDING_PAID" ? "pending" : "free"}>
                        {tierLabel(plan.tier)}
                    </PlanBadge>
                </div>
                <div className="mt-1 text-xs text-gray-500">{new Date(plan.updatedAt).toLocaleDateString("ko-KR")}</div>
            </Link>
            <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500" title="참여자">
                    <Users className="h-4 w-4" />
                    {plan.participantCount}
                </span>
                {onRemove && (
                    <button type="button" onClick={onRemove} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="계획 삭제">
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
                <ChevronRight className="h-4 w-4 text-gray-300" />
            </div>
        </div>
    );
}

function PlanBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "free" | "pending" | "paid" }) {
    const toneClass = {
        neutral: "bg-gray-100 text-gray-600",
        free: "bg-slate-100 text-slate-700",
        pending: "bg-amber-100 text-amber-700",
        paid: "bg-emerald-100 text-emerald-700",
    }[tone];

    return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${toneClass}`}>{children}</span>;
}

function templateLabel(template: TravelPlanIndexItem["template"]) {
    if (template === "spreadsheet") return "스프레드시트";
    if (template === "timeline") return "트립 보드";
    if (template === "route_sheet") return "루트 시트";
    return "기본 템플릿";
}

function tierLabel(tier: TravelPlanIndexItem["tier"]) {
    if (tier === "PAID") return "유료";
    if (tier === "PENDING_PAID") return "승인 대기";
    return "무료";
}

function ProfileAvatar({ value }: { value: string }) {
    const isImage = value?.startsWith("data:image/") || value?.startsWith("http://") || value?.startsWith("https://");
    return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-950 text-sm font-black text-white">
            {isImage ? <img src={value} alt="프로필 사진" className="h-full w-full object-cover" /> : value}
        </div>
    );
}

function ProfileCropDialog({
    source,
    onClose,
    onApply,
}: {
    source: string;
    onClose: () => void;
    onApply: (cropped: string) => void;
}) {
    const [x, setX] = useState(50);
    const [y, setY] = useState(50);
    const [scale, setScale] = useState(1);
    const [dragging, setDragging] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const applyCrop = async () => {
        const image = await loadImage(source);
        const size = 320;
        const imageMinSize = Math.min(image.naturalWidth, image.naturalHeight);
        const cropSize = Math.min(imageMinSize, imageMinSize * (0.62 / scale));
        const centerX = (x / 100) * image.naturalWidth;
        const centerY = (y / 100) * image.naturalHeight;
        const sourceX = clamp(centerX - cropSize / 2, 0, image.naturalWidth - cropSize);
        const sourceY = clamp(centerY - cropSize / 2, 0, image.naturalHeight - cropSize);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.clearRect(0, 0, size, size);
        context.save();
        context.beginPath();
        context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        context.clip();
        context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, size, size);
        context.restore();
        onApply(canvas.toDataURL("image/png"));
    };

    const moveBy = (clientX: number, clientY: number) => {
        const last = lastPointRef.current;
        lastPointRef.current = { x: clientX, y: clientY };
        if (!last) return;
        const rect = previewRef.current?.getBoundingClientRect();
        if (!rect) return;
        setX((current) => clamp(current + ((clientX - last.x) / rect.width) * 100, 0, 100));
        setY((current) => clamp(current + ((clientY - last.y) / rect.height) * 100, 0, 100));
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-black text-gray-950">프로필 사진 자르기</h2>
                        <p className="mt-1 text-xs font-semibold text-gray-500">전체 사진에서 원을 원하는 위치로 옮기세요.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div
                    ref={previewRef}
                    className="relative mt-5 flex aspect-square w-full cursor-grab items-center justify-center overflow-hidden rounded-xl bg-gray-100 active:cursor-grabbing"
                    onMouseDown={(event) => {
                        setDragging(true);
                        lastPointRef.current = { x: event.clientX, y: event.clientY };
                    }}
                    onMouseMove={(event) => dragging && moveBy(event.clientX, event.clientY)}
                    onMouseUp={() => {
                        setDragging(false);
                        lastPointRef.current = null;
                    }}
                    onMouseLeave={() => {
                        setDragging(false);
                        lastPointRef.current = null;
                    }}
                    onTouchStart={(event) => {
                        const touch = event.touches[0];
                        setDragging(true);
                        lastPointRef.current = { x: touch.clientX, y: touch.clientY };
                    }}
                    onTouchMove={(event) => {
                        const touch = event.touches[0];
                        if (touch) moveBy(touch.clientX, touch.clientY);
                    }}
                    onTouchEnd={() => {
                        setDragging(false);
                        lastPointRef.current = null;
                    }}
                >
                    <img
                        src={source}
                        alt="전체 사진 미리보기"
                        draggable={false}
                        className="h-full w-full select-none object-contain"
                        style={{ transform: `scale(${scale})` }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-black/20" />
                    <div
                        className="pointer-events-none absolute h-44 w-44 rounded-full border-4 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.35)]"
                        style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                    />
                </div>

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-700">사진 배율</span>
                        <span className="text-xs font-bold text-gray-500">{Math.round(scale * 100)}%</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setScale((current) => clamp(Number((current - 0.1).toFixed(2)), 0.55, 2.5))}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-950 hover:text-gray-950"
                            aria-label="사진 축소"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <input
                            type="range"
                            min="0.55"
                            max="2.5"
                            step="0.05"
                            value={scale}
                            onChange={(event) => setScale(Number(event.target.value))}
                            className="h-2 min-w-0 flex-1 accent-gray-950"
                            aria-label="사진 배율"
                        />
                        <button
                            type="button"
                            onClick={() => setScale((current) => clamp(Number((current + 0.1).toFixed(2)), 0.55, 2.5))}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-950 hover:text-gray-950"
                            aria-label="사진 확대"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
                        취소
                    </button>
                    <button type="button" onClick={() => void applyCrop()} className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-black">
                        적용
                    </button>
                </div>
            </div>
        </div>
    );
}

function loadImage(source: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
    });
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function SettingRow({ icon, label, trailing }: { icon: React.ReactNode; label: string; trailing: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 last:border-b-0">
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-950">
                <span className="text-gray-500">{icon}</span>
                {label}
            </div>
            {trailing}
        </div>
    );
}
