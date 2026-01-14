export default function SecondaryButton() {
    return (
        <button
            className="
        relative
        flex items-center justify-center
        h-[50px] px-[20px]
        rounded-[12px]
        font-[var(--font-paperlogy)]
        font-medium
        text-[18px]
        bg-[rgba(255,255,255,1)]
        text-[rgba(0,0,0,1)]
        tracking-[-0.09px]
        border-2
        border-[rgba(0,0,0,0.15)]
      "
        >
      <span
          aria-hidden={true}
          className="absolute inset-0 rounded-[12px] border-2 border-[rgba(0,0,0,0.15)] pointer-events-none"
      />
            Join
        </button>
    );
}
