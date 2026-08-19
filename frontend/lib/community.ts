import { api } from "@/service/api";
import {
    generatePlanId,
    saveTravelPlan,
    type TravelPlanDraft,
    type TravelPlanTemplate,
    type TravelPlanTier,
} from "@/lib/travelPlans";

export type CommunityImageKey = "tokyo" | "osaka" | "sapporo" | "fukuoka" | "nagoya";
export type CommunityPostType = "plan" | "photo" | "qna";

export type CommunityPost = {
    id: number;
    postType?: CommunityPostType;
    planId?: string | null;
    authorId: number;
    author: string;
    handle: string;
    avatar: string;
    title: string;
    city: string;
    duration: string;
    budget: string;
    imageKey: CommunityImageKey;
    imageUrl?: string | null;
    mediaType?: "image" | "video" | null;
    mediaUrl?: string | null;
    mediaOriginalFilename?: string | null;
    mediaMimeType?: string | null;
    mediaSizeBytes?: number | null;
    mediaDurationSeconds?: number | null;
    caption: string;
    questionDetail?: string | null;
    attempted?: string | null;
    answerPreference?: string | null;
    tags: string[];
    route: string[];
    likes: number;
    comments: number;
    saves: number;
    liked: boolean;
    saved: boolean;
    followingAuthor: boolean;
    ownPost: boolean;
    createdAt: string;
};

export type CommunityPostPayload = {
    postType?: CommunityPostType;
    planId?: string;
    title: string;
    city: string;
    duration: string;
    budget: string;
    imageKey: CommunityImageKey;
    imageUrl?: string | null;
    mediaType?: "image" | "video" | null;
    mediaUrl?: string | null;
    mediaOriginalFilename?: string | null;
    mediaMimeType?: string | null;
    mediaSizeBytes?: number | null;
    mediaDurationSeconds?: number | null;
    caption: string;
    questionDetail?: string | null;
    attempted?: string | null;
    answerPreference?: string | null;
    tags: string[];
    route: string[];
};

export type CommunityReaction = {
    postId: number;
    active: boolean;
    count: number;
};

export type CommunityCommentReaction = {
    commentId: number;
    active: boolean;
    count: number;
};

export type CommunityMediaUpload = {
    mediaType: "image" | "video";
    mediaUrl: string;
    originalFilename?: string | null;
    mimeType?: string | null;
    sizeBytes: number;
    durationSeconds?: number | null;
};

export type CommunityComment = {
    id: number;
    postId: number;
    authorId: number;
    author: string;
    avatar: string;
    content: string;
    ownComment: boolean;
    edited: boolean;
    likes: number;
    liked: boolean;
    createdAt: string;
    updatedAt: string;
};

export type CommunityPlanView = {
    postId: number;
    planId: string;
    postTitle: string;
    author: string;
    title: string;
    template: TravelPlanTemplate;
    tier: TravelPlanTier;
    contentJson: string;
    createdAt: string;
    updatedAt: string;
};

export type CommunityUserProfile = {
    userId: number;
    nickname: string;
    handle: string;
    avatar: string;
    statusMessage: string;
    followers: number;
    following: number;
    posts: number;
    sharedPlans: number;
    followingUser: boolean;
    ownProfile: boolean;
    feed: CommunityPost[];
};

export function isCommunityQnaPost(post: CommunityPost) {
    return post.postType === "qna" || Boolean(post.questionDetail?.trim());
}

export function normalizeCommunityPost(post: CommunityPost): CommunityPost {
    if (isCommunityQnaPost(post)) {
        return {
            ...post,
            postType: "qna",
            caption: post.caption || post.questionDetail || "",
        };
    }
    return {
        ...post,
        postType: post.postType ?? (post.planId ? "plan" : "photo"),
    };
}

