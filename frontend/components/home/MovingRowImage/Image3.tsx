import Image from "next/image";
import fukuoka from "../../../image/fukuoka.png";

export default function Image3() {
    return (
        <div className="relative w-[305px] h-[410px] rounded-[16px] overflow-hidden shrink-0">
            <Image src={fukuoka} alt="" fill className="object-cover" sizes="260px" />
        </div>
    );
}
