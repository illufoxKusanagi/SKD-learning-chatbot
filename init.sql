-- Enable pgvector extension in default postgres database
CREATE EXTENSION IF NOT EXISTS vector;

-- Also enable in the application database (runs after POSTGRES_DB is created)
\connect chatbot-main_db
CREATE EXTENSION IF NOT EXISTS vector;