export function normalizeCreatedCommunityPost(post: CommunityPost, payload: CommunityPostPayload): CommunityPost {
    if (payload.postType !== "qna") return normalizeCommunityPost(post);
    return normalizeCommunityPost({
        ...post,
        postType: "qna",
        planId: null,
        imageUrl: post.imageUrl || payload.imageUrl || null,
        mediaType: post.mediaType || payload.mediaType || null,
        mediaUrl: post.mediaUrl || payload.mediaUrl || null,
        caption: post.caption || payload.questionDetail || payload.caption || "",
        questionDetail: post.questionDetail || payload.questionDetail || payload.caption || "",
        attempted: post.attempted || payload.attempted || null,
        answerPreference: post.answerPreference || payload.answerPreference || null,
    });
}

export function forceCommunityQnaPost(post: CommunityPost): CommunityPost {
    return normalizeCommunityPost({
        ...post,
        postType: "qna",
        planId: null,
        imageUrl: post.imageUrl ?? null,
        mediaType: post.mediaType ?? null,
        mediaUrl: post.mediaUrl ?? null,
        questionDetail: post.questionDetail || post.caption || "",
        caption: post.caption || post.questionDetail || "",
    });
}

function normalizeCommunityPosts(posts: CommunityPost[]) {
    return posts.map(normalizeCommunityPost);
}

export async function loadCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts");
    return normalizeCommunityPosts(response.data);
}

export async function loadMyCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts/me");
    return normalizeCommunityPosts(response.data);
}

export async function loadCommunityUserProfile(userId: number) {
    const response = await api.get<CommunityUserProfile>(`/api/community/posts/users/${userId}/profile`);
    return {
        ...response.data,
        feed: normalizeCommunityPosts(response.data.feed ?? []),
    };
}

export async function loadSavedCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts/saved");
    return normalizeCommunityPosts(response.data);
}

export async function loadFollowingCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts/following");
    return normalizeCommunityPosts(response.data);
}

export async function loadPopularCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts/popular");
    return normalizeCommunityPosts(response.data);
}

export async function searchCommunityPosts(params: { q?: string; region?: string }) {
    const response = await api.get<CommunityPost[]>("/api/community/posts/search", { params });
    return normalizeCommunityPosts(response.data);
}

export async function searchCommunityRegions(q?: string) {
    const response = await api.get<string[]>("/api/community/posts/regions", { params: { q } });
    return response.data;
}

export async function createCommunityPost(payload: CommunityPostPayload) {
    const response = await api.post<CommunityPost>("/api/community/posts", payload);
    return normalizeCommunityPost(response.data);
}

export async function updateCommunityPost(postId: number, payload: CommunityPostPayload) {
    const response = await api.put<CommunityPost>(`/api/community/posts/${postId}`, payload);
    return normalizeCommunityPost(response.data);
}

