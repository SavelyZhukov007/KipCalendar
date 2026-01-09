import requests
import random
import string
import time
import logging
from faker import Faker
from tqdm import tqdm
import concurrent.futures
import json

# Настройка
API_BASE_URL = 'http://localhost:5000/api'  # URL вашего Flask-backend (измените)
NUM_REQUESTS = 1000  # Количество запросов (увеличьте для "неимоверного" количества)
MAX_WORKERS = 50  # Параллельные потоки (не перегружайте сервер)
fake = Faker()

# Логирование
logging.basicConfig(filename='test_log.txt', level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

# Метрики
metrics = {
    'total_requests': 0,
    'successful': 0,
    'failed': 0,
    'total_time': 0,
    'avg_response_time': 0
}

def generate_random_user():
    """Генерирует случайные данные для регистрации"""
    username = fake.user_name() + ''.join(random.choices(string.digits, k=3))
    email = fake.email()
    password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
    return {'username': username, 'email': email, 'password': password}

def generate_random_code():
    """Генерирует случайный 6-значный код для связывания"""
    return ''.join(random.choices(string.digits, k=6))

def random_request():
    """Выполняет случайный запрос и логирует"""
    start_time = time.time()
    metrics['total_requests'] += 1
    
    try:
        action = random.choice(['register', 'link', 'notifications', 'random_get'])
        
        if action == 'register':
            data = generate_random_user()
            response = requests.post(f'{API_BASE_URL}/register', json=data)
            log_msg = f"Register: {data['username']} - Status: {response.status_code}"
        
        elif action == 'link':
            code = generate_random_code()
            telegram_id = random.randint(100000000, 999999999)  # Случайный TG ID
            response = requests.post(f'{API_BASE_URL}/telegram/link', 
                                     json={'code': code, 'telegram_id': str(telegram_id)})
            log_msg = f"Link: Code {code}, TG_ID {telegram_id} - Status: {response.status_code}"
        
        elif action == 'notifications':
            user_id = ''.join(random.choices(string.digits, k=16))  # Случайный user_id
            response = requests.get(f'{API_BASE_URL}/telegram/notifications/pending/{user_id}')
            log_msg = f"Notifications for {user_id} - Status: {response.status_code}"
        
        else:  # random_get - случайный GET-запрос (например, на несуществующий endpoint)
            endpoint = random.choice(['/users/random', '/events/random'])
            response = requests.get(f'{API_BASE_URL}{endpoint}')
            log_msg = f"Random GET: {endpoint} - Status: {response.status_code}"
        
        elapsed = time.time() - start_time
        metrics['total_time'] += elapsed
        
        if 200 <= response.status_code < 300:
            metrics['successful'] += 1
            logging.info(f"SUCCESS - {log_msg} - Time: {elapsed:.2f}s")
        else:
            metrics['failed'] += 1
            logging.warning(f"FAIL - {log_msg} - Time: {elapsed:.2f}s - Response: {response.text[:100]}")
        
        return True
    except Exception as e:
        elapsed = time.time() - start_time
        metrics['total_time'] += elapsed
        metrics['failed'] += 1
        logging.error(f"ERROR - Action: {action} - Exception: {str(e)} - Time: {elapsed:.2f}s")
        return False

def run_tests():
    """Запускает тесты в параллели"""
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        list(tqdm(executor.map(lambda _: random_request(), range(NUM_REQUESTS)), total=NUM_REQUESTS))
    
    if metrics['total_requests'] > 0:
        metrics['avg_response_time'] = metrics['total_time'] / metrics['total_requests']
    
    logging.info(f"Metrics: {json.dumps(metrics, indent=2)}")
    print("Тестирование завершено. Метрики:")
    print(json.dumps(metrics, indent=2))

if __name__ == '__main__':
    run_tests()