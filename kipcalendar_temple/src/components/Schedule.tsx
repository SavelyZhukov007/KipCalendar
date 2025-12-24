import React, { useState } from 'react';
import Calendar from 'react-calendar'; // Импортируем react-calendar для отображения календаря, как в Dashboard.tsx
import 'react-calendar/dist/Calendar.css'; // Базовые стили для календаря
import { Typography, Container, Box } from '@mui/material'; // Импортируем компоненты из MUI для типографики и контейнеров, аналогично Dashboard.tsx
import { format } from 'date-fns'; // Импортируем date-fns для форматирования дат, как в Dashboard.tsx
import { ru } from 'date-fns/locale'; // Локаль для русского языка
import './Dashboard.css'; // Импортируем стили из Dashboard.css для переиспользования элементов (адаптируем для расписания)
import './DemoStyles.css'; // Импортируем стили из DemoStyles.css для общего дизайна страницы (градиенты, анимации и т.д.)

// Определяем тип для урока (lesson), чтобы сделать код типизированным. Это включает все поля из примера eljur.ru:
// - number: номер урока
// - time: время начала и конца
// - subject: название предмета
// - marks: оценки (массив строк или объектов)
// - homework: домашнее задание
// - cabinet: номер кабинета (добавляем для полноты, хотя в примере не всегда есть)
interface Lesson {
    number: number;
    time: string;
    subject: string;
    marks: { value: string; comment?: string }[]; // Оценки с возможным комментарием
    homework: string;
    cabinet: string;
}

// Определяем тип для дня расписания. Каждый день содержит заголовок и список уроков.
// Это позволяет группировать уроки по дням, как в примере eljur.ru.
interface DaySchedule {
    title: string; // Заголовок дня, например "Понедельник, 17.11"
    lessons: Lesson[]; // Список уроков на этот день
}

