"use client";

import dynamic from "next/dynamic";

const ServerTestClient = dynamic(() => import("@/components/admin/ServerTestClient"), {
    loading: () => (
        <main className="mx-auto max-w-7xl px-4 py-8">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
                <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-gray-100" />
                <div className="mt-6 grid gap-4 lg:grid-cols-4">
                    <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
                    <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
                    <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
                    <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
                </div>
            </div>
        </main>
    ),
    ssr: false,
});

export default function ServerTestLoader() {
    return <ServerTestClient />;
}
