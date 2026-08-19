"use client";

import Header from "@/app/header";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, CalendarDays, FileText, Heart, MapPin, MessageCircle, MoreHorizontal, Pencil, Play, Plus, Sparkles, Trash2, X } from "lucide-react";
import tokyo from "@/image/Tokyo.png";
import osaka from "@/image/Osaka.png";
import sapporo from "@/image/Sapporo.png";
import fukuoka from "@/image/fukuoka.png";
import nagoya from "@/image/Nagoya.png";
import { deleteCommunityPost, isCommunityQnaPost, loadMyCommunityPosts, type CommunityImageKey, type CommunityPost } from "@/lib/community";
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
    const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);

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
        if (!window.confirm("커뮤니티 피드를 삭제할까요?")) return;
        await deleteCommunityPost(post.id);
        setPosts((current) => current.filter((item) => item.id !== post.id));
    };

    return (
        <RequireAuth>
            <main className="min-h-screen bg-white">
                <Header />
                <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
                    <div className="flex flex-col gap-5 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-500">
                                <Sparkles className="h-3.5 w-3.5" />
                                My Feed
                            </div>
                            <h1 className="mt-2 text-3xl font-black text-gray-950 sm:text-4xl">나의 피드</h1>
                            <p className="mt-2 text-sm font-medium text-gray-500">내가 공유한 여행 사진, 계획, Q&A를 한곳에서 관리합니다.</p>
                        </div>

                        <div className="grid w-full grid-cols-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-center sm:w-auto sm:min-w-80">
                            <FeedMetric label="게시물" value={stats.posts} />
                            <FeedMetric label="좋아요" value={stats.likes} />
                            <FeedMetric label="저장" value={stats.saves} />
                        </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                        <Link href="/community" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-black text-gray-900 transition hover:border-gray-400 hover:bg-gray-50">
                            커뮤니티 피드
                        </Link>
                        <Link href="/community" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black !text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                            <Plus className="h-4 w-4" />
                            공유하기
                        </Link>
                    </div>

                    <div className="mt-6">
                        {loading ? (
                            <EmptyState text="나의 피드를 불러오는 중입니다." />
                        ) : posts.length === 0 ? (
                            <EmptyState text="아직 공유한 피드가 없습니다." />
                        ) : (
                            <div className="grid grid-cols-3 gap-1 sm:gap-2">
                                {posts.map((post) => (
                                    <MyFeedTile
                                        key={post.id}
                                        post={post}
                                        onOpen={() => setSelectedPost(post)}
                                        onDelete={() => void handleDelete(post)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
                {selectedPost && (
                    <FeedDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
                )}
            </main>
        </RequireAuth>
    );
}

function MyFeedTile({ post, onOpen, onDelete }: { post: CommunityPost; onOpen: () => void; onDelete: () => void }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const isQna = isCommunityQnaPost(post);
    const imageSrc = post.imageUrl || imageMap[post.imageKey] || tokyo;

    return (
        <article className="group relative aspect-square overflow-hidden bg-gray-100">
            {isQna && !post.imageUrl ? (
                <div className="flex h-full flex-col justify-between bg-gray-950 p-3 text-white sm:p-5">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/12">
                        <MessageCircle className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="text-[11px] font-black uppercase text-white/50">Q&A</div>
                        <h2 className="mt-1 line-clamp-3 text-sm font-black leading-5 sm:text-base">{post.title || "질문"}</h2>
                    </div>
                </div>
            ) : (
                <>
                    {post.mediaType === "video" && post.mediaUrl ? (
                        <video src={post.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                        <Image src={imageSrc} alt={post.title || post.caption || "피드 이미지"} fill className="object-cover transition duration-300 group-hover:scale-105" sizes="(max-width: 640px) 33vw, 360px" unoptimized={Boolean(post.imageUrl)} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent opacity-0 transition group-hover:opacity-100" />
                </>
            )}

            <div className="absolute left-2 top-2 flex gap-1.5 sm:left-3 sm:top-3">
                {post.mediaType === "video" && (
                    <TypeBadge label="영상" icon={<Play className="h-3.5 w-3.5 fill-current" />} />
                )}
                {post.planId && (
                    <TypeBadge label="계획" icon={<FileText className="h-3.5 w-3.5" />} />
                )}
                {isQna && (
                    <TypeBadge label="Q&A" icon={<MessageCircle className="h-3.5 w-3.5" />} />
                )}
            </div>

            <button
                type="button"
                onClick={onOpen}
                className="absolute inset-0 cursor-pointer text-left"
                aria-label={`${post.title || "피드"} 보기`}
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden p-3 text-white opacity-0 transition group-hover:opacity-100 sm:block">
                <h2 className="line-clamp-1 text-sm font-black">{post.title || post.city || "피드"}</h2>
                <div className="mt-2 flex items-center gap-3 text-xs font-black">
                    <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5 fill-current" />{post.likes.toLocaleString("ko-KR")}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{post.comments.toLocaleString("ko-KR")}</span>
                    <span className="inline-flex items-center gap-1"><Bookmark className="h-3.5 w-3.5 fill-current" />{post.saves.toLocaleString("ko-KR")}</span>
                </div>
            </div>

            <div className="absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        setMenuOpen((current) => !current);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white opacity-100 backdrop-blur transition hover:bg-black/65 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="피드 메뉴"
                >
                    <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-9 z-20 w-32 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <Link href="/community" className="flex w-full items-center gap-2 bg-white px-3 py-2 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-950">
                            <Pencil className="h-4 w-4" />
                            수정
                        </Link>
                        <button
                            type="button"
                            onClick={() => {
                                setMenuOpen(false);
                                onDelete();
                            }}
                            className="flex w-full items-center gap-2 bg-white px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            삭제
                        </button>
                    </div>
                )}
            </div>
        </article>
    );
}

function FeedDetailModal({ post, onClose }: { post: CommunityPost; onClose: () => void }) {
    const isQna = isCommunityQnaPost(post);
    const imageSrc = post.imageUrl || imageMap[post.imageKey] || tokyo;
    const bodyText = isQna ? post.questionDetail || post.caption : post.caption;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-3 py-4 backdrop-blur-sm sm:px-6"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className="grid max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl md:grid-cols-[minmax(0,1.15fr)_380px]">
                <div className="relative min-h-[320px] bg-black md:min-h-[620px]">
                    {post.mediaType === "video" && post.mediaUrl ? (
                        <video src={post.mediaUrl} controls className="h-full max-h-[70vh] w-full bg-black object-contain md:max-h-none" />
                    ) : (
                        <Image src={imageSrc} alt={post.title || post.caption || "피드 이미지"} fill className="object-contain" sizes="(max-width: 768px) 100vw, 640px" unoptimized={Boolean(post.imageUrl)} />
                    )}
                </div>

                <div className="flex min-h-0 flex-col">
                    <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                {isQna && <span className="rounded-full bg-gray-950 px-2.5 py-1 text-xs font-black text-white">Q&A</span>}
                                {post.planId && <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">계획</span>}
                                {post.city && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-600">{post.city}</span>}
                            </div>
                            <h2 className="mt-3 line-clamp-2 text-lg font-black text-gray-950">{post.title || (isQna ? "질문" : "피드")}</h2>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
                            aria-label="닫기"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                        {bodyText && (
                            <p className="whitespace-pre-line text-sm font-medium leading-6 text-gray-700">{bodyText}</p>
                        )}

                        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center">
                            <DetailMetric label="기간" value={post.duration || "-"} icon={<CalendarDays className="h-4 w-4" />} />
                            <DetailMetric label="도시" value={post.city || "-"} icon={<MapPin className="h-4 w-4" />} />
                            <DetailMetric label="저장" value={post.saves.toLocaleString("ko-KR")} icon={<Bookmark className="h-4 w-4" />} />
                        </div>

                        {post.tags.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {post.tags.map((tag) => (
                                    <span key={tag} className="text-sm font-black text-gray-600">#{tag}</span>
                                ))}
                            </div>
                        )}

                        {post.planId && (
                            <Link href={`/community/plans/${post.id}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black !text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                                <FileText className="h-4 w-4" />
                                여행 계획 보기
                            </Link>
                        )}
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm font-black text-gray-700">
                        <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4" />{post.likes.toLocaleString("ko-KR")}</span>
                        <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />{post.comments.toLocaleString("ko-KR")}</span>
                        <span>{new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
                    </div>
                </div>
            </section>
        </div>
    );
}

function DetailMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function TypeBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-black text-white backdrop-blur">
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </span>
    );
}

function FeedMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="border-r border-gray-200 px-4 py-3 last:border-r-0">
            <div className="text-xl font-black text-gray-950">{value.toLocaleString("ko-KR")}</div>
            <div className="mt-1 text-xs font-bold text-gray-500">{label}</div>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-16 text-center text-sm font-bold text-gray-500">
            {text}
        </div>
    );
}
