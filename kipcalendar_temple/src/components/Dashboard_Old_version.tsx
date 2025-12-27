import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Button, Container, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Checkbox, Typography, IconButton, List, ListItem, ListItemText, Collapse, ThemeProvider, createTheme, Tabs, Tab, RadioGroup, Radio, FormGroup, Stepper, Step, StepLabel, StepContent, Select, MenuItem, Snackbar, Alert, Menu, Autocomplete, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import CheckIcon from '@mui/icons-material/Check';
import ShareIcon from '@mui/icons-material/Share';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, parse, getDay, isWithinInterval, parseISO } from 'date-fns';
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
    },
});

const daysMap = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

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
}

const EventListItem: React.FC<{ e: Event; openTaskModal: (e: Event) => void; openEditModal: (e: Event) => void; handleDelete: (e: Event) => void; handleShare: (e: Event) => void }> = ({ e, openTaskModal, openEditModal, handleDelete, handleShare }) => {
    const itemRef = useRef<HTMLLIElement>(null);
    const handleClick = () => {
        if (e.eventType === 'task') {
            openTaskModal(e);
        } else {
            openEditModal(e);
        }
    };
    return (
        <CSSTransition timeout={300} classNames="fade" nodeRef={itemRef}>
            <ListItem ref={itemRef} className="event-list-item" onClick={handleClick}>
                <ListItemText primary={e.title} secondary={`${format(new Date(e.date), 'dd.MM.yyyy', { locale: ru })} ${e.time} - ${e.eventType} - ${e.description}`} />
                <IconButton onClick={(ev) => { ev.stopPropagation(); openEditModal(e); }}><EditIcon /></IconButton>
                <IconButton onClick={(ev) => { ev.stopPropagation(); handleShare(e); }}><ShareIcon /></IconButton>
                <IconButton onClick={(ev) => { ev.stopPropagation(); handleDelete(e); }}><DeleteIcon /></IconButton>
            </ListItem>
        </CSSTransition>
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
            // для немультизадачных задач создаём одну "главную" подзадачу
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
    const uncompleted = localSubTasks.filter(st => st.status !== 'completed');

    const toggleStatus = (index: number) => {
        const updated = [...localSubTasks];
        updated[index] = {
            ...updated[index],
            status: updated[index].status === 'completed' ? 'open' : 'completed',
        };
        setLocalSubTasks(updated);
    };

    const handleSave = () => {
        if (!event) return;
        onSave({ ...event, subTasks: localSubTasks });
    };

    const completeAll = () => {
        setLocalSubTasks(prev => prev.map(st => ({ ...st, status: 'completed' })));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Задачи: {event.title}</DialogTitle>
            <DialogContent>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label={`Выполненные (${completed.length})`} />
                    <Tab label={`Невыполненные (${uncompleted.length})`} />
                </Tabs>
                {tab === 0 && (
                    <List>
                        {completed.map((st, i) => (
                            <ListItem key={i}>
                                <ListItemText primary={st.name} secondary={st.description} />
                                <Checkbox checked onChange={() => toggleStatus(localSubTasks!.findIndex(t => t === st))} />
                            </ListItem>
                        ))}
                    </List>
                )}
                {tab === 1 && (
                    <List>
                        {uncompleted.map((st, i) => (
                            <ListItem key={i}>
                                <ListItemText primary={st.name} secondary={st.description} />
                                <Checkbox checked={false} onChange={() => toggleStatus(localSubTasks!.findIndex(t => t === st))} />
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={completeAll}>Отметить задачу как выполненную</Button>
                <Button onClick={onClose}>Закрыть</Button>
                <Button onClick={handleSave}>Сохранить</Button>
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
    const [time, setTime] = useState('00:00');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
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
    };

    const loadPendingShares = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const headers: HeadersInit = { 'Authorization': token };
        const res = await fetch(`${API_BASE_URL}/api/shares/pending`, { headers });
        if (res.ok) {
            setPendingShares(await res.json());
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        const headers: HeadersInit = { 'Authorization': token };
        const fetchEvents = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/events`, { headers });
                if (res.ok) {
                    const fetchedEvents = await res.json();
                    setEvents(fetchedEvents.map((ev: any) => ({
                        ...ev,
                        recurringOptions: ev.recurring_options || null,
                        subTasks: ev.subtasks || null,
                    })));
                } else {
                    localStorage.removeItem('token');
                    navigate('/');
                }
            } catch (error: any) {
                alert('Ошибка загрузки событий: ' + (error?.message || String(error)));
            }
        };
        const fetchRole = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/role`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setRoles(data.roles || []);
                    setCurrentRole(data.currentRole || '');
                }
            } catch (error: any) {
                console.error('Ошибка загрузки роли');
            }
        };
        fetchEvents();
        fetchRole();
        loadPendingShares();

        socket.on('event_update', fetchEvents);
        socket.on('new_share', loadPendingShares);
        socket.on('share_declined', (data: { reason: string }) => alert(`Ваше событие отклонено: ${data.reason}`));

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

    useEffect(() => {
        if (openShare) {
            const fetchUsers = async () => {
                const token = localStorage.getItem('token');
                if (!token) return;
                const headers = { 'Authorization': token };
                if (currentRole === 'student') {
                    // Assume fetching from group, but for simplicity use all
                    const tRes = await fetch(`${API_BASE_URL}/api/users/get-by-role?role=teacher`, { headers });
                    if (tRes.ok) setTeachers(await tRes.json());
                    const sRes = await fetch(`${API_BASE_URL}/api/users/get-by-role?role=student`, { headers });
                    if (sRes.ok) setStudents(await sRes.json());
                } else {
                    const tRes = await fetch(`${API_BASE_URL}/api/users/get-by-role?role=teacher`, { headers });
                    if (tRes.ok) setTeachers(await tRes.json());
                    const sRes = await fetch(`${API_BASE_URL}/api/users/get-by-role?role=student`, { headers });
                    if (sRes.ok) setStudents(await sRes.json());
                    const aRes = await fetch(`${API_BASE_URL}/api/users/get-by-role?role=admin`, { headers });
                    if (aRes.ok) setAdmins(await aRes.json());
                }
            };
            fetchUsers();
        }
    }, [openShare, currentRole]);

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
        const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
        try {
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
        const data: { title: string; date: string; time: string; description: string; password?: string } = { title, date, time, description };
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
        const token = localStorage.getItem('token');
        if (!token) return;
        if (window.confirm('Удалить событие?')) {
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
        }
    };

    const handleAccept = async (id: string) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const headers: HeadersInit = { 'Authorization': token };
        const res = await fetch(`${API_BASE_URL}/api/shares/accept/${id}`, { method: 'POST', headers });
        if (res.ok) {
            loadPendingShares();
            refreshEvents();
        }
    };

    const handleConfirmDecline = async () => {
        if (!declineId) return;
        const token = localStorage.getItem('token');
        if (!token) return;
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
    };

    const handleShare = (e: Event) => {
        setShareEvent(e);
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
            } else {
                alert('Ошибка шаринга');
            }
        } catch (error: any) {
            alert('Ошибка соединения: ' + error.message);
        }
    };

    const toggleUser = (username: string) => {
        setSelectedUsers(prev => prev.includes(username) ? prev.filter(u => u !== username) : [...prev, username]);
    };

    const selectAll = (list: any[]) => {
        setSelectedUsers(prev => {
            const newUsers = list.map(u => u.username);
            const combined = [...prev, ...newUsers];
            return combined.filter((value, index, self) => self.indexOf(value) === index);
        });
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
            const dayOfWeek = getDay(date); // 0 sun, 1 mon...
            const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
            if (!isWithinInterval(date, { start: startD, end: endR || date }) || !options.days.includes(adjustedDay)) return [];
            const instance = { ...e, date: fmt };
            return [instance];
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

    const isCompleted = (e: Event) => {
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
                        {eventsForDay.slice(0, 3).map((e, i) => (
                            <div
                                key={i}
                                className="tile-event"
                                style={{ backgroundColor: e.eventType === 'plan' ? (isCompleted(e) ? 'linear-gradient(to bottom, #90ee90, #006400)' : '#808080') : '#4285f4' }}
                                onClick={() => {
                                    if (e.eventType === 'task') { setSelectedEvent(e); setOpenTaskModal(true); } else openEditModal(e);
                                }}
                            >
                                {e.title}
                            </div>
                        ))}
                        {eventsForDay.length > 3 && <div className="more-events">+{eventsForDay.length - 3}</div>}
                    </div>
                );
            }
        }
        return null;
    };

    const headerTitle = () => {
        switch (view) {
            case 'month':
                return format(currentMonth, 'MMMM yyyy', { locale: ru });
            case 'week':
                const weekStart = startOfWeek(selectedDate, { locale: ru });
                const weekEnd = endOfWeek(selectedDate, { locale: ru });
                return `${format(weekStart, 'd MMM', { locale: ru })} - ${format(weekEnd, 'd MMM yyyy', { locale: ru })}`;
            case 'day':
                return format(selectedDate, 'd MMMM yyyy', { locale: ru });
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
        const eventsForDay = getEventsForDate(selectedDate).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
        const columns = placeEventsInColumns(eventsForDay);
        const maxColumns = Math.max(...columns.map(col => col.length), 1);

        return (
            <div className="time-grid day">
                <div className="time-labels">
                    {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className="time-label">
                            {h}:00
                        </div>
                    ))}
                </div>
                <div className="days-container">
                    <div className="day-column">
                        <div className="grid-lines">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} className="horizontal-line" />
                            ))}
                            <div className="events-container">
                                {eventsForDay.map(e => {
                                    const startMin = timeToMinutes(e.time);
                                    const endMin = e.eventType === 'plan' && ('endTime' in e && e.endTime) ? timeToMinutes(e.endTime) : startMin + 60;
                                    const top = (startMin / 1440) * 1440;
                                    const height = ((endMin - startMin) / 1440) * 1440;
                                    const colIndex = columns.findIndex(col => col.includes(e));
                                    const width = 100 / maxColumns;
                                    const left = colIndex * width;
                                    const className = `event-block ${e.eventType} ${isCompleted(e) ? 'completed' : 'active'}`;
                                    const progress = getTaskProgress(e);
                                    const style: React.CSSProperties = { top: `${top}px`, height: `${height}px`, left: `${left}%`, width: `${width}%` };
                                    if (e.eventType === 'task') {
                                        style.background = `linear-gradient(to right, #1a73e8 ${progress}%, #dadce0 ${progress}%)`;
                                    }
                                    return (
                                        <div
                                            key={e.name}
                                            className={className}
                                            style={style}
                                            onClick={() => {
                                                if (e.eventType === 'task') { setSelectedEvent(e); setOpenTaskModal(true); } else openEditModal(e);
                                            }}
                                        >
                                            <div className="event-content">
                                                {e.title} <span className="event-time">{e.time}</span>
                                            </div>
                                            <IconButton
                                                size="small"
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    handleDelete(e);
                                                }}
                                                className="delete-button"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderWeekView = () => {
        const weekStart = startOfWeek(selectedDate, { locale: ru });
        const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { locale: ru }) });
        return (
            <div className="time-grid week">
                <div className="time-labels">
                    {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className="time-label">
                            {h}:00
                        </div>
                    ))}
                </div>
                <div className="days-container">
                    {weekDays.map((day, d) => {
                        const eventsForDay = getEventsForDate(day).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
                        const columns = placeEventsInColumns(eventsForDay);
                        const maxColumns = Math.max(...columns.map(col => col.length), 1);
                        return (
                            <div key={d} className="day-column">
                                <div className="day-header">{format(day, 'EEE dd', { locale: ru })}</div>
                                <div className="grid-lines">
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <div key={i} className="horizontal-line" />
                                    ))}
                                    <div className="events-container">
                                        {eventsForDay.map(e => {
                                            const startMin = timeToMinutes(e.time);
                                            const endMin = e.eventType === 'plan' && ('endTime' in e && e.endTime) ? timeToMinutes(e.endTime) : startMin + 60;
                                            const top = (startMin / 1440) * 1440;
                                            const height = ((endMin - startMin) / 1440) * 1440;
                                            const colIndex = columns.findIndex(col => col.includes(e));
                                            const width = 100 / maxColumns;
                                            const left = colIndex * width;
                                            const className = `event-block ${e.eventType} ${isCompleted(e) ? 'completed' : 'active'}`;
                                            const progress = getTaskProgress(e);
                                            const style: React.CSSProperties = { top: `${top}px`, height: `${height}px`, left: `${left}%`, width: `${width}%` };
                                            if (e.eventType === 'task') {
                                                style.background = `linear-gradient(to right, #1a73e8 ${progress}%, #dadce0 ${progress}%)`;
                                            }
                                            return (
                                                <div
                                                    key={e.name}
                                                    className={className}
                                                    style={style}
                                                    onClick={() => {
                                                        if (e.eventType === 'task') { setSelectedEvent(e); setOpenTaskModal(true); } else openEditModal(e);
                                                    }}
                                                >
                                                    <div className="event-content">
                                                        {e.title} <span className="event-time">{e.time}</span>
                                                    </div>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(ev) => {
                                                            ev.stopPropagation();
                                                            handleDelete(e);
                                                        }}
                                                        className="delete-button"
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const placeEventsInColumns = (events: Event[]) => {
        const columns: Event[][] = [];
        for (const event of events) {
            const start = timeToMinutes(event.time);
            const end = event.eventType === 'plan' && ('endTime' in event && event.endTime) ? timeToMinutes(event.endTime) : start + 60;
            let placed = false;
            for (const col of columns) {
                if (!col.some(ev => {
                    const evStart = timeToMinutes(ev.time);
                    const evEnd = ev.eventType === 'plan' && ('endTime' in ev && ev.endTime) ? timeToMinutes(ev.endTime) : evStart + 60;
                    return !(end <= evStart || start >= evEnd);
                })) {
                    col.push(event);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([event]);
            }
        }
        return columns;
    };

    const renderAllEvents = () => {
        return events.map(e => (
            <EventListItem key={e.name} e={e} openTaskModal={() => { setSelectedEvent(e); setOpenTaskModal(true); }} openEditModal={openEditModal} handleDelete={handleDelete} handleShare={handleShare} />
        ));
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
            <div>
                <Autocomplete
                    freeSolo
                    options={previousPlans}
                    value={planTitle}
                    onChange={(_, v) => setPlanTitle(v || '')}
                    onInputChange={(_, v) => setPlanTitle(v)}
                    renderInput={(params) => <TextField {...params} label="Название плана" fullWidth margin="normal" inputProps={{ ...params.inputProps, maxLength: 100 }} required />}
                />
                <TextField label="Содержание" value={content} onChange={e => setContent(e.target.value)} multiline rows={5} fullWidth margin="normal" inputProps={{ maxLength: 2000 }} />
                <ReactMarkdown>{content}</ReactMarkdown>
                <Typography>Дата и время начала</Typography>
                <DatePicker selected={startDate} onChange={setStartDate} showTimeSelect dateFormat="MMMM d, yyyy h:mm aa" minDate={new Date()} wrapperClassName="date-picker" />
                <Typography>Дата и время окончания</Typography>
                <DatePicker selected={endDate} onChange={setEndDate} showTimeSelect dateFormat="MMMM d, yyyy h:mm aa" minDate={startDate ?? undefined} wrapperClassName="date-picker" />
                <FormControlLabel control={<Checkbox checked={recurring} onChange={e => setRecurring(e.target.checked)} />} label="Повторяющийся план" />
                {recurring && (
                    <Stepper activeStep={recStep} orientation="vertical">
                        <Step>
                            <StepLabel>Выбор дней недели</StepLabel>
                            <StepContent>
                                <Button onClick={() => handlePreset('weekdays')}>По будням</Button>
                                <Button onClick={() => handlePreset('weekends')}>По выходным</Button>
                                <Button onClick={() => handlePreset('everyday')}>Каждый день</Button>
                                <Button onClick={() => handlePreset('custom')}>Выбрать свои</Button>
                                <FormGroup row>
                                    {daysMap.map((d, i) => (
                                        <FormControlLabel key={i} control={<Checkbox checked={days.includes(i + 1)} onChange={() => toggleDay(i + 1)} />} label={d} />
                                    ))}
                                </FormGroup>
                                <Button disabled={days.length === 0} onClick={() => setRecStep(1)}>Далее</Button>
                            </StepContent>
                        </Step>
                        <Step>
                            <StepLabel>Выбор времени напоминания</StepLabel>
                            <StepContent>
                                <RadioGroup value={reminderType} onChange={e => setReminderType(e.target.value as 'same' | 'perDay')}>
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
                                    />
                                )}
                                {reminderType === 'perDay' && (
                                    <div>
                                        {days.map(day => (
                                            <div key={day}>
                                                <Typography>{daysMap[day]}</Typography>
                                                <DatePicker
                                                    selected={perDayTimes[day] ? parse(perDayTimes[day], 'HH:mm', new Date()) : null}
                                                    onChange={date => date && setPerDayTimes(prev => ({ ...prev, [day]: format(date, 'HH:mm') }))}
                                                    showTimeSelect
                                                    showTimeSelectOnly
                                                    timeIntervals={15}
                                                    dateFormat="HH:mm"
                                                    wrapperClassName="date-picker"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Typography>Конец повторений</Typography>
                                <DatePicker selected={endRepeat} onChange={setEndRepeat} minDate={new Date()} wrapperClassName="date-picker" />
                                <Button onClick={() => setRecStep(0)}>Назад</Button>
                            </StepContent>
                        </Step>
                    </Stepper>
                )}
                <RadioGroup value={privacy} onChange={e => setPrivacy(e.target.value)}>
                    <FormControlLabel value="public" control={<Radio />} label="Публичный" />
                    <FormControlLabel value="private" control={<Radio />} label="Приватный" />
                </RadioGroup>
                {privacy === 'private' && <TextField label="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth margin="normal" />}
                {privacy === 'private' && <TextField label="Срок действия пароля (дней)" type="number" value={expirationDays} onChange={e => setExpirationDays(Number(e.target.value))} fullWidth margin="normal" />}
                <Button onClick={onCancel}>Отмена</Button>
                <Button onClick={handleSave}>Создать</Button>
            </div>
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
            updated[index][field as keyof typeof subTasks[0]] = value;
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
            <div>
                <TextField label="Название задачи" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} fullWidth margin="normal" inputProps={{ maxLength: 100 }} required />
                <FormControlLabel control={<Checkbox checked={multiTask} onChange={e => setMultiTask(e.target.checked)} />} label="Мультизадача" />
                {multiTask && (
                    <div>
                        {subTasks.map((sub, index) => (
                            <div key={index}>
                                <TextField label="Название подзадачи" value={sub.name} onChange={e => updateSubTask(index, 'name', e.target.value)} fullWidth margin="normal" />
                                <TextField label="Описание" value={sub.description} onChange={e => updateSubTask(index, 'description', e.target.value)} fullWidth margin="normal" />
                                <DatePicker placeholderText="Дедлайн" selected={sub.deadline ? new Date(sub.deadline) : null} onChange={date => date && updateSubTask(index, 'deadline', format(date, 'yyyy-MM-dd'))} wrapperClassName="date-picker" />
                                <Select value={sub.priority} onChange={e => updateSubTask(index, 'priority', e.target.value as string)} >
                                    <MenuItem value="low">Низкий</MenuItem>
                                    <MenuItem value="medium">Средний</MenuItem>
                                    <MenuItem value="high">Высокий</MenuItem>
                                </Select>
                                <Select value={sub.status} onChange={e => updateSubTask(index, 'status', e.target.value as string)} >
                                    <MenuItem value="open">Открыта</MenuItem>
                                    <MenuItem value="inprogress">В процессе</MenuItem>
                                    <MenuItem value="completed">Завершена</MenuItem>
                                </Select>
                                <IconButton onClick={() => deleteSubTask(index)}><DeleteIcon /></IconButton>
                            </div>
                        ))}
                        <Button onClick={addSubTask}>Добавить подзадачу</Button>
                    </div>
                )}
                <RadioGroup value={privacy} onChange={e => setPrivacy(e.target.value)}>
                    <FormControlLabel value="public" control={<Radio />} label="Публичный" />
                    <FormControlLabel value="private" control={<Radio />} label="Приватный" />
                </RadioGroup>
                {privacy === 'private' && <TextField label="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth margin="normal" />}
                {privacy === 'private' && <TextField label="Срок действия пароля (дней)" type="number" value={expirationDays} onChange={e => setExpirationDays(Number(e.target.value))} fullWidth margin="normal" />}
                <Button onClick={onCancel}>Отмена</Button>
                <Button onClick={handleSave}>Создать</Button>
            </div>
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
            <Container className="dashboard-container">
                <div className="header">
                    <Button onClick={handlePrevious} className="nav-button"><ArrowBackIosIcon /></Button>
                    <Typography variant="h5" className="header-title">{headerTitle()}</Typography>
                    <Button onClick={handleNext} className="nav-button"><ArrowForwardIosIcon /></Button>
                    <select value={view} onChange={(e) => setView(e.target.value as 'month' | 'week' | 'day')} className="view-switcher">
                        <option value="month">Месяц</option>
                        <option value="week">Неделя</option>
                        <option value="day">День</option>
                    </select>
                    <Button onClick={handleOpenWizard} variant="contained" className="create-button" startIcon={<AddIcon />}>Создать событие</Button>
                    <Button startIcon={<PersonIcon />} onClick={handleProfileClick} variant="outlined" className="profile-button">{currentRole}</Button>
                </div>
                <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
                    <MenuItem onClick={() => { handleClose(); handleLogout(); }}>Выйти</MenuItem>
                    {isDual && <MenuItem onClick={() => { handleClose(); handleSwitchRole(); }}>Переключить на {otherRole}</MenuItem>}
                </Menu>
                <CSSTransition in={view === 'month'} timeout={500} classNames="view-transition" unmountOnExit nodeRef={monthRef}>
                    <div ref={monthRef} className="month-view-container">
                        <Calendar
                            onChange={(value) => setSelectedDate(value as Date)}
                            value={selectedDate}
                            activeStartDate={currentMonth}
                            tileContent={tileContent}
                            locale="ru-RU"
                            className="main-calendar"
                        />
                        <div className="selected-day-events">
                            <Typography variant="h6" className="events-title">События на {format(selectedDate, 'dd.MM.yyyy', { locale: ru })}</Typography>
                            {renderDayView()}
                        </div>
                    </div>
                </CSSTransition>
                <CSSTransition in={view === 'week'} timeout={500} classNames="view-transition" unmountOnExit nodeRef={weekRef}>
                    <div ref={weekRef}>
                        {renderWeekView()}
                    </div>
                </CSSTransition>
                <CSSTransition in={view === 'day'} timeout={500} classNames="view-transition" unmountOnExit nodeRef={dayRef}>
                    <div ref={dayRef}>
                        {renderDayView()}
                    </div>
                </CSSTransition>
                <Button onClick={() => setShowAllEvents(!showAllEvents)} className="show-all-button">
                    {showAllEvents ? 'Скрыть все события' : 'Показать все события'}
                    <ExpandMoreIcon style={{ transform: showAllEvents ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
                </Button>
                <Collapse in={showAllEvents}>
                    <List className="all-events-list">{renderAllEvents()}</List>
                </Collapse>
                <Dialog open={openWizard} onClose={() => setOpenWizard(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Создать событие</DialogTitle>
                    <DialogContent>
                        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                            <Tab label="План" />
                            <Tab label="Задача" />
                        </Tabs>
                        {tabValue === 0 && <PlanCreationForm onCreate={handleCreatePlan} onCancel={() => setOpenWizard(false)} />}
                        {tabValue === 1 && <TaskCreationForm onCreate={handleCreateTask} onCancel={() => setOpenWizard(false)} />}
                    </DialogContent>
                </Dialog>
                <Dialog open={openEdit} onClose={() => setOpenEdit(false)} classes={{ paper: 'dialog-paper' }}>
                    <DialogTitle>Редактировать событие</DialogTitle>
                    <DialogContent>
                        <TextField label="Название" value={title} onChange={e => setTitle(e.target.value)} fullWidth margin="normal" />
                        <TextField type="date" label="Дата" value={date} onChange={e => setDate(e.target.value)} fullWidth margin="normal" />
                        <TextField type="time" label="Время" value={time} onChange={e => setTime(e.target.value)} fullWidth margin="normal" />
                        <TextField label="Описание" value={description} onChange={e => setDescription(e.target.value)} fullWidth multiline margin="normal" />
                        <FormControlLabel control={<Checkbox checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />} label="Приватное" />
                        {isPrivate && <TextField label="Новый пароль (опционально)" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth margin="normal" />}
                        <Button onClick={handleEdit} variant="contained" className="save-button">Сохранить изменения</Button>
                    </DialogContent>
                </Dialog>
                <TaskModal
                    open={openTaskModal}
                    event={selectedEvent && selectedEvent.eventType === 'task' ? selectedEvent as TaskEvent : null}
                    onClose={() => setOpenTaskModal(false)}
                    onSave={handleUpdateTask}
                />
                <Snackbar open={pendingShares.length > 0} autoHideDuration={null}>
                    <Alert severity="info" action={<Button color="inherit" onClick={() => setOpenShares(true)}>Просмотреть</Button>}>
                        С вами поделились событиями ({pendingShares.length})
                    </Alert>
                </Snackbar>
                <Dialog open={openShares} onClose={() => setOpenShares(false)}>
                    <DialogTitle>С вами поделились событиями</DialogTitle>
                    <DialogContent>
                        <TextField label="ФИО" value={filterFIO} onChange={e => setFilterFIO(e.target.value)} fullWidth margin="normal" />
                        <Select value={filterType} onChange={e => setFilterType(e.target.value)} fullWidth margin="dense">
                            <MenuItem value="">Все</MenuItem>
                            <MenuItem value="plan">План</MenuItem>
                            <MenuItem value="task">Задача</MenuItem>
                        </Select>
                        <DatePicker selected={filterStart} onChange={setFilterStart} placeholderText="От" wrapperClassName="date-picker" />
                        <DatePicker selected={filterEnd} onChange={setFilterEnd} placeholderText="До" wrapperClassName="date-picker" />
                        <List>
                            {filteredPending.map(s => (
                                <ListItem key={s.id}>
                                    <ListItemText primary={`${s.sender} поделился с вами событием-${s.type} ${s.name}`} secondary={`${format(new Date(s.date), 'dd.MM.yyyy')} ${s.time}`} />
                                    <IconButton onClick={() => handleAccept(s.id)}><CheckIcon /></IconButton>
                                    <IconButton onClick={() => setDeclineId(s.id)}><DeleteIcon /></IconButton>
                                </ListItem>
                            ))}
                        </List>
                    </DialogContent>
                </Dialog>
                <Dialog open={!!declineId} onClose={() => setDeclineId(null)}>
                    <DialogTitle>Отклонить?</DialogTitle>
                    <DialogContent>
                        <Typography>Отправитель получит уведомление.</Typography>
                        <TextField label="Почему?" value={reason} onChange={e => setReason(e.target.value)} multiline fullWidth />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeclineId(null)}>Отмена</Button>
                        <Button onClick={handleConfirmDecline}>Отклонить</Button>
                    </DialogActions>
                </Dialog>
                <Dialog open={openShare} onClose={() => setOpenShare(false)}>
                    <DialogTitle>Поделиться событием</DialogTitle>
                    <DialogContent>
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Преподаватели</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <FormControlLabel control={<Checkbox onChange={(e) => e.target.checked ? selectAll(teachers) : setSelectedUsers([])} />} label="Выбрать всех" />
                                {teachers.map(t => (
                                    <FormControlLabel key={t.id} control={<Checkbox checked={selectedUsers.includes(t.username)} onChange={() => toggleUser(t.username)} />} label={t.username} />
                                ))}
                            </AccordionDetails>
                        </Accordion>
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Студенты</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <FormControlLabel control={<Checkbox onChange={(e) => e.target.checked ? selectAll(students) : setSelectedUsers([])} />} label="Выбрать всех" />
                                {students.map(s => (
                                    <FormControlLabel key={s.id} control={<Checkbox checked={selectedUsers.includes(s.username)} onChange={() => toggleUser(s.username)} />} label={s.username} />
                                ))}
                            </AccordionDetails>
                        </Accordion>
                        {currentRole !== 'student' && (
                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography>Администраторы</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <FormControlLabel control={<Checkbox onChange={(e) => e.target.checked ? selectAll(admins) : setSelectedUsers([])} />} label="Выбрать всех" />
                                    {admins.map(a => (
                                        <FormControlLabel key={a.id} control={<Checkbox checked={selectedUsers.includes(a.username)} onChange={() => toggleUser(a.username)} />} label={a.username} />
                                    ))}
                                </AccordionDetails>
                            </Accordion>
                        )}
                        <FormControlLabel control={<Checkbox checked={shareForbidEdit} onChange={e => setShareForbidEdit(e.target.checked)} />} label="Запретить редактирование" />
                        <FormControlLabel control={<Checkbox checked={shareAllowComments} onChange={e => setShareAllowComments(e.target.checked)} />} label="Разрешить комментарии" />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenShare(false)}>Отмена</Button>
                        <Button onClick={handleConfirmShare}>Поделиться</Button>
                    </DialogActions>
                </Dialog>
                {url && <Typography className="url-link">Ссылка: <a href={url}>{url}</a> (скопируй)</Typography>}
                {qrUrl && <QRCodeSVG value={qrUrl} />}
            </Container>
        </ThemeProvider>
    );
};

export default Dashboard;