import React, { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    Card,
    CardContent,
    Switch,
    FormControlLabel,
    Box,
    Divider,
    Button,
    Alert,
    Tabs,
    Tab,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    Security as SecurityIcon,
    Palette as PaletteIcon,
    Language as LanguageIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const Settings: React.FC = () => {
    const navigate = useNavigate();
    const [tabValue, setTabValue] = useState(0);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // Notification settings
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [telegramNotifications, setTelegramNotifications] = useState(true);
    const [gradeNotifications, setGradeNotifications] = useState(true);
    const [homeworkNotifications, setHomeworkNotifications] = useState(true);
    const [eventNotifications, setEventNotifications] = useState(true);
    const [messageNotifications, setMessageNotifications] = useState(true);

    // Password change
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Theme
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/notifications/settings`,
                {
                    headers: { 'Authorization': token || '' }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setEmailNotifications(data.email_enabled || true);
                setTelegramNotifications(data.telegram_enabled || false);

                const types = data.notification_types || {};
                setGradeNotifications(types.grade !== false);
                setHomeworkNotifications(types.homework !== false);
                setEventNotifications(types.event !== false);
                setMessageNotifications(types.message !== false);
            }
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        }
    };

    const handleSaveNotificationSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/notifications/settings`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                    },
                    body: JSON.stringify({
                        email_enabled: emailNotifications,
                        telegram_enabled: telegramNotifications,
                        notification_types: {
                            grade: gradeNotifications,
                            homework: homeworkNotifications,
                            event: eventNotifications,
                            message: messageNotifications
                        }
                    })
                }
            );

            if (response.ok) {
                setSuccess('Настройки уведомлений сохранены');
            } else {
                setError('Ошибка сохранения настроек');
            }
        } catch (err) {
            setError('Ошибка сети');
        }
    };

    const handleChangePassword = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            setError('Пароль должен быть не менее 6 символов');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/users/change-password`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                    },
                    body: JSON.stringify({
                        current_password: passwordForm.currentPassword,
                        new_password: passwordForm.newPassword
                    })
                }
            );

            if (response.ok) {
                setSuccess('Пароль изменён');
                setPasswordDialogOpen(false);
                setPasswordForm({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
            } else {
                const data = await response.json();
                setError(data.error || 'Ошибка изменения пароля');
            }
        } catch (err) {
            setError('Ошибка сети');
        }
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>
                Настройки
            </Typography>
            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}
            {/* Добавляем maxHeight и overflowY к Card */}
            <Card sx={{ maxHeight: '70vh', overflowY: 'auto' }}>  {/* Здесь: 70vh — пример, подставьте своё значение */}
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
                    <Tab icon={<NotificationsIcon />} label="Уведомления" />
                    <Tab icon={<SecurityIcon />} label="Безопасность" />
                    <Tab icon={<PaletteIcon />} label="Оформление" />
                    <Tab icon={<LanguageIcon />} label="Язык" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    <Typography variant="h6" gutterBottom>
                        Каналы уведомлений
                    </Typography>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={emailNotifications}
                                onChange={(e) => setEmailNotifications(e.target.checked)}
                            />
                        }
                        label="Email уведомления"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={telegramNotifications}
                                onChange={(e) => setTelegramNotifications(e.target.checked)}
                            />
                        }
                        label="Telegram уведомления"
                    />

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="h6" gutterBottom>
                        Типы уведомлений
                    </Typography>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={gradeNotifications}
                                onChange={(e) => setGradeNotifications(e.target.checked)}
                            />
                        }
                        label="Новые оценки"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={homeworkNotifications}
                                onChange={(e) => setHomeworkNotifications(e.target.checked)}
                            />
                        }
                        label="Домашние задания"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={eventNotifications}
                                onChange={(e) => setEventNotifications(e.target.checked)}
                            />
                        }
                        label="События календаря"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={messageNotifications}
                                onChange={(e) => setMessageNotifications(e.target.checked)}
                            />
                        }
                        label="Новые сообщения"
                    />

                    <Box sx={{ mt: 3 }}>
                        <Button
                            variant="contained"
                            onClick={handleSaveNotificationSettings}
                        >
                            Сохранить настройки
                        </Button>
                    </Box>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Typography variant="h6" gutterBottom>
                        Безопасность аккаунта
                    </Typography>

                    <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Изменить пароль
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Рекомендуется менять пароль каждые 3 месяца
                        </Typography>
                        <Button
                            variant="outlined"
                            onClick={() => setPasswordDialogOpen(true)}
                            sx={{ mt: 1 }}
                        >
                            Изменить пароль
                        </Button>
                    </Card>

                    <Card variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Активные сессии
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Текущее устройство: Активна
                        </Typography>
                        <Button
                            variant="outlined"
                            color="error"
                            sx={{ mt: 1 }}
                            onClick={() => {
                                localStorage.clear();
                                navigate('/login');
                            }}
                        >
                            Выйти из всех устройств
                        </Button>
                    </Card>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    <Typography variant="h6" gutterBottom>
                        Внешний вид
                    </Typography>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={darkMode}
                                onChange={(e) => {
                                    setDarkMode(e.target.checked);
                                    setSuccess('Темная тема будет доступна в следующей версии');
                                }}
                            />
                        }
                        label="Тёмная тема"
                    />

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Дополнительные настройки оформления будут добавлены в будущих версиях
                    </Typography>
                </TabPanel>

                <TabPanel value={tabValue} index={3}>
                    <Typography variant="h6" gutterBottom>
                        Язык интерфейса
                    </Typography>

                    <Typography variant="body1" gutterBottom>
                        Текущий язык: <strong>Русский</strong>
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Поддержка других языков будет добавлена в будущих версиях
                    </Typography>
                </TabPanel>
            </Card>

            {/* Password Change Dialog */}
            <Dialog
                open={passwordDialogOpen}
                onClose={() => setPasswordDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Изменить пароль</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        type="password"
                        label="Текущий пароль"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({
                            ...passwordForm,
                            currentPassword: e.target.value
                        })}
                        margin="normal"
                    />
                    <TextField
                        fullWidth
                        type="password"
                        label="Новый пароль"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({
                            ...passwordForm,
                            newPassword: e.target.value
                        })}
                        margin="normal"
                    />
                    <TextField
                        fullWidth
                        type="password"
                        label="Подтвердите новый пароль"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({
                            ...passwordForm,
                            confirmPassword: e.target.value
                        })}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPasswordDialogOpen(false)}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleChangePassword}
                        variant="contained"
                    >
                        Изменить пароль
                    </Button>
                </DialogActions>
            </Dialog>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Button variant="text" onClick={() => navigate('/dashboard')}>
                    Вернуться на главную
                </Button>
            </Box>
        </Container>
    );
};

export default Settings;