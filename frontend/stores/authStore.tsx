
import { create } from "zustand";
import { api } from "@/service/api";


interface Me {
    id: number;
    email: string;
    nickname?: string;
    role?: "USER" | "ADMIN";
}


interface AuthState {

    me: Me | null;
    isLoggedIn: boolean | null;
    fetchMe: () => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({

    me: null,
    isLoggedIn: null,


    fetchMe: async () => {
        try {
            const res = await api.get("/api/auth/me", {
                withCredentials: true,
            });
            set({
                me: res.data,      // 사용자 정보 저장
                isLoggedIn: true,  // 로그인 확정
            });
        } catch {
            set({
                me: null,
                isLoggedIn: false,
            });
        }
    },


    logout: async () => {
        try {
            await api.post("/api/auth/logout", {}, { withCredentials: true });
        } catch {
            // 로그아웃은 서버 쿠키/토큰 정리가 실패해도 클라이언트 상태를 반드시 비운다.
        } finally {
            set({
                me: null,
                isLoggedIn: false,
            });
        }
    },
}));
