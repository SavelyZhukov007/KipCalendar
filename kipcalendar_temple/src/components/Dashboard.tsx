import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  Radio,
  Typography,
  List,
  Collapse,
  Tabs,
  Steps,
  Avatar,
  Tag,
  Divider,
  Alert,
  Card,
  Row,
  Col,
  Space,
  Dropdown,
  Menu,
  DatePicker,
  TimePicker,
  Progress,
  QRCode,
  Badge,
  Popconfirm,
  message,
  notification,
  Drawer,
  InputNumber
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  CheckOutlined,
  ShareAltOutlined,
  LeftOutlined,
  RightOutlined,
  DownOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  LockOutlined,
  GlobalOutlined
} from '@ant-design/icons';
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
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { CSSTransition } from 'react-transition-group';
import ReactMarkdown from 'react-markdown';
import type { Event, PlanEvent, TaskEvent } from '../types/Event';
import io from 'socket.io-client';
import './Dashboard.css';

const API_BASE_URL = 'http://localhost:5000';
const socket = io(API_BASE_URL);

const { Text, Title } = Typography;
const { Panel } = Collapse;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

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

const EventListItem: React.FC<{
  event: Event;
  openTaskModal: (event: Event) => void;
  openEditModal: (event: Event) => void;
  handleDelete: (event: Event) => void;
  handleShare: (event: Event) => void;
}> = ({ event, openTaskModal, openEditModal, handleDelete, handleShare }) => {
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
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  return (
    <Card
      size="small"
      style={{ marginBottom: 12, cursor: 'pointer' }}
      onClick={handleClick}
      hoverable
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <Space align="start" style={{ marginBottom: 8 }}>
            <Text strong style={{ color: isTask ? '#fa8c16' : isCompleted ? '#52c41a' : '#1890ff' }}>
              {event.title}
            </Text>
            {isTask && event.subTasks && (
              <Tag color={getPriorityColor(event.subTasks[0]?.priority)}>
                {`${event.subTasks.filter(st => st.status === 'completed').length}/${event.subTasks.length}`}
              </Tag>
            )}
            {isCompleted && (
              <Tag color="green">Завершено</Tag>
            )}
          </Space>

          <Space size="middle" style={{ marginBottom: 8 }}>
            <Space size="small">
              <CalendarOutlined style={{ color: '#8c8c8c' }} />
              <Text type="secondary">
                {format(new Date(event.date), 'dd.MM.yyyy', { locale: ru })}
              </Text>
            </Space>

            <Space size="small">
              <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
              <Text type="secondary">{event.time}</Text>
            </Space>

            <Tag color={isTask ? 'orange' : 'blue'}>
              {isTask ? 'Задача' : 'План'}
            </Tag>

            {event.type === 'private' && (
              <Tag color="default">Приватное</Tag>
            )}
          </Space>

          {event.description && (
            <Space size="small" align="start">
              <FileTextOutlined style={{ color: '#8c8c8c', marginTop: 4 }} />
              <Text type="secondary" ellipsis>
                {event.description}
              </Text>
            </Space>
          )}
        </div>

        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(event);
            }}
          />
          <Button
            type="text"
            icon={<ShareAltOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleShare(event);
            }}
          />
          <Popconfirm
            title="Удалить событие?"
            description="Вы уверены, что хотите удалить это событие?"
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDelete(event);
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      </div>
    </Card>
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
  const [activeTab, setActiveTab] = useState('all');

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
    setActiveTab('all');
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
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'inprogress': return 'processing';
      case 'open': return 'default';
      default: return 'default';
    }
  };

  const tabItems = [
    {
      key: 'all',
      label: `Все (${localSubTasks.length})`,
      children: (
        <List
          dataSource={localSubTasks}
          renderItem={(st, index) => (
            <Card size="small" style={{ marginBottom: 8 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Checkbox
                    checked={st.status === 'completed'}
                    onChange={(e) => {
                      toggleStatus(index, e.target.checked ? 'completed' : 'open');
                    }}
                  >
                    <Text strong>{st.name}</Text>
                  </Checkbox>
                  <Space>
                    <Tag color={getPriorityColor(st.priority)}>
                      {st.priority === 'high' ? 'Высокий' :
                        st.priority === 'medium' ? 'Средний' : 'Низкий'}
                    </Tag>
                    <Tag color={getStatusColor(st.status)} icon={st.status === 'inprogress' ? <SyncOutlined spin /> : null}>
                      {st.status === 'completed' ? 'Выполнено' :
                        st.status === 'inprogress' ? 'В процессе' : 'Открыта'}
                    </Tag>
                  </Space>
                </div>
                {st.description && (
                  <Text type="secondary">{st.description}</Text>
                )}
                {st.deadline && (
                  <Space>
                    <CalendarOutlined />
                    <Text type="secondary">Дедлайн: {format(new Date(st.deadline), 'dd.MM.yyyy')}</Text>
                  </Space>
                )}
                <Space>
                  <Button
                    size="small"
                    type={st.status === 'open' ? 'primary' : 'default'}
                    onClick={() => toggleStatus(index, 'open')}
                  >
                    Открыта
                  </Button>
                  <Button
                    size="small"
                    type={st.status === 'inprogress' ? 'primary' : 'default'}
                    onClick={() => toggleStatus(index, 'inprogress')}
                  >
                    В процессе
                  </Button>
                  <Button
                    size="small"
                    type={st.status === 'completed' ? 'primary' : 'default'}
                    onClick={() => toggleStatus(index, 'completed')}
                  >
                    Выполнено
                  </Button>
                </Space>
              </Space>
            </Card>
          )}
        />
      ),
    },
    {
      key: 'completed',
      label: `Выполненные (${completed.length})`,
      children: (
        <List
          dataSource={completed}
          renderItem={(st) => (
            <Card size="small" style={{ marginBottom: 8 }}>
              <Space direction="vertical">
                <Text strong>{st.name}</Text>
                {st.description && <Text type="secondary">{st.description}</Text>}
                <Tag color="green">Выполнено</Tag>
              </Space>
            </Card>
          )}
        />
      ),
    },
    {
      key: 'inprogress',
      label: `В процессе (${inProgress.length})`,
      children: (
        <List
          dataSource={inProgress}
          renderItem={(st) => (
            <Card size="small" style={{ marginBottom: 8 }}>
              <Space direction="vertical">
                <Text strong>{st.name}</Text>
                {st.description && <Text type="secondary">{st.description}</Text>}
                <Tag color="processing" icon={<SyncOutlined spin />}>В процессе</Tag>
              </Space>
            </Card>
          )}
        />
      ),
    },
    {
      key: 'open',
      label: `Открытые (${openTasks.length})`,
      children: (
        <List
          dataSource={openTasks}
          renderItem={(st) => (
            <Card size="small" style={{ marginBottom: 8 }}>
              <Space direction="vertical">
                <Text strong>{st.name}</Text>
                {st.description && <Text type="secondary">{st.description}</Text>}
                <Tag color="default">Открыта</Tag>
              </Space>
            </Card>
          )}
        />
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <Text strong>{event.title}</Text>
          <Tag color="orange">Задача</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Закрыть
        </Button>,
        <Button key="complete" onClick={completeAll} icon={<CheckOutlined />}>
          Выполнить все
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          Сохранить изменения
        </Button>,
      ]}
    >
      {event.description && (
        <Alert message={event.description} type="info" style={{ marginBottom: 16 }} />
      )}
      
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Modal>
  );
};

const Dashboard: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [openWizard, setOpenWizard] = useState(false);
  const [wizardTab, setWizardTab] = useState('plan');
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
  const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
  const [openShares, setOpenShares] = useState(false);
  const [filterFIO, setFilterFIO] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStart, setFilterStart] = useState<Dayjs | null>(null);
  const [filterEnd, setFilterEnd] = useState<Dayjs | null>(null);
  const [openShare, setOpenShare] = useState(false);
  const [shareEvent, setShareEvent] = useState<Event | null>(null);
  const [shareForbidEdit, setShareForbidEdit] = useState(false);
  const [shareAllowComments, setShareAllowComments] = useState(false);
  const [teachers, setTeachers] = useState<UserShort[]>([]);
  const [students, setStudents] = useState<UserShort[]>([]);
  const [admins, setAdmins] = useState<UserShort[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [planForm] = Form.useForm();
  const [taskForm] = Form.useForm();
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
      message.error(`Ваше событие отклонено: ${data.reason}`);
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
        message.success('Роль переключена');
      }
    } catch (error: any) {
      message.error('Ошибка переключения роли');
    }
  };

  const isDual = roles.length > 1;
  const otherRole = roles.find(r => r !== currentRole) || '';

  const handleOpenWizard = () => {
    setWizardTab('plan');
    setOpenWizard(true);
    planForm.resetFields();
    taskForm.resetFields();
  };

  const handleCreatePlan = async (values: any) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
      const res = await fetch(`${API_BASE_URL}/api/events/create-plan`, {
        method: 'POST',
        headers,
        body: JSON.stringify(values)
      });
      if (res.ok) {
        const { url: newUrl } = await res.json();
        setUrl(newUrl);
        setOpenWizard(false);
        refreshEvents();
        if (values.privacy === 'private' && values.password) {
          setQrUrl(`${newUrl}?password=${values.password}`);
        }
        message.success('План успешно создан');
      } else {
        message.error('Ошибка создания плана');
      }
    } catch (error: any) {
      message.error('Ошибка соединения');
    }
  };

  const handleCreateTask = async (values: any) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
      const res = await fetch(`${API_BASE_URL}/api/events/create-task`, {
        method: 'POST',
        headers,
        body: JSON.stringify(values)
      });
      if (res.ok) {
        const { url: newUrl } = await res.json();
        setUrl(newUrl);
        setOpenWizard(false);
        refreshEvents();
        if (values.privacy === 'private' && values.password) {
          setQrUrl(`${newUrl}?password=${values.password}`);
        }
        message.success('Задача успешно создана');
      } else {
        message.error('Ошибка создания задачи');
      }
    } catch (error: any) {
      message.error('Ошибка соединения');
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
        message.success('Задача обновлена');
      } else {
        message.error('Ошибка обновления задачи');
      }
    } catch (error: any) {
      message.error('Ошибка соединения');
    }
  };

  const handleEdit = async (values: any) => {
    const token = localStorage.getItem('token');
    if (!token || !selectedEvent) return;
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
      const res = await fetch(`${API_BASE_URL}/event/${selectedEvent.type}/${selectedEvent.name}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(values)
      });
      if (res.ok) {
        setOpenEdit(false);
        refreshEvents();
        message.success('Событие обновлено');
      } else {
        message.error('Ошибка редактирования');
      }
    } catch (error: any) {
      message.error('Ошибка соединения');
    }
  };

  const handleDelete = async (event: Event) => {
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
        message.success('Событие удалено');
      } else {
        message.error('Ошибка удаления');
      }
    } catch (error: any) {
      message.error('Ошибка соединения');
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
        message.success('Событие успешно добавлено');
      }
    } catch (error) {
      message.error('Ошибка принятия события');
    }
  };

  const handleDecline = async (id: string, reason?: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
      const res = await fetch(`${API_BASE_URL}/api/shares/decline/${id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        loadPendingShares();
        message.success('Предложение отклонено');
      }
    } catch (error) {
      message.error('Ошибка отклонения события');
    }
  };

  const handleShare = (event: Event) => {
    setShareEvent(event);
    setOpenShare(true);
    setSelectedUsers([]);
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
        message.success('Событие успешно отправлено');
      } else {
        message.error('Ошибка отправки события');
      }
    } catch (error: any) {
      message.error('Ошибка соединения');
    }
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

    return (
      <div className="time-grid day" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="time-labels">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="time-label">
              {h.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        <div className="days-container">
          <div className="day-column">
            <div className="day-header">
              {format(selectedDate, 'EEEE, d MMMM', { locale: ru })}
            </div>
            <div className="grid-lines">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="horizontal-line" />
              ))}
              <div className="events-container">
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
                    <Card
                      key={index}
                      className={`event-block ${e.eventType} ${isCompleted ? 'completed' : 'active'}`}
                      style={{
                        position: 'absolute',
                        top: `${top}px`,
                        height: `${height}px`,
                        left: '5%',
                        width: '90%',
                        background: isTask
                          ? `linear-gradient(135deg, #fa8c16 0%, #f5222d ${progress}%)`
                          : isCompleted
                            ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
                            : 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                        zIndex: 1,
                      }}
                      onClick={() => {
                        if (isTask) {
                          setSelectedEvent(e);
                          setOpenTaskModal(true);
                        } else {
                          openEditModal(e);
                        }
                      }}
                      hoverable
                    >
                      <Space direction="vertical" size={0} style={{ width: '100%' }}>
                        <Text strong style={{ color: 'white' }}>{e.title}</Text>
                        <Text type="secondary" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          {e.time} {e.eventType === 'plan' && e.endTime && `- ${e.endTime}`}
                        </Text>
                        {isTask && e.subTasks && (
                          <Text type="secondary" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {e.subTasks.filter(st => st.status === 'completed').length}/{e.subTasks.length}
                          </Text>
                        )}
                      </Space>
                    </Card>
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
      <div className="time-grid week" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="time-labels">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="time-label">
              {h.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        <div className="days-container">
          {weekDays.map((day, d) => {
            const eventsForDay = getEventsForDate(day);
            const isTodayDay = isToday(day);

            return (
              <div key={d} className="day-column">
                <div
                  className="day-header"
                  style={{
                    backgroundColor: isTodayDay ? '#e6f7ff' : '#fafafa',
                    color: isTodayDay ? '#1890ff' : '#262626',
                    borderBottom: isTodayDay ? '2px solid #1890ff' : '2px solid #f0f0f0',
                  }}
                >
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {daysMap[getDay(day)]}
                    </Text>
                    <Text strong style={{ fontSize: 16 }}>{format(day, 'd')}</Text>
                  </div>
                </div>
                <div className="grid-lines">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="horizontal-line" />
                  ))}
                  <div className="events-container">
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
                        <Card
                          key={index}
                          className={`event-block ${e.eventType} ${isCompleted ? 'completed' : 'active'}`}
                          style={{
                            position: 'absolute',
                            top: `${top}px`,
                            height: `${height}px`,
                            left: '5%',
                            width: '90%',
                            background: isTask
                              ? `linear-gradient(135deg, #fa8c16 0%, #f5222d ${progress}%)`
                              : isCompleted
                                ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
                                : 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                            zIndex: 1,
                          }}
                          onClick={() => {
                            if (isTask) {
                              setSelectedEvent(e);
                              setOpenTaskModal(true);
                            } else {
                              openEditModal(e);
                            }
                          }}
                          hoverable
                        >
                          <Space direction="vertical" size={0} style={{ width: '100%' }}>
                            <Text strong style={{ color: 'white' }}>{e.title}</Text>
                            <Text type="secondary" style={{ color: 'rgba(255,255,255,0.9)' }}>
                              {e.time}
                            </Text>
                          </Space>
                        </Card>
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

  const renderSelectedDayEvents = () => {
    const eventsForDay = getEventsForDate(selectedDate);

    if (eventsForDay.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CalendarOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
          <Text type="secondary">На {format(selectedDate, 'dd.MM.yyyy')} событий нет</Text>
          <div style={{ marginTop: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenWizard}>
              Создать событие
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              {format(selectedDate, 'EEEE, d MMMM', { locale: ru })}
            </Title>
            {isToday(selectedDate) && (
              <Tag color="blue">Сегодня</Tag>
            )}
          </Space>
          <Text type="secondary">{eventsForDay.length} событий</Text>
        </div>

        <List
          dataSource={eventsForDay}
          renderItem={(event) => (
            <EventListItem
              event={event}
              openTaskModal={(e) => {
                setSelectedEvent(e);
                setOpenTaskModal(true);
              }}
              openEditModal={openEditModal}
              handleDelete={handleDelete}
              handleShare={handleShare}
            />
          )}
        />
      </div>
    );
  };

  const renderAllEvents = () => {
    if (events.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CalendarOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            У вас пока нет событий
          </Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenWizard}>
            Создать первое событие
          </Button>
        </div>
      );
    }

    return (
      <List
        dataSource={events}
        renderItem={(event) => (
          <EventListItem
            event={event}
            openTaskModal={(e) => {
              setSelectedEvent(e);
              setOpenTaskModal(true);
            }}
            openEditModal={openEditModal}
            handleDelete={handleDelete}
            handleShare={handleShare}
          />
        )}
      />
    );
  };

  const openEditModal = (e: Event) => {
    setSelectedEvent(e);
    form.setFieldsValue({
      title: e.title,
      date: dayjs(e.date),
      time: dayjs(e.time, 'HH:mm'),
      description: e.description,
      privacy: e.type,
      password: ''
    });
    setOpenEdit(true);
  };

  const PlanCreationForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const [recurring, setRecurring] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    const steps = [
      {
        title: 'Основная информация',
      },
      {
        title: 'Расписание',
      },
      {
        title: 'Приватность',
      },
    ];

    const onFinish = (values: any) => {
      const data = {
        title: values.title,
        content: values.content,
        date: values.startDate.format('YYYY-MM-DD'),
        time: values.startDate.format('HH:mm'),
        endDate: values.endDate?.format('YYYY-MM-DD') || '',
        endTime: values.endDate?.format('HH:mm') || '',
        recurringOptions: recurring ? {
          days: values.days || [],
          reminderType: values.reminderType || 'same',
          reminderTime: values.reminderType === 'same' ? values.sameTime?.format('HH:mm') : values.perDayTimes,
          endRepeat: values.endRepeat?.format('YYYY-MM-DD') || null
        } : null,
        privacy: values.privacy,
        password: values.privacy === 'private' ? values.password : undefined,
        expirationDays: values.expirationDays
      };
      handleCreatePlan(data);
    };

    return (
      <Form
        form={planForm}
        layout="vertical"
        onFinish={onFinish}
      >
        <Steps
          current={currentStep}
          items={steps}
          style={{ marginBottom: 24 }}
        />

        {currentStep === 0 && (
          <>
            <Form.Item
              name="title"
              label="Название плана"
              rules={[{ required: true, message: 'Введите название' }]}
            >
              <Input maxLength={100} />
            </Form.Item>
            
            <Form.Item
              name="content"
              label="Содержание"
            >
              <TextArea rows={4} maxLength={2000} />
            </Form.Item>
          </>
        )}

        {currentStep === 1 && (
          <>
            <Form.Item
              name="startDate"
              label="Дата и время начала"
              rules={[{ required: true, message: 'Выберите дату начала' }]}
            >
              <DatePicker
                showTime
                format="DD.MM.YYYY HH:mm"
                style={{ width: '100%' }}
              />
            </Form.Item>
            
            <Form.Item
              name="endDate"
              label="Дата и время окончания"
            >
              <DatePicker
                showTime
                format="DD.MM.YYYY HH:mm"
                style={{ width: '100%' }}
              />
            </Form.Item>
            
            <Form.Item>
              <Checkbox
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              >
                Повторяющийся план
              </Checkbox>
            </Form.Item>
            
            {recurring && (
              <>
                <Form.Item
                  name="days"
                  label="Дни недели"
                >
                  <Select mode="multiple" placeholder="Выберите дни">
                    {daysMap.map((day, i) => (
                      <Select.Option key={i + 1} value={i + 1}>
                        {day}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item
                  name="reminderType"
                  label="Тип напоминания"
                >
                  <Radio.Group>
                    <Radio value="same">В одно и то же время</Radio>
                    <Radio value="perDay">Своё время для каждого дня</Radio>
                  </Radio.Group>
                </Form.Item>
                
                <Form.Item
                  name="endRepeat"
                  label="Конец повторений"
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </>
            )}
          </>
        )}

        {currentStep === 2 && (
          <>
            <Form.Item
              name="privacy"
              label="Приватность"
              initialValue="public"
            >
              <Radio.Group>
                <Radio value="public">
                  <Space>
                    <GlobalOutlined />
                    Публичный
                  </Space>
                </Radio>
                <Radio value="private">
                  <Space>
                    <LockOutlined />
                    Приватный
                  </Space>
                </Radio>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.privacy !== currentValues.privacy}
            >
              {({ getFieldValue }) =>
                getFieldValue('privacy') === 'private' ? (
                  <>
                    <Form.Item
                      name="password"
                      label="Пароль"
                      rules={[{ required: true, message: 'Введите пароль' }]}
                    >
                      <Input.Password />
                    </Form.Item>
                    
                    <Form.Item
                      name="expirationDays"
                      label="Срок действия пароля (дней)"
                      initialValue={0}
                    >
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </>
                ) : null
              }
            </Form.Item>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          {currentStep > 0 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)}>
              Назад
            </Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
              Далее
            </Button>
          ) : (
            <Button type="primary" htmlType="submit">
              Создать план
            </Button>
          )}
        </div>
      </Form>
    );
  };

  const TaskCreationForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const [multiTask, setMultiTask] = useState(false);
    const [subTasks, setSubTasks] = useState([{ name: '', description: '', deadline: null as Dayjs | null, priority: 'medium', status: 'open' }]);

    const onFinish = (values: any) => {
      const data = {
        title: values.title,
        subTasks: multiTask ? subTasks.map(st => ({
          ...st,
          deadline: st.deadline ? st.deadline.format('YYYY-MM-DD') : ''
        })) : undefined,
        privacy: values.privacy,
        password: values.privacy === 'private' ? values.password : undefined,
        expirationDays: values.expirationDays
      };
      handleCreateTask(data);
    };

    const addSubTask = () => {
      setSubTasks([...subTasks, { name: '', description: '', deadline: null, priority: 'medium', status: 'open' }]);
    };

    const updateSubTask = (index: number, field: string, value: any) => {
      const updated = [...subTasks];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      setSubTasks(updated);
    };

    const deleteSubTask = (index: number) => {
      if (subTasks.length > 1) {
        setSubTasks(subTasks.filter((_, i) => i !== index));
      }
    };

    return (
      <Form
        form={taskForm}
        layout="vertical"
        onFinish={onFinish}
      >
        <Form.Item
          name="title"
          label="Название задачи"
          rules={[{ required: true, message: 'Введите название' }]}
        >
          <Input maxLength={100} />
        </Form.Item>
        
        <Form.Item>
          <Checkbox
            checked={multiTask}
            onChange={(e) => setMultiTask(e.target.checked)}
          >
            Мультизадача (с подзадачами)
          </Checkbox>
        </Form.Item>
        
        {multiTask && (
          <Form.Item label="Подзадачи">
            <List
              dataSource={subTasks}
              renderItem={(sub, index) => (
                <Card size="small" style={{ marginBottom: 8 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>Подзадача {index + 1}</Text>
                      {subTasks.length > 1 && (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => deleteSubTask(index)}
                        />
                      )}
                    </div>
                    
                    <Input
                      placeholder="Название подзадачи"
                      value={sub.name}
                      onChange={(e) => updateSubTask(index, 'name', e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    
                    <TextArea
                      placeholder="Описание"
                      value={sub.description}
                      onChange={(e) => updateSubTask(index, 'description', e.target.value)}
                      rows={2}
                      style={{ marginBottom: 8 }}
                    />
                    
                    <Space style={{ width: '100%' }}>
                      <DatePicker
                        placeholder="Дедлайн"
                        value={sub.deadline}
                        onChange={(date) => updateSubTask(index, 'deadline', date)}
                        style={{ flex: 1 }}
                      />
                      
                      <Select
                        value={sub.priority}
                        onChange={(value) => updateSubTask(index, 'priority', value)}
                        style={{ flex: 1 }}
                      >
                        <Select.Option value="low">Низкий</Select.Option>
                        <Select.Option value="medium">Средний</Select.Option>
                        <Select.Option value="high">Высокий</Select.Option>
                      </Select>
                      
                      <Select
                        value={sub.status}
                        onChange={(value) => updateSubTask(index, 'status', value)}
                        style={{ flex: 1 }}
                      >
                        <Select.Option value="open">Открыта</Select.Option>
                        <Select.Option value="inprogress">В процессе</Select.Option>
                        <Select.Option value="completed">Завершена</Select.Option>
                      </Select>
                    </Space>
                  </Space>
                </Card>
              )}
            />
            <Button type="dashed" onClick={addSubTask} icon={<PlusOutlined />} style={{ width: '100%' }}>
              Добавить подзадачу
            </Button>
          </Form.Item>
        )}
        
        <Form.Item
          name="privacy"
          label="Приватность"
          initialValue="public"
        >
          <Radio.Group>
            <Radio value="public">
              <Space>
                <GlobalOutlined />
                Публичный
              </Space>
            </Radio>
            <Radio value="private">
              <Space>
                <LockOutlined />
                Приватный
              </Space>
            </Radio>
          </Radio.Group>
        </Form.Item>
        
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.privacy !== currentValues.privacy}
        >
          {({ getFieldValue }) =>
            getFieldValue('privacy') === 'private' ? (
              <>
                <Form.Item
                  name="password"
                  label="Пароль"
                  rules={[{ required: true, message: 'Введите пароль' }]}
                >
                  <Input.Password />
                </Form.Item>
                
                <Form.Item
                  name="expirationDays"
                  label="Срок действия пароля (дней)"
                  initialValue={0}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </>
            ) : null
          }
        </Form.Item>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <Button onClick={onCancel}>Отмена</Button>
          <Button type="primary" htmlType="submit">Создать задачу</Button>
        </div>
      </Form>
    );
  };

  const filteredPending = pendingShares.filter(s => {
    if (filterFIO && !s.sender.toLowerCase().includes(filterFIO.toLowerCase())) return false;
    if (filterType && s.type !== filterType) return false;
    const sDate = new Date(s.date);
    if (filterStart && sDate < filterStart.toDate()) return false;
    if (filterEnd && sDate > filterEnd.toDate()) return false;
    return true;
  });

  const userMenuItems = [
    {
      key: 'logout',
      label: 'Выйти',
      danger: true,
      onClick: handleLogout,
    },
    ...(isDual ? [{
      key: 'switch',
      label: `Переключить на ${otherRole}`,
      onClick: handleSwitchRole,
    }] : [])
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="header">
        <Row align="middle" justify="space-between" style={{ width: '100%' }}>
          <Col>
            <Space>
              <Button
                icon={<LeftOutlined />}
                onClick={handlePrevious}
                type="text"
                style={{ width: 44, height: 44 }}
              />
              
              <Title level={4} style={{ margin: 0, minWidth: 200 }}>
                {headerTitle()}
              </Title>
              
              <Button
                icon={<RightOutlined />}
                onClick={handleNext}
                type="text"
                style={{ width: 44, height: 44 }}
              />
            </Space>
          </Col>
          
          <Col>
            <Space>
              <Select
                value={view}
                onChange={setView}
                style={{ width: 120 }}
              >
                <Select.Option value="month">Месяц</Select.Option>
                <Select.Option value="week">Неделя</Select.Option>
                <Select.Option value="day">День</Select.Option>
              </Select>
              
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenWizard}
              >
                Создать событие
              </Button>
              
              <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
                <Button icon={<UserOutlined />}>
                  {currentRole} <DownOutlined />
                </Button>
              </Dropdown>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Main Content */}
      <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
        {/* Month View */}
        <CSSTransition
          in={view === 'month'}
          timeout={300}
          classNames="view-transition"
          unmountOnExit
          nodeRef={monthRef}
        >
          <div ref={monthRef}>
            <div className="month-view-container">
              <Card className="main-calendar">
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
                />
              </Card>
              
              <Card className="selected-day-events">
                {renderSelectedDayEvents()}
              </Card>
            </div>
          </div>
        </CSSTransition>

        {/* Week View */}
        <CSSTransition
          in={view === 'week'}
          timeout={300}
          classNames="view-transition"
          unmountOnExit
          nodeRef={weekRef}
        >
          <div ref={weekRef} style={{ marginTop: 16 }}>
            {renderWeekView()}
          </div>
        </CSSTransition>

        {/* Day View */}
        <CSSTransition
          in={view === 'day'}
          timeout={300}
          classNames="view-transition"
          unmountOnExit
          nodeRef={dayRef}
        >
          <div ref={dayRef} style={{ marginTop: 16 }}>
            {renderDayView()}
          </div>
        </CSSTransition>

        {/* All Events Section */}
        <div style={{ marginTop: 32 }}>
          <Button
            type="link"
            onClick={() => setShowAllEvents(!showAllEvents)}
            icon={<DownOutlined style={{ transform: showAllEvents ? 'rotate(180deg)' : 'none' }} />}
            style={{ fontSize: 16 }}
          >
            {showAllEvents ? 'Скрыть все события' : 'Показать все события'}
            <Badge count={events.length} style={{ marginLeft: 8 }} />
          </Button>

          {showAllEvents && (
            <Card style={{ marginTop: 16 }}>
              <Title level={5}>Все события ({events.length})</Title>
              {renderAllEvents()}
            </Card>
          )}
        </div>
      </div>

      {/* Event Creation Wizard */}
      <Modal
        title="Создать событие"
        open={openWizard}
        onCancel={() => setOpenWizard(false)}
        width={800}
        footer={null}
        destroyOnClose
      >
        <Tabs activeKey={wizardTab} onChange={setWizardTab} items={[
          {
            key: 'plan',
            label: 'План',
            children: <PlanCreationForm onCancel={() => setOpenWizard(false)} />
          },
          {
            key: 'task',
            label: 'Задача',
            children: <TaskCreationForm onCancel={() => setOpenWizard(false)} />
          }
        ]} />
      </Modal>

      {/* Edit Event Dialog */}
      <Modal
        title="Редактировать событие"
        open={openEdit}
        onCancel={() => setOpenEdit(false)}
        width={600}
        onOk={() => form.submit()}
        okText="Сохранить изменения"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEdit}
        >
          <Form.Item
            name="title"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="date"
            label="Дата"
            rules={[{ required: true, message: 'Выберите дату' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="time"
            label="Время"
            rules={[{ required: true, message: 'Выберите время' }]}
          >
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Описание"
          >
            <TextArea rows={4} />
          </Form.Item>
          
          <Form.Item
            name="privacy"
            label="Приватность"
          >
            <Radio.Group>
              <Radio value="public">Публичное</Radio>
              <Radio value="private">Приватное</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.privacy !== currentValues.privacy}
          >
            {({ getFieldValue }) =>
              getFieldValue('privacy') === 'private' ? (
                <Form.Item
                  name="password"
                  label="Новый пароль"
                  help="Оставьте пустым, чтобы не менять пароль"
                >
                  <Input.Password />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* Task Modal */}
      <TaskModal
        open={openTaskModal}
        event={selectedEvent && selectedEvent.eventType === 'task' ? selectedEvent as TaskEvent : null}
        onClose={() => setOpenTaskModal(false)}
        onSave={handleUpdateTask}
      />

      {/* Pending Shares Notification */}
      {pendingShares.length > 0 && (
        <Alert
          message={`С вами поделились событиями (${pendingShares.length})`}
          type="info"
          action={
            <Button size="small" type="link" onClick={() => setOpenShares(true)}>
              Просмотреть
            </Button>
          }
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 300,
            zIndex: 1000,
          }}
        />
      )}

      {/* Pending Shares Drawer */}
      <Drawer
        title={`События, которыми поделились с вами (${pendingShares.length})`}
        open={openShares}
        onClose={() => setOpenShares(false)}
        width={600}
      >
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <Input
            placeholder="ФИО отправителя"
            value={filterFIO}
            onChange={(e) => setFilterFIO(e.target.value)}
          />
          
          <Select
            placeholder="Все типы"
            value={filterType}
            onChange={setFilterType}
            style={{ width: '100%' }}
          >
            <Select.Option value="">Все типы</Select.Option>
            <Select.Option value="plan">План</Select.Option>
            <Select.Option value="task">Задача</Select.Option>
          </Select>
          
          <RangePicker
            placeholder={['От', 'До']}
            value={[filterStart, filterEnd]}
            onChange={(dates) => {
              setFilterStart(dates?.[0] || null);
              setFilterEnd(dates?.[1] || null);
            }}
            style={{ width: '100%' }}
          />
        </Space>
        
        <List
          dataSource={filteredPending}
          renderItem={(s) => (
            <Card size="small" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>{s.name}</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {s.sender} поделился с вами {s.type === 'plan' ? 'планом' : 'задачей'}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {format(new Date(s.date), 'dd.MM.yyyy')} {s.time}
                  </Text>
                </div>
                
                <Space>
                  <Button
                    type="text"
                    icon={<CheckOutlined />}
                    onClick={() => handleAccept(s.id)}
                    style={{ color: '#52c41a' }}
                  />
                  <Popconfirm
                    title="Отклонить предложение?"
                    description="Вы уверены, что хотите отклонить это предложение?"
                    onConfirm={() => handleDecline(s.id)}
                    okText="Да"
                    cancelText="Нет"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          )}
          locale={{ emptyText: 'Нет событий по заданным фильтрам' }}
        />
      </Drawer>

      {/* Share Drawer */}
      <Drawer
        title={`Поделиться событием: ${shareEvent?.title}`}
        open={openShare}
        onClose={() => setOpenShare(false)}
        width={600}
      >
        <Text type="secondary" style={{ marginBottom: 24 }}>
          Выберите пользователей, с которыми хотите поделиться событием
        </Text>
        
        <Collapse defaultActiveKey={['teachers']}>
          <Panel header={`Преподаватели (${teachers.length})`} key="teachers">
            <Checkbox.Group
              value={selectedUsers}
              onChange={(values) => setSelectedUsers(values as string[])}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {teachers.map((t) => (
                  <Checkbox key={t.id} value={t.username}>
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} />
                      {t.username}
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Panel>
          
          <Panel header={`Студенты (${students.length})`} key="students">
            <Checkbox.Group
              value={selectedUsers}
              onChange={(values) => setSelectedUsers(values as string[])}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {students.map((s) => (
                  <Checkbox key={s.id} value={s.username}>
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} />
                      {s.username}
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Panel>
          
          {currentRole !== 'student' && (
            <Panel header={`Администраторы (${admins.length})`} key="admins">
              <Checkbox.Group
                value={selectedUsers}
                onChange={(values) => setSelectedUsers(values as string[])}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {admins.map((a) => (
                    <Checkbox key={a.id} value={a.username}>
                      <Space>
                        <Avatar size="small" icon={<UserOutlined />} />
                        {a.username}
                      </Space>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </Panel>
          )}
        </Collapse>
        
        <div style={{ marginTop: 24 }}>
          <Checkbox
            checked={shareForbidEdit}
            onChange={(e) => setShareForbidEdit(e.target.checked)}
          >
            Запретить редактирование
          </Checkbox>
          <br />
          <Checkbox
            checked={shareAllowComments}
            onChange={(e) => setShareAllowComments(e.target.checked)}
          >
            Разрешить комментарии
          </Checkbox>
        </div>
        
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">
            Всего выбрано пользователей: {selectedUsers.length}
          </Text>
        </div>
        
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTop: '1px solid #f0f0f0', background: 'white' }}>
          <Space>
            <Button onClick={() => setOpenShare(false)}>Отмена</Button>
            <Button
              type="primary"
              onClick={handleConfirmShare}
              disabled={selectedUsers.length === 0}
            >
              Поделиться ({selectedUsers.length})
            </Button>
          </Space>
        </div>
      </Drawer>

      {/* URL and QR Code */}
      {url && (
        <Card
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 300,
            zIndex: 1000,
          }}
          size="small"
        >
          <Text strong style={{ marginBottom: 8, display: 'block' }}>
            Ссылка на событие:
          </Text>
          <Text copyable style={{ display: 'block', marginBottom: 16 }}>
            {url}
          </Text>
          
          {qrUrl && (
            <div style={{ textAlign: 'center' }}>
              <QRCode value={qrUrl} size={128} />
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                QR-код для быстрого доступа
              </Text>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default Dashboard;