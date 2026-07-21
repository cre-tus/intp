"use client";

import Header from "@/app/header";
import Image, { type StaticImageData } from "next/image";
import tokyo from "@/image/Tokyo.png";
import osaka from "@/image/Osaka.png";
import sapporo from "@/image/Sapporo.png";
import fukuoka from "@/image/fukuoka.png";
import nagoya from "@/image/Nagoya.png";
import {
    Bookmark,
    CalendarDays,
    Camera,
    CheckCircle2,
    Clock,
    Coins,
    Copy,
    Heart,
    ImagePlus,
    Loader2,
    MapPin,
    MessageCircle,
    MoreHorizontal,
    Pencil,
    Plus,
    Route,
    Search,
    Send,
    Share2,
    Sparkles,
    TrendingUp,
    Trash2,
    Users,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    copyCommunityPlanToMine,
    createCommunityPost,
    createCommunityPostComment,
    deleteCommunityPostComment,
    deleteCommunityPost,
    loadFollowingCommunityPosts,
    loadCommunityPlanView,
    loadCommunityPosts,
    loadCommunityPostComments,
    loadCommunityUserProfile,
    loadPopularCommunityPosts,
    loadSavedCommunityPosts,
    toggleCommunityPostLike,
    toggleCommunityPostSave,
    searchCommunityPosts,
    searchCommunityRegions,
    updateCommunityPost,
    updateCommunityPostComment,
type CommunityImageKey,
    type CommunityComment,
    type CommunityPost,
    type CommunityPostPayload,
    type CommunityUserProfile,
} from "@/lib/community";
import { loadTravelPlanIndex, type TravelPlanDraft, type TravelPlanIndexItem } from "@/lib/travelPlans";
import type { ChecklistItem } from "@/components/planner/TravelCheckList";
import type { ItineraryActivity, ItineraryDay } from "@/components/planner/TravelItinerary";
import { useAuthStore } from "@/stores/authStore";
import { toggleUserFollow } from "@/lib/follows";

const imageMap: Record<CommunityImageKey, StaticImageData> = {
    tokyo,
    osaka,
    sapporo,
    fukuoka,
    nagoya,
};

