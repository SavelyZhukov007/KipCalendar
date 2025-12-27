import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
    Button,
    Container,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Checkbox,
    Typography,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Collapse,
    ThemeProvider,
    createTheme,
    Tabs,
    Tab,
    RadioGroup,
    Radio,
    FormGroup,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Select,
    MenuItem,
    Snackbar,
    Alert,
    Menu,
    Autocomplete,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
    Paper,
    Chip,
    Avatar,
    Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import CheckIcon from '@mui/icons-material/Check';
import ShareIcon from '@mui/icons-material/Share';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DescriptionIcon from '@mui/icons-material/Description';
import {
    format,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    startOfMonth,
    parse,
    getDay,
    isWithinInterval,
    parseISO,
    isSameDay,
    isToday,
    startOfDay,
    endOfDay
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ReactMarkdown from 'react-markdown';
import { QRCodeSVG } from 'qrcode.react';
import { Event, PlanEvent, TaskEvent } from '../types/Event';
import io from 'socket.io-client';
import './Dashboard.css';

const API_BASE_URL = 'http://localhost:5000';
const socket = io(API_BASE_URL);

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#1a73e8',
        },
        secondary: {
            main: '#f50057',
        },
    },
    typography: {
        fontFamily: 'Inter, Roboto, sans-serif',
    },
});

const daysMap = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const daysFull = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

interface PendingShare {
    id: string;
    sender: string;
    type: 'plan' | 'task';
    name: string;
    date: string;
    time: string;
}

interface UserShort {
    id: number | string;
    username: string;
    role?: string;
}

interface ViewState {
    type: 'month' | 'week' | 'day';
    date: Date;
}

