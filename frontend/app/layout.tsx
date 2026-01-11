
export const metadata = {
    title: "INFP",
    description: "Travel Route Optimization",
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko">
        <body>{children}</body>
        </html>
    );
}
