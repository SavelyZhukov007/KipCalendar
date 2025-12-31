// frontend/src/components/Kipswift.tsx
import React, { useState, useEffect, useRef } from 'react';
import './Kipswift.css'; // Сохраняем стили

// Ant Design импорты
import {
    Layout,
    Avatar,
    Input,
    Button,
    List,
    Typography,
    Divider,
    Badge,
    Card,
    Modal,
    Spin,
    message as antMessage,
    Empty,
    Space
} from 'antd';
import {
    SendOutlined,
    SearchOutlined,
    PaperClipOutlined,
    UserAddOutlined,
    DownloadOutlined,
    MoreOutlined,
    CloseOutlined,
    CheckOutlined
} from '@ant-design/icons';

import io from 'socket.io-client';
import { API_BASE_URL, SOCKET_URL } from '../config';

const { Header, Content, Sider } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;

const socket = io(SOCKET_URL);

interface Message {
    id: string;
    content: string;
    sender_id: string;
    sender_name: string;
    sent_at: number;
    edited_at?: number;
    attachments?: Array<{
        id: string;
        name: string;
        type: string;
        url: string;
        thumbnail?: string;
    }>;
}

interface Chat {
    id: string;
    type: 'private' | 'group';
    name?: string;
    other_user?: string;
    message_count: number;
    unread_count?: number;
    last_message?: string;
    avatar?: string;
}

