import { api } from "@/service/api";

export type FollowStats = {
    userId: number;
    followers: number;
    following: number;
};

export type FollowStatus = {
    userId: number;
    following: boolean;
    followers: number;
    followingCount: number;
};

export type FollowUser = {
    userId: number;
    nickname: string;
    handle: string;
    avatar: string;
    following: boolean;
};

export async function loadMyFollowStats() {
    const response = await api.get<FollowStats>("/api/follows/me/stats");
    return response.data;
}

export async function loadMyFollowers() {
    const response = await api.get<FollowUser[]>("/api/follows/me/followers");
    return response.data;
}

export async function loadMyFollowing() {
    const response = await api.get<FollowUser[]>("/api/follows/me/following");
    return response.data;
}

export async function toggleUserFollow(userId: number) {
    const response = await api.post<FollowStatus>(`/api/follows/users/${userId}/toggle`);
    return response.data;
}
