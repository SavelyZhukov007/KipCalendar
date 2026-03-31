// Schedule.tsx
import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Typography, Container, Box } from '@mui/material';
import { format, isSameDay, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import './Schedule.css'; // Предполагаем, что CSS файл переименован или исправлен

interface Lesson {
    number: number;
    time: string;
    subject: string;
    marks: { value: string; comment?: string }[]; // Оценки с возможным комментарием
    homework: string;
    cabinet: string;
}

interface DaySchedule {
    date: Date; // Полная дата для фильтрации
    title: string; // Заголовок дня, например "Понедельник, 23.12"
    lessons: Lesson[]; // Список уроков на этот день
}

const SchedulePage: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [schedule, setSchedule] = useState<DaySchedule[]>([]);

    useEffect(() => {
        const fetchEvents = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login';
                return;
            }

            try {
                const res = await fetch('http://127.0.0.1:5000/events', {
                    headers: {
                        Authorization: token,
                    },
                });

                if (res.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                    return;
                }

                if (!res.ok) {
                    throw new Error('Failed to fetch events');
                }

                const data = await res.json();

                // Group events by date
                const grouped: { [key: string]: any[] } = data.reduce((acc: { [key: string]: any[] }, ev: any) => {
                    const dateStr = ev.date;
                    if (!acc[dateStr]) acc[dateStr] = [];
                    acc[dateStr].push(ev);
                    return acc;
                }, {});

                // Create DaySchedule array
                const newSchedule: DaySchedule[] = Object.keys(grouped).map(dateStr => {
                    let date: Date;
                    try {
                        date = parse(dateStr, 'yyyy-MM-dd', new Date());
                    } catch {
                        return null; // Skip invalid dates
                    }

                    const title = format(date, 'EEEE, dd.MM', { locale: ru });

                    const lessons: Lesson[] = grouped[dateStr]
                        .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
                        .map((ev, idx) => ({
                            number: idx + 1,
                            time: `${ev.time || ''}${ev.end_time ? `–${ev.end_time}` : ''}`,
                            subject: ev.title,
                            marks: [], // No marks in DB
                            homework: ev.description || ev.content || (ev.subtasks ? JSON.parse(ev.subtasks).map((st: any) => st.name).join(', ') : ''),
                            cabinet: ev.event_type || 'Unknown',
                        }));

                    return { date, title, lessons };
                }).filter(Boolean) as DaySchedule[];

                // Sort by date
                newSchedule.sort((a, b) => a.date.getTime() - b.date.getTime());

                setSchedule(newSchedule);
            } catch (error) {
                console.error('Error fetching events:', error);
            }
        };

        fetchEvents();
    }, []);

    // Фильтруем расписание по выбранной дате
    const filteredSchedule = schedule.find((day) =>
        isSameDay(day.date, selectedDate)
    );

    const renderSchedule = (day: DaySchedule | undefined) => {
        if (!day || day.lessons.length === 0) {
            return <div className="page-empty">Нет занятий</div>;
        }

        return (
            <div className="dnevnik-day">
                <div className="dnevnik-day__header">
                    <div className="dnevnik-day__title">{day.title}</div>
                </div>
                <div className="dnevnik-day__lessons">
                    {day.lessons.map((lesson, lessonIndex) => (
                        <div key={lessonIndex} className="dnevnik-lesson">
                            <div className="dnevnik-lesson__number dnevnik-lesson__number--time">
                                {lesson.number}.
                            </div>
                            <div className="dnevnik-lesson__subject">
                                <div className="dnevnik-lesson__time">{lesson.time}</div>
                                <span className="js-rt_licey-dnevnik-subject">{lesson.subject}</span>
                                <div className="dnevnik-lesson__cabinet">Кабинет: {lesson.cabinet}</div>
                            </div>
                            <div className="dnevnik-lesson__marks js-rt_licey-dnevnik-marks">
                                {lesson.marks.map((mark, markIndex) => (
                                    <div key={markIndex} className="dnevnik-mark">
                                        <div
                                            className="dnevnik-mark__value"
                                            data-colorname="" // Для стилей
                                            data-value={mark.value}
                                        >
                                            {mark.value}
                                            {mark.comment && <span className="dnevnik-mark__comment"> ({mark.comment})</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="dnevnik-lesson__hometask">
                                <div className="dnevnik-lesson__task">
                                    <i className="dnevnik-lesson-icon"></i> {lesson.homework}
                                </div>
                            </div>
                            <div className="dnevnik-lesson__additional"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Container className="dashboard-container" style={{ display: 'flex', height: '100vh' }}>
            <input type="checkbox" id="calendar-toggle" className="calendar-toggle" />
            <label htmlFor="calendar-toggle" className="calendar-label">Календарь</label>
            <Box flex={1} padding={2} className="main-calendar" style={{ maxWidth: '300px' }}>
                <Calendar
                    onChange={(value) => setSelectedDate(value as Date)}
                    value={selectedDate}
                    locale="ru-RU"
                    className="main-calendar small-calendar"
                />
            </Box>
            <Box flex={3} padding={2} overflow="auto" className="selected-day-events">
                <Typography variant="h6" className="events-title">
                    Расписание на {format(selectedDate, 'dd.MM.yyyy', { locale: ru })}
                </Typography>
                <div className="dnevnik">
                    {renderSchedule(filteredSchedule)}
                </div>
            </Box>
        </Container>
    );
};

export default SchedulePage;