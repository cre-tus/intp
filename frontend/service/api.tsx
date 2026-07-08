import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/authStore";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
    _retry?: boolean;
};

const refreshClient = axios.create({
    baseURL: "",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

export const api = axios.create({
    baseURL: "",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

let refreshPromise: Promise<void> | null = null;

function shouldSkipRefresh(url?: string) {
    return (
        !url ||
        url.includes("/api/auth/login") ||
        url.includes("/api/auth/logout") ||
        url.includes("/api/auth/refresh")
    );
}

function refreshSession() {
    if (!refreshPromise) {
        refreshPromise = refreshClient
            .post("/api/auth/refresh")
            .then(() => undefined)
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}

api.interceptors.response.use(
    (res) => res,
    async (err: AxiosError) => {
        const status = err.response?.status;
        const originalRequest = err.config as RetriableRequestConfig | undefined;

        if (status !== 401 || !originalRequest || originalRequest._retry || shouldSkipRefresh(originalRequest.url)) {
            return Promise.reject(err);
        }

        originalRequest._retry = true;

        try {
            await refreshSession();
            return api(originalRequest);
        } catch (refreshError) {
            useAuthStore.setState({
                me: null,
                isLoggedIn: false,
            });
            return Promise.reject(refreshError);
        }
    }
);
