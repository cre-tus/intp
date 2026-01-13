'use client';
export default function Login() {
    return (
        <section style={{ padding: '20px' }}>
            <form onSubmit={(e: React.FormEvent) => e.preventDefault()}>
                <fieldset style={{ width: 'fit-content' }}>

                    <table>
                        <tbody>
                        {/* 첫 번째 줄: 아이디 */}
                        <tr>
                            <td><label htmlFor="id">아이디</label></td>
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
                            <td><label htmlFor="password">비밀번호</label></td>
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