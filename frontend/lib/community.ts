import { api } from "@/service/api";
import {
    generatePlanId,
    saveTravelPlan,
    type TravelPlanDraft,
    type TravelPlanTemplate,
    type TravelPlanTier,
} from "@/lib/travelPlans";

export type CommunityImageKey = "tokyo" | "osaka" | "sapporo" | "fukuoka" | "nagoya";

export type CommunityPost = {
    id: number;
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
    caption: string;
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
    planId?: string;
    title: string;
    city: string;
    duration: string;
    budget: string;
    imageKey: CommunityImageKey;
    imageUrl?: string | null;
    caption: string;
    tags: string[];
    route: string[];
};

export type CommunityReaction = {
    postId: number;
    active: boolean;
    count: number;
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

export async function loadCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts");
    return response.data;
}

export async function loadMyCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts/me");
    return response.data;
}

export async function loadCommunityUserProfile(userId: number) {
    const response = await api.get<CommunityUserProfile>(`/api/community/posts/users/${userId}/profile`);
    return response.data;
}

export async function loadSavedCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts/saved");
    return response.data;
}

export async function loadFollowingCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts/following");
    return response.data;
}

export async function loadPopularCommunityPosts() {
    const response = await api.get<CommunityPost[]>("/api/community/posts/popular");
    return response.data;
}

export async function searchCommunityPosts(params: { q?: string; region?: string }) {
    const response = await api.get<CommunityPost[]>("/api/community/posts/search", { params });
    return response.data;
}

export async function searchCommunityRegions(q?: string) {
    const response = await api.get<string[]>("/api/community/posts/regions", { params: { q } });
    return response.data;
}

export async function createCommunityPost(payload: CommunityPostPayload) {
    const response = await api.post<CommunityPost>("/api/community/posts", payload);
    return response.data;
}

export async function updateCommunityPost(postId: number, payload: CommunityPostPayload) {
    const response = await api.put<CommunityPost>(`/api/community/posts/${postId}`, payload);
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
