// src/components/Home.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Моментальное перенаправление на страницу входа
        navigate('/login', { replace: true });
    }, [navigate]);

    return null;
};

export default Home;