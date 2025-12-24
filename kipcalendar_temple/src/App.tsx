import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Home from './components/Home';
import Register from './components/Register';
import Login from './components/Login';
import Success from './components/Success';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import SchedulePage from './components/Schedule';
import './App.css';

const theme = createTheme();

type BackendContextType = {
  isBackendConnected: boolean;
};

const BackendContext = createContext<BackendContextType | undefined>(undefined);

function App() {
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://127.0.0.1:5000/health');
        setIsBackendConnected(res.ok);
      } catch {
        setIsBackendConnected(false);
      }
    };

    checkBackend();
    const interval = setInterval(() => {
      if (!isBackendConnected) checkBackend();
    }, 5000);

    return () => clearInterval(interval);
  }, [isBackendConnected]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BackendContext.Provider value={{ isBackendConnected }}>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} /> {/* Выбор вход/регистрация */}
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/success" element={<Success />} />
            <Route path="/dashboard" element={<Dashboard />} /> {/* Календарь */}
            <Route path="/profile" element={<Profile />} /> {/* Новый профиль */}
            <Route path="/schedule" element={<SchedulePage />} /> {/* Расписание */}
            </Routes>
        </Router>
      </BackendContext.Provider>
    </ThemeProvider>
  );
}

export default App;

export const useBackendStatus = () => {
  const context = useContext(BackendContext);
  if (context === undefined) {
    throw new Error('useBackendStatus must be used within BackendProvider');
  }
  return context;
};