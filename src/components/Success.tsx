import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Success.css';

interface TutorialStep {
    id: number;
    icon: string;
    title: string;
    description: string;
    details: string[];
    color: string;
}

const Success: React.FC = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [showCheckmark, setShowCheckmark] = useState(true);
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
        // Галочка появляется сразу, затем подмигивает и исчезает
        const checkmarkTimer = setTimeout(() => {
            setShowCheckmark(false);
            // После исчезновения галочки показываем туториал
            setTimeout(() => {
                setShowTutorial(true);
            }, 500);
        }, 2000); // Галочка показывается 2 секунды с анимацией подмигивания
        
        return () => clearTimeout(checkmarkTimer);
    }, []);

    const tutorialSteps: TutorialStep[] = [
        {
            id: 1,
            icon: '🔐',
            title: 'Вход в систему',
            description: 'Войдите в свой аккаунт',
            details: [
                'Используйте логин и пароль, которые вы указали при регистрации',
                'После успешного входа вы попадете в главное меню приложения',
                'Ваши данные будут сохранены для быстрого доступа'
            ],
            color: '#007bff'
        },
        {
            id: 2,
            icon: '📅',
            title: 'Работа с календарем',
            description: 'Создавайте и управляйте событиями',
            details: [
                'Нажмите на дату в календаре, чтобы создать новое событие',
                'Выберите тип события: лекция, практика, экзамен или другое',
                'Установите время начала и окончания события',
                'Добавьте описание и дополнительные детали'
            ],
            color: '#00c853'
        },
        {
            id: 3,
            icon: '👤',
            title: 'Настройка профиля',
            description: 'Выберите свою роль в системе',
            details: [
                'Перейдите в раздел "Профиль" из главного меню',
                'Выберите роль: Студент, Преподаватель или Администратор',
                'Каждая роль имеет свои особенности и возможности',
                'Вы можете изменить роль в любое время'
            ],
            color: '#9c27b0'
        },
        {
            id: 4,
            icon: '🔗',
            title: 'Совместная работа',
            description: 'Делитесь событиями с другими',
            details: [
                'Вы можете поделиться событием с другими пользователями',
                'Настройте права доступа: просмотр, редактирование, комментарии',
                'Получайте уведомления о приглашениях к событиям',
                'Принимайте или отклоняйте приглашения'
            ],
            color: '#ff9800'
        },
        {
            id: 5,
            icon: '🔍',
            title: 'Поиск и фильтрация',
            description: 'Найдите нужные события быстро',
            details: [
                'Используйте фильтры для поиска событий по типу',
                'Фильтруйте по дате начала и окончания',
                'Ищите события по имени пользователя',
                'Просматривайте все события или только ваши'
            ],
            color: '#e91e63'
        },
        {
            id: 6,
            icon: '✅',
            title: 'Готово к использованию!',
            description: 'Начните работу с KipCalendar',
            details: [
                'Теперь вы знаете основы работы с приложением',
                'Войдите в систему и начните создавать события',
                'При необходимости вы всегда можете вернуться к этому руководству',
                'Приятной работы!'
            ],
            color: '#4caf50'
        }
    ];

    const nextStep = () => {
        if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const goToStep = (stepIndex: number) => {
        setCurrentStep(stepIndex);
    };

    const currentStepData = tutorialSteps[currentStep];
    const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

    return (
        <div className="success-container" style={{ '--current-step-color': currentStepData.color } as React.CSSProperties}>
            <div className="success-background">
                {/* Анимация успеха - галочка посередине экрана */}
                {showCheckmark && (
                    <div className="success-checkmark-overlay">
                        <div className="success-checkmark-center">
                            <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Основной контент туториала */}
                {showTutorial && (
                    <div className="tutorial-content">
                        {/* Шаги навигации - теперь фон-прогресс бар */}
                        <div className="tutorial-steps-nav">
                            {tutorialSteps.map((step, index) => (
                                <div
                                    key={step.id}
                                    className={`step-indicator ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                                    onClick={() => goToStep(index)}
                                    style={{
                                        '--step-color': step.color,
                                        '--step-progress': index < currentStep ? 100 : (index === currentStep ? progress : 0)
                                    } as React.CSSProperties}
                                >
                                    <div className="step-number">
                                        {index < currentStep ? '✓' : index + 1}
                                    </div>
                                    <div className="step-label">{step.title}</div>
                                </div>
                            ))}
                        </div>

                    {/* Текущий шаг */}
                    <div className="tutorial-step-card" style={{ '--step-color': currentStepData.color } as React.CSSProperties}>
                        <div className="step-card-header">
                            <div className="step-icon" style={{ backgroundColor: currentStepData.color }}>
                                {currentStepData.icon}
                            </div>
                            <div className="step-header-text">
                                <h2 className="step-card-title">{currentStepData.title}</h2>
                                <p className="step-card-description">{currentStepData.description}</p>
                            </div>
                        </div>
                        <div className="step-card-body">
                            <ul className="step-details-list">
                                {currentStepData.details.map((detail, index) => (
                                    <li 
                                        key={index} 
                                        className="step-detail-item"
                                        style={{ '--index': index } as React.CSSProperties}
                                    >
                                        <span className="detail-icon">→</span>
                                        <span>{detail}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Навигация */}
                    <div className="tutorial-navigation">
                        <button
                            className="nav-btn nav-btn-prev"
                            onClick={prevStep}
                            disabled={currentStep === 0}
                        >
                            ← Назад
                        </button>
                        <div className="step-dots">
                            {tutorialSteps.map((_, index) => (
                                <button
                                    key={index}
                                    className={`step-dot ${index === currentStep ? 'active' : ''}`}
                                    onClick={() => goToStep(index)}
                                    style={{
                                        backgroundColor: index === currentStep ? currentStepData.color : '#ddd'
                                    }}
                                />
                            ))}
                        </div>
                        {currentStep < tutorialSteps.length - 1 ? (
                            <button
                                className="nav-btn nav-btn-next"
                                onClick={nextStep}
                                style={{ backgroundColor: currentStepData.color }}
                            >
                                Далее →
                            </button>
                        ) : (
                            <button
                                className="nav-btn nav-btn-finish"
                                onClick={() => navigate('/login')}
                                style={{ backgroundColor: currentStepData.color }}
                            >
                                Начать работу →
                            </button>
                        )}
                    </div>

                        {/* Кнопки действий */}
                        <div className="success-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => navigate('/')}
                            >
                                Вернуться в приложение
                            </button>
                            <button
                                className="btn-auth"
                                onClick={() => navigate('/login')}
                            >
                                Войти / Зарегистрироваться / Запустить туториал
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Success;
