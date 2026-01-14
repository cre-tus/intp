export default function Frame() {
    return (
        // ✅ 레이아웃용 wrapper (높이 확보)
        <div className="relative w-full h-[160px]">
            <div
                className="
          absolute top-0 bottom-0
          left-[114px] translate-x-[-50%]
          flex flex-col justify-center
          w-[154px]
          text-[32px] text-black text-center
          tracking-[-0.5px]
        "
            >
                <p className="leading-[1.45] whitespace-pre-wrap font-[var(--font-paperlogy)] font-semibold">
                    추천 여행지
                </p>
            </div>
        </div>
    );
}
