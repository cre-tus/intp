import Image from "next/image";
import tokyo from "../../../image/Tokyo.png";

export default function Image1() {
    return (
        <div className="relative w-[305px] h-[410px] rounded-[16px] overflow-hidden shrink-0">
            <Image src={tokyo} alt="" fill className="object-cover" sizes="260px" />
        </div>
    );
}
