"use client";

import PrimaryButton from "@/components/home/Buttons/PrimaryButton";
import SecondaryButton from "@/components/home/Buttons/SecondaryButton";
import DownloadButton from "@/components/home/Buttons/DownloadButton";
import { useAuthStore } from "@/stores/authStore";

export default function Buttons() {
    const { me } = useAuthStore();
    const isAdmin = me?.role === "ADMIN";

    return (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <PrimaryButton/>
            <SecondaryButton/>
            {isAdmin && <DownloadButton/>}
        </div>

    );
}

