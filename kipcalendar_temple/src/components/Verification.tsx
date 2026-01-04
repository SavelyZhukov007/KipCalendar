import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input, Button, Typography, message, Card, Space } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import '../styles/DemoStyles.css';

const { Title, Text } = Typography;

const Verification: React.FC = () => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';

    const handleVerify = async () => {
        if (code.length !== 6) {
            setError('Введите 6-значный код');
            message.error('Введите 6-значный код');
            return;
        }

        setLoading(true);
        setError('');

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
                const err = await res.json();
                setError(err.error || 'Неверный код');
                message.error(err.error || 'Неверный код');
            }
        } catch (error) {
            setError('Ошибка соединения');
            message.error('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        try {
            const res = await fetch('http://localhost:5000/resend-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                message.success('Новый код отправлен на почту');
            } else {
                message.error('Ошибка отправки');
            }
        } catch (error) {
            message.error('Ошибка отправки');
        }
    };

    return (
        <div id="container">
            <div id="left">
                <h1>KipCalendar</h1>
            </div>
            <div id="right">
                <Card 
                    style={{ 
                        width: '100%', 
                        maxWidth: 400, 
                        background: 'rgba(30, 30, 30, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                >
                    <div className="form-container">
                        <Title level={2} style={{ color: '#fff', textAlign: 'center', marginBottom: 16 }}>
                            Подтверждение email
                        </Title>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: 24, textAlign: 'center' }}>
                            Код отправлен на {email}
                        </Text>

                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <Input
                                size="large"
                                prefix={<SafetyOutlined />}
                                placeholder="6-значный код"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength={6}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                    color: '#fff',
                                    fontSize: 20,
                                    letterSpacing: 8,
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
                                style={{ height: 42 }}
                            >
                                Подтвердить
                            </Button>

                            <Button
                                type="link"
                                block
                                onClick={handleResend}
                                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                            >
                                Отправить код повторно
                            </Button>
                        </Space>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Verification;
