import localFont from 'next/font/local';
import InfpLogo from '@/components/infpLogo';

export const metadata = {
    title: 'INFP',
    description: 'Travel Route Optimization',
};

const infpFont = localFont({
    src: [
        {
            path: '../fonts/Paperlogy-6SemiBold.woff2',
            weight: '600',
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
        <body
            style={{
                margin: 0,
                fontFamily: 'var(--font-infp), system-ui, -apple-system, sans-serif',
            }}
        >
        {/* 전역 고정 로고 */}
        <div
            style={{
                position: 'fixed',
                top: 20,
                left: 20,
                zIndex: 1000,
            }}
        >
            <InfpLogo size={48} textSize={20} />
        </div>

        {/* 페이지 내용 */}
        {children}
        </body>
        </html>
    );
}