// Основной компонент страницы - SchedulePage. Это шаблонная страница, не связанная с backend.
// Мы используем useState для хранения выбранной даты (как в Dashboard.tsx для календаря).
// Фейковые данные заполнены вручную для демонстрации.
const SchedulePage: React.FC = () => {
    // Состояние для выбранной даты. По умолчанию - текущая дата.
    // Это позволяет синхронизировать календарь справа с расписанием слева.
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Фейковые данные для расписания. Здесь мы имитируем расписание на неделю, сгруппированное по дням,
    // как в примере eljur.ru. Данные выдуманы, чтобы страница не выглядела пустой.
    // Для реального приложения это будет загружаться из API.
    const fakeSchedule: DaySchedule[] = [
        {
            title: 'Понедельник, 23.12', // Заголовок дня
            lessons: [
                {
                    number: 1,
                    time: '09:30–10:30',
                    subject: 'Классный час',
                    marks: [], // Нет оценок
                    homework: 'Подготовить доклад о целях на год',
                    cabinet: '101',
                },
                {
                    number: 2,
                    time: '10:40–12:10',
                    subject: 'Иностранный язык в профессиональной деятельности',
                    marks: [{ value: '5' }], // Оценка 5
                    homework: 'Выучить 20 новых слов',
                    cabinet: '205',
                },
                {
                    number: 3,
                    time: '12:50–14:20',
                    subject: 'Психология общения',
                    marks: [],
                    homework: 'Прочитать главу 3',
                    cabinet: '310',
                },
                {
                    number: 4,
                    time: '14:30–16:00',
                    subject: 'История',
                    marks: [],
                    homework: 'Подготовить эссе о Второй мировой войне',
                    cabinet: '112',
                },
                {
                    number: 5,
                    time: '16:10–17:40',
                    subject: 'Основы алгоритмизации и программирования',
                    marks: [{ value: '4', comment: 'Хорошо, но нужно доработать код' }],
                    homework: 'Написать программу на Python',
                    cabinet: 'Lab 1',
                },
            ],
        },
        {
            title: 'Вторник, 24.12',
            lessons: [
                {
                    number: 2,
                    time: '10:40–12:10',
                    subject: 'Психология общения',
                    marks: [],
                    homework: 'Практика ролевых игр',
                    cabinet: '310',
                },
                {
                    number: 3,
                    time: '12:50–14:20',
                    subject: 'Физическая культура',
                    marks: [{ value: '5' }],
                    homework: 'Выполнить комплекс упражнений дома',
                    cabinet: 'Gym',
                },
                {
                    number: 4,
                    time: '14:30–16:00',
                    subject: 'Информационные технологии',
                    marks: [],
                    homework: 'Изучить SQL basics',
                    cabinet: '205',
                },
                {
                    number: 5,
                    time: '16:10–17:40',
                    subject: 'Элементы высшей математики',
                    marks: [{ value: '4' }],
                    homework: 'Решить задачи на пределы',
                    cabinet: '112',
                },
            ],
        },
        {
            title: 'Среда, 25.12',
            lessons: [
                {
                    number: 1,
                    time: '09:00–10:30',
                    subject: 'Дискретная математика с элементами математической логики',
                    marks: [],
                    homework: 'Доказать теоремы',
                    cabinet: '101',
                },
                {
                    number: 2,
                    time: '10:40–12:10',
                    subject: 'Основы алгоритмизации и программирования',
                    marks: [],
                    homework: 'Оптимизировать алгоритм сортировки',
                    cabinet: 'Lab 1',
                },
                {
                    number: 3,
                    time: '12:50–14:20',
                    subject: 'Дискретная математика с элементами математической логики',
                    marks: [{ value: '5' }],
                    homework: 'Построить граф',
                    cabinet: '101',
                },
            ],
        },
        {
            title: 'Четверг, 26.12',
            lessons: [
                {
                    number: 2,
                    time: '10:40–12:10',
                    subject: 'Иностранный язык в профессиональной деятельности',
                    marks: [{ value: '5' }],
                    homework: 'Учить лексику по уроку',
                    cabinet: '205',
                },
                {
                    number: 3,
                    time: '12:50–14:20',
                    subject: 'Элементы высшей математики',
                    marks: [{ value: '5/3' }],
                    homework: 'Решить интегралы',
                    cabinet: '112',
                },
                {
                    number: 4,
                    time: '14:30–16:00',
                    subject: 'Дискретная математика с элементами математической логики',
                    marks: [],
                    homework: 'Анализ логических выражений',
                    cabinet: '101',
                },
                {
                    number: 5,
                    time: '16:10–17:40',
                    subject: 'Дискретная математика с элементами математической логики',
                    marks: [{ value: '5' }],
                    homework: 'Практическая работа',
                    cabinet: '101',
                },
            ],
        },
        {
            title: 'Пятница, 27.12',
            lessons: [
                {
                    number: 2,
                    time: '10:40–12:10',
                    subject: 'История',
                    marks: [],
                    homework: 'Изучить тему "Древний Рим"',
                    cabinet: '112',
                },
                {
                    number: 3,
                    time: '12:50–14:20',
                    subject: 'Основы алгоритмизации и программирования',
                    marks: [],
                    homework: 'Написать функцию рекурсии',
                    cabinet: 'Lab 1',
                },
            ],
        },
        {
            title: 'Суббота, 28.12',
            lessons: [], // Нет занятий
        },
    ];

    // Функция для рендеринга расписания слева. Это адаптировано из Dashboard.tsx (renderDayView),
    // но сделано в стиле eljur.ru: div.dnevnik-day с заголовком и списком уроков.
    // Мы отображаем все дни недели, но фокусируемся на выбранной дате (можно фильтровать по дате в будущем).
    // Каждый урок - div.dnevnik-lesson с номером, временем, предметом, оценками, домашкой и кабинетом.
    const renderSchedule = () => {
        return (
            <div className="dnevnik"> {/* Основной контейнер для расписания, как в eljur */}
                {fakeSchedule.map((day, dayIndex) => (
                    <div key={dayIndex} className="dnevnik-day"> {/* Контейнер для одного дня */}
                        <div className="dnevnik-day__header"> {/* Заголовок дня */}
                            <div className="dnevnik-day__title">{day.title}</div> {/* Текст заголовка */}
                        </div>
                        <div className="dnevnik-day__lessons"> {/* Список уроков */}
                            {day.lessons.length > 0 ? (
                                day.lessons.map((lesson, lessonIndex) => (
                                    <div key={lessonIndex} className="dnevnik-lesson"> {/* Один урок */}
                                        <div className="dnevnik-lesson__number dnevnik-lesson__number--time">
                                            {lesson.number}. {/* Номер урока */}
                                        </div>
                                        <div className="dnevnik-lesson__subject"> {/* Блок с предметом и временем */}
                                            <div className="dnevnik-lesson__time">{lesson.time}</div> {/* Время */}
                                            <span className="js-rt_licey-dnevnik-subject">{lesson.subject}</span> {/* Название предмета */}
                                            <div className="dnevnik-lesson__cabinet">Кабинет: {lesson.cabinet}</div> {/* Добавленный кабинет */}
                                        </div>
                                        <div className="dnevnik-lesson__marks js-rt_licey-dnevnik-marks"> {/* Блок оценок */}
                                            {lesson.marks.map((mark, markIndex) => (
                                                <div key={markIndex} className="dnevnik-mark"> {/* Одна оценка */}
                                                    <div
                                                        className="dnevnik-mark__value"
                                                        data-colorname=""  // Изменено на data-атрибут для соответствия HTML5 и избежания TypeScript ошибок
                                                        data-value={mark.value}  // Изменено на data-атрибут
                                                    >
                                                        {mark.value} {/* Значение оценки */}
                                                        {mark.comment && <span className="dnevnik-mark__comment"> ({mark.comment})</span>} {/* Комментарий, если есть */}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="dnevnik-lesson__hometask"> {/* Домашнее задание */}
                                            <div className="dnevnik-lesson__task">
                                                <i className="dnevnik-lesson-icon"></i> {lesson.homework} {/* Текст домашки */}
                                            </div>
                                        </div>
                                        <div className="dnevnik-lesson__additional"></div> {/* Дополнительный блок, пустой как в примере */}
                                    </div>
                                ))
                            ) : <div className="page-empty">Нет занятий</div>}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Возвращаем JSX страницы. Структура: контейнер с flex, левая часть - расписание, правая - календарь.
    // Используем стили из Dashboard.css для .dashboard-container, .time-grid и т.д., но адаптируем.
    // Календарь справа - уменьшенный react-calendar.
    return (
        <Container className="dashboard-container" style={{ display: 'flex', height: '100vh' }}> {/* Главный контейнер, flex для left/right */}
            <Box flex={3} padding={2} overflow="auto" className="selected-day-events"> {/* Левая часть: расписание, flex=3 для большего размера */}
                <Typography variant="h6" className="events-title"> {/* Заголовок */}
                    Расписание на {format(selectedDate, 'dd.MM.yyyy', { locale: ru })} {/* Форматированная дата */}
                </Typography>
                {renderSchedule()} {/* Рендерим расписание */}
            </Box>
            <Box flex={1} padding={2} className="main-calendar" style={{ maxWidth: '300px' }}> {/* Правая часть: маленький календарь, flex=1 */}
                <Calendar
                    onChange={(value) => setSelectedDate(value as Date)} // Обработчик изменения даты
                    value={selectedDate} // Текущая дата
                    locale="ru-RU" // Русский язык
                    className="main-calendar small-calendar" // Класс для стилей, добавляем small-calendar для уменьшения
                />
            </Box>
        </Container>
    );
};

export default SchedulePage;

// Дополнительные стили: добавьте в Dashboard.css или отдельный файл
// .small-calendar { max-width: 300px; height: auto; } /* Для уменьшения календаря */
// .dnevnik-day { margin-bottom: 20px; border: 1px solid #e8eaed; padding: 10px; border-radius: 8px; } /* Стили для дня */
// .dnevnik-lesson { display: flex; align-items: center; margin-bottom: 10px; } /* Стили для урока */
// .dnevnik-lesson__number { width: 50px; font-weight: bold; } /* Номер урока */
// .dnevnik-lesson__subject { flex: 1; } /* Предмет */
// .dnevnik-lesson__marks { width: 100px; } /* Оценки */
// .dnevnik-lesson__hometask { flex: 1; color: #5f6368; } /* Домашка */
// .dnevnik-lesson__cabinet { font-size: 12px; color: #9aa0a6; } /* Кабинет */