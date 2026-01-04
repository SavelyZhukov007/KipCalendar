// src/components/Register.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Typography, Select, message, Card, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import '../styles/DemoStyles.css';
import logo from "../assets_logo/kip1.png";

const { Title, Text } = Typography;
const { Option } = Select;

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
    if (!email.includes('@')) {
      message.error('Введите корректный email');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, email }),
      });

      if (res.ok) {
        message.success('Регистрация успешна. Проверьте email для подтверждения.');
        navigate('/verification', { state: { email } });
      } else {
        const error = await res.json();
        message.error(error.error || 'Ошибка регистрации');
      }
    } catch (error: any) {
      message.error('Ошибка соединения');
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
              Регистрация
            </Title>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder="Логин"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.3)', color: '#fff' }}
              />
              <Input
                size="large"
                prefix={<MailOutlined />}
                type="email"
                placeholder="Электронная почта"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.3)', color: '#fff' }}
              />
              <Input.Password
                size="large"
                prefix={<LockOutlined />}
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.3)', color: '#fff' }}
                onPressEnter={handleRegister}
              />
              <Select
                size="large"
                value={role}
                onChange={setRole}
                style={{ width: '100%' }}
              >
                <Option value="student">Студент</Option>
                <Option value="teacher">Преподаватель</Option>
                <Option value="admin">Администратор</Option>
              </Select>
              <Button
                type="primary"
                size="large"
                block
                loading={loading}
                onClick={handleRegister}
                style={{ height: 42 }}
              >
                Зарегистрироваться
              </Button>
              <div className="form-footer">
                <div className="link-row">
                  <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Уже есть аккаунт?</Text>
                  <Link to="/login" className="text-link">Войти</Link>
                </div>
              </div>
            </Space>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Register;
