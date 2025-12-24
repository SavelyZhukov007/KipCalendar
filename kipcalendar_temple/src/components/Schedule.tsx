import React, { useState } from 'react';
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

  // Фейковые данные с полными датами (используем текущий год для простоты, или укажите нужный)
  const fakeSchedule: DaySchedule[] = [
    {
      date: parse('2023-12-23', 'yyyy-MM-dd', new Date()), // Полная дата
      title: 'Понедельник, 23.12',
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
      date: parse('2023-12-24', 'yyyy-MM-dd', new Date()),
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
      date: parse('2023-12-25', 'yyyy-MM-dd', new Date()),
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
      date: parse('2023-12-26', 'yyyy-MM-dd', new Date()),
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
      date: parse('2023-12-27', 'yyyy-MM-dd', new Date()),
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
      date: parse('2023-12-28', 'yyyy-MM-dd', new Date()),
      title: 'Суббота, 28.12',
      lessons: [], // Нет занятий
    },
  ];

  // Фильтруем расписание по выбранной дате
  const filteredSchedule = fakeSchedule.find((day) =>
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
      <Box flex={3} padding={2} overflow="auto" className="selected-day-events">
        <Typography variant="h6" className="events-title">
          Расписание на {format(selectedDate, 'dd.MM.yyyy', { locale: ru })}
        </Typography>
        <div className="dnevnik">
          {renderSchedule(filteredSchedule)}
        </div>
      </Box>
      <Box flex={1} padding={2} className="main-calendar" style={{ maxWidth: '300px' }}>
        <Calendar
          onChange={(value) => setSelectedDate(value as Date)}
          value={selectedDate}
          locale="ru-RU"
          className="main-calendar small-calendar"
        />
      </Box>
    </Container>
  );
};

export default SchedulePage;