const Kipswift: React.FC = () => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [typingUser, setTypingUser] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);

    const [newChatModalOpen, setNewChatModalOpen] = useState(false);
    const [searchUserQuery, setSearchUserQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentUserId = localStorage.getItem('user_id');
    const currentUsername = localStorage.getItem('username') || 'You';

    useEffect(() => {
        fetchChats();

        socket.on('new_message', handleNewMessage);
        socket.on('user_typing', handleUserTyping);
        socket.on('user_stop_typing', handleUserStopTyping);

        return () => {
            socket.off('new_message');
            socket.off('user_typing');
            socket.off('user_stop_typing');
        };
    }, []);

    useEffect(() => {
        if (selectedChat) {
            fetchMessages(selectedChat.id);
            socket.emit('join_chat', { chat_id: selectedChat.id });
            markChatAsRead(selectedChat.id);
        }
    }, [selectedChat]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchChats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/chats`, {
                headers: { 'Authorization': token || '' }
            });

            if (response.ok) {
                const data = await response.json();

                const chatsWithUnread = await Promise.all(
                    data.map(async (chat: Chat) => {
                        const unreadResponse = await fetch(
                            `${API_BASE_URL}/api/chats/${chat.id}/unread-count`,
                            { headers: { 'Authorization': token || '' } }
                        );
                        if (unreadResponse.ok) {
                            const unreadData = await unreadResponse.json();
                            chat.unread_count = unreadData.unread_count;
                        }
                        return chat;
                    })
                );

                setChats(chatsWithUnread);
            }
        } catch (err) {
            console.error('Failed to fetch chats:', err);
            antMessage.error('Не удалось загрузить чаты');
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (chatId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/chats/${chatId}/messages`,
                {
                    headers: { 'Authorization': token || '' }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setMessages(data);
            }
        } catch (err) {
            console.error('Failed to fetch messages:', err);
            antMessage.error('Не удалось загрузить сообщения');
        }
    };

    const markChatAsRead = async (chatId: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/api/chats/${chatId}/mark-read`, {
                method: 'POST',
                headers: { 'Authorization': token || '' }
            });

            setChats(prev => prev.map(chat =>
                chat.id === chatId ? { ...chat, unread_count: 0 } : chat
            ));
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const handleSendMessage = async () => {
        if ((!messageInput.trim() && attachments.length === 0) || !selectedChat || sending) return;

        setSending(true);

        try {
            const token = localStorage.getItem('token');

            // Если есть файлы, отправляем через FormData
            if (attachments.length > 0) {
                const formData = new FormData();
                formData.append('content', messageInput);
                attachments.forEach(file => {
                    formData.append('attachments', file);
                });

                const response = await fetch(
                    `${API_BASE_URL}/api/chats/${selectedChat.id}/messages`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': token || ''
                        },
                        body: formData
                    }
                );

                if (response.ok) {
                    const data = await response.json();

                    const newMessage: Message = {
                        id: data.message_id,
                        content: messageInput,
                        sender_id: currentUserId || '',
                        sender_name: currentUsername,
                        sent_at: data.sent_at,
                        attachments: data.attachments
                    };

                    setMessages(prev => [...prev, newMessage]);
                    setMessageInput('');
                    setAttachments([]);

                    socket.emit('new_message', {
                        chat_id: selectedChat.id,
                        message: newMessage
                    });

                    socket.emit('stop_typing', { chat_id: selectedChat.id });
                }
            } else {
                // Отправка только текста
                const response = await fetch(
                    `${API_BASE_URL}/api/chats/${selectedChat.id}/messages`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token || ''
                        },
                        body: JSON.stringify({ content: messageInput })
                    }
                );

                if (response.ok) {
                    const data = await response.json();

                    const newMessage: Message = {
                        id: data.message_id,
                        content: messageInput,
                        sender_id: currentUserId || '',
                        sender_name: currentUsername,
                        sent_at: data.sent_at
                    };

                    setMessages(prev => [...prev, newMessage]);
                    setMessageInput('');

                    socket.emit('new_message', {
                        chat_id: selectedChat.id,
                        message: newMessage
                    });

                    socket.emit('stop_typing', { chat_id: selectedChat.id });
                }
            }
        } catch (err) {
            console.error('Failed to send message:', err);
            antMessage.error('Не удалось отправить сообщение');
        } finally {
            setSending(false);
        }
    };

    const handleTyping = () => {
        if (!selectedChat) return;

        socket.emit('typing', {
            chat_id: selectedChat.id,
            username: currentUsername
        });

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stop_typing', { chat_id: selectedChat.id });
        }, 2000);
    };

    const handleNewMessage = (data: any) => {
        if (selectedChat && data.chat_id === selectedChat.id) {
            if (data.message.sender_id !== currentUserId) {
                setMessages(prev => [...prev, data.message]);
                markChatAsRead(selectedChat.id);
            }
        }

        fetchChats();
    };

    const handleUserTyping = (data: any) => {
        setTypingUser(data.username);
    };

    const handleUserStopTyping = () => {
        setTypingUser(null);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSearchUsers = async () => {
        if (!searchUserQuery.trim()) {
            antMessage.warning('Введите email пользователя');
            return;
        }

        setSearchingUsers(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/user/search?email=${searchUserQuery}`,
                {
                    headers: { 'Authorization': token || '' }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setSearchResults([data]);
            } else {
                setSearchResults([]);
                antMessage.info('Пользователь не найден');
            }
        } catch (err) {
            console.error('Failed to search users:', err);
            antMessage.error('Ошибка при поиске пользователя');
        } finally {
            setSearchingUsers(false);
        }
    };

    const handleCreateChat = async (targetUserId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/chats/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token || ''
                },
                body: JSON.stringify({ user_id: targetUserId })
            });

            if (response.ok) {
                const data = await response.json();
                setNewChatModalOpen(false);
                setSearchUserQuery('');
                setSearchResults([]);

                await fetchChats();
                const newChat = chats.find(c => c.id === data.chat_id);
                if (newChat) setSelectedChat(newChat);
                antMessage.success('Чат создан');
            }
        } catch (err) {
            console.error('Failed to create chat:', err);
            antMessage.error('Не удалось создать чат');
        }
    };

    const filteredChats = chats.filter(chat => {
        const searchLower = searchQuery.toLowerCase();
        return (
            (chat.name?.toLowerCase().includes(searchLower)) ||
            (chat.other_user?.toLowerCase().includes(searchLower))
        );
    });

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getAvatarColor = (name: string) => {
        const colors = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    const renderMessageContent = (msg: Message) => {
        const isOwn = msg.sender_id === currentUserId;

        return (
            <div className={`message-wrapper ${isOwn ? 'own-message' : 'other-message'}`}>
                {!isOwn && (
                    <Avatar
                        size="small"
                        style={{
                            background: getAvatarColor(msg.sender_name),
                            marginRight: 8,
                            marginTop: 4
                        }}
                    >
                        {msg.sender_name[0].toUpperCase()}
                    </Avatar>
                )}

                <div className="message-bubble">
                    {!isOwn && (
                        <Text strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>
                            {msg.sender_name}
                        </Text>
                    )}

                    {msg.attachments && msg.attachments.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                            {msg.attachments.map(att => (
                                <Card
                                    key={att.id}
                                    className="file-preview"
                                    size="small"
                                    style={{ padding: 8, marginBottom: 8 }}
                                >
                                    <Space align="center">
                                        <PaperClipOutlined />
                                        <Text style={{ flex: 1 }}>{att.name}</Text>
                                        <Button
                                            type="text"
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            href={att.url}
                                            download
                                        />
                                    </Space>
                                </Card>
                            ))}
                        </div>
                    )}

                    <div className="message-content">
                        {msg.content && (
                            <Text style={{ color: isOwn ? 'white' : 'inherit' }}>
                                {msg.content}
                            </Text>
                        )}
                    </div>

                    <div className="message-meta">
                        <Text style={{
                            fontSize: '0.75rem',
                            opacity: 0.8,
                            color: isOwn ? 'rgba(255,255,255,0.8)' : 'inherit'
                        }}>
                            {formatTime(msg.sent_at)}
                        </Text>
                        {isOwn && (
                            <CheckOutlined style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: 4 }} />
                        )}
                    </div>
                </div>

                {isOwn && (
                    <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        className="message-menu-btn"
                        style={{ marginLeft: 8 }}
                    />
                )}
            </div>
        );
    };

    return (
        <div className="kipswift-container">
            {/* Сайдбар */}
            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <div className="app-brand">
                        <div className="logo-fallback">K</div>
                        <Title level={4} className="app-title" style={{ margin: 0 }}>Kipswift</Title>
                    </div>
                    <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={() => setNewChatModalOpen(true)}
                        size="small"
                    />
                </div>

                <Input
                    placeholder="Поиск чатов..."
                    prefix={<SearchOutlined />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ margin: '12px 16px' }}
                />

                <div className="chat-list">
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                            <Spin />
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <Empty
                            description="Чаты не найдены"
                            style={{ marginTop: 40 }}
                        />
                    ) : (
                        <List
                            dataSource={filteredChats}
                            renderItem={chat => (
                                <Card
                                    className={`chat-item ${selectedChat?.id === chat.id ? 'Mui-selected' : ''}`}
                                    hoverable
                                    onClick={() => setSelectedChat(chat)}
                                    style={{ margin: '2px 8px', borderRadius: 12 }}
                                    bodyStyle={{ padding: '12px' }}
                                >
                                    <Space align="center" style={{ width: '100%' }}>
                                        <Badge count={chat.unread_count || 0}>
                                            <Avatar
                                                className="chat-avatar"
                                                size="large"
                                                style={{ background: getAvatarColor(chat.name || chat.other_user || '') }}
                                            >
                                                {(chat.name || chat.other_user || 'U')[0].toUpperCase()}
                                            </Avatar>
                                        </Badge>
                                        <div style={{ flex: 1 }}>
                                            <div className="chat-header">
                                                <Text strong style={{ display: 'block' }}>
                                                    {chat.name || chat.other_user || 'Чат'}
                                                </Text>
                                                {chat.last_message && (
                                                    <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                                                        {formatTime(Date.now() / 1000 - 3600)}
                                                    </Text>
                                                )}
                                            </div>
                                            <Text type="secondary" style={{ fontSize: '0.85rem', display: 'block' }}>
                                                {chat.last_message || `${chat.message_count} сообщений`}
                                            </Text>
                                        </div>
                                    </Space>
                                </Card>
                            )}
                        />
                    )}
                </div>
            </div>

            {/* Основная область чата */}
            <div className="chat-main">
                {selectedChat ? (
                    <>
                        {/* Заголовок чата */}
                        <div className="chat-header-bar">
                            <div className="chat-info">
                                <Avatar
                                    className="current-chat-avatar"
                                    size="large"
                                    style={{ background: getAvatarColor(selectedChat.name || selectedChat.other_user || '') }}
                                >
                                    {(selectedChat.name || selectedChat.other_user || 'U')[0].toUpperCase()}
                                </Avatar>
                                <div>
                                    <Title level={5} style={{ margin: 0 }}>
                                        {selectedChat.name || selectedChat.other_user || 'Чат'}
                                    </Title>
                                    {typingUser && (
                                        <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                                            {typingUser} печатает...
                                        </Text>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Контейнер сообщений */}
                        <div className="messages-container">
                            {messages.length === 0 ? (
                                <Empty
                                    description="Нет сообщений"
                                    style={{ margin: 'auto' }}
                                />
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id}>
                                        {renderMessageContent(msg)}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Вложения */}
                        {attachments.length > 0 && (
                            <div style={{ padding: '8px 24px', background: 'rgba(255,255,255,0.9)' }}>
                                <Space wrap>
                                    {attachments.map((file, index) => (
                                        <Card
                                            key={index}
                                            size="small"
                                            className="file-preview-badge"
                                            style={{ display: 'inline-flex', alignItems: 'center' }}
                                        >
                                            <PaperClipOutlined />
                                            <Text style={{ fontSize: '0.85rem' }}>{file.name}</Text>
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<CloseOutlined />}
                                                onClick={() => removeAttachment(index)}
                                            />
                                        </Card>
                                    ))}
                                </Space>
                            </div>
                        )}

                        {/* Поле ввода */}
                        <div className="input-area">
                            <Button
                                type="text"
                                icon={<PaperClipOutlined />}
                                onClick={() => fileInputRef.current?.click()}
                            />
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                multiple
                                onChange={handleFileSelect}
                            />

                            <TextArea
                                className="message-input"
                                placeholder="Введите сообщение..."
                                value={messageInput}
                                onChange={(e) => {
                                    setMessageInput(e.target.value);
                                    handleTyping();
                                }}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                autoSize={{ minRows: 1, maxRows: 4 }}
                                style={{ flex: 1 }}
                            />

                            <Button
                                type="primary"
                                icon={<SendOutlined />}
                                onClick={handleSendMessage}
                                loading={sending}
                                disabled={(!messageInput.trim() && attachments.length === 0) || sending}
                                style={{ borderRadius: '50%', width: 40, height: 40 }}
                            />
                        </div>
                    </>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        flexDirection: 'column'
                    }}>
                        <Avatar
                            size={80}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                marginBottom: 16
                            }}
                        >
                            K
                        </Avatar>
                        <Title level={4} style={{ color: '#666' }}>
                            Выберите чат для начала общения
                        </Title>
                        <Text type="secondary">
                            Или создайте новый чат, нажав на кнопку "+" в левом верхнем углу
                        </Text>
                    </div>
                )}
            </div>

            {/* Модальное окно нового чата */}
            <Modal
                title="Новый чат"
                open={newChatModalOpen}
                onCancel={() => {
                    setNewChatModalOpen(false);
                    setSearchUserQuery('');
                    setSearchResults([]);
                }}
                footer={null}
            >
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Input
                        placeholder="Введите email пользователя"
                        value={searchUserQuery}
                        onChange={(e) => setSearchUserQuery(e.target.value)}
                        onPressEnter={handleSearchUsers}
                        suffix={
                            <Button
                                type="text"
                                icon={<SearchOutlined />}
                                onClick={handleSearchUsers}
                                loading={searchingUsers}
                                size="small"
                            />
                        }
                    />

                    {searchResults.length > 0 ? (
                        <List
                            dataSource={searchResults}
                            renderItem={user => (
                                <List.Item
                                    style={{ cursor: 'pointer', padding: '12px' }}
                                    onClick={() => handleCreateChat(user.id)}
                                >
                                    <List.Item.Meta
                                        avatar={
                                            <Avatar style={{ background: getAvatarColor(user.username) }}>
                                                {user.username[0].toUpperCase()}
                                            </Avatar>
                                        }
                                        title={user.username}
                                        description={user.email}
                                    />
                                </List.Item>
                            )}
                        />
                    ) : (
                        searchUserQuery && (
                            <Empty
                                description="Пользователь не найден"
                                style={{ margin: '20px 0' }}
                            />
                        )
                    )}
                </Space>
            </Modal>
        </div>
    );
};

export default Kipswift;