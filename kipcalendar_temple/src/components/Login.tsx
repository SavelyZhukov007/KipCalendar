// src/components/Login.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Typography, Spin, message, Card, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import '../styles/DemoStyles.css';
import logo from "../assets_logo/kip1.png";

const { Title, Text } = Typography;

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
        message.success('Вход выполнен успешно');
        setTimeout(() => navigate('/dashboard'), 500);
      } else if (res.status === 403) {
        const error = await res.json();
        message.warning('Email не подтвержден. Перенаправляем...');
        navigate('/verification', { state: { email: error.email } });
        setLoading(false);
      } else {
        const error = await res.json();
        message.error(error.error || 'Ошибка входа');
        setLoading(false);
      }
    } catch (error) {
      message.error('Ошибка соединения с сервером');
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
        <Card 
          style={{ 
            width: '100%', 
            maxWidth: 400, 
            background: 'rgba(30, 30, 30, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div className="form-container">
            <Title level={2} style={{ color: '#fff', textAlign: 'center', marginBottom: 24 }}>
              Вход
            </Title>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder="Логин"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.3)', color: '#fff' }}
                onPressEnter={handleLogin}
              />
              <Input.Password
                size="large"
                prefix={<LockOutlined />}
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.3)', color: '#fff' }}
                onPressEnter={handleLogin}
              />
              <Button
                type="primary"
                size="large"
                block
                loading={loading}
                onClick={handleLogin}
                style={{ height: 42 }}
              >
                Войти
              </Button>
              <div className="form-footer">
                <div className="link-row">
                  <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Нет аккаунта?</Text>
                  <Link to="/register" className="text-link">Зарегистрироваться</Link>
                </div>
                <Button 
                  type="link" 
                  onClick={() => navigate('/forgot-password')}
                  style={{ color: 'rgba(255, 255, 255, 0.7)', padding: 0 }}
                >
                  Забыл пароль
                </Button>
              </div>
            </Space>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
