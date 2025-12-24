import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Typography, TextField, Button, List, ListItem, ListItemText, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReactMarkdown from 'react-markdown';

const EventView: React.FC = () => {
  const { username, type, name } = useParams<{ username: string; type: string; name: string }>();
  const [event, setEvent] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [showPrompt, setShowPrompt] = useState(type === 'private');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvent = async () => {
      const token = localStorage.getItem('token');
      let url = `http://localhost:5000/event/${username}/${type}/${name}`;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = token;
      if (type === 'private' && password) url += `?password=${password}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
        setShowPrompt(false);
        // Fetch history and comments if applicable
        if (data.shared) {
          const hRes = await fetch(`http://localhost:5000/api/events/${data.id}/history`, { headers });
          if (hRes.ok) setHistory(await hRes.json());
          const cRes = await fetch(`http://localhost:5000/api/events/${data.id}/comments`, { headers });
          if (cRes.ok) setComments(await cRes.json());
        }
      } else if (res.status === 401) {
        setError('Требуется вход');
        navigate('/');
      } else if (res.status === 403) {
        setError('Неверный пароль');
      } else {
        setError('Что-то пошло не так');
      }
    };
    if (!showPrompt) fetchEvent();
  }, [showPrompt, password, username, type, name, navigate]);

  const handleAddComment = async () => {
    const token = localStorage.getItem('token');
    if (!token || !event) return;
    const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': token };
    const res = await fetch(`http://localhost:5000/api/events/${event.id}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: newComment })
    });
    if (res.ok) {
      setComments([...comments, await res.json()]);
      setNewComment('');
    }
  };

  if (error) return <Container><Typography>{error}</Typography></Container>;

  if (showPrompt) {
    return (
      <Container>
        <Typography>Введите пароль для приватного события</Typography>
        <TextField type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth />
        <Button onClick={() => setShowPrompt(false)}>Отправить</Button>
      </Container>
    );
  }

  return (
    <Container>
      {event ? (
        <>
          <Typography variant="h4">{event.title}</Typography>
          <Typography>Тип: {event.eventType}</Typography>
          <Typography>Дата: {event.date}</Typography>
          <Typography>Время: {event.time}</Typography>
          {event.endDate && <Typography>Дата окончания: {event.endDate}</Typography>}
          {event.endTime && <Typography>Время окончания: {event.endTime}</Typography>}
          {event.eventType === 'plan' && (
            <>
              <Typography>Содержание:</Typography>
              <ReactMarkdown>{event.content}</ReactMarkdown>
              {event.recurringOptions && (
                <Typography>Повторения: {JSON.stringify(event.recurringOptions)}</Typography>
              )}
            </>
          )}
          {event.eventType === 'task' && event.subTasks && (
            <List>
              {event.subTasks.map((sub: any, i: number) => (
                <ListItem key={i}>
                  <ListItemText primary={sub.name} secondary={`${sub.description} - ${sub.deadline} - ${sub.priority} - ${sub.status}`} />
                </ListItem>
              ))}
            </List>
          )}
          <Typography>Описание: {event.description}</Typography>
          {event.shared && (
            <>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>История изменений</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {history.map((h: any, i: number) => (
                      <ListItem key={i}>
                        <ListItemText primary={`${h.user} изменил ${h.field} на ${h.newValue} в ${h.timestamp}`} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
              {event.allowComments && (
                <div>
                  <Typography>Комментарии</Typography>
                  <List>
                    {comments.map((c: any, i: number) => (
                      <ListItem key={i}>
                        <ListItemText primary={c.content} secondary={`${c.user} - ${c.timestamp}`} />
                      </ListItem>
                    ))}
                  </List>
                  <TextField value={newComment} onChange={e => setNewComment(e.target.value)} fullWidth label="Новый комментарий" />
                  <Button onClick={handleAddComment}>Добавить</Button>
                </div>
              )}
            </>
          )}
        </>
      ) : <Typography>Загрузка...</Typography>}
    </Container>
  );
};

export default EventView;