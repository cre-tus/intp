export function ProfileIcon({
        size = 28,
        color = "#111",
        }: {
        size?: number;
        color?: string;
        }) {
        return (
<svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ color }}
        >
<circle
cx="16"
cy="16"
r="15"
stroke="currentColor"
strokeWidth="2"
fill="none"
/>

<circle
cx="16"
cy="13"
r="4"
fill="currentColor"
/>

<path
d="M8 26c0-4.2 4-6.5 8-6.5s8 2.3 8 6.5"
fill="currentColor"
/>
        </svg>
        );
        }
