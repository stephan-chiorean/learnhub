import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Initialize Postgres pool
export const pool = new Pool({
  user: String(process.env.POSTGRES_USER),
  host: String(process.env.POSTGRES_HOST),
  database: String(process.env.POSTGRES_DB),
  password: String(process.env.POSTGRES_PASSWORD),
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

// Initialize database schema
export const initializeDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
};

// Get code chunks from Postgres
export const getCodeChunks = async (namespace: string) => {
  try {
    const result = await pool.query(
      'SELECT * FROM code_chunks WHERE namespace = $1',
      [namespace]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching code chunks from Postgres:', error);
    return [];
  }
};

// Save code chunks to Postgres
export const saveCodeChunks = async (namespace: string, chunks: any[]) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing chunks for this namespace
    await client.query(
      'DELETE FROM code_chunks WHERE namespace = $1',
      [namespace]
    );

    // Insert new chunks
    for (const chunk of chunks) {
      await client.query(
        `INSERT INTO code_chunks (
          namespace, chunk_id, file_path, file_name, relative_dir, 
          extension, type, text, start_line, end_line, 
          size, is_test_file, zone_guess, function_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          namespace,
          chunk.id,
          chunk.file_path,
          chunk.file_name,
          chunk.relative_dir,
          chunk.extension,
          chunk.type,
          chunk.text,
          chunk.start_line,
          chunk.end_line,
          chunk.size,
          chunk.is_test_file,
          chunk.zone_guess,
          chunk.function_name
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get code chunk summaries from Postgres
export const getCodeChunkSummaries = async (namespace: string) => {
  try {
    const result = await pool.query(
      'SELECT * FROM code_chunk_summaries WHERE namespace = $1',
      [namespace]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching code chunk summaries from Postgres:', error);
    return [];
  }
};

// Save code chunk summaries to Postgres
export const saveCodeChunkSummaries = async (namespace: string, summaries: any[]) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing summaries for this namespace
    await client.query(
      'DELETE FROM code_chunk_summaries WHERE namespace = $1',
      [namespace]
    );

    // Insert new summaries
    for (const summary of summaries) {
      await client.query(
        `INSERT INTO code_chunk_summaries (
          namespace, chunk_id, file_path, file_name, relative_dir,
          extension, type, summary, start_line, end_line, function_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          namespace,
          summary.id,
          summary.filePath,
          summary.fileName,
          summary.relativeDir,
          summary.extension,
          summary.type,
          summary.summary,
          summary.startLine,
          summary.endLine,
          summary.functionName
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}; 