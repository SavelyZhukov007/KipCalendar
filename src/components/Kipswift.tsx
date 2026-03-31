// frontend/src/components/Kipswift.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Kipswift.css';
import axios from 'axios';
import io from 'socket.io-client';

// Ant Design imports
import {
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
    Space,
    Tabs,
    Tag,
    Tooltip,
    Dropdown,
    Popover,
    Switch,
    Select,
    Image
} from 'antd';
import {
    SendOutlined,
    SearchOutlined,
    PaperClipOutlined,
    UserAddOutlined,
    DownloadOutlined,
    MoreOutlined,
    CloseOutlined,
    CheckOutlined,
    CheckCircleOutlined,
    EditOutlined,
    DeleteOutlined,
    CopyOutlined,
    SettingOutlined,
    UserOutlined,
    UsergroupAddOutlined,
    InfoCircleOutlined,
    CommentOutlined,
    ForwardOutlined,
    LoadingOutlined,
    FileOutlined,
    TeamOutlined
} from '@ant-design/icons';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

// Socket connection
const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5
});

const { TextArea } = Input;
const { Text, Title } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

// Interfaces matching updated backend structure
interface User {
    id: string; // UUID теперь
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    roles: string[];
    current_role: string;
    telegram_id?: string;
    created_at: number;
}

interface Message {
    id: string;
    chat_id: string;
    sender_id: string;
    sender_name?: string;
    subject?: string;
    content: string;
    sent_at: number;
    edited_at?: number;
    reply_to?: string;
    attachments?: Attachment[];
    is_pinned?: boolean;
    is_starred?: boolean;
    is_read?: boolean;
    attachment_count?: number;
}

interface Attachment {
    id: string;
    message_id: string;
    filename: string;
    file_size: number;
    mime_type: string;
    uploaded_at: number;
    url?: string;
    thumbnail?: string;
}

interface Chat {
    id: string;
    type: 'direct' | 'group';
    name?: string;
    created_at: number;
    organization_id?: string;
    other_user?: string; // Для прямых чатов
    message_count: number;
    unread_count?: number;
    last_message?: string;
    last_read_at?: number;
    members?: ChatMember[];
    created_by?: string;
}

interface ChatMember {
    chat_id: string;
    user_id: string;
    joined_at: number;
    last_read_at?: number;
    user?: User;
}

// Props interface
interface KipswiftProps {
    currentUser?: User;
    onLogout?: () => void;
}

