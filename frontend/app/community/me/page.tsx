"use client";

import Header from "@/app/header";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import tokyo from "@/image/Tokyo.png";
import osaka from "@/image/Osaka.png";
import sapporo from "@/image/Sapporo.png";
import fukuoka from "@/image/fukuoka.png";
import nagoya from "@/image/Nagoya.png";
import { deleteCommunityPost, loadMyCommunityPosts, type CommunityImageKey, type CommunityPost } from "@/lib/community";
import RequireAuth from "@/components/requireAuth/RequireAuth";

const imageMap: Record<CommunityImageKey, StaticImageData> = {
    tokyo,
    osaka,
    sapporo,
    fukuoka,
    nagoya,
};

export default function MyCommunityFeedPage() {
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMyCommunityPosts()
            .then(setPosts)
            .catch(() => setPosts([]))
            .finally(() => setLoading(false));
    }, []);

    const stats = useMemo(() => ({
        posts: posts.length,
        likes: posts.reduce((sum, post) => sum + post.likes, 0),
        saves: posts.reduce((sum, post) => sum + post.saves, 0),
    }), [posts]);

    const handleDelete = async (post: CommunityPost) => {
        if (!window.confirm("이 커뮤니티 글을 삭제할까요?")) return;
        await deleteCommunityPost(post.id);
        setPosts((current) => current.filter((item) => item.id !== post.id));
    };

    return (
        <RequireAuth>
            <main className="min-h-screen bg-gray-50">
                <Header />
                <section className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="bg-gradient-to-r from-gray-950 to-gray-700 px-5 py-8 text-white sm:px-8">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                                <Sparkles className="h-3.5 w-3.5" />
                                나의 피드
                            </div>
                            <h1 className="mt-4 text-3xl font-black">내가 공유한 여행 계획</h1>
                            <p className="mt-2 text-sm font-medium text-white/65">커뮤니티에 올린 여행 계획을 모아봅니다.</p>
                            <div className="mt-6 grid grid-cols-3 gap-2">
                                <FeedMetric label="게시글" value={stats.posts} />
                                <FeedMetric label="좋아요" value={stats.likes} />
                                <FeedMetric label="저장" value={stats.saves} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 flex justify-between gap-3">
                        <Link href="/community" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-black text-gray-900 shadow-sm transition hover:border-blue-400 hover:text-blue-700">
                            커뮤니티 피드
                        </Link>
                        <Link href="/community" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">
                            <Plus className="h-4 w-4" />
                            공유하기
                        </Link>
                    </div>

                    <div className="mt-5 grid gap-4">
                        {loading ? (
                            <EmptyState text="나의 피드를 불러오는 중입니다." />
                        ) : posts.length === 0 ? (
                            <EmptyState text="아직 공유한 여행 계획이 없습니다." />
                        ) : (
                            posts.map((post) => <MyFeedCard key={post.id} post={post} onDelete={() => void handleDelete(post)} />)
                        )}
                    </div>
                </section>
            </main>
        </RequireAuth>
    );
}

function MyFeedCard({ post, onDelete }: { post: CommunityPost; onDelete: () => void }) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="grid gap-4 p-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-gray-100 sm:aspect-auto sm:h-full">
                    <Image src={post.imageUrl || imageMap[post.imageKey] || tokyo} alt={`${post.city} 여행 이미지`} fill className="object-cover" sizes="220px" />
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-600">{post.city}</span>
                        <span className="text-xs font-bold text-gray-400">{relativeDate(post.createdAt)}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-black text-gray-950">{post.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">{post.caption}</p>
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center">
                        <MiniMetric label="기간" value={post.duration} icon={<CalendarDays className="h-4 w-4" />} />
                        <MiniMetric label="도시" value={post.city} icon={<MapPin className="h-4 w-4" />} />
                        <MiniMetric label="예산" value={post.budget} icon={<Sparkles className="h-4 w-4" />} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-bold text-gray-500">
                            좋아요 {post.likes.toLocaleString("ko-KR")} · 저장 {post.saves.toLocaleString("ko-KR")}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setMenuOpen((current) => !current)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
                                    aria-label="피드 메뉴"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {menuOpen && (
                                    <div className="absolute right-0 top-10 z-20 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                        <Link
                                            href="/community"
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                                        >
                                            <Pencil className="h-4 w-4" />
                                            수정
                                        </Link>
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
                            <Link href={`/community/plans/${post.id}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">
                                공개 뷰 보기
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

function FeedMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg bg-white/10 p-3 text-center">
            <div className="text-xl font-black">{value.toLocaleString("ko-KR")}</div>
            <div className="mt-1 text-xs font-bold text-white/60">{label}</div>
        </div>
    );
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-gray-500">
                {icon}
                {label}
            </div>
            <div className="mt-1 truncate text-sm font-black text-gray-950">{value}</div>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center text-sm font-bold text-gray-500 shadow-sm">
            {text}
        </div>
    );
}

function relativeDate(value: string) {
    return new Date(value).toLocaleDateString("ko-KR");
}
