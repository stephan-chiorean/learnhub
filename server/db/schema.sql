CREATE TABLE IF NOT EXISTS code_chunks (
    id SERIAL PRIMARY KEY,
    namespace VARCHAR(255) NOT NULL,
    chunk_id VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    relative_dir TEXT NOT NULL,
    extension VARCHAR(50),
    type VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    start_line INTEGER,
    end_line INTEGER,
    size INTEGER,
    is_test_file BOOLEAN,
    zone_guess TEXT,
    function_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(namespace, chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_code_chunks_namespace ON code_chunks(namespace); 