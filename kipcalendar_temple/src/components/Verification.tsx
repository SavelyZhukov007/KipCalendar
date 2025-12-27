import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TextField, Button, Typography, CircularProgress } from '@mui/material';
import '../styles/DemoStyles.css';

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
                navigate('/dashboard');
            } else {
                const err = await res.json();
                setError(err.error || 'Неверный код');
            }
        } catch (error) {
            setError('Ошибка соединения');
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
                alert('Новый код отправлен на почту');
            }
        } catch (error) {
            alert('Ошибка отправки');
        }
    };

    return (
        <div id="container">
            <div id="left">
                <h1>KipCalendar</h1>
            </div>
            <div id="right">
                <div className="form-container">
                    <Typography variant="h4" gutterBottom sx={{ color: 'var(--text-light)' }}>
                        Подтверждение email
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                        Код отправлен на {email}
                    </Typography>

                    <TextField
                        label="6-значный код"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        fullWidth
                        margin="normal"
                        inputProps={{ maxLength: 6, style: { letterSpacing: '5px', fontSize: '20px' } }}
                        InputLabelProps={{ style: { color: 'rgba(255, 255, 255, 0.7)' } }}
                    />

                    {error && (
                        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                            {error}
                        </Typography>
                    )}

                    <Button
                        onClick={handleVerify}
                        variant="contained"
                        fullWidth
                        disabled={loading || code.length !== 6}
                        className="submit-btn"
                        sx={{ mt: 2 }}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Подтвердить'}
                    </Button>

                    <Button
                        onClick={handleResend}
                        variant="text"
                        fullWidth
                        sx={{ mt: 1, color: 'rgba(255,255,255,0.7)' }}
                    >
                        Отправить код повторно
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Verification;