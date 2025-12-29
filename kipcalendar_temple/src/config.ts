export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
export const WS_URL = process.env.REACT_APP_WS_URL || 'http://127.0.0.1:5000';

export const config = {
    apiBaseUrl: API_BASE_URL,
    wsUrl: WS_URL,
    jwtTokenKey: 'token',
    userIdKey: 'user_id',
};

export default config;