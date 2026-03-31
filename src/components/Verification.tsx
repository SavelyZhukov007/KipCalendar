import React, { useState } from 'react';
import { Input, Button, Typography, message, Card } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Title, Text } = Typography;

const Verification: React.FC = () => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';

    const handleVerify = async () => {
        if (code.length !== 6) {
            message.error('Введите 6-значный код');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('token', data.token);
                localStorage.setItem('user_id', data.user_id);
                message.success('Email подтвержден');
                navigate('/dashboard');
            } else {
                message.error('Неверный код');
            }
        } catch {
            message.error('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        try {
            await fetch('http://localhost:5000/resend-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            message.success('Новый код отправлен');
        } catch {
            message.error('Ошибка отправки');
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: '#f0f2f5'
        }}>
            <Card style={{ width: 400, padding: 24 }}>
                <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
                    Подтверждение email
                </Title>
                <Text style={{ display: 'block', textAlign: 'center', marginBottom: 24, color: '#666' }}>
                    Код отправлен на {email}
                </Text>

                <Input
                    size="large"
                    prefix={<SafetyOutlined />}
                    placeholder="6-значный код"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    style={{
                        marginBottom: 16,
                        fontSize: 18,
                        letterSpacing: 4,
                        textAlign: 'center'
                    }}
                    onPressEnter={handleVerify}
                />

                <Button
                    type="primary"
                    size="large"
                    block
                    loading={loading}
                    disabled={code.length !== 6}
                    onClick={handleVerify}
                    style={{ marginBottom: 8 }}
                >
                    Подтвердить
                </Button>

                <Button type="link" block onClick={handleResend}>
                    Отправить код повторно
                </Button>
            </Card>
        </div>
    );
};

export default Verification;