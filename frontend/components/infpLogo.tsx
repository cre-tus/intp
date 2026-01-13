type InfpLogoProps = {
    size?: number;          // 아이콘 크기
    textSize?: number;      // PLANNER 글자 크기(px)
};

export default function InfpLogo({
                                     size = 64,
                                     textSize = 20,
                                 }: InfpLogoProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
            }}
        >
            {/* SVG Icon */}
            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id="infpGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                </defs>

                <rect width="100" height="100" rx="20" fill="url(#infpGradient)" />

                <circle cx="50" cy="48" r="30" stroke="white" strokeWidth="2.5" fill="none" opacity="0.9" />
                <circle cx="50" cy="48" r="26" stroke="white" strokeWidth="1" fill="none" opacity="0.3" />

                <path d="M50 48 L50 24 L45.5 33 Z" fill="white" />
                <path d="M50 48 L50 24 L54.5 33 Z" fill="white" opacity="0.85" />
                <path d="M50 48 L50 72 L45.5 63 Z" fill="white" opacity="0.5" />
                <path d="M50 48 L50 72 L54.5 63 Z" fill="white" opacity="0.35" />

                <g
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity="0.9"
                >
                    <path d="M47.5 13 L47.5 5 L52.5 13 L52.5 5" />
                    <path d="M13 46 L13 54" />
                    <path d="M87 46 L87 54 M87 46 L92 46 M87 50 L91 50" />
                    <path d="M47.5 83 L47.5 93 M47.5 83 L51 83 Q52.5 83 52.5 85.5 Q52.5 88 51 88 L47.5 88" />
                </g>

                <circle cx="50" cy="48" r="3" fill="white" />
            </svg>

            {/* PLANNER Text */}
            <span
                style={{
                    fontSize: textSize,
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    color: '#16a34a',
                    lineHeight: 1,
                }}
            >
        PLANNER
      </span>
        </div>
    );
}
