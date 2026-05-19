export default function LoginButton({ disabled = false }: { disabled?: boolean }) {
    return (
        <button
            type="submit"
            disabled={disabled}
            className="rounded-lg bg-black px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
            {disabled ? "로그인 중..." : "로그인"}
        </button>
    );
}
