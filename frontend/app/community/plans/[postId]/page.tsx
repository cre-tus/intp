import Header from "@/app/header";
import SharedPlanView from "@/app/community/plans/[postId]/shared-plan-view";

export default async function CommunitySharedPlanPage({
    params,
}: {
    params: Promise<{ postId: string }>;
}) {
    const { postId } = await params;

    return (
        <main>
            <Header />
            <SharedPlanView postId={Number(postId)} />
        </main>
    );
}
