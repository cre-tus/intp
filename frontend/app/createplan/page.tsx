import Header from "@/app/createplan/header";
import HeroSection from "@/components/planner/HeroSection";
import RequireAuth  from "@/components/requireAuth/RequireAuth";

export default function Home() {
    return (
        <RequireAuth>
            <main>
                <Header/>
                <HeroSection/>
            </main>
        </RequireAuth>
    );
}
