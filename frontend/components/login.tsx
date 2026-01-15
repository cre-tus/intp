'use client';
import { useState, useEffect } from 'react';

export default function Login() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        // 2. 컴포넌트가 브라우저에 마운트된 후 저장된 테마 불러오기
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            setIsDarkMode(true);
        }
        setIsMounted(true);
    }, []);

    useEffect(() => {
        // 3. 마운트 전에는 실행하지 않음
        if (!isMounted) return;

        // 4. 상태에 따라 body 클래스 및 localStorage 업데이트
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode, isMounted]);

    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
    if (!isMounted) return null;
    return (
        <section style={{
            display: 'flex',
            justifyContent: 'center', // 가로 중앙
            alignItems: 'center',     // 세로 중앙
            minHeight: '100vh',      // 화면 높이 전체 사용
            padding: '1px'
        }}>
            {/* 테마 전환 버튼 */}
            <button
                onClick={toggleDarkMode}
                style={{
                    marginBottom: '20px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    borderRadius: '20px',
                    border: '1px solid var(--text-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-color)'
                }}
            >
                {isDarkMode ? '다크 모드' : '라이트 모드'}
            </button>
            <form onSubmit={(e: React.FormEvent) => e.preventDefault()}>
                <fieldset style={{ width: 'fit-content' }}>

                    <table>
                        <tbody>
                        {/* 첫 번째 줄: 아이디 */}
                        <tr>
                            <td style={{
                            fontFamily: 'var(--font-infp)',
                            fontSize: 50,
                            fontWeight: 1000,
                            letterSpacing: '0.2em',
                            color: 'black',
                            lineHeight: 1,
                        }}><label htmlFor="id">아이디</label></td>
                            <td>
                                <input
                                    type="text"
                                    id="id"
                                    name="id"
                                    placeholder="아이디를 입력하세요"
                                />
                            </td>
                        </tr>
                        {/* 두 번째 줄: 비밀번호 */}
                        <tr>
                            <td style={{
                                fontFamily: 'var(--font-infp)',
                                fontSize: 50,
                                fontWeight: 1000,
                                letterSpacing: '0.2em',
                                color: 'black',
                                lineHeight: 1,
                            }}><label htmlFor="password">비밀번호</label></td>
                            <td>
                                <input
                                    type="password" // 비밀번호는 보안을 위해 password 타입으로 변경
                                    id="password"
                                    name="password"
                                    placeholder="비밀번호를 입력하세요"
                                />
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    {/* 버튼을 감싸는 div를 추가해 위아래 간격을 줌 */}
                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                        <button type="submit" style={{ width: '100%', padding: '5px' }}>
                            로그인
                        </button>
                    </div>
                </fieldset>
            </form>
        </section>
    );
}