const Kipswift: React.FC<KipswiftProps> = ({ currentUser, onLogout }) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [chatsLoading, setChatsLoading] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [typingUser, setTypingUser] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [messageToEdit, setMessageToEdit] = useState<Message | null>(null);

    // Chat creation
    const [newChatModalOpen, setNewChatModalOpen] = useState(false);
    const [searchUserQuery, setSearchUserQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');
    const [chatType, setChatType] = useState<'direct' | 'group'>('direct');

    // Settings
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [sendByEnter, setSendByEnter] = useState(true);

    // Filtering and sorting
    const [filterType, setFilterType] = useState<'all' | 'unread' | 'groups'>('all');
    const [sortOrder, setSortOrder] = useState<'date' | 'name'>('date');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<any>(null);
    const selectedChatRef = useRef<string | null>(null);

    // Get auth token from localStorage
    const getAuthToken = (): string => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found in localStorage');
            return '';
        }
        return token;
    };

    // Get auth headers for API requests
    const getAuthHeaders = () => {
        const token = getAuthToken();
        if (!token) {
            return {};
        }
        return {
            'Authorization': token,
            'Content-Type': 'application/json'
        };
    };

    // Format time helper
    const formatTime = useCallback((timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);

    // Format date for chat list
    const formatDate = useCallback((timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Вчера';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('ru-RU', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        }
    }, []);

    // Get avatar color based on name
    const getAvatarColor = useCallback((name: string) => {
        const colors = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
        if (!name) return colors[0];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    }, []);

    // Format file size
    const formatFileSize = useCallback((bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }, []);

    // Fetch chats from backend
    const fetchChats = useCallback(async () => {
        if (!currentUser?.id) return;

        setChatsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/chats`, {
                headers: getAuthHeaders(),
                params: {
                    user_id: currentUser.id // Добавляем user_id для бэкенда
                }
            });

            console.log('Chats response:', response.data);
            
            const chatsData: Chat[] = response.data.map((chat: any) => ({
                id: chat.id,
                type: chat.type || 'direct',
                name: chat.name || chat.other_user || 'Без имени',
                created_at: chat.created_at || Math.floor(Date.now() / 1000),
                organization_id: chat.organization_id,
                other_user: chat.other_user,
                message_count: chat.message_count || 0,
                unread_count: chat.unread_count || 0,
                last_message: chat.last_message || '',
                created_by: chat.created_by
            }));

            setChats(chatsData);
        } catch (error: any) {
            console.error('Error fetching chats:', error);
            if (error.response?.status === 401) {
                antMessage.error('Требуется авторизация');
                if (onLogout) onLogout();
            } else {
                antMessage.error('Не удалось загрузить чаты');
            }
        } finally {
            setChatsLoading(false);
        }
    }, [currentUser, onLogout]);

    // Fetch messages for selected chat
    const fetchMessages = useCallback(async (chatId: string) => {
        if (!chatId) return;

        setMessagesLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
                headers: getAuthHeaders()
            });

            console.log('Messages response:', response.data);
            
            const messagesData: Message[] = response.data.map((msg: any) => ({
                id: msg.id,
                chat_id: msg.chat_id,
                sender_id: msg.sender_id,
                sender_name: msg.sender_name || msg.username || 'Пользователь',
                content: msg.content || '',
                sent_at: msg.sent_at || Math.floor(Date.now() / 1000),
                edited_at: msg.edited_at,
                reply_to: msg.reply_to,
                attachment_count: msg.attachment_count || 0,
                is_read: true // Будем считать, что загруженные сообщения прочитаны
            }));

            setMessages(messagesData);

            // Mark chat as read
            await markChatAsRead(chatId);
        } catch (error: any) {
            console.error('Error fetching messages:', error);
            if (error.response?.status !== 401) {
                antMessage.error('Не удалось загрузить сообщения');
            }
        } finally {
            setMessagesLoading(false);
        }
    }, []);

    // Mark chat as read
    const markChatAsRead = useCallback(async (chatId: string) => {
        try {
            await axios.post(`${API_BASE_URL}/api/chats/${chatId}/mark-read`, {}, {
                headers: getAuthHeaders()
            });

            // Update local state
            setChats(prev => prev.map(chat =>
                chat.id === chatId ? { ...chat, unread_count: 0 } : chat
            ));

            // Если это текущий чат, обновляем сообщения как прочитанные
            if (selectedChat?.id === chatId) {
                setMessages(prev => prev.map(msg => ({ ...msg, is_read: true })));
            }
        } catch (error) {
            console.error('Error marking chat as read:', error);
        }
    }, [selectedChat]);

    // Search users for new chat
    const searchUsers = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/api/users/search`, {
                params: { 
                    q: query,
                    limit: 10
                },
                headers: getAuthHeaders()
            });

            console.log('Search results:', response.data);
            setSearchResults(response.data || []);
        } catch (error: any) {
            console.error('Error searching users:', error);
            antMessage.error('Ошибка поиска пользователей');
        }
    }, []);

    // Create new chat
    const createChat = useCallback(async () => {
        if (!currentUser?.id) return;

        try {
            let response;
            
            if (chatType === 'direct' && selectedUsers.length === 1) {
                // Direct chat - using the existing endpoint
                response = await axios.post(`${API_BASE_URL}/api/chats/create`, {
                    user_id: selectedUsers[0],
                    type: 'direct'
                }, {
                    headers: getAuthHeaders()
                });
                
                // Создаем объект чата на основе ответа
                const targetUser = searchResults.find(u => u.id === selectedUsers[0]);
                const newChat: Chat = {
                    id: response.data.chat_id,
                    type: 'direct',
                    created_at: Math.floor(Date.now() / 1000),
                    message_count: 0,
                    other_user: targetUser?.username || 'Пользователь',
                    name: targetUser?.username || 'Диалог',
                    unread_count: 0
                };

                setChats(prev => [newChat, ...prev]);
                setSelectedChat(newChat);
                antMessage.success('Чат создан');
                
            } else if (chatType === 'group' && selectedUsers.length >= 2 && groupName) {
                // Group chat
                response = await axios.post(`${API_BASE_URL}/api/chats/create`, {
                    type: 'group',
                    name: groupName,
                    users: selectedUsers
                }, {
                    headers: getAuthHeaders()
                });

                const newChat: Chat = {
                    id: response.data.chat_id,
                    type: 'group',
                    name: groupName,
                    created_at: Math.floor(Date.now() / 1000),
                    message_count: 0,
                    unread_count: 0
                };

                setChats(prev => [newChat, ...prev]);
                setSelectedChat(newChat);
                antMessage.success('Групповой чат создан');
            }

            // Reset form
            setNewChatModalOpen(false);
            setSelectedUsers([]);
            setSearchUserQuery('');
            setGroupName('');
            setChatType('direct');
            
        } catch (error: any) {
            console.error('Error creating chat:', error);
            if (error.response?.data?.error) {
                antMessage.error(error.response.data.error);
            } else {
                antMessage.error('Ошибка создания чата');
            }
        }
    }, [currentUser, chatType, selectedUsers, groupName, searchResults]);

    // Send message
    const sendMessage = useCallback(async () => {
        if ((!messageInput.trim() && attachments.length === 0) || !selectedChat || sending) return;

        setSending(true);

        try {
            const messageData: any = {
                content: messageInput,
                reply_to: replyTo?.id
            };

            // Если редактируем сообщение
            if (messageToEdit) {
                // PUT запрос для редактирования
                await axios.put(`${API_BASE_URL}/api/messages/${messageToEdit.id}`, {
                    content: messageInput
                }, {
                    headers: getAuthHeaders()
                });

                // Обновляем сообщение локально
                setMessages(prev => prev.map(msg =>
                    msg.id === messageToEdit.id 
                    ? { ...msg, content: messageInput, edited_at: Math.floor(Date.now() / 1000) }
                    : msg
                ));

                setMessageToEdit(null);
                antMessage.success('Сообщение обновлено');
                
            } else {
                // POST запрос для нового сообщения
                const response = await axios.post(
                    `${API_BASE_URL}/api/chats/${selectedChat.id}/messages`,
                    messageData,
                    { headers: getAuthHeaders() }
                );

                console.log('Message sent response:', response.data);

                const newMessage: Message = {
                    id: response.data.message_id || `temp_${Date.now()}`,
                    chat_id: selectedChat.id,
                    sender_id: currentUser?.id || '',
                    sender_name: currentUser?.username || 'Вы',
                    content: messageInput,
                    sent_at: response.data.sent_at || Math.floor(Date.now() / 1000),
                    is_read: false,
                    reply_to: replyTo?.id
                };

                setMessages(prev => [...prev, newMessage]);

                // Если есть вложения, загружаем их
                if (attachments.length > 0) {
                    for (const file of attachments) {
                        await uploadAttachment(response.data.message_id, file);
                    }
                    setAttachments([]);
                }

                // Update chat list
                setChats(prev => prev.map(chat =>
                    chat.id === selectedChat.id ? {
                        ...chat,
                        last_message: messageInput.substring(0, 50) + (messageInput.length > 50 ? '...' : ''),
                        message_count: (chat.message_count || 0) + 1
                    } : chat
                ));
            }

            // Clear input and reset states
            setMessageInput('');
            setReplyTo(null);

            // Emit typing stop
            socket.emit('stop_typing', { chat_id: selectedChat.id });

        } catch (error: any) {
            console.error('Error sending message:', error);
            antMessage.error('Ошибка отправки сообщения');
        } finally {
            setSending(false);
        }
    }, [selectedChat, currentUser, messageInput, attachments, sending, replyTo, messageToEdit]);

    // Upload attachment
    const uploadAttachment = useCallback(async (messageId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/messages/${messageId}/attach`,
                formData,
                {
                    headers: {
                        'Authorization': getAuthToken(),
                        'Content-Type': 'multipart/form-data'
                    },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round(
                            (progressEvent.loaded * 100) / (progressEvent.total || file.size)
                        );
                        setUploadProgress(prev => ({
                            ...prev,
                            [file.name]: percentCompleted
                        }));
                    }
                }
            );

            console.log('Attachment uploaded:', response.data);
            antMessage.success(`Файл ${file.name} загружен`);
            
            // Remove from upload progress
            setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[file.name];
                return newProgress;
            });

        } catch (error) {
            console.error('Error uploading attachment:', error);
            antMessage.error(`Ошибка загрузки файла ${file.name}`);
        }
    }, []);

    // Handle typing
    const handleTyping = useCallback(() => {
        if (!selectedChat || !currentUser) return;

        socket.emit('typing', {
            chat_id: selectedChat.id,
            username: currentUser.username
        });

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stop_typing', { chat_id: selectedChat.id });
        }, 2000);
    }, [selectedChat, currentUser]);

    // Delete message
    const deleteMessage = useCallback(async (messageId: string) => {
        Modal.confirm({
            title: 'Удалить сообщение?',
            content: 'Это действие нельзя отменить',
            okText: 'Удалить',
            okType: 'danger',
            cancelText: 'Отмена',
            async onOk() {
                try {
                    await axios.delete(`${API_BASE_URL}/api/messages/${messageId}`, {
                        headers: getAuthHeaders()
                    });

                    setMessages(prev => prev.filter(msg => msg.id !== messageId));
                    antMessage.success('Сообщение удалено');
                } catch (error) {
                    console.error('Error deleting message:', error);
                    antMessage.error('Ошибка удаления сообщения');
                }
            }
        });
    }, []);

    // Get unread count for chat
    const getUnreadCount = useCallback(async (chatId: string) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/chats/${chatId}/unread-count`, {
                headers: getAuthHeaders()
            });
            return response.data.unread_count || 0;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initial data fetch and socket setup
    useEffect(() => {
        if (currentUser?.id) {
            fetchChats();
            
            // Socket connection
            socket.on('connect', () => {
                console.log('Socket connected');
                // Join user's room for notifications
                socket.emit('join', { room: currentUser.id });
            });

            socket.on('new_message', (data: any) => {
                console.log('New message via socket:', data);
                
                const isCurrentChat = selectedChat?.id === data.chat_id;

                // Если это текущий чат, добавляем сообщение
                if (isCurrentChat) {
                    const newMessage: Message = {
                        id: data.message_id,
                        chat_id: data.chat_id,
                        sender_id: data.sender_id,
                        sender_name: data.sender_name || 'Пользователь',
                        content: data.content,
                        sent_at: Date.now() / 1000,
                        is_read: true
                    };

                    setMessages(prev => [...prev, newMessage]);
                }

                // Обновляем список чатов
                setChats(prev => prev.map(chat => {
                    if (chat.id === data.chat_id) {
                        const updatedChat = {
                            ...chat,
                            last_message: data.content.substring(0, 50) + (data.content.length > 50 ? '...' : ''),
                            message_count: (chat.message_count || 0) + 1
                        };
                        
                        // Увеличиваем счетчик непрочитанных только если это не текущий чат
                        if (!isCurrentChat) {
                            updatedChat.unread_count = (chat.unread_count || 0) + 1;
                        }
                        
                        return updatedChat;
                    }
                    return chat;
                }));
            });

            socket.on('user_typing', (data: any) => {
                if (selectedChat && data.chat_id === selectedChat.id) {
                    setTypingUser(data.username);
                }
            });

            socket.on('user_stop_typing', (data: any) => {
                if (selectedChat && data.chat_id === selectedChat.id) {
                    setTypingUser(null);
                }
            });

            return () => {
                socket.off('connect');
                socket.off('new_message');
                socket.off('user_typing');
                socket.off('user_stop_typing');
            };
        }
    }, [currentUser, selectedChat, fetchChats]);

    // Handle chat selection and room management
    useEffect(() => {
        if (selectedChat) {
            // Join the chat room
            socket.emit('join', { room: selectedChat.id });
            selectedChatRef.current = selectedChat.id;
            
            // Fetch messages for the chat
            fetchMessages(selectedChat.id);
            
            // Clear typing indicator
            setTypingUser(null);
        }

        return () => {
            if (selectedChatRef.current) {
                socket.emit('leave', { room: selectedChatRef.current });
                selectedChatRef.current = null;
            }
        };
    }, [selectedChat, fetchMessages]);

    // Filter and sort chats
    const filteredChats = React.useMemo(() => {
        return chats.filter(chat => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = (
                (chat.name?.toLowerCase().includes(searchLower)) ||
                (chat.other_user?.toLowerCase().includes(searchLower))
            );

            if (filterType === 'all') return matchesSearch;
            if (filterType === 'unread') return matchesSearch && (chat.unread_count || 0) > 0;
            if (filterType === 'groups') return matchesSearch && chat.type === 'group';

            return matchesSearch;
        }).sort((a, b) => {
            if (sortOrder === 'date') {
                return b.created_at - a.created_at;
            }
            if (sortOrder === 'name') {
                return (a.name || a.other_user || '').localeCompare(b.name || b.other_user || '');
            }
            return 0;
        });
    }, [chats, searchQuery, filterType, sortOrder]);

    // Render message menu
    const renderMessageMenu = useCallback((message: Message, isOwn: boolean) => {
        const menuItems = [
            {
                key: 'reply',
                icon: <CommentOutlined />,
                label: 'Ответить',
                onClick: () => setReplyTo(message)
            },
            {
                key: 'copy',
                icon: <CopyOutlined />,
                label: 'Скопировать текст',
                onClick: () => {
                    navigator.clipboard.writeText(message.content);
                    antMessage.success('Текст скопирован');
                }
            }
        ];

        if (isOwn) {
            menuItems.push(
                {
                    key: 'edit',
                    icon: <EditOutlined />,
                    label: 'Редактировать',
                    onClick: () => {
                        setMessageToEdit(message);
                        setMessageInput(message.content);
                        messageInputRef.current?.focus();
                    }
                },
                {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    label: 'Удалить',
                    danger: true,
                    onClick: () => deleteMessage(message.id)
                } as any
            );
        } else {
            menuItems.push(
                {
                    key: 'forward',
                    icon: <ForwardOutlined />,
                    label: 'Переслать',
                    onClick: () => {
                        antMessage.info('Пересылка сообщений пока не реализована');
                    }
                }
            );
        }

        return (
            <Dropdown
                menu={{ items: menuItems }}
                trigger={['click']}
                placement="bottomRight"
            >
                <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    className="message-menu-btn"
                    onClick={(e) => e.stopPropagation()}
                />
            </Dropdown>
        );
    }, [deleteMessage]);

    // Render message content
    const renderMessageContent = useCallback((msg: Message) => {
        const isOwn = msg.sender_id === currentUser?.id;
        const repliedMessage = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null;
        const chatType = selectedChat?.type || 'direct';

        return (
            <div
                className={`message-wrapper ${isOwn ? 'own-message' : 'other-message'}`}
                onDoubleClick={() => setReplyTo(msg)}
            >
                {!isOwn && (
                    <Avatar
                        size="small"
                        style={{
                            background: getAvatarColor(msg.sender_name || 'Пользователь'),
                            marginRight: 8,
                            marginTop: 4
                        }}
                    >
                        {(msg.sender_name || 'П')[0].toUpperCase()}
                    </Avatar>
                )}

                <div className="message-bubble">
                    {repliedMessage && (
                        <div className="reply-preview">
                            <Text strong style={{ fontSize: '0.85rem' }}>
                                {repliedMessage.sender_name}
                            </Text>
                            <Text type="secondary" style={{ fontSize: '0.8rem', display: 'block' }}>
                                {repliedMessage.content?.substring(0, 100) || 'Сообщение'}
                            </Text>
                        </div>
                    )}

                    {chatType === 'group' && !isOwn && (
                        <Text strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>
                            {msg.sender_name}
                        </Text>
                    )}

                    {msg.attachment_count && msg.attachment_count > 0 && (
                        <Card
                            className="file-preview"
                            size="small"
                            style={{ marginBottom: 8, cursor: 'pointer' }}
                            onClick={() => antMessage.info('Просмотр вложений пока не реализован')}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <div style={{ padding: 10, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8 }}>
                                    <FileOutlined style={{ fontSize: 24, color: '#6366f1' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                                    <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {msg.attachment_count} файл{msg.attachment_count > 1 ? 'а' : ''}
                                    </Text>
                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                        <span>Вложения</span>
                                    </div>
                                </div>
                                <Button
                                    type="text"
                                    icon={<DownloadOutlined />}
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        antMessage.info('Загрузка вложений пока не реализована');
                                    }}
                                />
                            </div>
                        </Card>
                    )}

                    {msg.content && (
                        <div className="message-content">
                            <Text style={{ color: isOwn ? 'white' : 'inherit', whiteSpace: 'pre-wrap' }}>
                                {msg.content}
                            </Text>
                        </div>
                    )}

                    <div className="message-meta">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {msg.edited_at && (
                                <Tooltip title="Отредактировано">
                                    <EditOutlined style={{ fontSize: '0.75rem', opacity: 0.7 }} />
                                </Tooltip>
                            )}

                            <Text style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                {formatTime(msg.sent_at)}
                            </Text>

                            {isOwn && (
                                <>
                                    {msg.is_read ? (
                                        <Tooltip title="Прочитано">
                                            <CheckCircleOutlined style={{ fontSize: '0.75rem', color: '#10b981' }} />
                                        </Tooltip>
                                    ) : (
                                        <Tooltip title="Отправлено">
                                            <CheckOutlined style={{ fontSize: '0.75rem', opacity: 0.7 }} />
                                        </Tooltip>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {renderMessageMenu(msg, isOwn)}
            </div>
        );
    }, [currentUser, messages, selectedChat, getAvatarColor, formatTime, renderMessageMenu]);

    if (!currentUser) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                flexDirection: 'column'
            }}>
                <Spin size="large" />
                <Text style={{ marginTop: 16 }}>Загрузка мессенджера...</Text>
            </div>
        );
    }

    return (
        <div className={`kipswift-container ${darkMode ? 'dark-mode' : ''}`}>
            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <div className="app-brand">
                        <div className="logo-fallback" style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: '#6366f1' }}>
                            <TeamOutlined style={{ color: 'white', fontSize: 20, lineHeight: '32px' }} />
                        </div>
                        <Title level={4} className="app-title" style={{ margin: 0, marginLeft: 12 }}>Kipswift</Title>
                    </div>
                    <Space>
                        <Tooltip title="Настройки">
                            <Button
                                type="text"
                                icon={<SettingOutlined />}
                                onClick={() => setSettingsVisible(true)}
                            />
                        </Tooltip>
                        <Tooltip title="Новый чат">
                            <Button
                                type="primary"
                                icon={<UserAddOutlined />}
                                onClick={() => setNewChatModalOpen(true)}
                                size="small"
                            />
                        </Tooltip>
                    </Space>
                </div>

                <div style={{ padding: '0 16px 12px' }}>
                    <Input
                        placeholder="Поиск чатов..."
                        prefix={<SearchOutlined />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        allowClear
                        size="middle"
                    />

                    <Space style={{ marginTop: 12, width: '100%', justifyContent: 'space-between' }}>
                        <Select
                            value={filterType}
                            onChange={(value) => setFilterType(value)}
                            size="small"
                            style={{ width: '48%' }}
                        >
                            <Option value="all">Все</Option>
                            <Option value="unread">Непрочитанные</Option>
                            <Option value="groups">Группы</Option>
                        </Select>

                        <Select
                            value={sortOrder}
                            onChange={(value) => setSortOrder(value)}
                            size="small"
                            style={{ width: '48%' }}
                        >
                            <Option value="date">По дате</Option>
                            <Option value="name">По имени</Option>
                        </Select>
                    </Space>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div className="chat-list">
                    {chatsLoading ? (
                        <Spin style={{ display: 'block', margin: '40px auto' }} />
                    ) : filteredChats.length === 0 ? (
                        <Empty
                            description={searchQuery ? "Чаты не найдены" : "Нет чатов"}
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
                                    style={{ margin: '2px 8px', borderRadius: 12, border: 'none' }}
                                    bodyStyle={{ padding: '12px' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                        <Badge
                                            count={chat.unread_count || 0}
                                            offset={[-5, 5]}
                                            style={{ backgroundColor: '#6366f1' }}
                                        >
                                            <Avatar
                                                className="chat-avatar"
                                                size="large"
                                                style={{ 
                                                    background: getAvatarColor(chat.name || chat.other_user || ''),
                                                    border: selectedChat?.id === chat.id ? '2px solid #6366f1' : 'none'
                                                }}
                                            >
                                                {(chat.name || chat.other_user || 'Ч')[0].toUpperCase()}
                                                {chat.type === 'group' && (
                                                    <div style={{ position: 'absolute', bottom: -2, right: -2, background: '#8b5cf6', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <UsergroupAddOutlined style={{ fontSize: 10, color: 'white' }} />
                                                    </div>
                                                )}
                                            </Avatar>
                                        </Badge>
                                        <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                                            <div className="chat-header">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {chat.name || chat.other_user || 'Чат'}
                                                    </Text>
                                                    <Text type="secondary" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', marginLeft: 8 }}>
                                                        {formatDate(chat.created_at)}
                                                    </Text>
                                                </div>
                                            </div>
                                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text type="secondary" style={{ fontSize: '0.85rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {chat.last_message || (chat.message_count > 0 ? `${chat.message_count} сообщений` : 'Нет сообщений')}
                                                </Text>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        />
                    )}
                </div>
            </div>

            {/* Main chat area */}
            <div className="chat-main">
                {selectedChat ? (
                    <>
                        <div className="chat-header-bar">
                            <div className="chat-info">
                                <Avatar
                                    className="current-chat-avatar"
                                    size="large"
                                    style={{ 
                                        background: getAvatarColor(selectedChat.name || selectedChat.other_user || ''),
                                        border: '2px solid white',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    {(selectedChat.name || selectedChat.other_user || 'Ч')[0].toUpperCase()}
                                    {selectedChat.type === 'group' && (
                                        <div style={{ position: 'absolute', bottom: -2, right: -2, background: '#8b5cf6', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <UsergroupAddOutlined style={{ fontSize: 10, color: 'white' }} />
                                        </div>
                                    )}
                                </Avatar>
                                <div style={{ flex: 1, marginLeft: 12 }}>
                                    <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {selectedChat.name || selectedChat.other_user || 'Чат'}
                                        {selectedChat.type === 'group' && (
                                            <Tag color="purple" style={{ fontSize: '0.85rem', padding: '2px 6px' }}>Группа</Tag>
                                        )}
                                    </Title>
                                    {typingUser ? (
                                        <Text type="secondary" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                                            {typingUser} печатает...
                                        </Text>
                                    ) : (
                                        <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                                            {selectedChat.type === 'direct' ? 'Диалог' : `Групповой чат • ${selectedChat.message_count || 0} сообщений`}
                                        </Text>
                                    )}
                                </div>
                            </div>
                            <Space>
                                <Tooltip title="Информация о чате">
                                    <Button
                                        type="text"
                                        icon={<InfoCircleOutlined />}
                                        onClick={() => antMessage.info('Информация о чате пока не реализована')}
                                    />
                                </Tooltip>
                            </Space>
                        </div>

                        <div className="messages-container">
                            {messagesLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                                    <Spin size="large" />
                                </div>
                            ) : messages.length === 0 ? (
                                <Empty
                                    description="Нет сообщений"
                                    style={{ margin: 'auto' }}
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                            ) : (
                                <>
                                    <div style={{ padding: '16px 24px', textAlign: 'center' }}>
                                        <Text type="secondary">Начало переписки</Text>
                                    </div>
                                    {messages.map(msg => (
                                        <div key={msg.id} style={{ padding: '4px 24px' }}>
                                            {renderMessageContent(msg)}
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {replyTo && (
                            <div className="reply-bar">
                                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                    <CommentOutlined style={{ marginRight: 8, color: '#6366f1' }} />
                                    <div style={{ overflow: 'hidden' }}>
                                        <Text strong style={{ display: 'block', fontSize: '0.9rem' }}>Ответ на сообщение {replyTo.sender_name}</Text>
                                        <Text type="secondary" style={{ display: 'block', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {replyTo.content?.substring(0, 80) || 'Сообщение'}
                                        </Text>
                                    </div>
                                </div>
                                <Button
                                    type="text"
                                    icon={<CloseOutlined />}
                                    onClick={() => setReplyTo(null)}
                                    size="small"
                                />
                            </div>
                        )}

                        {messageToEdit && (
                            <div style={{ padding: '8px 24px', background: 'rgba(255, 193, 7, 0.1)', borderBottom: '1px solid #ffc107' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <EditOutlined style={{ color: '#ffc107', marginRight: 8 }} />
                                        <Text strong>Редактирование сообщения</Text>
                                    </div>
                                    <Button
                                        type="text"
                                        icon={<CloseOutlined />}
                                        onClick={() => {
                                            setMessageToEdit(null);
                                            setMessageInput('');
                                        }}
                                        size="small"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="input-area">
                            <Popover
                                content={
                                    <Space direction="vertical">
                                        <Tooltip title="Файл">
                                            <Button
                                                type="text"
                                                icon={<PaperClipOutlined />}
                                                onClick={() => fileInputRef.current?.click()}
                                                block
                                            >
                                                Прикрепить файл
                                            </Button>
                                        </Tooltip>
                                    </Space>
                                }
                                title="Прикрепить"
                                trigger="click"
                                placement="topLeft"
                            >
                                <Button type="text" icon={<PaperClipOutlined />} />
                            </Popover>

                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                multiple
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (files) {
                                        const fileArray = Array.from(files);
                                        setAttachments(prev => [...prev, ...fileArray]);
                                        antMessage.info(`Добавлено ${fileArray.length} файл(ов)`);
                                    }
                                }}
                            />

                            {attachments.length > 0 && (
                                <div style={{ padding: '8px 16px', background: '#f5f5f5', borderTop: '1px solid #e8e8e8' }}>
                                    <Text strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: 4 }}>
                                        Вложения ({attachments.length}):
                                    </Text>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {attachments.map((file, index) => (
                                            <Tag
                                                key={index}
                                                closable
                                                onClose={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                                                style={{ marginBottom: 4 }}
                                            >
                                                {file.name} ({formatFileSize(file.size)})
                                            </Tag>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <TextArea
                                ref={messageInputRef}
                                className="message-input"
                                placeholder={messageToEdit ? "Редактируйте сообщение..." : "Введите сообщение..."}
                                value={messageInput}
                                onChange={(e) => {
                                    setMessageInput(e.target.value);
                                    handleTyping();
                                }}
                                onKeyDown={(e) => {
                                    if (sendByEnter && e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    } else if (!sendByEnter && e.key === 'Enter' && e.ctrlKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                autoSize={{ minRows: 1, maxRows: 6 }}
                                style={{ flex: 1, margin: '0 8px' }}
                            />

                            <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center' }}>
                                {sending ? (
                                    <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
                                ) : (
                                    <Button
                                        type="primary"
                                        icon={messageToEdit ? <CheckOutlined /> : <SendOutlined />}
                                        onClick={sendMessage}
                                        disabled={(!messageInput.trim() && attachments.length === 0) || sending}
                                        style={{ borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        flexDirection: 'column',
                        padding: 40,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white'
                    }}>
                        <Avatar
                            size={120}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                marginBottom: 24,
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            <TeamOutlined style={{ fontSize: 60, color: 'white' }} />
                        </Avatar>
                        <Title level={2} style={{ color: 'white', marginBottom: 16, textAlign: 'center' }}>
                            Добро пожаловать в Kipswift
                        </Title>
                        <Text style={{ textAlign: 'center', maxWidth: 400, color: 'rgba(255,255,255,0.8)', marginBottom: 32 }}>
                            Выберите чат для начала общения или создайте новый
                        </Text>
                        <Space>
                            <Button 
                                type="primary" 
                                icon={<UserAddOutlined />} 
                                onClick={() => setNewChatModalOpen(true)}
                                size="large"
                                style={{ background: 'white', color: '#6366f1', border: 'none' }}
                            >
                                Новый чат
                            </Button>
                            <Button 
                                icon={<SettingOutlined />} 
                                onClick={() => setSettingsVisible(true)}
                                size="large"
                                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}
                            >
                                Настройки
                            </Button>
                        </Space>
                    </div>
                )}
            </div>

            {/* New chat modal */}
            <Modal
                title={chatType === 'direct' ? 'Новый чат' : 'Новая группа'}
                open={newChatModalOpen}
                onCancel={() => {
                    setNewChatModalOpen(false);
                    setSearchUserQuery('');
                    setSelectedUsers([]);
                    setGroupName('');
                    setChatType('direct');
                }}
                onOk={createChat}
                okText="Создать"
                cancelText="Отмена"
                width={500}
                okButtonProps={{
                    disabled: chatType === 'direct' ? selectedUsers.length !== 1 : (selectedUsers.length < 2 || !groupName.trim())
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
                    <Tabs
                        activeKey={chatType}
                        onChange={(key) => {
                            setChatType(key as 'direct' | 'group');
                            setSelectedUsers([]);
                            setSearchUserQuery('');
                            setGroupName('');
                        }}
                        style={{ width: '100%' }}
                    >
                        <TabPane tab={<div style={{ display: 'flex', alignItems: 'center' }}><UserOutlined style={{ marginRight: 8 }} />Приватный</div>} key="direct" />
                        <TabPane tab={<div style={{ display: 'flex', alignItems: 'center' }}><UsergroupAddOutlined style={{ marginRight: 8 }} />Группа</div>} key="group" />
                    </Tabs>

                    {chatType === 'direct' && (
                        <>
                            <Input
                                placeholder="Поиск по имени пользователя или email..."
                                value={searchUserQuery}
                                onChange={(e) => {
                                    setSearchUserQuery(e.target.value);
                                    if (e.target.value.length >= 2) {
                                        searchUsers(e.target.value);
                                    } else {
                                        setSearchResults([]);
                                    }
                                }}
                                suffix={
                                    <Button
                                        type="text"
                                        icon={<SearchOutlined />}
                                        onClick={() => searchUsers(searchUserQuery)}
                                        size="small"
                                        disabled={searchUserQuery.length < 2}
                                    />
                                }
                            />

                            <List
                                dataSource={searchResults}
                                loading={false}
                                style={{ maxHeight: 300, overflowY: 'auto' }}
                                locale={{ emptyText: searchUserQuery.length < 2 ? 'Введите минимум 2 символа для поиска' : 'Пользователи не найдены' }}
                                renderItem={user => (
                                    <List.Item
                                        style={{
                                            cursor: 'pointer',
                                            padding: '12px',
                                            background: selectedUsers.includes(user.id) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                            borderRadius: 8,
                                            border: '1px solid #f0f0f0',
                                            marginBottom: 4
                                        }}
                                        onClick={() => {
                                            if (selectedUsers.includes(user.id)) {
                                                setSelectedUsers([]);
                                            } else {
                                                setSelectedUsers([user.id]);
                                            }
                                        }}
                                    >
                                        <List.Item.Meta
                                            avatar={
                                                <Avatar style={{ background: getAvatarColor(user.username) }}>
                                                    {user.username[0].toUpperCase()}
                                                </Avatar>
                                            }
                                            title={user.username}
                                            description={user.email || `ID: ${user.id}`}
                                        />
                                        {selectedUsers.includes(user.id) && <CheckOutlined style={{ color: '#10b981' }} />}
                                    </List.Item>
                                )}
                            />
                        </>
                    )}

                    {chatType === 'group' && (
                        <>
                            <Input
                                placeholder="Название группы"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                maxLength={50}
                                showCount
                            />

                            <Input
                                placeholder="Поиск участников..."
                                value={searchUserQuery}
                                onChange={(e) => {
                                    setSearchUserQuery(e.target.value);
                                    if (e.target.value.length >= 2) {
                                        searchUsers(e.target.value);
                                    } else {
                                        setSearchResults([]);
                                    }
                                }}
                                suffix={
                                    <Button
                                        type="text"
                                        icon={<SearchOutlined />}
                                        onClick={() => searchUsers(searchUserQuery)}
                                        size="small"
                                        disabled={searchUserQuery.length < 2}
                                    />
                                }
                            />

                            {selectedUsers.length > 0 && (
                                <div>
                                    <Text strong>Выбранные участники ({selectedUsers.length}):</Text>
                                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {selectedUsers.map(userId => {
                                            const user = searchResults.find(u => u.id === userId);
                                            return user ? (
                                                <Tag
                                                    key={userId}
                                                    closable
                                                    onClose={() => setSelectedUsers(prev => prev.filter(id => id !== userId))}
                                                    style={{ marginBottom: 4 }}
                                                >
                                                    {user.username}
                                                </Tag>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}

                            <List
                                dataSource={searchResults.filter(user => !selectedUsers.includes(user.id))}
                                loading={false}
                                style={{ maxHeight: 200, overflowY: 'auto' }}
                                locale={{ emptyText: searchUserQuery.length < 2 ? 'Введите минимум 2 символа для поиска' : 'Пользователи не найдены' }}
                                renderItem={user => (
                                    <List.Item
                                        style={{
                                            cursor: 'pointer',
                                            padding: '8px',
                                            background: 'transparent',
                                            borderRadius: 4,
                                            marginBottom: 2
                                        }}
                                        onClick={() => {
                                            if (!selectedUsers.includes(user.id)) {
                                                setSelectedUsers(prev => [...prev, user.id]);
                                            }
                                        }}
                                    >
                                        <List.Item.Meta
                                            avatar={
                                                <Avatar size="small" style={{ background: getAvatarColor(user.username) }}>
                                                    {user.username[0].toUpperCase()}
                                                </Avatar>
                                            }
                                            title={<Text style={{ fontSize: '0.9rem' }}>{user.username}</Text>}
                                            description={<Text type="secondary" style={{ fontSize: '0.8rem' }}>{user.email}</Text>}
                                        />
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<UserAddOutlined />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!selectedUsers.includes(user.id)) {
                                                    setSelectedUsers(prev => [...prev, user.id]);
                                                }
                                            }}
                                        />
                                    </List.Item>
                                )}
                            />
                        </>
                    )}
                </div>
            </Modal>

            {/* Settings modal */}
            <Modal
                title="Настройки"
                open={settingsVisible}
                onCancel={() => setSettingsVisible(false)}
                footer={null}
                width={400}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Text strong>Уведомления</Text>
                            <Text type="secondary" style={{ display: 'block', fontSize: '0.85rem' }}>
                                Звуковые и push-уведомления
                            </Text>
                        </div>
                        <Switch
                            checked={notificationsEnabled}
                            onChange={setNotificationsEnabled}
                        />
                    </div>

                    <Divider style={{ margin: 0 }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Text strong>Тёмная тема</Text>
                            <Text type="secondary" style={{ display: 'block', fontSize: '0.85rem' }}>
                                Переключение между светлой и темной темой
                            </Text>
                        </div>
                        <Switch
                            checked={darkMode}
                            onChange={setDarkMode}
                        />
                    </div>

                    <Divider style={{ margin: 0 }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Text strong>Отправка по Enter</Text>
                            <Text type="secondary" style={{ display: 'block', fontSize: '0.85rem' }}>
                                {sendByEnter ? 'Enter отправляет сообщение, Shift+Enter — перенос строки' : 'Ctrl+Enter отправляет сообщение'}
                            </Text>
                        </div>
                        <Switch
                            checked={sendByEnter}
                            onChange={setSendByEnter}
                        />
                    </div>

                    <Divider style={{ margin: 0 }} />

                    <div style={{ background: '#f6ffed', padding: 12, borderRadius: 8, border: '1px solid #b7eb8f' }}>
                        <Text strong style={{ display: 'block', marginBottom: 4 }}>Текущий пользователь</Text>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                            <Avatar size="small" style={{ background: getAvatarColor(currentUser.username), marginRight: 8 }}>
                                {currentUser.username[0].toUpperCase()}
                            </Avatar>
                            <Text>{currentUser.username}</Text>
                        </div>
                        <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                            ID: {currentUser.id.substring(0, 8)}...
                        </Text>
                    </div>

                    <Divider style={{ margin: 0 }} />

                    <Button
                        danger
                        block
                        onClick={() => {
                            if (onLogout) onLogout();
                            socket.disconnect();
                            antMessage.success('Вы вышли из аккаунта');
                        }}
                    >
                        Выйти из аккаунта
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default Kipswift;