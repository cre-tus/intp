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
        <section className="w-full overflow-x-hidden border-t">
            <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 sm:py-32 lg:py-56">
                <div className="flex min-w-0 flex-col items-center gap-6 text-center">
                    <h1 className="max-w-4xl break-keep font-[var(--font-paperlogy)] text-4xl font-normal leading-[1.08] text-black sm:text-5xl lg:text-[64px]">
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
