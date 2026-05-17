import Header from "@/app/createplan/header";
import HeroSection from "@/components/planner/HeroSection";
import RequireAuth from "@/components/requireAuth/RequireAuth";

export default async function CreatePlanByIdPage({
    params,
}: {
    params: Promise<{ createid: string }>;
}) {
    const { createid } = await params;

    return (
        <RequireAuth>
            <main>
                <Header />
                <HeroSection createId={createid} />
            </main>
        </RequireAuth>
    );
}
