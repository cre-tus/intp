import TypingText from "@/components/home/TypingText";
import Buttons from "@/components/home/Buttons";
import Frame from "@/components/home/Frame";
import MovingRow from "@/components/home/MovingRow";
import Image1 from "@/components/home/MovingRowImage/Image1";
import Image2 from "@/components/home/MovingRowImage/Image2";
import Image3 from "@/components/home/MovingRowImage/Image3";
import Image4 from "@/components/home/MovingRowImage/Image4";
import Image5 from "@/components/home/MovingRowImage/Image5";

export default function HeroSection() {
    return (
        <section className="w-full border-t">
            <div className="mx-auto max-w-[1280px] px-6 py-60">
                <div className="flex flex-col items-center text-center gap-6">
                    <h1 className="font-[var(--font-paperlogy)] font-normal text-[64px] leading-[1.05] tracking-[-0.02em] text-black mb-[-0.1px]">
                        나만의 여행 플래너 지금 만드세요.
                    </h1>

                    {/* ✅ 타이틀 아래 24px 간격은 gap-6가 처리 */}
                    <TypingText />

                    {/* ✅ TypingText 아래도 24px 간격 유지하려면 Buttons도 “직접 자식”으로 두는 게 깔끔 */}
                    <Buttons />

                    <Frame/>

                    <MovingRow>
                        <Image1 />
                        <Image2 />
                        <Image3 />
                        <Image4 />
                        <Image5 />
                    </MovingRow>
                </div>
            </div>
        </section>
    );
}
