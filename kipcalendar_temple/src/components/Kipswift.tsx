import React, { useState, useRef, useEffect } from 'react';
import {
    Send,
    AttachFile,
    Image,
    Videocam,
    InsertDriveFile as Document,
    Mic,
    MoreVert,
    Search,
    CheckCircle,
    DoneAll,
    Delete,
    Reply,
    Edit,
    Download
} from '@mui/icons-material';
import {
    Avatar,
    IconButton,
    TextField,
    Typography,
    Box,
    Paper,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemSecondaryAction,
    Badge,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Menu,
    MenuItem,
    Divider,
    ListItemButton
} from '@mui/material';
import { format } from 'date-fns';
import './Kipswift.css';

// Типы
interface Message {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    isOwn: boolean;
    isRead: boolean;
    file?: FileAttachment;
    replyTo?: string;
    isEdited?: boolean;
}

interface FileAttachment {
    id: string;
    name: string;
    type: 'image' | 'video' | 'document' | 'audio';
    size: number;
    url?: string;
    thumbnail?: string;
}

interface Chat {
    id: string;
    name: string;
    avatar: string;
    lastMessage: string;
    timestamp: Date;
    unreadCount: number;
    isOnline: boolean;
}

const Kipswift: React.FC = () => {
    // состояния
    const [messages, setMessages] = useState<Message[]>([/*...*/]);
    const [chats, setChats] = useState<Chat[]>([/*...*/]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedChat, setSelectedChat] = useState<Chat>(chats[0]);
    const [isUploading, setIsUploading] = useState(false);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [messageMenuAnchor, setMessageMenuAnchor] = useState<{ el: HTMLElement; message: Message } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Скролл внизу сообщений
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- НОВЫЙ EFFECT: проверка токена и загрузка чатов ---
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        fetch('http://127.0.0.1:5000/api/chats', {
            headers: { 'Authorization': token }
        })
            .then(res => res.json())
            .then((data: any[]) => {
                const loadedChats: Chat[] = data.map(chat => ({
                    id: chat.id.toString(),
                    name: chat.other_user || 'Группа',
                    avatar: chat.other_user ? chat.other_user[0].toUpperCase() : 'G',
                    lastMessage: '',
                    timestamp: new Date(chat.created_at * 1000),
                    unreadCount: 0,
                    isOnline: false,
                }));
                setChats(loadedChats);
                if (loadedChats.length > 0) setSelectedChat(loadedChats[0]);
            })
            .catch(err => console.error('Ошибка загрузки чатов:', err));
    }, []);

    const handleSendMessage = () => {
        if (!newMessage.trim() && !fileToUpload) return;

        const newMsg: Message = {
            id: Date.now().toString(),
            content: newMessage,
            senderId: 'user1',
            senderName: 'Вы',
            timestamp: new Date(),
            isOwn: true,
            isRead: false,
            replyTo: replyTo?.id,
            isEdited: false
        };

        if (fileToUpload) {
            const fileType = fileToUpload.type.startsWith('image') ? 'image' :
                fileToUpload.type.startsWith('video') ? 'video' :
                    fileToUpload.type.startsWith('audio') ? 'audio' : 'document';

            const fileAttachment: FileAttachment = {
                id: Date.now().toString(),
                name: fileToUpload.name,
                type: fileType,
                size: fileToUpload.size,
                url: URL.createObjectURL(fileToUpload)
            };

            if (fileType === 'image') {
                fileAttachment.thumbnail = URL.createObjectURL(fileToUpload);
            }

            newMsg.file = fileAttachment;
        }

        setMessages(prev => [...prev, newMsg]);
        setNewMessage('');
        setFileToUpload(null);
        setReplyTo(null);
        setIsUploading(false);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileToUpload(file);
            setIsUploading(true);
            setTimeout(() => setIsUploading(false), 1500);
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    const handleReply = (message: Message) => {
        setReplyTo(message);
    };

    const handleDeleteMessage = (messageId: string) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        setMessageMenuAnchor(null);
    };

    const handleEditMessage = (messageId: string) => {
        const message = messages.find(msg => msg.id === messageId);
        if (message) {
            setNewMessage(message.content);
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
        }
        setMessageMenuAnchor(null);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const getFileIcon = (type: string) => {
        switch (type) {
            case 'image': return <Image />;
            case 'video': return <Videocam />;
            case 'audio': return <Mic />;
            default: return <Document />;
        }
    };

    const renderFilePreview = (file: FileAttachment) => {
        if (file.type === 'image' && file.thumbnail) {
            return (
                <div className="file-preview">
                    <img src={file.thumbnail} alt={file.name} className="file-thumbnail" />
                    <div className="file-info">
                        <Typography variant="caption">{file.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                            {formatFileSize(file.size)}
                        </Typography>
                    </div>
                    <IconButton size="small" className="download-btn">
                        <Download fontSize="small" />
                    </IconButton>
                </div>
            );
        }

        return (
            <div className="file-attachment">
                <div className="file-icon">
                    {getFileIcon(file.type)}
                </div>
                <div className="file-details">
                    <Typography variant="body2">{file.name}</Typography>
                    <Typography variant="caption" color="textSecondary">
                        {formatFileSize(file.size)}
                    </Typography>
                </div>
                <IconButton size="small" className="download-btn">
                    <Download fontSize="small" />
                </IconButton>
            </div>
        );
    };

    return (
        <div className="kipswift-container">
            {/* Боковая панель с чатами */}
            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <div className="app-brand">
                        <img
                            src="../assets_logo/kip1.png"
                            alt="KipSwift Logo"
                            className="app-logo"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                    parent.innerHTML = '<div class="logo-fallback">KS</div>';
                                }
                            }}
                        />
                        <Typography variant="h6" className="app-title">KipSwift</Typography>
                    </div>
                    <div className="sidebar-actions">
                        <IconButton>
                            <Search />
                        </IconButton>
                        <IconButton>
                            <MoreVert />
                        </IconButton>
                    </div>
                </div>

                <Divider />

                <List className="chat-list">
                    {chats.map(chat => (
                        <ListItem
                            key={chat.id}
                            disablePadding
                            secondaryAction={
                                chat.unreadCount > 0 && (
                                    <Badge badgeContent={chat.unreadCount} color="primary" />
                                )
                            }
                            className="chat-item"
                        >
                            <ListItemButton
                                selected={selectedChat.id === chat.id}
                                onClick={() => setSelectedChat(chat)}
                                className="chat-button"
                            >
                                <ListItemAvatar>
                                    <Badge
                                        color="success"
                                        variant="dot"
                                        invisible={!chat.isOnline}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    >
                                        <Avatar className="chat-avatar">{chat.avatar}</Avatar>
                                    </Badge>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <div className="chat-header">
                                            <Typography variant="subtitle2">{chat.name}</Typography>
                                            <Typography variant="caption" color="textSecondary">
                                                {format(chat.timestamp, 'HH:mm')}
                                            </Typography>
                                        </div>
                                    }
                                    secondary={
                                        <Typography variant="body2" color="textSecondary" noWrap>
                                            {chat.lastMessage}
                                        </Typography>
                                    }
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </div>

            {/* Основная область чата */}
            <div className="chat-main">
                {/* Заголовок чата */}
                <div className="chat-header-bar">
                    <div className="chat-info">
                        <Avatar className="current-chat-avatar">{selectedChat.avatar}</Avatar>
                        <div>
                            <Typography variant="h6">{selectedChat.name}</Typography>
                            <Typography variant="caption" color="textSecondary">
                                {selectedChat.isOnline ? 'в сети' : 'был(а) недавно'}
                            </Typography>
                        </div>
                    </div>
                    <div className="chat-actions">
                        <IconButton>
                            <Search />
                        </IconButton>
                        <IconButton>
                            <MoreVert />
                        </IconButton>
                    </div>
                </div>

                <Divider />

                {/* История сообщений */}
                <div className="messages-container">
                    {messages.map(message => (
                        <div
                            key={message.id}
                            className={`message-wrapper ${message.isOwn ? 'own-message' : 'other-message'}`}
                        >
                            <div className="message-bubble">
                                {replyTo && message.replyTo === replyTo.id && (
                                    <div className="reply-preview">
                                        <Typography variant="caption" color="textSecondary">
                                            Ответ на: {replyTo.content.substring(0, 50)}...
                                        </Typography>
                                    </div>
                                )}

                                {message.file && renderFilePreview(message.file)}

                                {message.content && (
                                    <Typography variant="body1" className="message-content">
                                        {message.content}
                                    </Typography>
                                )}

                                <div className="message-meta">
                                    <Typography variant="caption" color="textSecondary">
                                        {format(message.timestamp, 'HH:mm')}
                                    </Typography>
                                    {message.isOwn && (
                                        message.isRead ? (
                                            <DoneAll fontSize="small" color="primary" />
                                        ) : (
                                            <CheckCircle fontSize="small" color="action" />
                                        )
                                    )}
                                    {message.isEdited && (
                                        <Typography variant="caption" color="textSecondary">
                                            (ред.)
                                        </Typography>
                                    )}
                                </div>
                            </div>

                            <IconButton
                                size="small"
                                className="message-menu-btn"
                                onClick={(e) => setMessageMenuAnchor({ el: e.currentTarget, message })}
                            >
                                <MoreVert fontSize="small" />
                            </IconButton>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Панель ответа (если есть) */}
                {replyTo && (
                    <div className="reply-bar">
                        <div className="reply-info">
                            <Reply fontSize="small" />
                            <Typography variant="body2">
                                Ответ на: {replyTo.content.substring(0, 30)}...
                            </Typography>
                        </div>
                        <IconButton size="small" onClick={() => setReplyTo(null)}>
                            <Delete fontSize="small" />
                        </IconButton>
                    </div>
                )}

                {/* Поле ввода сообщения */}
                <div className="input-area">
                    <IconButton onClick={() => fileInputRef.current?.click()}>
                        <AttachFile />
                    </IconButton>

                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                        multiple={false}
                    />

                    {fileToUpload && (
                        <div className="file-preview-badge">
                            <Typography variant="caption">
                                {fileToUpload.name}
                            </Typography>
                            <IconButton size="small" onClick={() => setFileToUpload(null)}>
                                <Delete fontSize="small" />
                            </IconButton>
                        </div>
                    )}

                    <TextField
                        className="message-input"
                        placeholder="Сообщение..."
                        multiline
                        maxRows={4}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        fullWidth
                        variant="outlined"
                    />

                    {isUploading ? (
                        <CircularProgress size={24} />
                    ) : (
                        <IconButton
                            color="primary"
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() && !fileToUpload}
                        >
                            <Send />
                        </IconButton>
                    )}
                </div>
            </div>

            {/* Меню для сообщений */}
            <Menu
                anchorEl={messageMenuAnchor?.el}
                open={Boolean(messageMenuAnchor)}
                onClose={() => setMessageMenuAnchor(null)}
            >
                <MenuItem onClick={() => messageMenuAnchor && handleReply(messageMenuAnchor.message)}>
                    <Reply fontSize="small" />
                    Ответить
                </MenuItem>
                {messageMenuAnchor?.message.isOwn && (
                    <MenuItem onClick={() => messageMenuAnchor && handleEditMessage(messageMenuAnchor.message.id)}>
                        <Edit fontSize="small" />
                        Редактировать
                    </MenuItem>
                )}
                <MenuItem onClick={() => messageMenuAnchor && handleDeleteMessage(messageMenuAnchor.message.id)}>
                    <Delete fontSize="small" />
                    Удалить
                </MenuItem>
            </Menu>
        </div>
    );
};

export default Kipswift;