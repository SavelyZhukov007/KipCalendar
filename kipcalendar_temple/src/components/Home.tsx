import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');

        if (token) {
            // Проверяем валидность токена
            fetch('http://localhost:5000/me', {
                headers: { 'Authorization': token }
            })
                .then(res => {
                    if (res.ok) {
                        navigate('/dashboard', { replace: true });
                    } else {
                        localStorage.removeItem('token');
                        navigate('/login', { replace: true });
                    }
                })
                .catch(() => {
                    navigate('/login', { replace: true });
                });
        } else {
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    return null;
};

export default Home;