import React, { useState, useEffect } from 'react';
import { Typography, Button, Box, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

const Profile: React.FC = () => {
    const [userId, setUserId] = useState('');
    const [email, setEmail] = useState('');
    const [roles, setRoles] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState('');
    const [openOrgDialog, setOpenOrgDialog] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [orgShortName, setOrgShortName] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }

        const headers: HeadersInit = { 'Authorization': token };

        const fetchProfile = async () => {
            try {
                const res = await fetch('http://127.0.0.1:5000/role', { headers });
                if (res.ok) {
                    const data = await res.json();
                    setRoles(data.roles || []);
                    setCurrentRole(data.currentRole || '');
                }

                // Получаем user_id из JWT токена
                const tokenData = JSON.parse(atob(token.split('.')[1]));
                setUserId(tokenData.user_id || 'N/A');
            } catch (error: any) {
                console.error('Ошибка загрузки профиля');
            }
        };
        fetchProfile();
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

    const handleCreateOrg = async () => {
        if (!orgName.trim()) return alert('Введите название');

        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const res = await fetch('http://127.0.0.1:5000/api/organizations/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({
                    name: orgName,
                    short_name: orgShortName,
                    type: 'education'
                })
            });

            if (res.ok) {
                alert('Организация создана!');
                setOpenOrgDialog(false);
                setOrgName('');
                setOrgShortName('');
            }
        } catch (error) {
            alert('Ошибка создания организации');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Скопировано: ' + text);
    };

    return (
        <div className="profile-container">
            <div className="profile-header">
                <Typography variant="h4" className="profile-title">Профиль</Typography>
            </div>

            <div className="profile-info">
                <div className="profile-info-item">
                    <strong>User ID:</strong> {userId}
                    <Button size="small" onClick={() => copyToClipboard(userId)}>Копировать</Button>
                </div>
                <div className="profile-info-item">
                    <strong>Логин:</strong> {localStorage.getItem('username') || 'Неизвестно'}
                </div>
                <div className="profile-info-item">
                    <strong>Роль:</strong> {currentRole || 'Не выбрана'}
                </div>
            </div>

            <div className="profile-actions">
                <Button
                    className="profile-button profile-button-primary"
                    onClick={() => setOpenOrgDialog(true)}
                >
                    Создать организацию
                </Button>
                <Button
                    className="profile-button profile-button-secondary"
                    onClick={() => navigate('/kipswift')}
                >
                    Мессенджер
                </Button>
                <Button
                    className="profile-button profile-button-secondary"
                    onClick={handleLogout}
                >
                    Выход
                </Button>
            </div>

            {/* Диалог создания организации */}
            <Dialog open={openOrgDialog} onClose={() => setOpenOrgDialog(false)}>
                <DialogTitle>Создание организации</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" gutterBottom>
                        Тип: Образовательное учреждение (Школа/СПО/Университет)
                    </Typography>
                    <TextField
                        label="Полное название"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        fullWidth
                        margin="normal"
                    />
                    <TextField
                        label="Сокращенное название (опционально)"
                        value={orgShortName}
                        onChange={(e) => setOrgShortName(e.target.value)}
                        fullWidth
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenOrgDialog(false)}>Отмена</Button>
                    <Button onClick={handleCreateOrg} variant="contained">Создать</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default Profile;