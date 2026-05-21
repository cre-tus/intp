import PrimaryButton from "@/components/home/Buttons/PrimaryButton";
import SecondaryButton from "@/components/home/Buttons/SecondaryButton";

export default function Buttons() {
    return (
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <PrimaryButton/>
            <SecondaryButton/>
        </div>

    );
}

