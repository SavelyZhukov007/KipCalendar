import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  List,
  Card,
  Row,
  Col,
  Space,
  Dropdown,
  Menu,
  DatePicker,
  TimePicker,
  Popconfirm,
  message,
  Drawer,
  Tabs,
  Badge
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  LeftOutlined,
  RightOutlined,
  DownOutlined
} from '@ant-design/icons';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const API_BASE_URL = 'http://localhost:5000';

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  description?: string;
  type: string;
  eventType: 'plan' | 'task';
}

const Dashboardtest: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const refreshEvents = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/events`, {
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки событий:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }
    refreshEvents();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleCreate = async (values: any) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify(values)
      });
      if (res.ok) {
        setOpenCreateModal(false);
        refreshEvents();
        message.success('Событие создано');
      }
    } catch (error) {
      message.error('Ошибка создания события');
    }
  };

  const handleEdit = async (values: any) => {
    const token = localStorage.getItem('token');
    if (!token || !selectedEvent) return;
    try {
      const res = await fetch(`${API_BASE_URL}/event/${selectedEvent.type}/${selectedEvent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify(values)
      });
      if (res.ok) {
        setOpenEditModal(false);
        refreshEvents();
        message.success('Событие обновлено');
      }
    } catch (error) {
      message.error('Ошибка редактирования');
    }
  };

  const handleDelete = async (event: Event) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/event/${event.type}/${event.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        refreshEvents();
        message.success('Событие удалено');
      }
    } catch (error) {
      message.error('Ошибка удаления');
    }
  };

  const openEdit = (event: Event) => {
    setSelectedEvent(event);
    form.setFieldsValue({
      title: event.title,
      date: dayjs(event.date),
      time: dayjs(event.time, 'HH:mm'),
      description: event.description,
      type: event.type
    });
    setOpenEditModal(true);
  };

  const userMenuItems = [
    {
      key: 'logout',
      label: 'Выйти',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Шапка - сверху во всю ширину */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Title level={3} style={{ margin: 0 }}>
                {format(selectedDate, 'LLLL yyyy', { locale: ru })}
              </Title>
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
                onClick={() => setOpenCreateModal(true)}
              >
                Создать событие
              </Button>
              
              <Dropdown menu={{ items: userMenuItems }}>
                <Button icon={<UserOutlined />}>
                  Профиль <DownOutlined />
                </Button>
              </Dropdown>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Основной контент */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Space>
              <Button
                icon={<LeftOutlined />}
                onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() - 1)))}
              />
              <Button
                icon={<RightOutlined />}
                onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)))}
              />
            </Space>
            
            <Title level={4} style={{ margin: 0 }}>
              {format(selectedDate, 'dd MMMM yyyy', { locale: ru })}
            </Title>
          </div>

          <List
            dataSource={events.filter(e => 
              new Date(e.date).getMonth() === selectedDate.getMonth() &&
              new Date(e.date).getFullYear() === selectedDate.getFullYear()
            )}
            renderItem={(event) => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(event)}
                  />,
                  <Popconfirm
                    title="Удалить событие?"
                    onConfirm={() => handleDelete(event)}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Text strong>{format(new Date(event.date), 'dd', { locale: ru })}</Text>
                      <Text type="secondary">{format(new Date(event.date), 'EEE', { locale: ru })}</Text>
                    </div>
                  }
                  title={
                    <Space>
                      <Text strong>{event.title}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> {event.time}
                      </Text>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      {event.description && <Text type="secondary">{event.description}</Text>}
                      <Tag color={event.type === 'private' ? 'default' : 'blue'}>
                        {event.type === 'private' ? 'Приватное' : 'Публичное'}
                      </Tag>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </div>

      {/* Модальное окно создания события */}
      <Modal
        title="Создать событие"
        open={openCreateModal}
        onCancel={() => setOpenCreateModal(false)}
        onOk={() => {
          form.validateFields().then(values => {
            handleCreate(values);
          });
        }}
      >
        <Form layout="vertical">
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
            name="type"
            label="Тип"
            initialValue="public"
          >
            <Select>
              <Select.Option value="public">Публичное</Select.Option>
              <Select.Option value="private">Приватное</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно редактирования события */}
      <Modal
        title="Редактировать событие"
        open={openEditModal}
        onCancel={() => setOpenEditModal(false)}
        onOk={() => form.submit()}
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
            name="type"
            label="Тип"
          >
            <Select>
              <Select.Option value="public">Публичное</Select.Option>
              <Select.Option value="private">Приватное</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// Вспомогательный компонент Tag (если нет в antd)
const Tag: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span style={{
    padding: '2px 8px',
    fontSize: 12,
    borderRadius: 4,
    background: color === 'blue' ? '#e6f7ff' : '#fafafa',
    color: color === 'blue' ? '#1890ff' : '#595959',
    border: `1px solid ${color === 'blue' ? '#91d5ff' : '#d9d9d9'}`
  }}>
    {children}
  </span>
);

export default Dashboardtest;