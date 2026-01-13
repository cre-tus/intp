import localFont from 'next/font/local';

export const metadata = {
    title: 'INFP',
    description: 'Travel Route Optimization',
};

const infpFont = localFont({
    src: [
        {
            path: '../fonts/Paperlogy-6SemiBold.woff2',
            weight: '400',
            style: 'normal',
        },
    ],
    variable: '--font-infp',
    display: 'swap',
});

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko" className={infpFont.variable}>
        <body>{children}</body>
        </html>
    );
}
