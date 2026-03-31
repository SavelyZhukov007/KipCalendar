import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Layout as Container, 
    Typography, 
    Input, 
    Button, 
    List, 
    Collapse, 
    Card,
    Space,
    Tag,
    Divider,
    Spin,
    Alert,
    Empty
} from 'antd';
import { 
    CopyOutlined,
    CalendarOutlined,
    ClockCircleOutlined,
    UserOutlined,
    CommentOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;
const API_BASE_URL = 'http://localhost:5000';

const EventView: React.FC = () => {
  const { username, type, name } = useParams<{ username: string; type: string; name: string }>();
  const [event, setEvent] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [showPrompt, setShowPrompt] = useState(type === 'private');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvent = async () => {
      if (showPrompt) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/event/${username}/${type}/${name}`;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = token;
      if (type === 'private' && password) url += `?password=${password}`;
      
      try {
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          setEvent(data);
          setShowPrompt(false);
          
          if (data.shared) {
            const hRes = await fetch(`${API_BASE_URL}/api/events/${data.id}/history`, { headers });
            if (hRes.ok) setHistory(await hRes.json());
            const cRes = await fetch(`${API_BASE_URL}/api/events/${data.id}/comments`, { headers });
            if (cRes.ok) setComments(await cRes.json());
          }
        } else if (res.status === 401) {
          setError('Требуется вход');
          navigate('/login');
        } else if (res.status === 403) {
          setError('Неверный пароль');
          setShowPrompt(true);
        } else {
          setError('Что-то пошло не так');
        }
      } catch (err) {
        setError('Ошибка соединения');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [showPrompt, password, username, type, name, navigate]);

  const handleAddComment = async () => {
    const token = localStorage.getItem('token');
    if (!token || !event) return;
    const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${event.id}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: newComment })
      });
      if (res.ok) {
        const newComm = await res.json();
        setComments([...comments, newComm]);
        setNewComment('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleCopyToCalendar = async () => {
    if (!event) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/events/${event.id}/copy`, {
        method: 'POST',
        headers: { 'Authorization': token || '' }
      });
      if (response.ok) {
        alert('Событие добавлено в ваш календарь');
      }
    } catch (err) {
      console.error('Failed to copy event:', err);
    }
  };

  if (loading) {
    return (
      <Container style={{ padding: '50px', textAlign: 'center' }}>
        <Spin size="large" />
      </Container>
    );
  }

  if (error && !showPrompt) {
    return (
      <Container style={{ padding: '50px' }}>
        <Alert message={error} type="error" showIcon />
      </Container>
    );
  }

  if (showPrompt) {
    return (
      <Container style={{ padding: '50px', maxWidth: 500 }}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={3}>Введите пароль для приватного события</Title>
            <Input.Password
              size="large"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onPressEnter={() => setShowPrompt(false)}
            />
            <Button type="primary" block onClick={() => setShowPrompt(false)}>
              Отправить
            </Button>
          </Space>
        </Card>
      </Container>
    );
  }

  if (!event) {
    return (
      <Container style={{ padding: '50px' }}>
        <Empty description="Событие не найдено" />
      </Container>
    );
  }

  return (
    <Container style={{ padding: '50px', maxWidth: 900 }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2}>{event.title}</Title>
            <Space>
              <Tag color="blue">{event.eventType}</Tag>
              {event.shared && <Tag color="green">Публичное</Tag>}
            </Space>
          </div>

          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <CalendarOutlined />
              <Text strong>Дата:</Text>
              <Text>{event.date}</Text>
            </Space>
            <Space>
              <ClockCircleOutlined />
              <Text strong>Время:</Text>
              <Text>{event.time}</Text>
            </Space>
            {event.endDate && (
              <Space>
                <Text strong>Дата окончания:</Text>
                <Text>{event.endDate}</Text>
              </Space>
            )}
            {event.endTime && (
              <Space>
                <Text strong>Время окончания:</Text>
                <Text>{event.endTime}</Text>
              </Space>
            )}
          </Space>

          <Divider />

          {event.eventType === 'plan' && (
            <>
              <div>
                <Title level={4}>Содержание:</Title>
                <Card>
                  <ReactMarkdown>{event.content}</ReactMarkdown>
                </Card>
              </div>
              {event.recurringOptions && (
                <Text type="secondary">
                  Повторения: {JSON.stringify(event.recurringOptions)}
                </Text>
              )}
            </>
          )}

          {event.eventType === 'task' && event.subTasks && (
            <div>
              <Title level={4}>Подзадачи:</Title>
              <List
                dataSource={event.subTasks}
                renderItem={(sub: any, i: number) => (
                  <List.Item>
                    <List.Item.Meta
                      title={sub.name}
                      description={`${sub.description} - ${sub.deadline} - ${sub.priority} - ${sub.status}`}
                    />
                  </List.Item>
                )}
              />
            </div>
          )}

          {event.description && (
            <div>
              <Title level={4}>Описание:</Title>
              <Paragraph>{event.description}</Paragraph>
            </div>
          )}

          <Button 
            type="primary" 
            icon={<CopyOutlined />}
            onClick={handleCopyToCalendar}
          >
            Добавить в свой календарь
          </Button>

          {event.shared && (
            <>
              <Divider />
              <Collapse>
                <Panel header="История изменений" key="history">
                  {history.length > 0 ? (
                    <List
                      dataSource={history}
                      renderItem={(h: any, i: number) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<UserOutlined />}
                            title={`${h.user} изменил ${h.field} на ${h.newValue}`}
                            description={h.timestamp}
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Text type="secondary">История изменений пуста</Text>
                  )}
                </Panel>
              </Collapse>

              {event.allowComments && (
                <div>
                  <Title level={4}>
                    <CommentOutlined /> Комментарии
                  </Title>
                  <List
                    dataSource={comments}
                    renderItem={(c: any, i: number) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<UserOutlined />}
                          title={c.user}
                          description={c.content}
                        />
                        <Text type="secondary">{c.timestamp}</Text>
                      </List.Item>
                    )}
                  />
                  <Space.Compact style={{ width: '100%', marginTop: 16 }}>
                    <TextArea
                      rows={3}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Добавить комментарий..."
                    />
                    <Button type="primary" onClick={handleAddComment}>
                      Добавить
                    </Button>
                  </Space.Compact>
                </div>
              )}
            </>
          )}
        </Space>
      </Card>
    </Container>
  );
};

export default EventView;
