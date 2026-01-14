import PrimaryButton from "@/components/home/Buttons/PrimaryButton";
import SecondaryButton from "@/components/home/Buttons/SecondaryButton";

export default function Buttons() {
    return (
        <div className="flex items-center justify-center space-x-6">
            <PrimaryButton/>
            <SecondaryButton/>
        </div>

    );
}