const samplePosts: CommunityPost[] = [
    {
        id: -1,
        authorId: -1,
        author: "민지",
        handle: "@slowtrip.mj",
        avatar: "MJ",
        title: "도쿄 3박 4일 감성 카페 루트",
        city: "Tokyo",
        duration: "3박 4일",
        budget: "72만원",
        imageKey: "tokyo",
        caption: "시부야부터 기치조지까지 걷는 시간이 많은 일정이에요. 카페, 편집숍, 야경 위주로 짰습니다.",
        tags: ["카페투어", "도보여행", "야경"],
        route: ["시부야", "오모테산도", "기치조지", "오다이바"],
        likes: 1284,
        comments: 86,
        saves: 412,
        liked: false,
        saved: false,
        followingAuthor: false,
        ownPost: false,
        createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    {
        id: -2,
        authorId: -2,
        author: "준호",
        handle: "@foodroute",
        avatar: "JH",
        title: "오사카 먹방만 보고 만든 현실 일정",
        city: "Osaka",
        duration: "2박 3일",
        budget: "58만원",
        imageKey: "osaka",
        caption: "유니버셜은 빼고 도톤보리, 난바, 신세카이 쪽 맛집 밀도를 높인 일정입니다. 이동 적게 먹기 많이.",
        tags: ["맛집", "짧은여행", "가성비"],
        route: ["난바", "도톤보리", "구로몬시장", "신세카이"],
        likes: 932,
        comments: 61,
        saves: 287,
        liked: false,
        saved: false,
        followingAuthor: false,
        ownPost: false,
        createdAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    },
    {
        id: -3,
        authorId: -3,
        author: "서연",
        handle: "@snow.archive",
        avatar: "SY",
        title: "삿포로 겨울 사진 스팟 모음",
        city: "Sapporo",
        duration: "4박 5일",
        budget: "96만원",
        imageKey: "sapporo",
        caption: "눈축제 시즌 기준으로 숙소 위치, 이동 시간, 사진 잘 나오는 시간대까지 적어둔 계획이에요.",
        tags: ["겨울여행", "사진스팟", "커플여행"],
        route: ["오도리공원", "비에이", "오타루", "스스키노"],
        likes: 2041,
        comments: 144,
        saves: 760,
        liked: false,
        saved: false,
        followingAuthor: false,
        ownPost: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
];

const trendingTags = ["#도쿄카페", "#오사카맛집", "#혼행", "#가성비루트", "#겨울삿포로", "#주말여행"];
const tabs = ["추천", "팔로잉", "인기", "지역"];
const imageKeys: CommunityImageKey[] = ["tokyo", "osaka", "sapporo", "fukuoka", "nagoya"];
type ComposerMode = "plan" | "photo";

export default function CommunityPage() {
    const router = useRouter();
    const { isLoggedIn, fetchMe } = useAuthStore();
    const [activeTab, setActiveTab] = useState("추천");
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [plans, setPlans] = useState<TravelPlanIndexItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [composerOpen, setComposerOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
    const [composerMode, setComposerMode] = useState<ComposerMode>("plan");
    const [notice, setNotice] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [regionInput, setRegionInput] = useState("");
    const [selectedRegion, setSelectedRegion] = useState("");
    const [apiRegions, setApiRegions] = useState<string[]>([]);
    const [customRegions, setCustomRegions] = useState<string[]>([]);
    const [feedback, setFeedback] = useState("");
    const [profileUserId, setProfileUserId] = useState<number | null>(null);
    const [popularTopPosts, setPopularTopPosts] = useState<CommunityPost[]>([]);

    useEffect(() => {
        void fetchMe();
    }, [fetchMe]);

    useEffect(() => {
        if (isLoggedIn !== true) return;
        loadTravelPlanIndex()
            .then(setPlans)
            .catch(() => setPlans([]));
    }, [isLoggedIn]);

    useEffect(() => {
        loadPopularCommunityPosts()
            .then((items) => setPopularTopPosts(items.slice(0, 5)))
            .catch(() => setPopularTopPosts([]));
    }, [isLoggedIn]);

    const refreshFeed = useCallback(async () => {
        setLoading(true);
        try {
            const keyword = searchQuery.trim();
            if (keyword || (activeTab === "지역" && selectedRegion)) {
                setPosts(await searchCommunityPosts({ q: keyword, region: selectedRegion }));
            } else if (activeTab === "팔로잉") {
                if (isLoggedIn === false) {
                    setPosts([]);
                } else {
                    setPosts(await loadFollowingCommunityPosts());
                }
            } else if (activeTab === "인기") {
                setPosts(await loadPopularCommunityPosts());
            } else if (activeTab === "저장") {
                if (isLoggedIn === false) {
                    setPosts([]);
                } else {
                    setPosts(await loadSavedCommunityPosts());
                }
            } else {
                setPosts(await loadCommunityPosts());
            }
        } catch {
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, [activeTab, isLoggedIn, searchQuery, selectedRegion]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void refreshFeed();
        }, searchQuery.trim() ? 250 : 0);
        return () => window.clearTimeout(timeoutId);
    }, [refreshFeed, searchQuery]);

    useEffect(() => {
        if (activeTab !== "지역") return;
        const timeoutId = window.setTimeout(() => {
            searchCommunityRegions(regionInput.trim())
                .then(setApiRegions)
                .catch(() => setApiRegions([]));
        }, 200);
        return () => window.clearTimeout(timeoutId);
    }, [activeTab, regionInput]);

    const shouldShowSampleFeed = activeTab === "추천" && !searchQuery.trim() && !selectedRegion;
    const visiblePosts = posts.length > 0 ? posts : shouldShowSampleFeed ? samplePosts : [];
    const isSampleFeed = posts.length === 0 && shouldShowSampleFeed;
    const regionChoices = [...apiRegions, ...customRegions].filter((region, index, regions) =>
        regions.findIndex((item) => item.toLowerCase() === region.toLowerCase()) === index
    );

    const updatePost = (postId: number, patch: Partial<CommunityPost>) => {
        setPosts((current) => current.map((post) => (post.id === postId ? { ...post, ...patch } : post)));
    };

    const toggleSampleReaction = (postId: number, kind: "liked" | "saved") => {
        const countKey = kind === "liked" ? "likes" : "saves";
        setPosts((current) => current.map((post) => {
            if (post.id !== postId) return post;
            const active = !post[kind];
            return { ...post, [kind]: active, [countKey]: post[countKey] + (active ? 1 : -1) };
        }));
    };

    const handleLike = async (post: CommunityPost) => {
        if (post.id < 0) {
            toggleSampleReaction(post.id, "liked");
            return;
        }
        if (isLoggedIn === false) {
            router.push("/login");
            return;
        }
        const result = await toggleCommunityPostLike(post.id);
        updatePost(post.id, { liked: result.active, likes: result.count });
    };

    const handleSave = async (post: CommunityPost) => {
        if (post.id < 0) {
            toggleSampleReaction(post.id, "saved");
            return;
        }
        if (isLoggedIn === false) {
            router.push("/login");
            return;
        }
        const result = await toggleCommunityPostSave(post.id);
        updatePost(post.id, { saved: result.active, saves: result.count });
    };

    const handleFollow = async (post: CommunityPost) => {
        if (post.ownPost) return;
        if (post.id < 0) {
            updatePost(post.id, { followingAuthor: !post.followingAuthor });
            return;
        }
        if (isLoggedIn === false) {
            router.push("/login");
            return;
        }
        const result = await toggleUserFollow(post.authorId);
        setPosts((current) => current.map((item) =>
            item.authorId === post.authorId ? { ...item, followingAuthor: result.following } : item
        ));
    };

    const syncAuthorFollow = (userId: number, following: boolean) => {
        setPosts((current) => current.map((item) =>
            item.authorId === userId ? { ...item, followingAuthor: following } : item
        ));
    };

    const addRegion = () => {
        const nextRegion = regionInput.trim();
        if (!nextRegion) return;
        setCustomRegions((current) => (
            current.some((region) => region.toLowerCase() === nextRegion.toLowerCase()) ? current : [...current, nextRegion]
        ));
        setSelectedRegion(nextRegion);
        setActiveTab("지역");
        setRegionInput("");
    };

    const removeCustomRegion = (targetRegion: string) => {
        setCustomRegions((current) => current.filter((region) => region !== targetRegion));
        if (selectedRegion === targetRegion) {
            setSelectedRegion("");
        }
    };

    const handleShare = async (post: CommunityPost) => {
        if (post.id < 0) {
            setFeedback("샘플 피드는 공유 링크가 없습니다.");
            return;
        }
        const url = post.planId
            ? `${window.location.origin}/community/plans/${post.id}`
            : `${window.location.origin}/community`;
        await navigator.clipboard.writeText(url);
        setFeedback("공유 링크를 복사했습니다.");
    };

    const handleDelete = async (post: CommunityPost) => {
        if (!post.ownPost || post.id < 0) return;
        if (!window.confirm("이 커뮤니티 글을 삭제할까요?")) return;
        await deleteCommunityPost(post.id);
        setPosts((current) => current.filter((item) => item.id !== post.id));
        setFeedback("커뮤니티 글을 삭제했습니다.");
    };

    const openComposer = (mode: ComposerMode = "plan") => {
        if (isLoggedIn === false) {
            router.push("/login");
            return;
        }
        setNotice("");
        setEditingPost(null);
        setComposerMode(mode);
        setComposerOpen(true);
    };

    const handleCreatePost = async (payload: CommunityPostPayload) => {
        try {
            if (editingPost) {
                const updated = await updateCommunityPost(editingPost.id, payload);
                updatePost(editingPost.id, updated);
            } else {
                const created = await createCommunityPost(payload);
                setPosts((current) => [created, ...current]);
            }
            setEditingPost(null);
            setComposerOpen(false);
        } catch (error) {
            setNotice(getApiErrorMessage(error));
        }
    };

    const handleEdit = (post: CommunityPost) => {
        setNotice("");
        setEditingPost(post);
        setComposerMode(post.planId ? "plan" : "photo");
        setComposerOpen(true);
    };

    return (
        <main className="min-h-screen bg-gray-50">
            <Header />
            <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
                <aside className="hidden space-y-4 lg:block">
                    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-950">
                            <Sparkles className="h-4 w-4" />
                            커뮤니티
                        </div>
                        <nav className="mt-4 space-y-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab("추천")}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                                    activeTab === "추천" ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-950"
                                }`}
                            >
                                여행 피드
                                {activeTab === "추천" && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                            </button>
                            <Link
                                href="/community/me"
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-950"
                            >
                                나의 피드
                            </Link>
                            <button
                                type="button"
                                onClick={() => setActiveTab("저장")}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                                    activeTab === "저장" ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-950"
                                }`}
                            >
                                저장한 일정
                                {activeTab === "저장" && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("지역")}
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-950"
                            >
                                지역별 피드
                            </button>
                        </nav>
                    </section>

                    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-950">
                            <TrendingUp className="h-4 w-4" />
                            실시간 트렌드
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {trendingTags.map((tag) => (
                                <button
                                    key={tag}
                                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-gray-950 hover:text-gray-950"
                                    type="button"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </section>
                </aside>

                <section className="min-w-0 space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-950 text-sm font-black text-white">
                                ME
                            </div>
                            <button
                                type="button"
                                onClick={() => openComposer("plan")}
                                className="flex min-h-11 flex-1 items-center rounded-full border border-gray-200 bg-gray-50 px-4 text-left text-sm font-medium text-gray-500 transition hover:border-gray-300 hover:bg-white"
                            >
                                내 여행 계획을 공유해보세요
                            </button>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <ComposerAction icon={<Plus className="h-4 w-4" />} label="계획 공유" onClick={() => openComposer("plan")} />
                            <ComposerAction icon={<Camera className="h-4 w-4" />} label="사진" onClick={() => openComposer("photo")} />
                            <ComposerAction icon={<Users className="h-4 w-4" />} label="동행 모집" onClick={() => openComposer("plan")} />
                        </div>
                        {isSampleFeed && !loading && (
                            <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                                아직 등록된 공유 글이 없어 샘플 피드를 보여주는 중입니다.
                            </p>
                        )}
                        {feedback && (
                            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                                {feedback}
                            </p>
                        )}
                    </div>

                    <div className="sticky top-[64px] z-30 -mx-4 border-y border-gray-200 bg-gray-50/90 px-4 py-3 backdrop-blur sm:top-[84px] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
                        <div className="flex gap-2 overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                                        activeTab === tab
                                            ? "bg-gray-950 text-white"
                                            : "border border-gray-200 bg-white text-gray-600 hover:text-gray-950"
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab === "지역" && (
                        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3">
                                    <MapPin className="h-4 w-4 text-gray-500" />
                                    <input
                                        value={regionInput}
                                        onChange={(event) => setRegionInput(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") addRegion();
                                        }}
                                        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none"
                                        placeholder="지역 직접 추가"
                                        type="text"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={addRegion}
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4" />
                                    지역 추가
                                </button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {regionChoices.length === 0 ? (
                                    <span className="rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500">
                                        검색된 지역이 없습니다. 직접 추가할 수 있습니다.
                                    </span>
                                ) : (
                                    regionChoices.map((region) => {
                                        const isCustomRegion = customRegions.some((item) => item.toLowerCase() === region.toLowerCase());
                                        return (
                                            <span
                                                key={region}
                                                className={`inline-flex items-center overflow-hidden rounded-full border text-xs font-black transition ${
                                                    selectedRegion === region
                                                        ? "border-blue-600 bg-blue-50 text-blue-700"
                                                        : "border-gray-200 bg-white text-gray-600"
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRegion(region);
                                                        setActiveTab("지역");
                                                    }}
                                                    className="px-3 py-1.5 hover:text-blue-700"
                                                >
                                                    {region}
                                                </button>
                                                {isCustomRegion && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCustomRegion(region)}
                                                        className="border-l border-current/15 px-2 py-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                                                        aria-label={`${region} 지역 삭제`}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </span>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    )}

                    {loading ? (
                        <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center text-sm font-bold text-gray-500 shadow-sm">
                            커뮤니티 피드를 불러오는 중입니다.
                        </div>
                    ) : visiblePosts.length === 0 ? (
                        <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center text-sm font-bold text-gray-500 shadow-sm">
                            조건에 맞는 커뮤니티 글이 없습니다.
                        </div>
                    ) : (
                        visiblePosts.map((post) => (
                            <FeedCard
                                key={post.id}
                                post={post}
                                onLike={() => void handleLike(post)}
                                onSave={() => void handleSave(post)}
                                onFollow={() => void handleFollow(post)}
                                onShare={() => void handleShare(post)}
                                onEdit={() => handleEdit(post)}
                                onDelete={() => void handleDelete(post)}
                                onOpenProfile={() => post.authorId > 0 && setProfileUserId(post.authorId)}
                                isLoggedIn={isLoggedIn === true}
                                onRequireLogin={() => router.push("/login")}
                                onCommentCountChange={(count) => updatePost(post.id, { comments: count })}
                            />
                        ))
                    )}
                </section>

                <RightRail
                    searchQuery={searchQuery}
                    regionInput={regionInput}
                    popularPosts={popularTopPosts.length > 0 ? popularTopPosts : samplePosts}
                    onSearchQueryChange={setSearchQuery}
                    onRegionInputChange={setRegionInput}
                    onAddRegion={addRegion}
                />
            </div>

            {composerOpen && (
                <CommunityComposer
                    plans={plans}
                    mode={composerMode}
                    notice={notice}
                    editingPost={editingPost}
                    onClose={() => {
                        setEditingPost(null);
                        setComposerOpen(false);
                    }}
                    onSubmit={handleCreatePost}
                />
            )}
            {profileUserId !== null && (
                <CommunityProfileDialog
                    userId={profileUserId}
                    isLoggedIn={isLoggedIn === true}
                    onClose={() => setProfileUserId(null)}
                    onRequireLogin={() => router.push("/login")}
                    onFollowChange={syncAuthorFollow}
                />
            )}
        </main>
    );
}

function FeedCard({
    post,
    onLike,
    onSave,
    onFollow,
    onShare,
    onEdit,
    onDelete,
    onOpenProfile,
    isLoggedIn,
    onRequireLogin,
    onCommentCountChange,
}: {
    post: CommunityPost;
    onLike: () => void;
    onSave: () => void;
    onFollow: () => void;
    onShare: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onOpenProfile: () => void;
    isLoggedIn: boolean;
    onRequireLogin: () => void;
    onCommentCountChange: (count: number) => void;
}) {
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [comments, setComments] = useState<CommunityComment[]>([]);
    const [commentText, setCommentText] = useState("");
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentSubmitting, setCommentSubmitting] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [commentMenuId, setCommentMenuId] = useState<number | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [editingCommentSubmitting, setEditingCommentSubmitting] = useState(false);
    const [planOpen, setPlanOpen] = useState(false);

    const loadComments = useCallback(async () => {
        if (post.id < 0 || comments.length > 0) return;
        setCommentsLoading(true);
        try {
            setComments(await loadCommunityPostComments(post.id));
        } finally {
            setCommentsLoading(false);
        }
    }, [comments.length, post.id]);

    const openComments = async () => {
        const nextOpen = !commentsOpen;
        setCommentsOpen(nextOpen);
        if (nextOpen) await loadComments();
    };

    const openPlanPreview = async () => {
        const nextOpen = !planOpen;
        setPlanOpen(nextOpen);
        if (nextOpen) {
            setCommentsOpen(true);
            await loadComments();
        }
    };

    const submitComment = async () => {
        const content = commentText.trim();
        if (!content || post.id < 0) return;
        if (!isLoggedIn) {
            onRequireLogin();
            return;
        }
        setCommentSubmitting(true);
        try {
            const created = await createCommunityPostComment(post.id, content);
            const nextComments = [...comments, created];
            setComments(nextComments);
            onCommentCountChange(nextComments.length);
            setCommentText("");
        } finally {
            setCommentSubmitting(false);
        }
    };

    const startEditComment = (comment: CommunityComment) => {
        setCommentMenuId(null);
        setEditingCommentId(comment.id);
        setEditingCommentText(comment.content);
    };

    const submitEditComment = async (commentId: number) => {
        const content = editingCommentText.trim();
        if (!content || post.id < 0) return;
        setEditingCommentSubmitting(true);
        try {
            const updated = await updateCommunityPostComment(post.id, commentId, content);
            setComments((current) => current.map((comment) => (comment.id === commentId ? updated : comment)));
            setEditingCommentId(null);
            setEditingCommentText("");
        } finally {
            setEditingCommentSubmitting(false);
        }
    };

    const deleteComment = async (commentId: number) => {
        if (post.id < 0) return;
        if (!window.confirm("이 댓글을 삭제할까요?")) return;
        await deleteCommunityPostComment(post.id, commentId);
        setComments((current) => {
            const nextComments = current.filter((comment) => comment.id !== commentId);
            onCommentCountChange(nextComments.length);
            return nextComments;
        });
        setCommentMenuId(null);
    };

    return (
        <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                    <button type="button" onClick={onOpenProfile} className="shrink-0 rounded-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                        <Avatar value={post.avatar} size="md" />
                    </button>
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={onOpenProfile}
                                className="truncate text-left text-sm font-bold text-gray-950 transition hover:text-blue-600"
                            >
                                {post.author}
                            </button>
                            {!post.ownPost && (
                                <button
                                    className="shrink-0 text-sm font-black text-blue-600 transition hover:text-blue-700"
                                    onClick={onFollow}
                                    type="button"
                                >
                                    {post.followingAuthor ? "팔로잉" : "팔로우"}
                                </button>
                            )}
                        </div>
                        <div className="truncate text-xs font-medium text-gray-500">
                            {post.handle} · {relativeTime(post.createdAt)}
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {post.ownPost && post.id > 0 && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setMenuOpen((current) => !current)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
                                aria-label="피드 메뉴"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuOpen && (
                                <div className="absolute right-0 top-10 z-20 w-32 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onEdit();
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                                    >
                                        <Pencil className="h-4 w-4" />
                                        수정
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onDelete();
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        삭제
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
                <Image src={post.imageUrl || imageMap[post.imageKey] || tokyo} alt={post.city ? `${post.city} 여행 이미지` : "커뮤니티 사진"} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 680px" />
                {post.planId && post.city && (
                <div className="absolute left-4 top-4 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                    {post.city}
                </div>
                )}
            </div>

            <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        {post.title && <h1 className="text-lg font-black leading-tight text-gray-950">{post.title}</h1>}
                        <p className="mt-2 text-sm font-medium leading-6 text-gray-950">{post.caption}</p>
                    </div>
                    {post.planId && (
                        <button
                            type="button"
                            className={`shrink-0 rounded-full border px-3 py-2 text-sm font-bold transition ${
                                planOpen
                                    ? "border-gray-950 bg-gray-950 text-white"
                                    : "border-gray-200 text-gray-800 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
                            }`}
                            onClick={() => void openPlanPreview()}
                            aria-expanded={planOpen}
                        >
                            {planOpen ? "계획 닫기" : "계획 보기"}
                        </button>
                    )}
                </div>

                {post.planId && (
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center">
                    <PlanMetric icon={<CalendarDays className="h-4 w-4" />} label="기간" value={post.duration} />
                    <PlanMetric icon={<MapPin className="h-4 w-4" />} label="도시" value={post.city} />
                    <PlanMetric icon={<Sparkles className="h-4 w-4" />} label="예산" value={post.budget} />
                </div>
                )}

                {post.planId && post.route.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {post.route.map((spot) => (
                        <span key={spot} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                            {spot}
                        </span>
                    ))}
                </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                        <span key={tag} className="text-sm font-bold text-blue-600">#{tag}</span>
                    ))}
                </div>

                {planOpen && post.id > 0 && (
                    <InlinePlanPreview
                        postId={post.id}
                        isLoggedIn={isLoggedIn}
                        canCopy={!post.ownPost}
                        onRequireLogin={onRequireLogin}
                        onClose={() => setPlanOpen(false)}
                    />
                )}

                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                    <div className="flex items-center gap-1 sm:gap-2">
                        <SocialButton active={post.liked} icon={<Heart className="h-5 w-5" />} label={`${post.likes}`} onClick={onLike} />
                        <SocialButton icon={<MessageCircle className="h-5 w-5" />} label={`${post.comments}`} onClick={() => void openComments()} />
                        <SocialButton icon={<Share2 className="h-5 w-5" />} label="공유" onClick={onShare} />
                    </div>
                    <SocialButton active={post.saved} icon={<Bookmark className="h-5 w-5" />} label={`${post.saves}`} onClick={onSave} />
                </div>

                {commentsOpen && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="space-y-3">
                            {commentsLoading ? (
                                <p className="text-sm font-bold text-gray-500">댓글을 불러오는 중입니다.</p>
                            ) : comments.length === 0 ? (
                                <p className="text-sm font-bold text-gray-500">아직 댓글이 없습니다.</p>
                            ) : (
                                comments.map((comment) => (
                                    <div key={comment.id} className="flex gap-2">
                                        <Avatar value={comment.avatar} size="sm" />
                                        <div className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 shadow-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                        <span className="font-black text-gray-950">{comment.author}</span>
                                                        {comment.edited && <span className="font-bold text-gray-400">수정됨</span>}
                                                    </div>
                                                    {editingCommentId === comment.id ? (
                                                        <div className="mt-2 space-y-2">
                                                            <input
                                                                value={editingCommentText}
                                                                onChange={(event) => setEditingCommentText(event.target.value)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter") void submitEditComment(comment.id);
                                                                }}
                                                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                                type="text"
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void submitEditComment(comment.id)}
                                                                    disabled={editingCommentSubmitting || !editingCommentText.trim()}
                                                                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    저장
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingCommentId(null);
                                                                        setEditingCommentText("");
                                                                    }}
                                                                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-600 hover:bg-gray-50"
                                                                >
                                                                    취소
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="mt-1 text-sm leading-5 text-gray-700">{comment.content}</p>
                                                    )}
                                                </div>
                                                {comment.ownComment && editingCommentId !== comment.id && (
                                                    <div className="relative shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setCommentMenuId((current) => (current === comment.id ? null : comment.id))}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                                                            aria-label="댓글 메뉴"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </button>
                                                        {commentMenuId === comment.id && (
                                                            <div className="absolute right-0 top-8 z-20 w-28 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEditComment(comment)}
                                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                    수정
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void deleteComment(comment.id)}
                                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="mt-3 flex gap-2">
                            <input
                                value={commentText}
                                onChange={(event) => setCommentText(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") void submitComment();
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder="댓글 입력"
                                type="text"
                            />
                            <button
                                type="button"
                                onClick={() => void submitComment()}
                                disabled={commentSubmitting || !commentText.trim()}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                등록
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}

type InlinePlanState = Awaited<ReturnType<typeof loadCommunityPlanView>>;

function InlinePlanPreview({
    postId,
    isLoggedIn,
    canCopy,
    onRequireLogin,
    onClose,
}: {
    postId: number;
    isLoggedIn: boolean;
    canCopy: boolean;
    onRequireLogin: () => void;
    onClose: () => void;
}) {
    const [data, setData] = useState<InlinePlanState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;
        loadCommunityPlanView(postId)
            .then((nextData) => {
                if (alive) setData(nextData);
            })
            .catch(() => {
                if (alive) setError("계획을 불러오지 못했습니다.");
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [postId]);

    if (loading) {
        return (
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    계획을 불러오는 중입니다.
                </div>
            </section>
        );
    }

    if (error || !data) {
        return (
            <section className="rounded-xl border border-red-100 bg-red-50 p-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-red-600">{error || "계획을 찾을 수 없습니다."}</p>
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-100">
                        닫기
                    </button>
                </div>
            </section>
        );
    }

    return <InlineReadonlyPlan data={data} plan={data.content} isLoggedIn={isLoggedIn} canCopy={canCopy} onRequireLogin={onRequireLogin} onClose={onClose} />;
}

function InlineReadonlyPlan({
    data,
    plan,
    isLoggedIn,
    canCopy,
    onRequireLogin,
    onClose,
}: {
    data: InlinePlanState;
    plan: TravelPlanDraft;
    isLoggedIn: boolean;
    canCopy: boolean;
    onRequireLogin: () => void;
    onClose: () => void;
}) {
    const [copying, setCopying] = useState(false);
    const [copyError, setCopyError] = useState("");
    const [copySuccess, setCopySuccess] = useState("");
    const totalCost = useMemo(() => {
        const checklistCost = plan.checklist.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
        const itineraryCost = plan.days.reduce(
            (daySum, day) => daySum + day.activities.reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0),
            0,
        );
        return checklistCost + itineraryCost;
    }, [plan]);

    const copyToMyPlans = async () => {
        if (copying) return;
        if (!canCopy) {
            setCopyError("내가 공유한 계획은 이미 내 여행 계획에 있어 복사할 수 없습니다.");
            return;
        }
        if (!isLoggedIn) {
            onRequireLogin();
            return;
        }
        setCopying(true);
        setCopyError("");
        setCopySuccess("");
        try {
            await copyCommunityPlanToMine(data.postId);
            setCopySuccess("복사되었습니다. 마이페이지에서 확인할 수 있습니다.");
        } catch (error) {
            setCopyError(getApiErrorMessage(error, "계획을 복사하지 못했습니다. 잠시 후 다시 시도해주세요."));
        } finally {
            setCopying(false);
        }
    };

    return (
        <section className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-4 bg-gray-950 px-4 py-5 text-white sm:px-5">
                <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                        <Sparkles className="h-3.5 w-3.5" />
                        공유 계획
                    </div>
                    <h2 className="mt-3 text-xl font-black leading-tight">{plan.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/65">
                        {data.author}님이 공유한 읽기 전용 일정입니다. 아래 댓글을 보면서 의견을 남길 수 있습니다.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void copyToMyPlans()}
                        disabled={copying || !canCopy}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-gray-950 transition hover:bg-gray-100 disabled:cursor-wait disabled:opacity-70"
                    >
                        {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                        {canCopy ? "내 계획으로 복사" : "내 공유 계획"}
                    </button>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="계획 닫기">
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
            {copyError && (
                <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                    {copyError}
                </p>
            )}
            {copySuccess && (
                <p className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                    {copySuccess}
                </p>
            )}

            <div className="grid gap-3 border-b border-gray-200 bg-gray-50 p-4 sm:grid-cols-3">
                <InlinePlanMetric icon={<CalendarDays className="h-4 w-4" />} label="일정" value={`${plan.days.length}개 Day`} />
                <InlinePlanMetric icon={<Route className="h-4 w-4" />} label="형식" value={planTemplateLabel(plan.template)} />
                <InlinePlanMetric icon={<Coins className="h-4 w-4" />} label="예상 경비" value={`${totalCost.toLocaleString("ko-KR")}원`} />
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                    {plan.days.length === 0 ? (
                        <InlineEmpty title="공개된 일정이 없습니다." />
                    ) : (
                        plan.days.map((day, index) => <InlineDayPanel key={day.id || index} day={day} index={index} />)
                    )}
                </div>

                <aside className="space-y-3">
                    <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <h3 className="text-sm font-black text-gray-950">공유 정보</h3>
                        <InlineInfoRow label="게시글" value={data.postTitle} />
                        <InlineInfoRow label="작성자" value={data.author} />
                        <InlineInfoRow label="업데이트" value={new Date(data.updatedAt).toLocaleDateString("ko-KR")} />
                    </section>
                    <InlineChecklistPanel items={plan.checklist} />
                </aside>
            </div>
        </section>
    );
}

function InlinePlanMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-lg bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                {icon}
                {label}
            </div>
            <div className="mt-1 text-base font-black text-gray-950">{value}</div>
        </div>
    );
}

function InlineDayPanel({ day, index }: { day: ItineraryDay; index: number }) {
    const dayCost = day.activities.reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0);
    return (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
                <div>
                    <h3 className="text-sm font-black text-gray-950">{day.dayTitle || `Day ${index + 1}`}</h3>
                    {day.date && <p className="mt-0.5 text-xs font-bold text-gray-500">{day.date}</p>}
                </div>
                <span className="rounded-full bg-gray-950 px-2.5 py-1 text-xs font-black text-white">
                    {dayCost.toLocaleString("ko-KR")}원
                </span>
            </div>
            <div className="divide-y divide-gray-100">
                {day.activities.length === 0 ? (
                    <InlineEmpty title="이 Day에는 공개된 일정이 없습니다." compact />
                ) : (
                    day.activities.map((activity, idx) => <InlineActivityItem key={activity.id || idx} activity={activity} />)
                )}
            </div>
        </section>
    );
}

function InlineActivityItem({ activity }: { activity: ItineraryActivity }) {
    return (
        <div className="grid gap-2 px-3 py-3 sm:grid-cols-[82px_minmax(0,1fr)_90px] sm:items-center">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-700">
                <Clock className="h-3.5 w-3.5" />
                {displayPlanText(activity.time, "시간 미정")}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-black text-gray-950">
                    <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">{displayPlanText(activity.location, "장소 미정")}</span>
                </div>
                <p className="mt-1 text-sm leading-5 text-gray-600">{displayPlanText(activity.activity, "활동 내용 없음")}</p>
            </div>
            <div className="text-left text-sm font-black text-gray-950 sm:text-right">
                {(Number(activity.cost) || 0).toLocaleString("ko-KR")}원
            </div>
        </div>
    );
}

function InlineChecklistPanel({ items }: { items: ChecklistItem[] }) {
    return (
        <section className="rounded-lg border border-gray-200 bg-white p-3">
            <h3 className="text-sm font-black text-gray-950">준비물 체크리스트</h3>
            {items.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-gray-500">공개된 준비물이 없습니다.</p>
            ) : (
                <div className="mt-3 space-y-2">
                    {items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 rounded-lg bg-gray-50 p-2.5">
                            <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.checked ? "text-emerald-500" : "text-gray-300"}`} />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-gray-800">{displayPlanText(item.text, "준비물")}</div>
                                <div className="mt-0.5 text-xs font-semibold text-gray-500">{(Number(item.cost) || 0).toLocaleString("ko-KR")}원</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function InlineInfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="mt-3 flex items-start justify-between gap-3 border-t border-gray-200 pt-3 text-sm">
            <span className="font-bold text-gray-500">{label}</span>
            <span className="min-w-0 text-right font-black text-gray-950">{value}</span>
        </div>
    );
}

function InlineEmpty({ title, compact = false }: { title: string; compact?: boolean }) {
    return (
        <div className={`${compact ? "p-4" : "rounded-lg border border-gray-200 bg-white p-6"} text-center text-sm font-bold text-gray-500`}>
            {title}
        </div>
    );
}

function displayPlanText(value: string | undefined, fallback: string) {
    return value && value.trim() ? value : fallback;
}

function planTemplateLabel(template: TravelPlanDraft["template"]) {
    if (template === "spreadsheet") return "일정표형";
    if (template === "timeline") return "트립 보드";
    if (template === "route_sheet") return "루트 시트";
    return "기본형";
}

function RightRail({
    searchQuery,
    regionInput,
    popularPosts,
    onSearchQueryChange,
    onRegionInputChange,
    onAddRegion,
}: {
    searchQuery: string;
    regionInput: string;
    popularPosts: CommunityPost[];
    onSearchQueryChange: (value: string) => void;
    onRegionInputChange: (value: string) => void;
    onAddRegion: () => void;
}) {
    const recommendedPlans = useMemo(() => {
        return [...popularPosts]
            .sort((left, right) => {
                const leftScore = left.likes * 3 + left.saves * 2 + left.comments;
                const rightScore = right.likes * 3 + right.saves * 2 + right.comments;
                if (rightScore !== leftScore) return rightScore - leftScore;
                return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
            })
            .slice(0, 5);
    }, [popularPosts]);

    return (
        <aside className="hidden space-y-4 xl:block">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <Search className="h-4 w-4 text-gray-500" />
                    <input
                        value={searchQuery}
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none"
                        placeholder="도시, 태그, 일정 검색"
                        type="text"
                    />
                </label>
                <div className="mt-3 flex gap-2">
                    <input
                        value={regionInput}
                        onChange={(event) => onRegionInputChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") onAddRegion();
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="지역 직접 추가"
                        type="text"
                    />
                    <button
                        type="button"
                        onClick={onAddRegion}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white transition hover:bg-blue-700"
                    >
                        추가
                    </button>
                </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-gray-950">인기 공유 계획 Top 5</div>
                    <TrendingUp className="h-4 w-4 text-rose-500" />
                </div>
                <div className="mt-3 space-y-3">
                    {recommendedPlans.length === 0 ? (
                        <div className="rounded-lg bg-gray-50 p-4 text-sm font-bold text-gray-500">아직 인기 공유 계획이 없습니다.</div>
                    ) : (
                        recommendedPlans.map((post, index) => (
                            <Link
                                key={post.id}
                                href={post.id > 0 ? `/community/plans/${post.id}` : "/community"}
                                className="group flex w-full gap-3 rounded-lg text-left"
                            >
                                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                    <Image src={imageMap[post.imageKey]} alt={post.city} fill className="object-cover transition group-hover:scale-105" sizes="80px" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-1">
                                        <span className="shrink-0 rounded-full bg-gray-950 px-1.5 py-0.5 text-[10px] font-black text-white">#{index + 1}</span>
                                        <div className="truncate text-sm font-bold text-gray-950">{post.title}</div>
                                    </div>
                                    <div className="mt-1 truncate text-xs font-medium text-gray-500">{post.city} · {post.duration || "일정"}</div>
                                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-gray-950">
                                        가져오기 <Send className="h-3 w-3" />
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </section>
        </aside>
    );
}

function CommunityComposer({
    plans,
    mode,
    notice,
    editingPost,
    onClose,
    onSubmit,
}: {
    plans: TravelPlanIndexItem[];
    mode: ComposerMode;
    notice: string;
    editingPost: CommunityPost | null;
    onClose: () => void;
    onSubmit: (payload: CommunityPostPayload) => Promise<void>;
}) {
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        planId: mode === "plan" ? plans[0]?.id ?? "" : "",
        title: mode === "plan" ? plans[0]?.title ?? "" : "",
        city: "",
        duration: "",
        budget: "",
        imageKey: "tokyo" as CommunityImageKey,
        imageUrl: "",
        caption: "",
        tags: "",
        route: "",
    });

    const effectiveMode: ComposerMode = editingPost ? (editingPost.planId ? "plan" : "photo") : mode;
    const isPlanMode = effectiveMode === "plan";
    const selectedPlan = plans.find((plan) => plan.id === form.planId);

    useEffect(() => {
        if (editingPost) return;
        setForm({
            planId: isPlanMode ? plans[0]?.id ?? "" : "",
            title: isPlanMode ? plans[0]?.title ?? "" : "",
            city: "",
            duration: "",
            budget: "",
            imageKey: "tokyo",
            imageUrl: "",
            caption: "",
            tags: "",
            route: "",
        });
    }, [editingPost, isPlanMode, plans]);

    useEffect(() => {
        if (!editingPost) return;
        setForm({
            planId: editingPost.planId ?? "",
            title: editingPost.title,
            city: editingPost.city,
            duration: editingPost.duration,
            budget: editingPost.budget,
            imageKey: editingPost.imageKey,
            imageUrl: editingPost.imageUrl ?? "",
            caption: editingPost.caption,
            tags: editingPost.tags.join(","),
            route: editingPost.route.join(","),
        });
    }, [editingPost]);

    useEffect(() => {
        if (editingPost || !isPlanMode) return;
        if (form.planId || plans.length === 0) return;
        setForm((current) => ({
            ...current,
            planId: plans[0].id,
            title: current.title || plans[0].title,
        }));
    }, [editingPost, form.planId, isPlanMode, plans]);

    const update = (field: keyof typeof form, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleCustomImage = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setForm((current) => ({
                ...current,
                imageKey: "tokyo",
                imageUrl: typeof reader.result === "string" ? reader.result : current.imageUrl,
            }));
        };
        reader.readAsDataURL(file);
    };

    const submit = async () => {
        if (isPlanMode && !form.planId) return;
        setSubmitting(true);
        try {
            await onSubmit({
                planId: isPlanMode ? form.planId : undefined,
                title: isPlanMode ? form.title || selectedPlan?.title || "" : form.title,
                city: isPlanMode ? form.city : "",
                duration: isPlanMode ? form.duration : "",
                budget: isPlanMode ? form.budget : "",
                imageKey: form.imageKey,
                imageUrl: form.imageUrl || null,
                caption: form.caption,
                tags: splitList(form.tags),
                route: splitList(form.route),
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 py-6">
            <div className="max-h-full w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <div>
                        <h2 className="text-xl font-black text-gray-950">{editingPost ? "피드 수정" : isPlanMode ? "여행 계획 공유" : "사진 글쓰기"}</h2>
                        <p className="mt-1 text-sm text-gray-500">{editingPost ? "커뮤니티 피드 내용을 수정합니다." : isPlanMode ? "내 계획을 커뮤니티 피드에 올립니다." : "사진과 글만 가볍게 커뮤니티에 올립니다."}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-950">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    {isPlanMode && (
                    <Field label="공유할 계획">
                        <select
                            value={form.planId}
                            onChange={(event) => {
                                const plan = plans.find((item) => item.id === event.target.value);
                                setForm((current) => ({ ...current, planId: event.target.value, title: plan?.title || current.title }));
                            }}
                            disabled={plans.length === 0}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            {plans.length === 0 && <option value="">내가 만든 여행 계획이 없습니다</option>}
                            {plans.map((plan) => (
                                <option key={plan.id} value={plan.id}>{plan.title}</option>
                            ))}
                        </select>
                        <p className="mt-1.5 text-xs font-semibold text-gray-500">
                            커뮤니티에는 로그인한 사용자가 직접 만든 여행 계획만 공유할 수 있습니다.
                        </p>
                    </Field>
                    )}

                    <Field label="제목">
                        <input value={form.title} onChange={(event) => update("title", event.target.value)} className="community-input" placeholder={isPlanMode ? "예: 도쿄 3박 4일 카페 루트" : "제목 없이 올릴 수 있습니다"} />
                    </Field>

                    {isPlanMode && (
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="도시">
                            <input value={form.city} onChange={(event) => update("city", event.target.value)} className="community-input" />
                        </Field>
                        <Field label="기간">
                            <input value={form.duration} onChange={(event) => update("duration", event.target.value)} className="community-input" />
                        </Field>
                        <Field label="예산">
                            <input value={form.budget} onChange={(event) => update("budget", event.target.value)} className="community-input" />
                        </Field>
                    </div>
                    )}

                    <Field label="대표 이미지">
                        <div className="grid grid-cols-5 gap-2">
                            <label
                                className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 bg-gray-50 text-xs font-black transition ${
                                    form.imageUrl ? "border-blue-600 text-blue-700" : "border-dashed border-gray-300 text-gray-500 hover:border-blue-300 hover:text-blue-700"
                                }`}
                            >
                                {form.imageUrl ? (
                                    <Image src={form.imageUrl} alt="직접 추가 이미지" fill className="object-cover" sizes="96px" />
                                ) : (
                                    <>
                                        <ImagePlus className="mb-1 h-5 w-5" />
                                        직접 추가
                                    </>
                                )}
                                <input
                                    className="sr-only"
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => handleCustomImage(event.target.files?.[0])}
                                />
                            </label>
                            {imageKeys.map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setForm((current) => ({ ...current, imageKey: key, imageUrl: "" }))}
                                    className={`relative aspect-square overflow-hidden rounded-lg border-2 ${form.imageKey === key && !form.imageUrl ? "border-gray-950" : "border-transparent"}`}
                                >
                                    <Image src={imageMap[key]} alt={key} fill className="object-cover" sizes="96px" />
                                </button>
                            ))}
                        </div>
                    </Field>

                    <Field label="소개">
                        <textarea
                            value={form.caption}
                            onChange={(event) => update("caption", event.target.value)}
                            className="community-input min-h-28 resize-none"
                            placeholder="이 계획의 핵심 포인트, 추천 대상, 주의할 점을 적어주세요."
                        />
                    </Field>

                    <div className={isPlanMode ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
                        <Field label="태그">
                            <input value={form.tags} onChange={(event) => update("tags", event.target.value)} className="community-input" placeholder="쉼표로 구분" />
                        </Field>
                        {isPlanMode && (
                        <Field label="주요 루트">
                            <input value={form.route} onChange={(event) => update("route", event.target.value)} className="community-input" placeholder="쉼표로 구분" />
                        </Field>
                        )}
                    </div>

                    {notice && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{notice}</p>}

                    <button
                        type="button"
                        disabled={submitting || (isPlanMode && plans.length === 0)}
                        onClick={() => void submit()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-3 text-sm font-black text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                    >
                        <Send className="h-4 w-4" />
                            {submitting ? (editingPost ? "수정 중" : "게시 중") : (editingPost ? "수정 완료" : isPlanMode ? "커뮤니티에 공유" : "사진 글 게시")}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-gray-500">{label}</span>
            {children}
        </label>
    );
}

function ComposerAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950 sm:text-sm"
        >
            {icon}
            {label}
        </button>
    );
}

function Avatar({ value, size }: { value: string; size: "sm" | "md" | "lg" }) {
    const dimension = size === "lg" ? "h-20 w-20 text-2xl ring-4 ring-white/25" : size === "md" ? "h-11 w-11 text-sm" : "h-8 w-8 text-xs";
    const isImage = value?.startsWith("data:image/") || value?.startsWith("http://") || value?.startsWith("https://");
    return (
        <div className={`flex ${dimension} shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-900 font-black text-white`}>
            {isImage ? <img src={value} alt="프로필 사진" className="h-full w-full object-cover" /> : value}
        </div>
    );
}

function PlanMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-500">
                {icon}
                {label}
            </div>
            <div className="mt-1 truncate text-sm font-black text-gray-950">{value}</div>
        </div>
    );
}

function SocialButton({ active = false, icon, label, onClick }: { active?: boolean; icon: ReactNode; label: string; onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-sm font-bold transition sm:px-3 ${
                active ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function CommunityProfileDialog({
    userId,
    isLoggedIn,
    onClose,
    onRequireLogin,
    onFollowChange,
}: {
    userId: number;
    isLoggedIn: boolean;
    onClose: () => void;
    onRequireLogin: () => void;
    onFollowChange: (userId: number, following: boolean) => void;
}) {
    const [profile, setProfile] = useState<CommunityUserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tab, setTab] = useState<"feed" | "plans">("feed");
    const [followSaving, setFollowSaving] = useState(false);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError("");
        loadCommunityUserProfile(userId)
            .then((nextProfile) => {
                if (alive) setProfile(nextProfile);
            })
            .catch(() => {
                if (alive) setError("프로필을 불러오지 못했습니다.");
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [userId]);

    const toggleFollow = async () => {
        if (!profile || profile.ownProfile || followSaving) return;
        if (!isLoggedIn) {
            onRequireLogin();
            return;
        }
        setFollowSaving(true);
        try {
            const result = await toggleUserFollow(profile.userId);
            setProfile((current) => current ? {
                ...current,
                followingUser: result.following,
                followers: result.followers,
                following: result.followingCount,
            } : current);
            onFollowChange(profile.userId, result.following);
        } finally {
            setFollowSaving(false);
        }
    };

    const feed = profile?.feed ?? [];
    const planFeed = feed.filter((post) => post.planId);
    const visibleFeed = tab === "plans" ? planFeed : feed;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6">
            <section className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <h2 className="text-base font-black text-gray-950">프로필</h2>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex min-h-80 items-center justify-center gap-2 text-sm font-bold text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        프로필을 불러오는 중입니다.
                    </div>
                ) : error || !profile ? (
                    <div className="min-h-80 px-5 py-10 text-center text-sm font-bold text-red-600">
                        {error || "프로필을 찾을 수 없습니다."}
                    </div>
                ) : (
                    <>
                        <div className="bg-gradient-to-r from-gray-950 to-gray-700 px-5 pb-5 pt-8 text-white">
                            <div className="flex items-end justify-between gap-4">
                                <div className="flex min-w-0 items-end gap-4">
                                    <Avatar value={profile.avatar} size="lg" />
                                    <div className="min-w-0 pb-1">
                                        <div className="truncate text-2xl font-black">{profile.nickname}</div>
                                        <div className="mt-1 text-sm font-bold text-white/65">{profile.handle}</div>
                                    </div>
                                </div>
                                {!profile.ownProfile && (
                                    <button
                                        type="button"
                                        onClick={() => void toggleFollow()}
                                        disabled={followSaving}
                                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition disabled:cursor-wait ${
                                            profile.followingUser
                                                ? "bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15"
                                                : "bg-white text-gray-950 hover:bg-gray-100"
                                        }`}
                                    >
                                        {profile.followingUser ? "팔로잉" : "팔로우"}
                                    </button>
                                )}
                            </div>
                            <p className="mt-4 min-h-5 text-sm font-semibold leading-6 text-white/80">
                                {profile.statusMessage || "아직 상태메시지가 없습니다."}
                            </p>
                            <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-xl border border-white/20 text-center">
                                <ProfileStat value={profile.posts} label="피드" />
                                <ProfileStat value={profile.sharedPlans} label="공유 계획" />
                                <ProfileStat value={profile.followers} label="팔로워" />
                                <ProfileStat value={profile.following} label="팔로잉" />
                            </div>
                        </div>

                        <div className="flex border-b border-gray-200 px-5">
                            <ProfileTab active={tab === "feed"} onClick={() => setTab("feed")}>피드</ProfileTab>
                            <ProfileTab active={tab === "plans"} onClick={() => setTab("plans")}>공유한 여행 계획</ProfileTab>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-4">
                            {visibleFeed.length === 0 ? (
                                <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center text-sm font-bold text-gray-500">
                                    {tab === "plans" ? "공유한 여행 계획이 없습니다." : "작성한 피드가 없습니다."}
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {visibleFeed.map((post) => (
                                        <ProfilePostCard key={post.id} post={post} onClose={onClose} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

function ProfileStat({ value, label }: { value: number; label: string }) {
    return (
        <div className="border-r border-white/20 px-2 py-3 last:border-r-0">
            <div className="text-lg font-black">{value.toLocaleString("ko-KR")}</div>
            <div className="mt-1 truncate text-xs font-bold text-white/60">{label}</div>
        </div>
    );
}

function ProfileTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`border-b-2 px-3 py-3 text-sm font-black transition ${
                active ? "border-gray-950 text-gray-950" : "border-transparent text-gray-500 hover:text-gray-950"
            }`}
        >
            {children}
        </button>
    );
}

function ProfilePostCard({ post, onClose }: { post: CommunityPost; onClose: () => void }) {
    return (
        <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="relative aspect-[4/3] bg-gray-100">
                <Image src={post.imageUrl || imageMap[post.imageKey] || tokyo} alt={post.title || post.caption || "피드 이미지"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 320px" />
                {post.planId && (
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-black text-white backdrop-blur">
                        여행 계획
                    </span>
                )}
            </div>
            <div className="space-y-3 p-3">
                <div>
                    {post.title && <h3 className="line-clamp-1 text-sm font-black text-gray-950">{post.title}</h3>}
                    <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-gray-700">{post.caption}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-xs font-black text-blue-600">#{tag}</span>
                    ))}
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-bold text-gray-500">
                    <span>좋아요 {post.likes} · 댓글 {post.comments}</span>
                    {post.planId && (
                        <Link
                            href={`/community/plans/${post.id}`}
                            onClick={onClose}
                            className="rounded-full bg-gray-950 px-3 py-1.5 font-black text-white hover:bg-black"
                        >
                            계획 보기
                        </Link>
                    )}
                </div>
            </div>
        </article>
    );
}

function getApiErrorMessage(error: unknown, fallback = "게시글을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.") {
    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as { response?: { data?: unknown; status?: number } }).response;
        if (typeof response?.data === "string" && response.data.trim()) return response.data;
        if (response?.status === 401) return "로그인이 필요합니다.";
        if (response?.status === 403) return "이 작업을 수행할 권한이 없습니다.";
    }
    return fallback;
}

function splitList(value: string) {
    return value.split(",").map((item) => item.trim().replace(/^#/, "")).filter(Boolean);
}

function relativeTime(value: string) {
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    if (!Number.isFinite(diff) || diff < 0) return "방금 전";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString("ko-KR");
}
