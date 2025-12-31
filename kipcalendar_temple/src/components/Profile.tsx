import React, { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    Card,
    CardContent,
    Button,
    TextField,
    Box,
    Alert,
    Chip,
    Stack,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Snackbar
} from '@mui/material';
import {
    Edit as EditIcon,
    ContentCopy as CopyIcon,
    Check as CheckIcon,
    Telegram as TelegramIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import CreateOrganizationDialog from './CreateOrganizationDialog';
import { API_BASE_URL } from '../config';

interface UserProfile {
    id: string;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    roles: string[];
    current_role: string;
    telegram_linked: boolean;
    organizations: Array<{
        id: string;
        name: string;
        short_name?: string;
        roles: string[];
        current_role: string;
    }>;
    groups?: Array<{
        id: string;
        name: string;
        specialty?: string;
        course?: number;
        organization_name: string;
    }>;
    subjects?: Array<{
        id: string;
        name: string;
        code?: string;
        organization_name: string;
    }>;
}

const Profile: React.FC = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Editing state
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({
        first_name: '',
        last_name: '',
        middle_name: '',
        email: ''
    });

    // Telegram linking
    const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
    const [telegramCode, setTelegramCode] = useState('');
    const [telegramCodeCopied, setTelegramCodeCopied] = useState(false);

    // Create org dialog
    const [createOrgOpen, setCreateOrgOpen] = useState(false);

    // Snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('user_id');

            if (!userId) {
                navigate('/login');
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/api/users/${userId}/profile`,
                {
                    headers: { 'Authorization': token || '' }
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
                setSuccess('Профиль обновлён');
                setEditMode(false);
                fetchProfile();
            } else {
                const data = await response.json();
                setError(data.error || 'Ошибка обновления');
            }
        } catch (err) {
            setError('Ошибка сети');
        }
    };

    const handleGenerateTelegramCode = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/telegram/generate-code`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setTelegramCode(data.code);
                setTelegramDialogOpen(true);
            } else {
                setError('Ошибка генерации кода');
            }
        } catch (err) {
            setError('Ошибка сети');
        }
    };

    const handleUnlinkTelegram = async () => {
        if (!window.confirm('Отвязать Telegram?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/telegram/unlink`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                    }
                }
            );

            if (response.ok) {
                setSuccess('Telegram отвязан');
                fetchProfile();
            }
        } catch (err) {
            setError('Ошибка отвязки');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setTelegramCodeCopied(true);
        setTimeout(() => setTelegramCodeCopied(false), 2000);
    };

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            admin: 'Администратор',
            teacher: 'Преподаватель',
            student: 'Студент',
            curator: 'Куратор'
        };
        return labels[role] || role;
    };

    const getRoleColor = (role: string) => {
        const colors: Record<string, any> = {
            admin: 'error',
            teacher: 'primary',
            student: 'success',
            curator: 'warning'
        };
        return colors[role] || 'default';
    };

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
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

            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}

            {/* User ID Card */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Информация о пользователе
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            User ID:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                fontFamily: 'monospace',
                                bgcolor: 'grey.100',
                                p: 0.5,
                                borderRadius: 1
                            }}
                        >
                            {profile.id}
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => {
                                copyToClipboard(profile.id);
                                setSnackbar({ open: true, message: 'User ID скопирован' });
                            }}
                        >
                            <CopyIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Username: <strong>{profile.username}</strong>
                    </Typography>

                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Роли:
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                            {profile.roles.map((role) => (
                                <Chip
                                    key={role}
                                    label={getRoleLabel(role)}
                                    color={getRoleColor(role)}
                                    size="small"
                                    variant={role === profile.current_role ? 'filled' : 'outlined'}
                                />
                            ))}
                        </Stack>
                    </Box>
                </CardContent>
            </Card>

            {/* Personal Info Card */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            Личные данные
                        </Typography>
                        {!editMode && (
                            <IconButton onClick={() => setEditMode(true)}>
                                <EditIcon />
                            </IconButton>
                        )}
                    </Box>

                    {editMode ? (
                        <Box component="form" sx={{ '& > *': { mb: 2 } }}>
                            <TextField
                                fullWidth
                                label="Фамилия"
                                value={editForm.last_name}
                                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                            />
                            <TextField
                                fullWidth
                                label="Имя"
                                value={editForm.first_name}
                                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                            />
                            <TextField
                                fullWidth
                                label="Отчество"
                                value={editForm.middle_name}
                                onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}
                            />
                            <TextField
                                fullWidth
                                label="Email"
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button variant="contained" onClick={handleUpdateProfile}>
                                    Сохранить
                                </Button>
                                <Button variant="outlined" onClick={() => setEditMode(false)}>
                                    Отмена
                                </Button>
                            </Box>
                        </Box>
                    ) : (
                        <Box>
                            <Typography variant="body1" gutterBottom>
                                {profile.last_name} {profile.first_name} {profile.middle_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Email: {profile.email}
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Telegram Card */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <TelegramIcon color="primary" />
                        <Typography variant="h6">
                            Telegram
                        </Typography>
                    </Box>

                    {profile.telegram_linked ? (
                        <Box>
                            <Alert severity="success" sx={{ mb: 2 }}>
                                Telegram подключён
                            </Alert>
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={handleUnlinkTelegram}
                            >
                                Отвязать Telegram
                            </Button>
                        </Box>
                    ) : (
                        <Box>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Подключите Telegram для получения уведомлений
                            </Alert>
                            <Button
                                variant="contained"
                                startIcon={<TelegramIcon />}
                                onClick={handleGenerateTelegramCode}
                            >
                                Подключить Telegram
                            </Button>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Organizations Card */}
            {profile.organizations && profile.organizations.length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Мои организации
                        </Typography>
                        {profile.organizations.map((org) => (
                            <Card key={org.id} variant="outlined" sx={{ mb: 2 }}>
                                <CardContent>
                                    <Typography variant="subtitle1">
                                        {org.name}
                                    </Typography>
                                    {org.short_name && (
                                        <Typography variant="body2" color="text.secondary">
                                            {org.short_name}
                                        </Typography>
                                    )}
                                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                        {org.roles.map((role) => (
                                            <Chip
                                                key={role}
                                                label={getRoleLabel(role)}
                                                size="small"
                                                color={getRoleColor(role)}
                                                variant={role === org.current_role ? 'filled' : 'outlined'}
                                            />
                                        ))}
                                    </Stack>
                                    <Button
                                        size="small"
                                        sx={{ mt: 1 }}
                                        onClick={() => navigate(`/organizations/${org.id}`)}
                                    >
                                        Управление
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Student Groups */}
            {profile.groups && profile.groups.length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Мои группы
                        </Typography>
                        {profile.groups.map((group) => (
                            <Card key={group.id} variant="outlined" sx={{ mb: 1 }}>
                                <CardContent>
                                    <Typography variant="subtitle2">
                                        {group.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {group.specialty} • Курс {group.course}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {group.organization_name}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Teacher Subjects */}
            {profile.subjects && profile.subjects.length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Мои предметы
                        </Typography>
                        {profile.subjects.map((subject) => (
                            <Card key={subject.id} variant="outlined" sx={{ mb: 1 }}>
                                <CardContent>
                                    <Typography variant="subtitle2">
                                        {subject.name}
                                    </Typography>
                                    {subject.code && (
                                        <Typography variant="body2" color="text.secondary">
                                            Код: {subject.code}
                                        </Typography>
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                        {subject.organization_name}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Action Buttons */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Действия
                    </Typography>
                    <Stack spacing={2}>
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={() => setCreateOrgOpen(true)}
                        >
                            Создать организацию
                        </Button>
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => navigate('/settings')}
                        >
                            Настройки
                        </Button>
                        <Divider />
                        <Button
                            variant="outlined"
                            color="error"
                            fullWidth
                            onClick={() => {
                                localStorage.clear();
                                navigate('/login');
                            }}
                        >
                            Выйти
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* Telegram Dialog */}
            <Dialog
                open={telegramDialogOpen}
                onClose={() => setTelegramDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Подключение Telegram</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Следуйте инструкциям для подключения
                    </Alert>

                    <Typography variant="body2" gutterBottom>
                        1. Откройте Telegram и найдите бота: <strong>@KipCalendarBot</strong>
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        2. Отправьте команду <code>/start</code>
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        3. Скопируйте код ниже:
                    </Typography>

                    <Box sx={{
                        bgcolor: 'grey.100',
                        p: 2,
                        borderRadius: 1,
                        my: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <Typography
                            variant="h4"
                            sx={{
                                fontFamily: 'monospace',
                                letterSpacing: 2
                            }}
                        >
                            {telegramCode}
                        </Typography>
                        <IconButton
                            onClick={() => copyToClipboard(telegramCode)}
                            color={telegramCodeCopied ? 'success' : 'default'}
                        >
                            {telegramCodeCopied ? <CheckIcon /> : <CopyIcon />}
                        </IconButton>
                    </Box>

                    <Typography variant="body2" gutterBottom>
                        4. Отправьте боту команду: <code>/link {telegramCode}</code>
                    </Typography>

                    <Alert severity="warning" sx={{ mt: 2 }}>
                        Код действителен 10 минут
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTelegramDialogOpen(false)}>
                        Закрыть
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create Organization Dialog */}
            <CreateOrganizationDialog
                open={createOrgOpen}
                onClose={() => setCreateOrgOpen(false)}
                onSuccess={(orgId) => {
                    setSnackbar({
                        open: true,
                        message: 'Организация создана!'
                    });
                    navigate(`/organizations/${orgId}`);
                }}
            />

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
            />
        </Container>
    );
};

export default Profile;