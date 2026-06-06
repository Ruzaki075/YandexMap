ALTER USER postgres WITH PASSWORD 'Chernig007or';

SELECT 'CREATE DATABASE yandexmap'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yandexmap')\gexec
