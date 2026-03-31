// src/components/Login.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, TextField, Typography, CircularProgress, Fade } from '@mui/material';
import '../styles/DemoStyles.css';
import logo from "../assets_logo/kip1.png"

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const navigate = useNavigate();
  const title = 'KipCalendar';
  const chars = title.split('').map((char, index) => (
    <span key={index} className="char" style={{ '--char-index': index } as React.CSSProperties}>
      {char}
    </span>
  ));

  useEffect(() => {
    // Проверяем наличие сохраненных данных для автозаполнения
    const savedUsername = localStorage.getItem('savedUsername');
    const savedPassword = localStorage.getItem('savedPassword');
    if (savedUsername) {
      setUsername(savedUsername);
    }
    if (savedPassword) {
      setPassword(savedPassword);
    }

    document.body.classList.add('animate');

    return () => {
      document.body.classList.remove('animate');
    };
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem('token', token);
        setFadeOut(true);
      } else if (res.status === 403) {
        const error = await res.json();
        alert('Email не подтвержден. Перенаправляем...');
        navigate('/verification', { state: { email: error.email } });
        setLoading(false);
      } else {
        const error = await res.json();
        alert(error.error || 'Ошибка входа');
        setLoading(false);
      }
    } catch (error) {
      /*      alert('Ошибка соединения с бэкендом');*/
      setLoading(false);
    }
  };

  const handleAnimationEnd = () => {
    if (fadeOut) {
      navigate('/dashboard');
    }
  };

  return (
    <Fade in={!fadeOut} timeout={500} onExited={handleAnimationEnd}>
      <div id="container">
        <div id="left">
          <h1>{chars}</h1>
          <img src={logo} alt="Kip Logo" />

        </div>
        <div id="right">
          <div className="form-container">
            <Typography variant="h4" gutterBottom sx={{ color: 'var(--text-light)', textAlign: 'center' }}>
              Вход
            </Typography>
            <TextField
              placeholder="Логин"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              margin="normal"
              InputProps={{
                style: { color: 'var(--text-light)' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--primary-light)' },
                },
                '& input::placeholder': { color: 'rgba(255, 255, 255, 0.7)', opacity: 1 },
              }}
            />
            <TextField
              placeholder="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              margin="normal"
              InputProps={{
                style: { color: 'var(--text-light)' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--primary-light)' },
                },
                '& input::placeholder': { color: 'rgba(255, 255, 255, 0.7)', opacity: 1 },
              }}
            />
            <Button
              onClick={handleLogin}
              variant="contained"
              fullWidth
              disabled={loading}
              className="submit-btn"
              sx={{ mt: 2 }}
            >
              Войти
            </Button>
            {loading && <CircularProgress sx={{ mt: 2, display: 'block', mx: 'auto', color: 'var(--text-light)' }} />}
            <div className="form-footer">
              <div className="link-row">
                <span>Нет аккаунта?</span>
                <Link to="/register" className="text-link">Зарегистрироваться</Link>
              </div>
              <button className="ghost-button" onClick={() => navigate('/forgot-password')}>
                Забыл пароль
              </button>
            </div>
          </div>
        </div>
      </div>
    </Fade>
  );
};

export default Login;