export async function uploadCommunityPostMedia(file: File, durationSeconds?: number | null) {
    const formData = new FormData();
    formData.append("file", file);
    if (durationSeconds !== undefined && durationSeconds !== null) {
        formData.append("durationSeconds", String(Math.floor(durationSeconds)));
    }
    const response = await api.post<CommunityMediaUpload>("/api/community/posts/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
}

export async function deleteCommunityPost(postId: number) {
    await api.delete(`/api/community/posts/${postId}`);
}

export async function toggleCommunityPostLike(postId: number) {
    const response = await api.post<CommunityReaction>(`/api/community/posts/${postId}/like`);
    return response.data;
}

export async function toggleCommunityPostSave(postId: number) {
    const response = await api.post<CommunityReaction>(`/api/community/posts/${postId}/save`);
    return response.data;
}

export async function loadCommunityPostComments(postId: number) {
    const response = await api.get<CommunityComment[]>(`/api/community/posts/${postId}/comments`);
    return response.data;
}

export async function createCommunityPostComment(postId: number, content: string) {
    const response = await api.post<CommunityComment>(`/api/community/posts/${postId}/comments`, { content });
    return response.data;
}

export async function updateCommunityPostComment(postId: number, commentId: number, content: string) {
    const response = await api.put<CommunityComment>(`/api/community/posts/${postId}/comments/${commentId}`, { content });
    return response.data;
}

export async function deleteCommunityPostComment(postId: number, commentId: number) {
    await api.delete(`/api/community/posts/${postId}/comments/${commentId}`);
}

export async function toggleCommunityPostCommentLike(postId: number, commentId: number) {
    const response = await api.post<CommunityCommentReaction>(`/api/community/posts/${postId}/comments/${commentId}/like`);
    return response.data;
}

export async function loadCommunityPlanView(postId: number) {
    const response = await api.get<CommunityPlanView>(`/api/community/posts/${postId}/plan`);
    return {
        ...response.data,
        content: parseCommunityPlanContent(response.data),
    };
}

export async function copyCommunityPlanToMine(postId: number) {
    try {
        const response = await api.post<{ id: string }>(`/api/community/posts/${postId}/plan/copy`);
        return response.data;
    } catch (error) {
        if (!shouldFallbackCopy(error)) throw error;
        const shared = await loadCommunityPlanView(postId);
        return saveTravelPlan(createCopiedCommunityPlan(shared));
    }
}

function parseCommunityPlanContent(view: CommunityPlanView): TravelPlanDraft {
    const parsed = JSON.parse(view.contentJson || "{}") as Partial<TravelPlanDraft>;
    return {
        id: view.planId,
        title: view.title,
        template: view.template,
        tier: view.tier,
        costCurrency: parsed.costCurrency === "JPY" ? "JPY" : "KRW",
        tripContext: {
            countryCode: parsed.tripContext?.countryCode ?? "KR",
            companionType: parsed.tripContext?.companionType ?? "unknown",
            childAgeBucket: parsed.tripContext?.childAgeBucket ?? "unknown",
            groupAgeBucket: parsed.tripContext?.groupAgeBucket ?? "unknown",
            monthBucket: parsed.tripContext?.monthBucket ?? "unknown",
            seasonBucket: parsed.tripContext?.seasonBucket ?? "unknown",
            rainySeason: Boolean(parsed.tripContext?.rainySeason),
        },
        checklist: parsed.checklist ?? [],
        days: parsed.days ?? [],
        participants: [],
        createdAt: view.createdAt,
        updatedAt: view.updatedAt,
    };
}

function createCopiedCommunityPlan(view: CommunityPlanView & { content: TravelPlanDraft }): TravelPlanDraft {
    const id = generatePlanId();
    const now = new Date().toISOString();
    const title = copiedPlanTitle(view.title, view.author);
    return {
        ...clonePlan(view.content),
        id,
        title,
        template: view.template === "spreadsheet" ? "basic" : view.template,
        tier: "FREE",
        participants: [],
        checklist: view.content.checklist.map((item, index) => ({
            ...item,
            id: Date.now() + index,
        })),
        days: view.content.days.map((day) => ({
            ...day,
            id: generatePlanId(),
            activities: day.activities.map((activity) => ({
                ...activity,
                id: generatePlanId(),
            })),
        })),
        createdAt: now,
        updatedAt: now,
    };
}

function copiedPlanTitle(title: string, author: string) {
    const suffix = ` - ${author || "공유자"}님 공유 일정 복사됨`;
    const baseLength = Math.max(1, 120 - suffix.length);
    return `${title || "공유 여행 계획"}`.slice(0, baseLength) + suffix;
}

function clonePlan(plan: TravelPlanDraft): TravelPlanDraft {
    return JSON.parse(JSON.stringify(plan)) as TravelPlanDraft;
}

function shouldFallbackCopy(error: unknown) {
    if (typeof error !== "object" || error === null || !("response" in error)) return false;
    const status = (error as { response?: { status?: number } }).response?.status;
    return status === 404 || status === 500;
}
