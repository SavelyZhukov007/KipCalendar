// src/components/Register.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, TextField, Typography, CircularProgress, Select, MenuItem } from '@mui/material';
import '../styles/DemoStyles.css';
import logo from "../assets_logo/kip1.jpeg"

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const title = 'KipCalendar';
  const chars = title.split('').map((char, index) => (
    <span key={index} className="char" style={{ '--char-index': index } as React.CSSProperties}>
      {char}
    </span>
  ));

  useEffect(() => {
      document.body.classList.add('animate');

    return () => {
      document.body.classList.remove('animate');
    };
  }, []);

  const handleRegister = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, email }),
      });
      if (res.ok) {
        localStorage.setItem('hasRegistered', 'true');
        localStorage.setItem('savedUsername', username);
        localStorage.setItem('savedPassword', password);
        navigate('/success');
      } else {
        const error = await res.json();
        alert(error.error || 'Ошибка регистрации');
      }
    } catch (error: any) {
/*      alert('Ошибка соединения с бэкендом: ' + (error.message || 'Неизвестная ошибка'));*/
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="container">
      <div id="left">
        <h1>{chars}</h1>
        <img src={logo} alt="Kip Logo" />
      </div>
      <div id="right">
        <div className="form-container">
          <Typography variant="h4" gutterBottom sx={{ color: 'var(--text-light)', textAlign: 'center' }}>
            Регистрация
          </Typography>
            <TextField
              label="Логин"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              margin="normal"
              InputLabelProps={{ style: { color: 'rgba(255, 255, 255, 0.7)' } }}
            />
            <TextField
              label="Электронная почта"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              margin="normal"
              InputLabelProps={{ style: { color: 'rgba(255, 255, 255, 0.7)' } }}
            />
            <TextField
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              margin="normal"
              InputLabelProps={{ style: { color: 'rgba(255, 255, 255, 0.7)' } }}
            />
          <Select value={role} onChange={(e) => setRole(e.target.value)} fullWidth margin="dense">
            <MenuItem value="student">Студент</MenuItem>
            <MenuItem value="teacher">Преподаватель</MenuItem>
            <MenuItem value="admin">Администратор</MenuItem>
          </Select>
          <Button
            onClick={handleRegister}
            variant="contained"
            fullWidth
            disabled={loading}
            className="submit-btn"
            sx={{ mt: 2 }}
          >
            Зарегистрироваться
          </Button>
          {loading && <CircularProgress sx={{ mt: 2, display: 'block', mx: 'auto', color: 'var(--text-light)' }} />}
          <div className="form-footer">
            <div className="link-row">
              <span>Уже есть аккаунт?</span>
              <Link to="/login" className="text-link">Войти</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;