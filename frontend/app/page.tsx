import InfpLogo from '@/components/infpLogo';

export default function Home() {
    return (
        <main
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <InfpLogo size={72} textSize={22} />
        </main>
    );
}
