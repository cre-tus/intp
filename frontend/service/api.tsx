import axios from "axios";
import {useAuthStore} from "@/stores/authStore";

export const api = axios.create({

    baseURL: "",
    withCredentials: true, // 쿠키 기반 인증
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err?.response?.status === 401) {
            // 세션 만료/토큰 만료 등 → 전역 로그인 상태 풀기
            useAuthStore.getState().logout?.();
            // 또는 더 가볍게: useAuthStore.getState().setLoggedOut();
        }
        return Promise.reject(err);
    }
);