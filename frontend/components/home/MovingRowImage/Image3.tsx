import Image from "next/image";
import fukuoka from "../../../image/fukuoka.png";

export default function Image3() {
    return (
        <div className="group relative h-[360px] w-[270px] shrink-0 overflow-hidden rounded-2xl border border-white bg-gray-100 shadow-xl shadow-gray-900/10 sm:h-[410px] sm:w-[305px]">
            <Image src={fukuoka} alt="후쿠오카 여행지 이미지" fill className="object-cover transition duration-500 group-hover:scale-105" sizes="305px" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5 text-left text-white">
                <p className="text-xl font-bold">Fukuoka</p>
                <p className="mt-1 text-sm text-white/80">가볍게 떠나는 휴식</p>
            </div>
        </div>
    );
}
