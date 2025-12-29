import React, { useEffect, useState } from 'react';
import {
    Container,
    Card,
    CardContent,
    Typography,
    Button,
    Box,
    TextField,
    Avatar,
    Chip,
    Stack,
    Divider,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemButton,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    Edit as EditIcon,
    ExitToApp as LogoutIcon,
    ContentCopy as CopyIcon,
    Business as BusinessIcon,
    Telegram as TelegramIcon,
    Add as AddIcon,
    SwapHoriz as SwapIcon,
    Email as EmailIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import CreateOrganizationDialog from './CreateOrganizationDialog';
import { API_BASE_URL } from '../config';

interface UserProfile {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    middle_name: string;
    roles: string[];
    current_role: string;
    telegram_linked: boolean;
    organizations: Organization[];
}

interface Organization {
    id: string;
    name: string;
    short_name: string;
    roles: string[];
    current_role: string;
}

const roleLabels: { [key: string]: string } = {
    admin: 'Администратор',
    teacher: 'Преподаватель',
    student: 'Студент',
    curator: 'Куратор'
};

const roleColors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'error' } = {
    admin: 'error',
    teacher: 'primary',
    student: 'success',
    curator: 'warning'
};

const Profile: React.FC = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [createOrgOpen, setCreateOrgOpen] = useState(false);
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);

    const [editForm, setEditForm] = useState({
        first_name: '',
        last_name: '',
        middle_name: '',
        email: ''
    });
    const [telegramId, setTelegramId] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('user_id');

            if (!token || !userId) {
                navigate('/login');
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/api/users/${userId}/profile`,
                {
                    headers: { 'Authorization': token }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setProfile(data);
                setEditForm({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    middle_name: data.middle_name || '',
                    email: data.email || ''
                });
            } else if (response.status === 401) {
                navigate('/login');
            } else {
                setError('Ошибка загрузки профиля');
            }
        } catch (err) {
            setError('Ошибка сети');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        const token = localStorage.getItem('token');

        fetch(`${API_BASE_URL}/logout`, {
            method: 'POST',
            headers: { 'Authorization': token || '' }
        });

        localStorage.removeItem('token');
        localStorage.removeItem('user_id');
        navigate('/login');
    };

    const handleCopyUserId = () => {
        if (profile) {
            navigator.clipboard.writeText(profile.id);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };

    const handleUpdateProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/users/me/update`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                    },
                    body: JSON.stringify(editForm)
                }
            );

            if (response.ok) {
                setEditDialogOpen(false);
                fetchProfile();
            } else {
                const data = await response.json();
                setError(data.error || 'Ошибка обновления');
            }
        } catch (err) {
            setError('Ошибка сети');
        }
    };

    const handleSwitchRole = async (newRole: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/switch-role`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                    },
                    body: JSON.stringify({ newRole })
                }
            );

            if (response.ok) {
                setRoleDialogOpen(false);
                fetchProfile();
                window.location.reload();
            }
        } catch (err) {
            setError('Ошибка смены роли');
        }
    };

    const handleLinkTelegram = async () => {
        if (!telegramId.trim()) {
            setError('Введите Telegram ID');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/telegram/link`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                    },
                    body: JSON.stringify({ telegram_id: telegramId })
                }
            );

            if (response.ok) {
                setTelegramDialogOpen(false);
                setTelegramId('');
                fetchProfile();
            } else {
                const data = await response.json();
                setError(data.error || 'Ошибка привязки');
            }
        } catch (err) {
            setError('Ошибка сети');
        }
    };

    const handleUnlinkTelegram = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/telegram/unlink`,
                {
                    method: 'POST',
                    headers: { 'Authorization': token || '' }
                }
            );

            if (response.ok) {
                fetchProfile();
            }
        } catch (err) {
            setError('Ошибка отвязки');
        }
    };

    const handleOrganizationClick = (orgId: string) => {
        navigate(`/organizations/${orgId}`);
    };

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
                <Typography>Загрузка...</Typography>
            </Container>
        );
    }

    if (!profile) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">Профиль не найден</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {copySuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    User ID скопирован в буфер обмена!
                </Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Avatar
                            sx={{
                                width: 80,
                                height: 80,
                                bgcolor: 'primary.main',
                                fontSize: '2rem',
                                mr: 3
                            }}
                        >
                            {profile.first_name?.[0] || profile.username[0].toUpperCase()}
                        </Avatar>

                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h5" gutterBottom>
                                {profile.first_name && profile.last_name
                                    ? `${profile.last_name} ${profile.first_name} ${profile.middle_name || ''}`
                                    : profile.username}
                            </Typography>

                            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                                {profile.roles.map((role) => (
                                    <Chip
                                        key={role}
                                        label={roleLabels[role] || role}
                                        color={roleColors[role] || 'default'}
                                        size="small"
                                        variant={role === profile.current_role ? 'filled' : 'outlined'}
                                    />
                                ))}
                            </Stack>

                            <Typography variant="body2" color="text.secondary">
                                <EmailIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                                {profile.email}
                            </Typography>
                        </Box>

                        <Box>
                            <IconButton onClick={() => setEditDialogOpen(true)} color="primary">
                                <EditIcon />
                            </IconButton>
                            <IconButton onClick={handleLogout} color="error">
                                <LogoutIcon />
                            </IconButton>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            User ID
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                                variant="body1"
                                sx={{
                                    fontFamily: 'monospace',
                                    bgcolor: 'grey.100',
                                    px: 2,
                                    py: 1,
                                    borderRadius: 1,
                                    flexGrow: 1
                                }}
                            >
                                {profile.id}
                            </Typography>
                            <Tooltip title="Копировать">
                                <IconButton onClick={handleCopyUserId} size="small">
                                    <CopyIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Текущая роль
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                                label={roleLabels[profile.current_role] || profile.current_role}
                                color={roleColors[profile.current_role] || 'default'}
                            />
                            {profile.roles.length > 1 && (
                                <Button
                                    size="small"
                                    startIcon={<SwapIcon />}
                                    onClick={() => setRoleDialogOpen(true)}
                                >
                                    Сменить роль
                                </Button>
                            )}
                        </Box>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Telegram
                        </Typography>
                        {profile.telegram_linked ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                    icon={<TelegramIcon />}
                                    label="Подключён"
                                    color="success"
                                    size="small"
                                />
                                <Button
                                    size="small"
                                    color="error"
                                    onClick={handleUnlinkTelegram}
                                >
                                    Отвязать
                                </Button>
                            </Box>
                        ) : (
                            <Button
                                variant="outlined"
                                startIcon={<TelegramIcon />}
                                onClick={() => setTelegramDialogOpen(true)}
                                size="small"
                            >
                                Подключить Telegram
                            </Button>
                        )}
                    </Box>
                </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            <BusinessIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                            Мои организации
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setCreateOrgOpen(true)}
                        >
                            Создать организацию
                        </Button>
                    </Box>

                    {profile.organizations && profile.organizations.length > 0 ? (
                        <List>
                            {profile.organizations.map((org) => (
                                <ListItem
                                    key={org.id}
                                    disablePadding
                                    secondaryAction={
                                        <Stack direction="row" spacing={0.5}>
                                            {org.roles.map((role) => (
                                                <Chip
                                                    key={role}
                                                    label={roleLabels[role] || role}
                                                    size="small"
                                                    color={roleColors[role]}
                                                    variant={role === org.current_role ? 'filled' : 'outlined'}
                                                />
                                            ))}
                                        </Stack>
                                    }
                                >
                                    <ListItemButton onClick={() => handleOrganizationClick(org.id)}>
                                        <ListItemText
                                            primary={org.name}
                                            secondary={org.short_name}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Alert severity="info">
                            Вы пока не состоите ни в одной организации. Создайте новую или примите приглашение.
                        </Alert>
                    )}
                </CardContent>
            </Card>

            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Редактировать профиль</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Имя"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        margin="normal"
                    />
                    <TextField
                        fullWidth
                        label="Фамилия"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        margin="normal"
                    />
                    <TextField
                        fullWidth
                        label="Отчество"
                        value={editForm.middle_name}
                        onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}
                        margin="normal"
                    />
                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>Отмена</Button>
                    <Button onClick={handleUpdateProfile} variant="contained">
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)}>
                <DialogTitle>Выберите роль</DialogTitle>
                <DialogContent>
                    <List>
                        {profile.roles.map((role) => (
                            <ListItem key={role} disablePadding>
                                <ListItemButton
                                    onClick={() => handleSwitchRole(role)}
                                    selected={role === profile.current_role}
                                >
                                    <ListItemText
                                        primary={roleLabels[role] || role}
                                        secondary={role === profile.current_role ? 'Текущая роль' : ''}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoleDialogOpen(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={telegramDialogOpen} onClose={() => setTelegramDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Подключить Telegram</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                            Для подключения Telegram:
                        </Typography>
                        <ol style={{ margin: 0, paddingLeft: 20 }}>
                            <li>Откройте бота @KipCalendarBot в Telegram</li>
                            <li>Отправьте команду /start</li>
                            <li>Скопируйте ваш User ID: <strong>{profile.id}</strong></li>
                            <li>Отправьте боту команду: /link {profile.id}</li>
                        </ol>
                    </Alert>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Или введите ваш Telegram ID вручную:
                    </Typography>
                    <TextField
                        fullWidth
                        label="Telegram ID"
                        value={telegramId}
                        onChange={(e) => setTelegramId(e.target.value)}
                        margin="normal"
                        helperText="Узнать свой Telegram ID можно у бота @userinfobot"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTelegramDialogOpen(false)}>Отмена</Button>
                    <Button onClick={handleLinkTelegram} variant="contained">
                        Подключить
                    </Button>
                </DialogActions>
            </Dialog>

            <CreateOrganizationDialog
                open={createOrgOpen}
                onClose={() => setCreateOrgOpen(false)}
                onSuccess={(orgId) => {
                    setCreateOrgOpen(false);
                    fetchProfile();
                    navigate(`/organizations/${orgId}`);
                }}
            />
        </Container>
    );
};

export default Profile;