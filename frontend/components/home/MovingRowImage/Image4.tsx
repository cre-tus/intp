import Image from "next/image";
import sapporo from "../../../image/Sapporo.png";

export default function Image4() {
    return (
        <div className="relative w-[305px] h-[410px] rounded-[16px] overflow-hidden shrink-0">
            <Image src={sapporo} alt="" fill className="object-cover" sizes="260px" />
        </div>
    );
}
