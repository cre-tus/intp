import Image from "next/image";
import nagoya from "../../../image/Nagoya.png";

export default function Image5() {
    return (
        <div className="relative w-[305px] h-[410px] rounded-[16px] overflow-hidden shrink-0">
            <Image src={nagoya} alt="" fill className="object-cover" sizes="260px" />
        </div>
    );
}