const EventListItem: React.FC<{
    event: Event;
    openTaskModal: (event: Event) => void;
    openEditModal: (event: Event) => void;
    handleDelete: (event: Event) => void;
    handleShare: (event: Event) => void;
}> = ({ event, openTaskModal, openEditModal, handleDelete, handleShare }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const isTask = event.eventType === 'task';
    const isCompleted = event.eventType === 'plan' && event.endDate && event.endTime
        ? new Date(`${event.endDate} ${event.endTime}`) < new Date()
        : false;

    const handleClick = () => {
        if (isTask) {
            openTaskModal(event);
        } else {
            openEditModal(event);
        }
    };

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'low': return '#10b981';
            default: return '#6b7280';
        }
    };

    return (
        <Paper
            ref={itemRef}
            elevation={1}
            className="event-list-item"
            onClick={handleClick}
            sx={{
                borderLeft: `4px solid ${isTask ? '#f59e0b' : isCompleted ? '#10b981' : '#1a73e8'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                },
            }}
        >
            <Box display="flex" alignItems="center" width="100%">
                <Box flex={1} minWidth={0}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography
                            variant="subtitle1"
                            fontWeight={600}
                            sx={{
                                color: isTask ? '#f59e0b' : isCompleted ? '#10b981' : '#202124',
                            }}
                        >
                            {event.title}
                        </Typography>
                        {isTask && event.subTasks && (
                            <Chip
                                size="small"
                                label={`${event.subTasks.filter(st => st.status === 'completed').length}/${event.subTasks.length}`}
                                sx={{
                                    backgroundColor: getPriorityColor(event.subTasks[0]?.priority),
                                    color: 'white',
                                    fontSize: '0.7rem',
                                }}
                            />
                        )}
                        {isCompleted && (
                            <Chip
                                size="small"
                                label="Завершено"
                                sx={{
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                }}
                            />
                        )}
                    </Box>

                    <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                        <Box display="flex" alignItems="center" gap={0.5}>
                            <CalendarTodayIcon sx={{ fontSize: 14, color: '#5f6368' }} />
                            <Typography variant="caption" color="text.secondary">
                                {format(new Date(event.date), 'dd.MM.yyyy', { locale: ru })}
                            </Typography>
                        </Box>

                        <Box display="flex" alignItems="center" gap={0.5}>
                            <AccessTimeIcon sx={{ fontSize: 14, color: '#5f6368' }} />
                            <Typography variant="caption" color="text.secondary">
                                {event.time}
                            </Typography>
                        </Box>

                        <Chip
                            size="small"
                            label={isTask ? 'Задача' : 'План'}
                            sx={{
                                backgroundColor: isTask ? '#fef3c7' : '#dbeafe',
                                color: isTask ? '#92400e' : '#1e40af',
                                fontSize: '0.7rem',
                            }}
                        />

                        {event.type === 'private' && (
                            <Chip
                                size="small"
                                label="Приватное"
                                sx={{
                                    backgroundColor: '#f3f4f6',
                                    color: '#6b7280',
                                    fontSize: '0.7rem',
                                }}
                            />
                        )}
                    </Box>

                    {event.description && (
                        <Box mt={1} display="flex" alignItems="flex-start" gap={0.5}>
                            <DescriptionIcon sx={{ fontSize: 14, color: '#5f6368', mt: 0.25 }} />
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                {event.description}
                            </Typography>
                        </Box>
                    )}
                </Box>

                <Box display="flex" alignItems="center" gap={0.5}>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(event);
                        }}
                        sx={{
                            color: '#5f6368',
                            '&:hover': { backgroundColor: 'rgba(26, 115, 232, 0.1)' },
                        }}
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleShare(event);
                        }}
                        sx={{
                            color: '#5f6368',
                            '&:hover': { backgroundColor: 'rgba(26, 115, 232, 0.1)' },
                        }}
                    >
                        <ShareIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(event);
                        }}
                        sx={{
                            color: '#5f6368',
                            '&:hover': { backgroundColor: 'rgba(220, 38, 38, 0.1)' },
                        }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>
        </Paper>
    );
};

interface TaskModalProps {
    open: boolean;
    event: TaskEvent | null;
    onClose: () => void;
    onSave: (event: TaskEvent) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ open, event, onClose, onSave }) => {
    const [localSubTasks, setLocalSubTasks] = useState<NonNullable<TaskEvent['subTasks']>>([]);
    const [tab, setTab] = useState(0);

    useEffect(() => {
        if (!event) return;

        if (event.subTasks && event.subTasks.length > 0) {
            setLocalSubTasks(event.subTasks as NonNullable<TaskEvent['subTasks']>);
        } else {
            setLocalSubTasks([{
                name: event.title,
                description: event.description,
                deadline: '',
                priority: 'medium',
                status: 'open',
            }]);
        }
        setTab(0);
    }, [event]);

    if (!event) return null;

    const completed = localSubTasks.filter(st => st.status === 'completed');
    const inProgress = localSubTasks.filter(st => st.status === 'inprogress');
    const openTasks = localSubTasks.filter(st => st.status === 'open');

    const toggleStatus = (index: number, status: 'open' | 'inprogress' | 'completed') => {
        const updated = [...localSubTasks];
        updated[index] = {
            ...updated[index],
            status,
        };
        setLocalSubTasks(updated);
    };

    const updateSubTask = (index: number, field: keyof typeof localSubTasks[0], value: string) => {
        const updated = [...localSubTasks];
        updated[index] = {
            ...updated[index],
            [field]: value,
        };
        setLocalSubTasks(updated);
    };

    const handleSave = () => {
        if (!event) return;
        onSave({ ...event, subTasks: localSubTasks });
        onClose();
    };

    const completeAll = () => {
        setLocalSubTasks(prev => prev.map(st => ({ ...st, status: 'completed' })));
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'low': return '#10b981';
            default: return '#6b7280';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return '#10b981';
            case 'inprogress': return '#3b82f6';
            case 'open': return '#6b7280';
            default: return '#6b7280';
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ backgroundColor: '#f8f9fa', borderBottom: 1, borderColor: 'divider' }}>
                <Box display="flex" alignItems="center" gap={2}>
                    <Typography variant="h6" fontWeight={600}>
                        {event.title}
                    </Typography>
                    <Chip
                        label="Задача"
                        size="small"
                        sx={{
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            fontWeight: 500,
                        }}
                    />
                </Box>
                {event.description && (
                    <Typography variant="body2" color="text.secondary" mt={1}>
                        {event.description}
                    </Typography>
                )}
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    sx={{
                        mb: 3,
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            fontWeight: 500,
                        },
                    }}
                >
                    <Tab
                        label={`Все (${localSubTasks.length})`}
                        icon={<Typography fontSize="0.75rem">({localSubTasks.length})</Typography>}
                        iconPosition="end"
                    />
                    <Tab
                        label={`Выполненные (${completed.length})`}
                        icon={<Typography fontSize="0.75rem">({completed.length})</Typography>}
                        iconPosition="end"
                    />
                    <Tab
                        label={`В процессе (${inProgress.length})`}
                        icon={<Typography fontSize="0.75rem">({inProgress.length})</Typography>}
                        iconPosition="end"
                    />
                    <Tab
                        label={`Открытые (${openTasks.length})`}
                        icon={<Typography fontSize="0.75rem">({openTasks.length})</Typography>}
                        iconPosition="end"
                    />
                </Tabs>

                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {(tab === 0 ? localSubTasks :
                        tab === 1 ? completed :
                            tab === 2 ? inProgress : openTasks).map((st, i) => {
                                const originalIndex = localSubTasks.findIndex(t => t.name === st.name);
                                return (
                                    <Paper
                                        key={i}
                                        elevation={0}
                                        sx={{
                                            mb: 2,
                                            p: 2,
                                            border: 1,
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            backgroundColor: st.status === 'completed' ? '#f0fdf4' :
                                                st.status === 'inprogress' ? '#eff6ff' : 'white',
                                        }}
                                    >
                                        <Box display="flex" alignItems="center" gap={2} mb={1}>
                                            <Checkbox
                                                checked={st.status === 'completed'}
                                                onChange={(e) => {
                                                    toggleStatus(originalIndex, e.target.checked ? 'completed' : 'open');
                                                }}
                                                sx={{
                                                    color: getStatusColor(st.status),
                                                    '&.Mui-checked': {
                                                        color: getStatusColor('completed'),
                                                    },
                                                }}
                                            />

                                            <Box flex={1}>
                                                <Typography variant="subtitle2" fontWeight={600}>
                                                    {st.name}
                                                </Typography>
                                                {st.description && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {st.description}
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Chip
                                                    size="small"
                                                    label={st.priority === 'high' ? 'Высокий' :
                                                        st.priority === 'medium' ? 'Средний' : 'Низкий'}
                                                    sx={{
                                                        backgroundColor: getPriorityColor(st.priority),
                                                        color: 'white',
                                                        fontSize: '0.65rem',
                                                    }}
                                                />
                                                <Chip
                                                    size="small"
                                                    label={st.status === 'completed' ? 'Выполнено' :
                                                        st.status === 'inprogress' ? 'В процессе' : 'Открыта'}
                                                    sx={{
                                                        backgroundColor: getStatusColor(st.status),
                                                        color: 'white',
                                                        fontSize: '0.65rem',
                                                    }}
                                                />
                                            </Box>
                                        </Box>

                                        {st.deadline && (
                                            <Box display="flex" alignItems="center" gap={1} mt={1}>
                                                <CalendarTodayIcon sx={{ fontSize: 14, color: '#5f6368' }} />
                                                <Typography variant="caption" color="text.secondary">
                                                    Дедлайн: {format(new Date(st.deadline), 'dd.MM.yyyy')}
                                                </Typography>
                                            </Box>
                                        )}

                                        <Box display="flex" gap={1} mt={2}>
                                            <Button
                                                size="small"
                                                variant={st.status === 'open' ? 'contained' : 'outlined'}
                                                onClick={() => toggleStatus(originalIndex, 'open')}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                Открыта
                                            </Button>
                                            <Button
                                                size="small"
                                                variant={st.status === 'inprogress' ? 'contained' : 'outlined'}
                                                onClick={() => toggleStatus(originalIndex, 'inprogress')}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                В процессе
                                            </Button>
                                            <Button
                                                size="small"
                                                variant={st.status === 'completed' ? 'contained' : 'outlined'}
                                                onClick={() => toggleStatus(originalIndex, 'completed')}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                Выполнено
                                            </Button>
                                        </Box>
                                    </Paper>
                                );
                            })}
                </List>
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
                <Box display="flex" justifyContent="space-between" width="100%">
                    <Box display="flex" gap={1}>
                        <Button
                            variant="outlined"
                            onClick={completeAll}
                            startIcon={<CheckIcon />}
                            sx={{ textTransform: 'none' }}
                        >
                            Выполнить все
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={onClose}
                            sx={{ textTransform: 'none' }}
                        >
                            Закрыть
                        </Button>
                    </Box>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        sx={{ textTransform: 'none' }}
                    >
                        Сохранить изменения
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
};

const Dashboard: React.FC = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
    const [view, setView] = useState<'month' | 'week' | 'day'>('month');
    const [openWizard, setOpenWizard] = useState(false);
    const [tabValue, setTabValue] = useState(0);
    const [openEdit, setOpenEdit] = useState(false);
    const [openTaskModal, setOpenTaskModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [time, setTime] = useState('09:00');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [password, setPassword] = useState('');
    const [url, setUrl] = useState('');
    const [qrUrl, setQrUrl] = useState('');
    const [showAllEvents, setShowAllEvents] = useState(false);
    const [roles, setRoles] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState('');
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
    const [openShares, setOpenShares] = useState(false);
    const [filterFIO, setFilterFIO] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStart, setFilterStart] = useState<Date | null>(null);
    const [filterEnd, setFilterEnd] = useState<Date | null>(null);
    const [declineId, setDeclineId] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [openShare, setOpenShare] = useState(false);
    const [shareEvent, setShareEvent] = useState<Event | null>(null);
    const [shareForbidEdit, setShareForbidEdit] = useState(false);
    const [shareAllowComments, setShareAllowComments] = useState(false);
    const [teachers, setTeachers] = useState<UserShort[]>([]);
    const [students, setStudents] = useState<UserShort[]>([]);
    const [admins, setAdmins] = useState<UserShort[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const navigate = useNavigate();

    const monthRef = useRef<HTMLDivElement>(null);
    const weekRef = useRef<HTMLDivElement>(null);
    const dayRef = useRef<HTMLDivElement>(null);

    const refreshEvents = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const headers: HeadersInit = { 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/events`, { headers });
            if (res.ok) {
                const fetchedEvents = await res.json();
                setEvents(fetchedEvents.map((ev: any) => ({
                    ...ev,
                    recurringOptions: ev.recurring_options || null,
                    subTasks: ev.subtasks || null,
                })));
            }
        } catch (error) {
            console.error('Ошибка загрузки событий:', error);
        }
    };

    const loadPendingShares = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const headers: HeadersInit = { 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/api/shares/pending`, { headers });
            if (res.ok) {
                setPendingShares(await res.json());
            }
        } catch (error) {
            console.error('Ошибка загрузки общих событий:', error);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }

        const fetchData = async () => {
            try {
                const headers: HeadersInit = { 'Authorization': token };

                const [eventsRes, roleRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/events`, { headers }),
                    fetch(`${API_BASE_URL}/role`, { headers })
                ]);

                if (eventsRes.ok) {
                    const fetchedEvents = await eventsRes.json();
                    setEvents(fetchedEvents.map((ev: any) => ({
                        ...ev,
                        recurringOptions: ev.recurring_options || null,
                        subTasks: ev.subtasks || null,
                    })));
                } else {
                    localStorage.removeItem('token');
                    navigate('/');
                }

                if (roleRes.ok) {
                    const data = await roleRes.json();
                    setRoles(data.roles || []);
                    setCurrentRole(data.currentRole || '');
                }
            } catch (error: any) {
                console.error('Ошибка загрузки данных:', error);
            }
        };

        fetchData();
        loadPendingShares();

        socket.on('event_update', refreshEvents);
        socket.on('new_share', loadPendingShares);
        socket.on('share_declined', (data: { reason: string }) => {
            alert(`Ваше событие отклонено: ${data.reason}`);
        });

        return () => {
            socket.off('event_update');
            socket.off('new_share');
            socket.off('share_declined');
        };
    }, [navigate]);

    useEffect(() => {
        if (view === 'month') {
            setCurrentMonth(startOfMonth(selectedDate));
        }
    }, [selectedDate, view]);

    const handleProfileClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/');
    };

    const handleSwitchRole = async () => {
        const other = roles.find(r => r !== currentRole);
        if (!other) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/switch-role`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ newRole: other })
            });
            if (res.ok) {
                setCurrentRole(other);
                refreshEvents();
            }
        } catch (error: any) {
            alert('Ошибка переключения роли');
        }
    };

    const isDual = roles.length > 1;
    const otherRole = roles.find(r => r !== currentRole) || '';

    const handleOpenWizard = () => {
        setTabValue(0);
        setOpenWizard(true);
    };

    const handleCreatePlan = async (data: any) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/api/events/create-plan`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const { url: newUrl } = await res.json();
                setUrl(newUrl);
                setOpenWizard(false);
                refreshEvents();
                if (data.privacy === 'private' && data.password) {
                    setQrUrl(`${newUrl}?password=${data.password}`);
                }
            } else {
                alert('Ошибка создания плана');
            }
        } catch (error: any) {
            alert('Ошибка соединения: ' + error.message);
        }
    };

    const handleCreateTask = async (data: any) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/api/events/create-task`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const { url: newUrl } = await res.json();
                setUrl(newUrl);
                setOpenWizard(false);
                refreshEvents();
                if (data.privacy === 'private' && data.password) {
                    setQrUrl(`${newUrl}?password=${data.password}`);
                }
            } else {
                alert('Ошибка создания задачи');
            }
        } catch (error: any) {
            alert('Ошибка соединения: ' + error.message);
        }
    };

    const handleUpdateTask = async (updatedEvent: TaskEvent) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/event/${updatedEvent.type}/${updatedEvent.name}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ subtasks: updatedEvent.subTasks })
            });
            if (res.ok) {
                setOpenTaskModal(false);
                refreshEvents();
            } else {
                alert('Ошибка обновления задачи');
            }
        } catch (error: any) {
            alert('Ошибка соединения: ' + error.message);
        }
    };

    const handleEdit = async () => {
        const token = localStorage.getItem('token');
        if (!token || !selectedEvent) return;
        const data: { title: string; date: string; time: string; description: string; password?: string } = {
            title,
            date,
            time,
            description
        };
        if (isPrivate && password) {
            data.password = password;
        }
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/event/${selectedEvent.type}/${selectedEvent.name}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (res.ok) {
                setOpenEdit(false);
                refreshEvents();
            } else {
                alert('Ошибка редактирования');
            }
        } catch (error: any) {
            alert('Ошибка соединения: ' + error.message);
        }
    };

    const handleDelete = async (event: Event) => {
        if (!window.confirm(`Удалить событие "${event.title}"?`)) return;

        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const headers: HeadersInit = { 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/event/${event.type}/${event.name}`, {
                method: 'DELETE',
                headers
            });
            if (res.ok) {
                refreshEvents();
            } else {
                alert('Ошибка удаления');
            }
        } catch (error: any) {
            alert('Ошибка соединения: ' + error.message);
        }
    };

    const handleAccept = async (id: string) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const headers: HeadersInit = { 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/api/shares/accept/${id}`, { method: 'POST', headers });
            if (res.ok) {
                loadPendingShares();
                refreshEvents();
                alert('Событие успешно добавлено');
            }
        } catch (error) {
            alert('Ошибка принятия события');
        }
    };

    const handleConfirmDecline = async () => {
        if (!declineId) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/api/shares/decline/${declineId}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                setDeclineId(null);
                setReason('');
                loadPendingShares();
            }
        } catch (error) {
            alert('Ошибка отклонения события');
        }
    };

    const handleShare = (event: Event) => {
        setShareEvent(event);
        setOpenShare(true);
        setSelectedUsers([]);
        setShareForbidEdit(false);
        setShareAllowComments(false);
    };

    const handleConfirmShare = async () => {
        const token = localStorage.getItem('token');
        if (!token || !shareEvent) return;
        const data = {
            users: selectedUsers,
            forbid_edit: shareForbidEdit,
            allow_comments: shareAllowComments
        };
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
            const res = await fetch(`${API_BASE_URL}/api/events/${shareEvent.name}/share`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (res.ok) {
                setOpenShare(false);
                alert('Событие успешно отправлено');
            } else {
                alert('Ошибка шаринга');
            }
        } catch (error: any) {
            alert('Ошибка соединения: ' + error.message);
        }
    };

    const toggleUser = (username: string) => {
        setSelectedUsers(prev =>
            prev.includes(username)
                ? prev.filter(u => u !== username)
                : [...prev, username]
        );
    };

    const selectAll = (list: UserShort[]) => {
        setSelectedUsers(prev => {
            const newUsers = list.map(u => u.username);
            const combined = [...prev, ...newUsers];
            return Array.from(new Set(combined));
        });
    };

    const deselectAll = () => {
        setSelectedUsers([]);
    };

    const getEventsForDate = (date: Date) => {
        const fmt = format(date, 'yyyy-MM-dd');
        return events.flatMap(e => {
            if (e.eventType !== 'plan' || !('recurringOptions' in e) || !e.recurringOptions) {
                if (e.date === fmt) return [e];
                return [];
            }
            const options = e.recurringOptions;
            const startD = parseISO(e.date);
            const endR = options.endRepeat ? parseISO(options.endRepeat) : null;
            const dayOfWeek = getDay(date);
            const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
            if (!isWithinInterval(date, { start: startD, end: endR || date }) || !options.days.includes(adjustedDay)) return [];
            const instance = { ...e, date: fmt };
            return [instance];
        }).sort((a, b) => {
            const timeA = a.time.split(':').map(Number);
            const timeB = b.time.split(':').map(Number);
            return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
        });
    };

    const timeToMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const minutesToTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const isCompletedEvent = (e: Event) => {
        if (e.eventType !== 'plan') return false;
        if (!('endDate' in e) || !e.endDate || !('endTime' in e) || !e.endTime) return false;
        return new Date(`${e.endDate} ${e.endTime}`) < new Date();
    };

    const getTaskProgress = (e: Event) => {
        if (e.eventType !== 'task' || !('subTasks' in e) || !e.subTasks) return 0;
        const completed = e.subTasks.filter(st => st.status === 'completed').length;
        return (completed / e.subTasks.length) * 100;
    };

    const tileContent = ({ date, view }: { date: Date; view: string }) => {
        if (view === 'month') {
            const eventsForDay = getEventsForDate(date);
            if (eventsForDay.length > 0) {
                return (
                    <div className="tile-events">
                        {eventsForDay.slice(0, 3).map((e, i) => {
                            const isTask = e.eventType === 'task';
                            const isCompleted = isCompletedEvent(e);
                            const progress = getTaskProgress(e);
                            return (
                                <div
                                    key={i}
                                    className="tile-event"
                                    style={{
                                        backgroundColor: isTask ? '#4285f4' :
                                            isCompleted ? '#10b981' : '#6366f1',
                                        backgroundImage: isTask ?
                                            `linear-gradient(to right, #1a73e8 ${progress}%, #4285f4 ${progress}%)` : 'none'
                                    }}
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        if (isTask) {
                                            setSelectedEvent(e);
                                            setOpenTaskModal(true);
                                        } else {
                                            openEditModal(e);
                                        }
                                    }}
                                >
                                    {e.title}
                                </div>
                            );
                        })}
                        {eventsForDay.length > 3 && (
                            <div className="more-events" onClick={(ev) => ev.stopPropagation()}>
                                +{eventsForDay.length - 3} ещё
                            </div>
                        )}
                    </div>
                );
            }
        }
        return null;
    };

    const headerTitle = () => {
        switch (view) {
            case 'month':
                return format(currentMonth, 'LLLL yyyy', { locale: ru });
            case 'week':
                const weekStart = startOfWeek(selectedDate, { locale: ru });
                const weekEnd = endOfWeek(selectedDate, { locale: ru });
                return `${format(weekStart, 'd MMM', { locale: ru })} - ${format(weekEnd, 'd MMM yyyy', { locale: ru })}`;
            case 'day':
                return format(selectedDate, 'd MMMM yyyy, EEEE', { locale: ru });
            default:
                return '';
        }
    };

    const handlePrevious = () => {
        switch (view) {
            case 'month':
                setCurrentMonth(subMonths(currentMonth, 1));
                break;
            case 'week':
                setSelectedDate(subWeeks(selectedDate, 1));
                break;
            case 'day':
                setSelectedDate(subDays(selectedDate, 1));
                break;
        }
    };

    const handleNext = () => {
        switch (view) {
            case 'month':
                setCurrentMonth(addMonths(currentMonth, 1));
                break;
            case 'week':
                setSelectedDate(addWeeks(selectedDate, 1));
                break;
            case 'day':
                setSelectedDate(addDays(selectedDate, 1));
                break;
        }
    };

    const renderDayView = () => {
        const eventsForDay = getEventsForDate(selectedDate);
        const dayStart = startOfDay(selectedDate);
        const dayEnd = endOfDay(selectedDate);

        return (
            <Box className="time-grid day" sx={{ height: 'calc(100vh - 200px)' }}>
                <Box className="time-labels">
                    {Array.from({ length: 24 }).map((_, h) => (
                        <Box key={h} className="time-label">
                            {h.toString().padStart(2, '0')}:00
                        </Box>
                    ))}
                </Box>
                <Box className="days-container">
                    <Box className="day-column">
                        <Box className="day-header">
                            {format(selectedDate, 'EEEE, d MMMM', { locale: ru })}
                        </Box>
                        <Box className="grid-lines">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <Box key={i} className="horizontal-line" />
                            ))}
                            <Box className="events-container">
                                {eventsForDay.map((e, index) => {
                                    const startMin = timeToMinutes(e.time);
                                    const endMin = e.eventType === 'plan' && ('endTime' in e && e.endTime)
                                        ? timeToMinutes(e.endTime)
                                        : startMin + 60;
                                    const top = (startMin / 1440) * 1440;
                                    const height = Math.max(((endMin - startMin) / 1440) * 1440, 30);
                                    const isTask = e.eventType === 'task';
                                    const isCompleted = isCompletedEvent(e);
                                    const progress = getTaskProgress(e);

                                    return (
                                        <Paper
                                            key={index}
                                            className={`event-block ${e.eventType} ${isCompleted ? 'completed' : 'active'}`}
                                            sx={{
                                                position: 'absolute',
                                                top: `${top}px`,
                                                height: `${height}px`,
                                                left: '5%',
                                                width: '90%',
                                                background: isTask
                                                    ? `linear-gradient(135deg, #f59e0b 0%, #ef4444 ${progress}%)`
                                                    : isCompleted
                                                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                                        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                zIndex: 1,
                                                '&:hover': {
                                                    zIndex: 20,
                                                },
                                            }}
                                            onClick={() => {
                                                if (isTask) {
                                                    setSelectedEvent(e);
                                                    setOpenTaskModal(true);
                                                } else {
                                                    openEditModal(e);
                                                }
                                            }}
                                        >
                                            <Box display="flex" alignItems="center" height="100%" p={1}>
                                                <Box flex={1} minWidth={0}>
                                                    <Typography
                                                        variant="caption"
                                                        fontWeight={600}
                                                        sx={{ color: 'white', display: 'block' }}
                                                    >
                                                        {e.title}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{ color: 'rgba(255,255,255,0.9)', display: 'block' }}
                                                    >
                                                        {e.time} {e.eventType === 'plan' && e.endTime && `- ${e.endTime}`}
                                                    </Typography>
                                                    {isTask && e.subTasks && (
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: 'rgba(255,255,255,0.9)', display: 'block' }}
                                                        >
                                                            {e.subTasks.filter(st => st.status === 'completed').length}/{e.subTasks.length}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    onClick={(ev) => {
                                                        ev.stopPropagation();
                                                        handleDelete(e);
                                                    }}
                                                    sx={{
                                                        color: 'white',
                                                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        </Paper>
                                    );
                                })}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    };

    const renderWeekView = () => {
        const weekStart = startOfWeek(selectedDate, { locale: ru });
        const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { locale: ru }) });

        return (
            <Box className="time-grid week" sx={{ height: 'calc(100vh - 200px)' }}>
                <Box className="time-labels">
                    {Array.from({ length: 24 }).map((_, h) => (
                        <Box key={h} className="time-label">
                            {h.toString().padStart(2, '0')}:00
                        </Box>
                    ))}
                </Box>
                <Box className="days-container">
                    {weekDays.map((day, d) => {
                        const eventsForDay = getEventsForDate(day);
                        const isTodayDay = isToday(day);

                        return (
                            <Box key={d} className="day-column">
                                <Box
                                    className="day-header"
                                    sx={{
                                        backgroundColor: isTodayDay ? '#e8f0fe' : '#f8f9fa',
                                        color: isTodayDay ? '#1a73e8' : '#202124',
                                        borderBottom: isTodayDay ? '2px solid #1a73e8' : '2px solid #e8eaed',
                                    }}
                                >
                                    <Box>
                                        <Typography variant="caption" display="block">
                                            {daysMap[getDay(day)]}
                                        </Typography>
                                        <Typography variant="subtitle2" fontWeight={600}>
                                            {format(day, 'd')}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box className="grid-lines">
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <Box key={i} className="horizontal-line" />
                                    ))}
                                    <Box className="events-container">
                                        {eventsForDay.map((e, index) => {
                                            const startMin = timeToMinutes(e.time);
                                            const endMin = e.eventType === 'plan' && ('endTime' in e && e.endTime)
                                                ? timeToMinutes(e.endTime)
                                                : startMin + 60;
                                            const top = (startMin / 1440) * 1440;
                                            const height = Math.max(((endMin - startMin) / 1440) * 1440, 30);
                                            const isTask = e.eventType === 'task';
                                            const isCompleted = isCompletedEvent(e);
                                            const progress = getTaskProgress(e);

                                            return (
                                                <Paper
                                                    key={index}
                                                    className={`event-block ${e.eventType} ${isCompleted ? 'completed' : 'active'}`}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: `${top}px`,
                                                        height: `${height}px`,
                                                        left: '5%',
                                                        width: '90%',
                                                        background: isTask
                                                            ? `linear-gradient(135deg, #f59e0b 0%, #ef4444 ${progress}%)`
                                                            : isCompleted
                                                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                                                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                        zIndex: 1,
                                                        '&:hover': {
                                                            zIndex: 20,
                                                        },
                                                    }}
                                                    onClick={() => {
                                                        if (isTask) {
                                                            setSelectedEvent(e);
                                                            setOpenTaskModal(true);
                                                        } else {
                                                            openEditModal(e);
                                                        }
                                                    }}
                                                >
                                                    <Box display="flex" alignItems="center" height="100%" p={1}>
                                                        <Box flex={1} minWidth={0}>
                                                            <Typography
                                                                variant="caption"
                                                                fontWeight={600}
                                                                sx={{ color: 'white', display: 'block' }}
                                                            >
                                                                {e.title}
                                                            </Typography>
                                                            <Typography
                                                                variant="caption"
                                                                sx={{ color: 'rgba(255,255,255,0.9)', display: 'block' }}
                                                            >
                                                                {e.time}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </Paper>
                                            );
                                        })}
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        );
    };

    const renderSelectedDayEvents = () => {
        const eventsForDay = getEventsForDate(selectedDate);

        if (eventsForDay.length === 0) {
            return (
                <Box textAlign="center" py={8}>
                    <CalendarTodayIcon sx={{ fontSize: 60, color: '#dadce0', mb: 2 }} />
                    <Typography color="text.secondary">
                        На {format(selectedDate, 'dd.MM.yyyy')} событий нет
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={handleOpenWizard}
                        sx={{ mt: 2 }}
                    >
                        Создать событие
                    </Button>
                </Box>
            );
        }

        return (
            <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h6" fontWeight={600}>
                        {format(selectedDate, 'EEEE, d MMMM', { locale: ru })}
                        {isToday(selectedDate) && (
                            <Chip
                                label="Сегодня"
                                size="small"
                                sx={{ ml: 2, backgroundColor: '#e8f0fe', color: '#1a73e8' }}
                            />
                        )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {eventsForDay.length} событий
                    </Typography>
                </Box>

                <List sx={{ maxHeight: 500, overflow: 'auto' }}>
                    {eventsForDay.map((event, index) => (
                        <EventListItem
                            key={event.name}
                            event={event}
                            openTaskModal={(e) => {
                                setSelectedEvent(e);
                                setOpenTaskModal(true);
                            }}
                            openEditModal={openEditModal}
                            handleDelete={handleDelete}
                            handleShare={handleShare}
                        />
                    ))}
                </List>
            </Box>
        );
    };

    const renderAllEvents = () => {
        if (events.length === 0) {
            return (
                <Box textAlign="center" py={8}>
                    <CalendarTodayIcon sx={{ fontSize: 60, color: '#dadce0', mb: 2 }} />
                    <Typography color="text.secondary" mb={2}>
                        У вас пока нет событий
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenWizard}
                    >
                        Создать первое событие
                    </Button>
                </Box>
            );
        }

        return (
            <List sx={{ maxHeight: 600, overflow: 'auto' }}>
                {events.map((event) => (
                    <EventListItem
                        key={event.name}
                        event={event}
                        openTaskModal={(e) => {
                            setSelectedEvent(e);
                            setOpenTaskModal(true);
                        }}
                        openEditModal={openEditModal}
                        handleDelete={handleDelete}
                        handleShare={handleShare}
                    />
                ))}
            </List>
        );
    };

    const openEditModal = (e: Event) => {
        setSelectedEvent(e);
        setTitle(e.title);
        setDate(e.date);
        setTime(e.time);
        setDescription(e.description);
        setIsPrivate(e.type === 'private');
        setPassword('');
        setOpenEdit(true);
    };

    const PlanCreationForm: React.FC<{ onCreate: (data: any) => void; onCancel: () => void }> = ({ onCreate, onCancel }) => {
        const [planTitle, setPlanTitle] = useState('');
        const [content, setContent] = useState('');
        const [startDate, setStartDate] = useState<Date | null>(new Date());
        const [endDate, setEndDate] = useState<Date | null>(null);
        const [recurring, setRecurring] = useState(false);
        const [privacy, setPrivacy] = useState('public');
        const [password, setPassword] = useState('');
        const [expirationDays, setExpirationDays] = useState(0);
        const [previousPlans, setPreviousPlans] = useState<string[]>([]);
        const [recStep, setRecStep] = useState(0);
        const [days, setDays] = useState<number[]>([]);
        const [reminderType, setReminderType] = useState<'same' | 'perDay'>('same');
        const [sameTime, setSameTime] = useState('');
        const [perDayTimes, setPerDayTimes] = useState<{ [key: number]: string }>({});
        const [endRepeat, setEndRepeat] = useState<Date | null>(null);

        useEffect(() => {
            const stored = localStorage.getItem('previousPlans');
            if (stored) setPreviousPlans(JSON.parse(stored));
        }, []);

        const handlePreset = (preset: string) => {
            if (preset === 'weekdays') setDays([1, 2, 3, 4, 5]);
            else if (preset === 'weekends') setDays([6, 7]);
            else if (preset === 'everyday') setDays([1, 2, 3, 4, 5, 6, 7]);
            else setDays([]);
        };

        const toggleDay = (day: number) => {
            setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
        };

        const handleSave = () => {
            if (!planTitle.trim()) return alert('Название обязательно');
            const data = {
                title: planTitle,
                content,
                date: startDate ? format(startDate, 'yyyy-MM-dd') : '',
                time: startDate ? format(startDate, 'HH:mm') : '',
                endDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
                endTime: endDate ? format(endDate, 'HH:mm') : '',
                recurringOptions: recurring ? {
                    days,
                    reminderType,
                    reminderTime: reminderType === 'same' ? sameTime : perDayTimes,
                    endRepeat: endRepeat ? format(endRepeat, 'yyyy-MM-dd') : null
                } : null,
                privacy,
                password: privacy === 'private' ? password : undefined,
                expirationDays
            };
            onCreate(data);
            const updatedPlans = Array.from(new Set([...previousPlans, planTitle]));
            localStorage.setItem('previousPlans', JSON.stringify(updatedPlans));
        };

        return (
            <Box>
                <Autocomplete
                    freeSolo
                    options={previousPlans}
                    value={planTitle}
                    onChange={(_, v) => setPlanTitle(v || '')}
                    onInputChange={(_, v) => setPlanTitle(v)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Название плана"
                            fullWidth
                            margin="normal"
                            inputProps={{ ...params.inputProps, maxLength: 100 }}
                            required
                        />
                    )}
                />
                <TextField
                    label="Содержание"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    multiline
                    rows={4}
                    fullWidth
                    margin="normal"
                    inputProps={{ maxLength: 2000 }}
                    helperText={`${content.length}/2000`}
                />
                {content && (
                    <Paper elevation={0} sx={{ p: 2, mb: 2, backgroundColor: '#f8f9fa' }}>
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </Paper>
                )}

                <Typography variant="subtitle2" fontWeight={600} mt={2} mb={1}>
                    Дата и время начала
                </Typography>
                <DatePicker
                    selected={startDate}
                    onChange={setStartDate}
                    showTimeSelect
                    dateFormat="dd.MM.yyyy HH:mm"
                    timeFormat="HH:mm"
                    minDate={new Date()}
                    wrapperClassName="date-picker"
                    customInput={
                        <TextField
                            fullWidth
                            margin="normal"
                            InputProps={{ readOnly: true }}
                        />
                    }
                />

                <Typography variant="subtitle2" fontWeight={600} mt={2} mb={1}>
                    Дата и время окончания
                </Typography>
                <DatePicker
                    selected={endDate}
                    onChange={setEndDate}
                    showTimeSelect
                    dateFormat="dd.MM.yyyy HH:mm"
                    timeFormat="HH:mm"
                    minDate={startDate ?? undefined}
                    wrapperClassName="date-picker"
                    customInput={
                        <TextField
                            fullWidth
                            margin="normal"
                            InputProps={{ readOnly: true }}
                        />
                    }
                />

                <FormControlLabel
                    control={
                        <Checkbox
                            checked={recurring}
                            onChange={e => setRecurring(e.target.checked)}
                        />
                    }
                    label="Повторяющийся план"
                    sx={{ mt: 2 }}
                />

                {recurring && (
                    <Stepper activeStep={recStep} orientation="vertical" sx={{ mt: 2 }}>
                        <Step>
                            <StepLabel>Выбор дней недели</StepLabel>
                            <StepContent>
                                <Box display="flex" gap={1} mb={2}>
                                    <Button variant="outlined" onClick={() => handlePreset('weekdays')}>
                                        По будням
                                    </Button>
                                    <Button variant="outlined" onClick={() => handlePreset('weekends')}>
                                        По выходным
                                    </Button>
                                    <Button variant="outlined" onClick={() => handlePreset('everyday')}>
                                        Каждый день
                                    </Button>
                                </Box>
                                <FormGroup row>
                                    {daysMap.map((d, i) => (
                                        <FormControlLabel
                                            key={i}
                                            control={
                                                <Checkbox
                                                    checked={days.includes(i + 1)}
                                                    onChange={() => toggleDay(i + 1)}
                                                />
                                            }
                                            label={d}
                                        />
                                    ))}
                                </FormGroup>
                                <Button
                                    variant="contained"
                                    disabled={days.length === 0}
                                    onClick={() => setRecStep(1)}
                                    sx={{ mt: 2 }}
                                >
                                    Далее
                                </Button>
                            </StepContent>
                        </Step>
                        <Step>
                            <StepLabel>Выбор времени напоминания</StepLabel>
                            <StepContent>
                                <RadioGroup
                                    value={reminderType}
                                    onChange={e => setReminderType(e.target.value as 'same' | 'perDay')}
                                >
                                    <FormControlLabel value="same" control={<Radio />} label="В одно и то же время" />
                                    <FormControlLabel value="perDay" control={<Radio />} label="Своё время для каждого дня" />
                                </RadioGroup>

                                {reminderType === 'same' && (
                                    <DatePicker
                                        selected={sameTime ? parse(sameTime, 'HH:mm', new Date()) : null}
                                        onChange={date => date && setSameTime(format(date, 'HH:mm'))}
                                        showTimeSelect
                                        showTimeSelectOnly
                                        timeIntervals={15}
                                        dateFormat="HH:mm"
                                        wrapperClassName="date-picker"
                                        customInput={
                                            <TextField
                                                fullWidth
                                                margin="normal"
                                                InputProps={{ readOnly: true }}
                                            />
                                        }
                                    />
                                )}

                                {reminderType === 'perDay' && (
                                    <Box>
                                        {days.map(day => (
                                            <Box key={day} mb={2}>
                                                <Typography variant="subtitle2">{daysFull[day]}</Typography>
                                                <DatePicker
                                                    selected={perDayTimes[day] ? parse(perDayTimes[day], 'HH:mm', new Date()) : null}
                                                    onChange={date => date && setPerDayTimes(prev => ({ ...prev, [day]: format(date, 'HH:mm') }))}
                                                    showTimeSelect
                                                    showTimeSelectOnly
                                                    timeIntervals={15}
                                                    dateFormat="HH:mm"
                                                    wrapperClassName="date-picker"
                                                    customInput={
                                                        <TextField
                                                            fullWidth
                                                            margin="normal"
                                                            InputProps={{ readOnly: true }}
                                                        />
                                                    }
                                                />
                                            </Box>
                                        ))}
                                    </Box>
                                )}

                                <Typography variant="subtitle2" fontWeight={600} mt={2} mb={1}>
                                    Конец повторений
                                </Typography>
                                <DatePicker
                                    selected={endRepeat}
                                    onChange={setEndRepeat}
                                    minDate={new Date()}
                                    wrapperClassName="date-picker"
                                    customInput={
                                        <TextField
                                            fullWidth
                                            margin="normal"
                                            InputProps={{ readOnly: true }}
                                        />
                                    }
                                />

                                <Box display="flex" gap={1} mt={2}>
                                    <Button onClick={() => setRecStep(0)}>Назад</Button>
                                    <Button variant="contained" onClick={() => setRecStep(2)}>Далее</Button>
                                </Box>
                            </StepContent>
                        </Step>
                        <Step>
                            <StepLabel>Настройки приватности</StepLabel>
                            <StepContent>
                                <RadioGroup value={privacy} onChange={e => setPrivacy(e.target.value)}>
                                    <FormControlLabel value="public" control={<Radio />} label="Публичный" />
                                    <FormControlLabel value="private" control={<Radio />} label="Приватный" />
                                </RadioGroup>

                                {privacy === 'private' && (
                                    <>
                                        <TextField
                                            label="Пароль"
                                            type="password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            fullWidth
                                            margin="normal"
                                        />
                                        <TextField
                                            label="Срок действия пароля (дней)"
                                            type="number"
                                            value={expirationDays}
                                            onChange={e => setExpirationDays(Number(e.target.value))}
                                            fullWidth
                                            margin="normal"
                                            InputProps={{ inputProps: { min: 0 } }}
                                        />
                                    </>
                                )}

                                <Box display="flex" gap={1} mt={2}>
                                    <Button onClick={() => setRecStep(1)}>Назад</Button>
                                    <Button variant="contained" onClick={handleSave}>Создать план</Button>
                                </Box>
                            </StepContent>
                        </Step>
                    </Stepper>
                )}

                {!recurring && (
                    <>
                        <RadioGroup value={privacy} onChange={e => setPrivacy(e.target.value)} sx={{ mt: 2 }}>
                            <FormControlLabel value="public" control={<Radio />} label="Публичный" />
                            <FormControlLabel value="private" control={<Radio />} label="Приватный" />
                        </RadioGroup>

                        {privacy === 'private' && (
                            <>
                                <TextField
                                    label="Пароль"
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    fullWidth
                                    margin="normal"
                                />
                                <TextField
                                    label="Срок действия пароля (дней)"
                                    type="number"
                                    value={expirationDays}
                                    onChange={e => setExpirationDays(Number(e.target.value))}
                                    fullWidth
                                    margin="normal"
                                    InputProps={{ inputProps: { min: 0 } }}
                                />
                            </>
                        )}
                    </>
                )}

                {!recurring && (
                    <Box display="flex" justifyContent="flex-end" gap={2} mt={4}>
                        <Button onClick={onCancel}>Отмена</Button>
                        <Button variant="contained" onClick={handleSave}>Создать план</Button>
                    </Box>
                )}
            </Box>
        );
    };

    const TaskCreationForm: React.FC<{ onCreate: (data: any) => void; onCancel: () => void }> = ({ onCreate, onCancel }) => {
        const [taskTitle, setTaskTitle] = useState('');
        const [multiTask, setMultiTask] = useState(false);
        const [subTasks, setSubTasks] = useState([{ name: '', description: '', deadline: '', priority: 'medium', status: 'open' }]);
        const [privacy, setPrivacy] = useState('public');
        const [password, setPassword] = useState('');
        const [expirationDays, setExpirationDays] = useState(0);

        const addSubTask = () => {
            setSubTasks([...subTasks, { name: '', description: '', deadline: '', priority: 'medium', status: 'open' }]);
        };

        const updateSubTask = (index: number, field: string, value: string) => {
            const updated = [...subTasks];
            updated[index] = {
                ...updated[index],
                [field]: value,
            };
            setSubTasks(updated);
        };

        const deleteSubTask = (index: number) => {
            if (window.confirm('Удалить подзадачу?')) {
                setSubTasks(subTasks.filter((_, i) => i !== index));
            }
        };

        const handleSave = () => {
            if (!taskTitle.trim()) return alert('Название обязательно');
            const data = {
                title: taskTitle,
                subTasks: multiTask ? subTasks : undefined,
                privacy,
                password: privacy === 'private' ? password : undefined,
                expirationDays
            };
            onCreate(data);
        };

        return (
            <Box>
                <TextField
                    label="Название задачи"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    fullWidth
                    margin="normal"
                    inputProps={{ maxLength: 100 }}
                    required
                />

                <FormControlLabel
                    control={
                        <Checkbox
                            checked={multiTask}
                            onChange={e => setMultiTask(e.target.checked)}
                        />
                    }
                    label="Мультизадача (с подзадачами)"
                />

                {multiTask && (
                    <Box mt={2}>
                        <Typography variant="subtitle2" fontWeight={600} mb={2}>
                            Подзадачи ({subTasks.length})
                        </Typography>

                        {subTasks.map((sub, index) => (
                            <Paper key={index} elevation={0} sx={{ p: 2, mb: 2, border: 1, borderColor: 'divider' }}>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                    <Typography variant="subtitle2">Подзадача {index + 1}</Typography>
                                    {subTasks.length > 1 && (
                                        <IconButton
                                            size="small"
                                            onClick={() => deleteSubTask(index)}
                                            sx={{ color: '#ef4444' }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Box>

                                <TextField
                                    label="Название подзадачи"
                                    value={sub.name}
                                    onChange={e => updateSubTask(index, 'name', e.target.value)}
                                    fullWidth
                                    margin="normal"
                                    size="small"
                                />

                                <TextField
                                    label="Описание"
                                    value={sub.description}
                                    onChange={e => updateSubTask(index, 'description', e.target.value)}
                                    fullWidth
                                    margin="normal"
                                    multiline
                                    rows={2}
                                    size="small"
                                />

                                <Box display="flex" gap={2} mt={2}>
                                    <DatePicker
                                        selected={sub.deadline ? new Date(sub.deadline) : null}
                                        onChange={date => date && updateSubTask(index, 'deadline', format(date, 'yyyy-MM-dd'))}
                                        wrapperClassName="date-picker"
                                        customInput={
                                            <TextField
                                                label="Дедлайн"
                                                fullWidth
                                                margin="normal"
                                                size="small"
                                                InputProps={{ readOnly: true }}
                                            />
                                        }
                                    />

                                    <Select
                                        value={sub.priority}
                                        onChange={e => updateSubTask(index, 'priority', e.target.value as string)}
                                        fullWidth
                                        size="small"
                                    >
                                        <MenuItem value="low">Низкий</MenuItem>
                                        <MenuItem value="medium">Средний</MenuItem>
                                        <MenuItem value="high">Высокий</MenuItem>
                                    </Select>

                                    <Select
                                        value={sub.status}
                                        onChange={e => updateSubTask(index, 'status', e.target.value as string)}
                                        fullWidth
                                        size="small"
                                    >
                                        <MenuItem value="open">Открыта</MenuItem>
                                        <MenuItem value="inprogress">В процессе</MenuItem>
                                        <MenuItem value="completed">Завершена</MenuItem>
                                    </Select>
                                </Box>
                            </Paper>
                        ))}

                        <Button
                            variant="outlined"
                            onClick={addSubTask}
                            startIcon={<AddIcon />}
                            sx={{ mt: 1 }}
                        >
                            Добавить подзадачу
                        </Button>
                    </Box>
                )}

                <Typography variant="subtitle2" fontWeight={600} mt={4} mb={2}>
                    Настройки приватности
                </Typography>

                <RadioGroup value={privacy} onChange={e => setPrivacy(e.target.value)}>
                    <FormControlLabel value="public" control={<Radio />} label="Публичный" />
                    <FormControlLabel value="private" control={<Radio />} label="Приватный" />
                </RadioGroup>

                {privacy === 'private' && (
                    <>
                        <TextField
                            label="Пароль"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            fullWidth
                            margin="normal"
                        />
                        <TextField
                            label="Срок действия пароля (дней)"
                            type="number"
                            value={expirationDays}
                            onChange={e => setExpirationDays(Number(e.target.value))}
                            fullWidth
                            margin="normal"
                            InputProps={{ inputProps: { min: 0 } }}
                        />
                    </>
                )}

                <Box display="flex" justifyContent="flex-end" gap={2} mt={4}>
                    <Button onClick={onCancel}>Отмена</Button>
                    <Button variant="contained" onClick={handleSave}>Создать задачу</Button>
                </Box>
            </Box>
        );
    };

    const filteredPending = pendingShares.filter(s => {
        if (filterFIO && !s.sender.toLowerCase().includes(filterFIO.toLowerCase())) return false;
        if (filterType && s.type !== filterType) return false;
        const sDate = new Date(s.date);
        if (filterStart && sDate < filterStart) return false;
        if (filterEnd && sDate > filterEnd) return false;
        return true;
    });

    return (
        <ThemeProvider theme={theme}>
            <Container className="dashboard-container" maxWidth={false}>
                {/* Header */}
                <Paper className="header" elevation={3}>
                    <Box display="flex" alignItems="center" width="100%" gap={2}>
                        <IconButton onClick={handlePrevious} className="nav-button">
                            <ArrowBackIosIcon />
                        </IconButton>

                        <Typography variant="h6" className="header-title" sx={{ flex: 1 }}>
                            {headerTitle()}
                        </Typography>

                        <IconButton onClick={handleNext} className="nav-button">
                            <ArrowForwardIosIcon />
                        </IconButton>

                        <Select
                            value={view}
                            onChange={(e) => setView(e.target.value as 'month' | 'week' | 'day')}
                            className="view-switcher"
                            size="small"
                        >
                            <MenuItem value="month">Месяц</MenuItem>
                            <MenuItem value="week">Неделя</MenuItem>
                            <MenuItem value="day">День</MenuItem>
                        </Select>

                        <Button
                            onClick={handleOpenWizard}
                            variant="contained"
                            className="create-button"
                            startIcon={<AddIcon />}
                        >
                            Создать событие
                        </Button>

                        <Button
                            startIcon={<PersonIcon />}
                            onClick={handleProfileClick}
                            variant="outlined"
                            className="profile-button"
                            sx={{ textTransform: 'capitalize' }}
                        >
                            {currentRole}
                        </Button>
                    </Box>
                </Paper>

                {/* Profile Menu */}
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                    PaperProps={{
                        elevation: 3,
                        sx: {
                            mt: 1,
                            minWidth: 200,
                        }
                    }}
                >
                    <MenuItem
                        onClick={() => {
                            handleClose();
                            handleLogout();
                        }}
                        sx={{ color: '#ef4444' }}
                    >
                        Выйти
                    </MenuItem>
                    {isDual && (
                        <MenuItem
                            onClick={() => {
                                handleClose();
                                handleSwitchRole();
                            }}
                        >
                            Переключить на {otherRole}
                        </MenuItem>
                    )}
                </Menu>

                {/* Main Content */}
                <Box sx={{ p: 3 }}>
                    {/* Month View */}
                    <CSSTransition
                        in={view === 'month'}
                        timeout={300}
                        classNames="view-transition"
                        unmountOnExit
                        nodeRef={monthRef}
                    >
                        <Box ref={monthRef}>
                            <Box className="month-view-container">
                                <Paper className="main-calendar" elevation={3}>
                                    <Calendar
                                        onChange={(value) => setSelectedDate(value as Date)}
                                        value={selectedDate}
                                        activeStartDate={currentMonth}
                                        onActiveStartDateChange={({ activeStartDate }) => {
                                            if (activeStartDate) {
                                                setCurrentMonth(startOfMonth(activeStartDate));
                                            }
                                        }}
                                        tileContent={tileContent}
                                        locale="ru-RU"
                                        navigationLabel={({ date }) => (
                                            <Typography fontWeight={600}>
                                                {format(date, 'LLLL yyyy', { locale: ru })}
                                            </Typography>
                                        )}
                                    />
                                </Paper>

                                <Paper className="selected-day-events" elevation={3}>
                                    {renderSelectedDayEvents()}
                                </Paper>
                            </Box>
                        </Box>
                    </CSSTransition>

                    {/* Week View */}
                    <CSSTransition
                        in={view === 'week'}
                        timeout={300}
                        classNames="view-transition"
                        unmountOnExit
                        nodeRef={weekRef}
                    >
                        <Box ref={weekRef} sx={{ mt: 2 }}>
                            {renderWeekView()}
                        </Box>
                    </CSSTransition>

                    {/* Day View */}
                    <CSSTransition
                        in={view === 'day'}
                        timeout={300}
                        classNames="view-transition"
                        unmountOnExit
                        nodeRef={dayRef}
                    >
                        <Box ref={dayRef} sx={{ mt: 2 }}>
                            {renderDayView()}
                        </Box>
                    </CSSTransition>

                    {/* All Events Section */}
                    <Box sx={{ mt: 4 }}>
                        <Button
                            onClick={() => setShowAllEvents(!showAllEvents)}
                            className="show-all-button"
                            endIcon={
                                <ExpandMoreIcon
                                    sx={{
                                        transform: showAllEvents ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.3s',
                                    }}
                                />
                            }
                        >
                            {showAllEvents ? 'Скрыть все события' : 'Показать все события'}
                            <Chip
                                label={events.length}
                                size="small"
                                sx={{
                                    ml: 1,
                                    backgroundColor: '#1a73e8',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                }}
                            />
                        </Button>

                        <Collapse in={showAllEvents}>
                            <Paper elevation={3} sx={{ mt: 2, p: 3 }}>
                                <Typography variant="h6" fontWeight={600} mb={3}>
                                    Все события ({events.length})
                                </Typography>
                                {renderAllEvents()}
                            </Paper>
                        </Collapse>
                    </Box>
                </Box>

                {/* Event Creation Wizard */}
                <Dialog
                    open={openWizard}
                    onClose={() => setOpenWizard(false)}
                    maxWidth="md"
                    fullWidth
                    PaperProps={{ className: 'dialog-paper' }}
                >
                    <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        Создать событие
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2 }}>
                        <Tabs
                            value={tabValue}
                            onChange={(_, v) => setTabValue(v)}
                            sx={{ mb: 3 }}
                        >
                            <Tab label="План" />
                            <Tab label="Задача" />
                        </Tabs>
                        {tabValue === 0 && (
                            <PlanCreationForm
                                onCreate={handleCreatePlan}
                                onCancel={() => setOpenWizard(false)}
                            />
                        )}
                        {tabValue === 1 && (
                            <TaskCreationForm
                                onCreate={handleCreateTask}
                                onCancel={() => setOpenWizard(false)}
                            />
                        )}
                    </DialogContent>
                </Dialog>

                {/* Edit Event Dialog */}
                <Dialog
                    open={openEdit}
                    onClose={() => setOpenEdit(false)}
                    PaperProps={{ className: 'dialog-paper' }}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Редактировать событие</DialogTitle>
                    <DialogContent>
                        <TextField
                            label="Название"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            fullWidth
                            margin="normal"
                            required
                        />
                        <TextField
                            type="date"
                            label="Дата"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            fullWidth
                            margin="normal"
                            required
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            type="time"
                            label="Время"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            fullWidth
                            margin="normal"
                            required
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            label="Описание"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            fullWidth
                            multiline
                            rows={4}
                            margin="normal"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={isPrivate}
                                    onChange={e => setIsPrivate(e.target.checked)}
                                />
                            }
                            label="Приватное событие"
                        />
                        {isPrivate && (
                            <TextField
                                label="Новый пароль (опционально)"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                fullWidth
                                margin="normal"
                                helperText="Оставьте пустым, чтобы не менять пароль"
                            />
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenEdit(false)}>Отмена</Button>
                        <Button
                            onClick={handleEdit}
                            variant="contained"
                            className="save-button"
                        >
                            Сохранить изменения
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Task Modal */}
                <TaskModal
                    open={openTaskModal}
                    event={selectedEvent && selectedEvent.eventType === 'task' ? selectedEvent as TaskEvent : null}
                    onClose={() => setOpenTaskModal(false)}
                    onSave={handleUpdateTask}
                />

                {/* Pending Shares Notification */}
                {pendingShares.length > 0 && (
                    <Snackbar
                        open={pendingShares.length > 0}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    >
                        <Alert
                            severity="info"
                            action={
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={() => setOpenShares(true)}
                                >
                                    Просмотреть
                                </Button>
                            }
                            sx={{ width: '100%' }}
                        >
                            С вами поделились событиями ({pendingShares.length})
                        </Alert>
                    </Snackbar>
                )}

                {/* Pending Shares Dialog */}
                <Dialog
                    open={openShares}
                    onClose={() => setOpenShares(false)}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>
                        События, которыми поделились с вами ({pendingShares.length})
                    </DialogTitle>
                    <DialogContent>
                        <Box display="flex" gap={2} mb={3} flexWrap="wrap">
                            <TextField
                                label="ФИО отправителя"
                                value={filterFIO}
                                onChange={e => setFilterFIO(e.target.value)}
                                size="small"
                                sx={{ flex: 1, minWidth: 200 }}
                            />
                            <Select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                size="small"
                                sx={{ minWidth: 120 }}
                            >
                                <MenuItem value="">Все типы</MenuItem>
                                <MenuItem value="plan">План</MenuItem>
                                <MenuItem value="task">Задача</MenuItem>
                            </Select>
                            <DatePicker
                                selected={filterStart}
                                onChange={setFilterStart}
                                placeholderText="От"
                                wrapperClassName="date-picker"
                                customInput={
                                    <TextField
                                        size="small"
                                        InputProps={{ readOnly: true }}
                                        sx={{ minWidth: 120 }}
                                    />
                                }
                            />
                            <DatePicker
                                selected={filterEnd}
                                onChange={setFilterEnd}
                                placeholderText="До"
                                wrapperClassName="date-picker"
                                customInput={
                                    <TextField
                                        size="small"
                                        InputProps={{ readOnly: true }}
                                        sx={{ minWidth: 120 }}
                                    />
                                }
                            />
                        </Box>

                        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                            {filteredPending.length === 0 ? (
                                <Typography color="text.secondary" textAlign="center" py={4}>
                                    Нет событий по заданным фильтрам
                                </Typography>
                            ) : (
                                filteredPending.map((s) => (
                                    <Paper
                                        key={s.id}
                                        elevation={0}
                                        sx={{
                                            p: 2,
                                            mb: 2,
                                            border: 1,
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                        }}
                                    >
                                        <Box display="flex" alignItems="center" justifyContent="space-between">
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={600}>
                                                    {s.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {s.sender} поделился с вами {s.type === 'plan' ? 'планом' : 'задачей'}
                                                </Typography>
                                                <Typography variant="caption" display="block" color="text.secondary">
                                                    {format(new Date(s.date), 'dd.MM.yyyy')} {s.time}
                                                </Typography>
                                            </Box>
                                            <Box display="flex" gap={1}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleAccept(s.id)}
                                                    sx={{
                                                        color: '#10b981',
                                                        '&:hover': { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                                                    }}
                                                >
                                                    <CheckIcon />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setDeclineId(s.id)}
                                                    sx={{
                                                        color: '#ef4444',
                                                        '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
                                                    }}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Box>
                                        </Box>
                                    </Paper>
                                ))
                            )}
                        </List>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenShares(false)}>Закрыть</Button>
                    </DialogActions>
                </Dialog>

                {/* Decline Dialog */}
                <Dialog open={!!declineId} onClose={() => setDeclineId(null)}>
                    <DialogTitle>Отклонить предложение?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                            Отправитель получит уведомление о вашем отказе.
                        </Typography>
                        <TextField
                            label="Причина отказа (опционально)"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            multiline
                            rows={3}
                            fullWidth
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeclineId(null)}>Отмена</Button>
                        <Button
                            onClick={handleConfirmDecline}
                            variant="contained"
                            color="error"
                        >
                            Отклонить
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Share Dialog */}
                <Dialog
                    open={openShare}
                    onClose={() => setOpenShare(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>
                        Поделиться событием: {shareEvent?.title}
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" mb={3}>
                            Выберите пользователей, с которыми хотите поделиться событием
                        </Typography>

                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight={600}>Преподаватели ({teachers.length})</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                onChange={(e) =>
                                                    e.target.checked ? selectAll(teachers) : setSelectedUsers([])
                                                }
                                                checked={teachers.every(t => selectedUsers.includes(t.username))}
                                            />
                                        }
                                        label="Выбрать всех"
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                        Выбрано: {selectedUsers.filter(u => teachers.some(t => t.username === u)).length}
                                    </Typography>
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                                    {teachers.map((t) => (
                                        <FormControlLabel
                                            key={t.id}
                                            control={
                                                <Checkbox
                                                    checked={selectedUsers.includes(t.username)}
                                                    onChange={() => toggleUser(t.username)}
                                                />
                                            }
                                            label={
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                                                        {t.username[0].toUpperCase()}
                                                    </Avatar>
                                                    <Typography variant="body2">{t.username}</Typography>
                                                </Box>
                                            }
                                            sx={{ width: '100%', ml: 0, mb: 1 }}
                                        />
                                    ))}
                                </Box>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight={600}>Студенты ({students.length})</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                onChange={(e) =>
                                                    e.target.checked ? selectAll(students) : setSelectedUsers([])
                                                }
                                                checked={students.every(s => selectedUsers.includes(s.username))}
                                            />
                                        }
                                        label="Выбрать всех"
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                        Выбрано: {selectedUsers.filter(u => students.some(s => s.username === u)).length}
                                    </Typography>
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                                    {students.map((s) => (
                                        <FormControlLabel
                                            key={s.id}
                                            control={
                                                <Checkbox
                                                    checked={selectedUsers.includes(s.username)}
                                                    onChange={() => toggleUser(s.username)}
                                                />
                                            }
                                            label={
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                                                        {s.username[0].toUpperCase()}
                                                    </Avatar>
                                                    <Typography variant="body2">{s.username}</Typography>
                                                </Box>
                                            }
                                            sx={{ width: '100%', ml: 0, mb: 1 }}
                                        />
                                    ))}
                                </Box>
                            </AccordionDetails>
                        </Accordion>

                        {currentRole !== 'student' && (
                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography fontWeight={600}>Администраторы ({admins.length})</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    onChange={(e) =>
                                                        e.target.checked ? selectAll(admins) : setSelectedUsers([])
                                                    }
                                                    checked={admins.every(a => selectedUsers.includes(a.username))}
                                                />
                                            }
                                            label="Выбрать всех"
                                        />
                                        <Typography variant="caption" color="text.secondary">
                                            Выбрано: {selectedUsers.filter(u => admins.some(a => a.username === u)).length}
                                        </Typography>
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                                        {admins.map((a) => (
                                            <FormControlLabel
                                                key={a.id}
                                                control={
                                                    <Checkbox
                                                        checked={selectedUsers.includes(a.username)}
                                                        onChange={() => toggleUser(a.username)}
                                                    />
                                                }
                                                label={
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                                                            {a.username[0].toUpperCase()}
                                                        </Avatar>
                                                        <Typography variant="body2">{a.username}</Typography>
                                                    </Box>
                                                }
                                                sx={{ width: '100%', ml: 0, mb: 1 }}
                                            />
                                        ))}
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        )}

                        <Box mt={3}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={shareForbidEdit}
                                        onChange={e => setShareForbidEdit(e.target.checked)}
                                    />
                                }
                                label="Запретить редактирование"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={shareAllowComments}
                                        onChange={e => setShareAllowComments(e.target.checked)}
                                    />
                                }
                                label="Разрешить комментарии"
                            />
                        </Box>

                        <Typography variant="caption" color="text.secondary" mt={2} display="block">
                            Всего выбрано пользователей: {selectedUsers.length}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenShare(false)}>Отмена</Button>
                        <Button
                            onClick={handleConfirmShare}
                            variant="contained"
                            disabled={selectedUsers.length === 0}
                        >
                            Поделиться ({selectedUsers.length})
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* URL and QR Code */}
                {url && (
                    <Paper
                        elevation={3}
                        sx={{
                            position: 'fixed',
                            bottom: 20,
                            right: 20,
                            p: 3,
                            maxWidth: 400,
                            backgroundColor: 'white',
                            zIndex: 1000,
                        }}
                    >
                        <Typography variant="subtitle2" fontWeight={600} mb={1}>
                            Ссылка на событие:
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                display: 'block',
                                wordBreak: 'break-all',
                                backgroundColor: '#f8f9fa',
                                p: 1,
                                borderRadius: 1,
                                mb: 2,
                            }}
                        >
                            {url}
                        </Typography>
                        {qrUrl && (
                            <Box textAlign="center">
                                <QRCodeSVG value={qrUrl} size={128} />
                                <Typography variant="caption" color="text.secondary" mt={1} display="block">
                                    QR-код для быстрого доступа
                                </Typography>
                            </Box>
                        )}
                        <Button
                            size="small"
                            onClick={() => {
                                navigator.clipboard.writeText(url);
                                alert('Ссылка скопирована в буфер обмена');
                            }}
                            sx={{ mt: 2 }}
                        >
                            Скопировать ссылку
                        </Button>
                    </Paper>
                )}
            </Container>
        </ThemeProvider>
    );
};

export default Dashboard;