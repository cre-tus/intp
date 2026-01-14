export default function MovingRow({ children }: { children: React.ReactNode }) {
    return (
        <div className="overflow-hidden w-full">
            <div className="moving-wrap flex w-max">
                <div className="moving-track flex gap-6">
                    {children}
                    <div className="w-6 shrink-0" aria-hidden />
                </div>

                <div className="moving-track flex gap-6" aria-hidden>
                    {children}
                    <div className="w-6 shrink-0" aria-hidden />
                </div>
            </div>
        </div>
    );
}
