import Image from "next/image";
import osaka from "../../../image/Osaka.png";

export default function Image2() {
    return (
        <div className="relative w-[305px] h-[410px] rounded-[16px] overflow-hidden shrink-0">
            <Image src={osaka} alt="" fill className="object-cover" sizes="260px" />
        </div>
    );
}
