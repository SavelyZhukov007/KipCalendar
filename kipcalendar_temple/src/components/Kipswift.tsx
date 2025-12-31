// frontend/src/components/Kipswift.tsx
import React, { useState, useEffect, useRef } from 'react';
import ListItemButton from '@mui/material/ListItemButton';
import {
    Box,
    Container,
    Paper,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    TextField,
    IconButton,
    Typography,
    Divider,
    Badge,
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    CircularProgress
} from '@mui/material';
import {
    Send as SendIcon,
    Search as SearchIcon,
    AttachFile as AttachFileIcon,
    PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import io from 'socket.io-client';
import { API_BASE_URL, SOCKET_URL } from '../config';

const socket = io(SOCKET_URL);

interface Message {
    id: string;
    content: string;
    sender_id: string;
    sender_name: string;
    sent_at: number;
    edited_at?: number;
}

interface Chat {
    id: string;
    type: 'private' | 'group';
    name?: string;
    other_user?: string;
    message_count: number;
    unread_count?: number;
    last_message?: string;
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

    const [newChatDialogOpen, setNewChatDialogOpen] = useState(false);
    const [searchUserQuery, setSearchUserQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        if (!messageInput.trim() || !selectedChat || sending) return;

        setSending(true);

        try {
            const token = localStorage.getItem('token');
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
        } catch (err) {
            console.error('Failed to send message:', err);
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

    const handleSearchUsers = async () => {
        if (!searchUserQuery.trim()) return;

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
            }
        } catch (err) {
            console.error('Failed to search users:', err);
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
                setNewChatDialogOpen(false);
                setSearchUserQuery('');
                setSearchResults([]);

                await fetchChats();
                const newChat = chats.find(c => c.id === data.chat_id);
                if (newChat) setSelectedChat(newChat);
            }
        } catch (err) {
            console.error('Failed to create chat:', err);
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

    return (
        <Container maxWidth="xl" sx={{ height: '100vh', py: 2 }}>
            <Paper elevation={3} sx={{ display: 'flex', height: '90vh' }}>
                <Box sx={{ width: 320, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="h5" gutterBottom>
                            Сообщения
                        </Typography>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                )
                            }}
                        />
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<PersonAddIcon />}
                            onClick={() => setNewChatDialogOpen(true)}
                            sx={{ mt: 1 }}
                        >
                            Новый чат
                        </Button>
                    </Box>

                    <Divider />

                    <List sx={{ flexGrow: 1, overflow: 'auto' }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            filteredChats.map((chat) => (
                                <ListItemButton
                                    key={chat.id}
                                    selected={selectedChat?.id === chat.id}
                                    onClick={() => setSelectedChat(chat)}
                                >
                                    <ListItemAvatar>
                                        <Badge badgeContent={chat.unread_count} color="primary">
                                            <Avatar>
                                                {(chat.name || chat.other_user || 'U')[0].toUpperCase()}
                                            </Avatar>
                                        </Badge>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={chat.name || chat.other_user || 'Чат'}
                                        secondary={`${chat.message_count} сообщений`}
                                    />
                                </ListItemButton>
                            ))
                        )}
                    </List>
                </Box>

                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    {selectedChat ? (
                        <>
                            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                                <Typography variant="h6">
                                    {selectedChat.name || selectedChat.other_user || 'Чат'}
                                </Typography>
                                {typingUser && (
                                    <Typography variant="caption" color="text.secondary">
                                        {typingUser} печатает...
                                    </Typography>
                                )}
                            </Box>

                            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                                {messages.map((message) => {
                                    const isOwn = message.sender_id === currentUserId;

                                    return (
                                        <Box
                                            key={message.id}
                                            sx={{
                                                display: 'flex',
                                                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                                                mb: 2
                                            }}
                                        >
                                            <Paper
                                                elevation={1}
                                                sx={{
                                                    p: 1.5,
                                                    maxWidth: '70%',
                                                    bgcolor: isOwn ? 'primary.main' : 'grey.100',
                                                    color: isOwn ? 'white' : 'text.primary'
                                                }}
                                            >
                                                {!isOwn && (
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                                                        {message.sender_name}
                                                    </Typography>
                                                )}
                                                <Typography variant="body1">
                                                    {message.content}
                                                </Typography>
                                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                                                    {formatTime(message.sent_at)}
                                                </Typography>
                                            </Paper>
                                        </Box>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </Box>

                            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <IconButton>
                                        <AttachFileIcon />
                                    </IconButton>
                                    <TextField
                                        fullWidth
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
                                        multiline
                                        maxRows={4}
                                    />
                                    <IconButton
                                        color="primary"
                                        onClick={handleSendMessage}
                                        disabled={!messageInput.trim() || sending}
                                    >
                                        {sending ? <CircularProgress size={24} /> : <SendIcon />}
                                    </IconButton>
                                </Box>
                            </Box>
                        </>
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Typography variant="h6" color="text.secondary">
                                Выберите чат для начала общения
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Paper>

            <Dialog open={newChatDialogOpen} onClose={() => setNewChatDialogOpen(false)}>
                <DialogTitle>Новый чат</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        placeholder="Email пользователя"
                        value={searchUserQuery}
                        onChange={(e) => setSearchUserQuery(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleSearchUsers();
                            }
                        }}
                        sx={{ mt: 2 }}
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleSearchUsers}
                        sx={{ mt: 2 }}
                    >
                        Найти
                    </Button>

                    {searchResults.length > 0 && (
                        <List sx={{ mt: 2 }}>
                            {searchResults.map((user) => (
                                <ListItemButton
                                    key={user.id}
                                    onClick={() => handleCreateChat(user.id)}
                                >
                                    <ListItemAvatar>
                                        <Avatar>{user.username[0].toUpperCase()}</Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={user.username}
                                        secondary={user.email}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </DialogContent>
            </Dialog>
        </Container>
    );
};

export default Kipswift;