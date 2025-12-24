import React, { useState, useEffect } from 'react';
import { Typography, Container, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

const Profile: React.FC = () => {
    const [roles, setRoles] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        const headers: HeadersInit = { 'Authorization': token };
        const fetchRole = async () => {
            try {
                const res = await fetch('http://127.0.0.1:5000/role', { headers });
                if (res.ok) {
                    const data = await res.json();
                    setRoles(data.roles || []);
                    setCurrentRole(data.currentRole || '');
                }
            } catch (error: any) {
                console.error('Ошибка загрузки роли');
            }
        };
        fetchRole();
    }, [navigate]);

    const handleLogout = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            await fetch('http://127.0.0.1:5000/logout', {
                method: 'POST',
                headers: { 'Authorization': token }
            });
            localStorage.removeItem('token');
            navigate('/home');
        }
    };

    const handleSwitchRole = async () => {
        const other = roles.find(r => r !== currentRole);
        if (!other) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
        try {
            const res = await fetch('http://127.0.0.1:5000/switch-role', {
                method: 'POST',
                headers,
                body: JSON.stringify({ newRole: other })
            });
            if (res.ok) {
                setCurrentRole(other);
            }
        } catch (error: any) {
            alert('Ошибка переключения роли');
        }
    };

    return (
        <div className="profile-container">
            <div className="profile-header">
                <Typography variant="h4" className="profile-title">Профиль</Typography>
            </div>
            <div className="profile-info">
                <div className="profile-info-item">
                    <strong>Логин:</strong> {localStorage.getItem('username') || 'Неизвестно'}
                </div>
                <div className="profile-info-item">
                    <strong>Роль:</strong> {currentRole || 'Не выбрана'}
                </div>
            </div>
            <div className="role-blocks-container">
                <Box className="role-block">
                    <div className="role-block-title">Студент</div>
                    <div className="role-block-actions">
                        <Button className="profile-button profile-button-secondary" onClick={handleLogout}>Выйти</Button>
                    </div>
                </Box>
                <Box className="role-block">
                    <div className="role-block-title">Преподаватель</div>
                    <div className="role-block-actions">
                        <Button className="profile-button profile-button-secondary" onClick={handleLogout}>Выйти</Button>
                    </div>
                </Box>
                <Box className="role-block">
                    <div className="role-block-title">Администратор</div>
                    <div className="role-block-actions">
                        <Button className="profile-button profile-button-secondary" onClick={handleLogout}>Выйти</Button>
                    </div>
                </Box>
            </div>
            {roles.length > 1 && (
                <div className="profile-actions">
                    <Button 
                        className="profile-button profile-button-primary" 
                        onClick={handleSwitchRole}
                    >
                        Переключить роль
                    </Button>
                    <Button 
                        className="profile-button profile-button-secondary" 
                        onClick={handleLogout}
                    >
                        Выход
                    </Button>
                </div>
            )}
            {roles.length <= 1 && (
                <div className="profile-actions">
                    <Button 
                        className="profile-button profile-button-secondary" 
                        onClick={handleLogout}
                    >
                        Выход
                    </Button>
                </div>
            )}
        </div>
    );
};

export default Profile;