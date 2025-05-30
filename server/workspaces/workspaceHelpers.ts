import axios, { AxiosError } from 'axios';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Pinecone } from '@pinecone-database/pinecone';
import { Pool } from 'pg';
import { getCodeChunks, saveCodeChunks, saveCodeChunkSummaries } from '../db/index.ts';
import cliProgress from 'cli-progress';
import { openai } from '../utils/openai.js';

const execAsync = promisify(exec);

// GitHub API configuration
const GITHUB_API = 'https://api.github.com';
let GITHUB_TOKEN: string;
let PINECONE_API_KEY: string;
let PINECONE_INDEX: string;

// Initialize Pinecone client
let pinecone: Pinecone;

// Common headers for GitHub API requests
let githubHeaders: { [key: string]: string };

// Initialize Postgres pool
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

// Function to initialize environment variables and clients
export const initializeEnvironment = () => {
  const token = process.env.GITHUB_TOKEN;
  const apiKey = process.env.PINECONE_API_KEY;
  const index = process.env.PINECONE_INDEX;

  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  if (!apiKey || !index) {
    throw new Error('PINECONE_API_KEY and PINECONE_INDEX environment variables must be set');
  }

  GITHUB_TOKEN = token;
  PINECONE_API_KEY = apiKey;
  PINECONE_INDEX = index;

  // Initialize Pinecone client
  pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY,
    controllerHostUrl: 'https://api.pinecone.io'
  });

  // Set up GitHub headers
  githubHeaders = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'LearnHub-App',
    'Authorization': `token ${GITHUB_TOKEN}`
  };
};

interface GitHubError {
  status: number;
  message: string;
}

interface GitHubErrorResponse {
  message: string;
  documentation_url?: string;
}

interface TreeItem {
  path: string;
  type: 'blob' | 'tree';
  mode: string;
  sha: string;
  size?: number;
  url: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children?: TreeNode[];
  parentPath?: string;
}

// Helper function to handle GitHub API errors
const handleGitHubError = (error: AxiosError): GitHubError => {
  if (error.response) {
    const data = error.response.data as GitHubErrorResponse;
    
    // Handle rate limiting
    if (error.response.status === 403 && data.message.includes('API rate limit exceeded')) {
      return {
        status: 429,
        message: 'GitHub API rate limit exceeded. Please try again later.'
      };
    }

    // Handle other GitHub API errors
    if (error.response.status === 404) {
      return {
        status: 404,
        message: 'Repository not found. Please check the URL and try again.'
      };
    }

    return {
      status: error.response.status,
      message: data.message || 'GitHub API error'
    };
  }

  // Handle network errors
  if (error.code === 'ECONNREFUSED') {
    return {
      status: 503,
      message: 'Unable to connect to GitHub API. Please try again later.'
    };
  }

  return {
    status: 500,
    message: 'Internal server error'
  };
};

// Helper function to build nested tree structure
const buildNestedTree = (items: TreeItem[]): TreeNode[] => {
  const tree: TreeNode[] = [];
  const pathMap: { [key: string]: TreeNode } = {};

  // First pass: create all nodes
  items.forEach(item => {
    const pathParts = item.path.split('/');
    const name = pathParts[pathParts.length - 1];
    const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : undefined;
    
    const node: TreeNode = {
      name,
      path: item.path,
      type: item.type,
      children: item.type === 'tree' ? [] : undefined,
      parentPath
    };

    pathMap[item.path] = node;
  });

  // Second pass: build hierarchy
  items.forEach(item => {
    const pathParts = item.path.split('/');
    if (pathParts.length === 1) {
      // Root level item
      tree.push(pathMap[item.path]);
    } else {
      // Find parent path
      const parentPath = pathParts.slice(0, -1).join('/');
      const parent = pathMap[parentPath];
      if (parent && parent.children) {
        parent.children.push(pathMap[item.path]);
      }
    }
  });

  return tree;
};

// Helper function to check if namespace exists in Pinecone
export const checkNamespaceExists = async (namespace: string): Promise<boolean> => {
  try {
    const index = pinecone.index(PINECONE_INDEX);
    const stats = await index.describeIndexStats();
    return stats.namespaces ? namespace in stats.namespaces : false;
  } catch (error) {
    console.error('Error checking namespace:', error);
    return false;
  }
};

// Helper function to fetch repository metadata
export const fetchRepoMetadata = async (owner: string, repo: string): Promise<any> => {
  try {
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: githubHeaders
    });
    return response.data;
  } catch (error) {
    throw handleGitHubError(error as AxiosError);
  }
};

// Helper function to fetch repository tree
export const fetchRepoTree = async (owner: string, repo: string, defaultBranch: string): Promise<TreeNode[]> => {
  try {
    const response = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers: githubHeaders
      }
    );
    return buildNestedTree(response.data.tree);
  } catch (error) {
    throw handleGitHubError(error as AxiosError);
  }
};

// Helper function to clone repository
export const cloneRepository = async (owner: string, repo: string, defaultBranch: string, sessionId: string): Promise<string> => {
  const walkthroughDir = path.join('/tmp', 'walkthrough');
  const tempDir = path.join(walkthroughDir, `${owner}_${repo}_${sessionId}`);
  
  try {
    // Create parent walkthrough directory if it doesn't exist
    if (!fs.existsSync(walkthroughDir)) {
      fs.mkdirSync(walkthroughDir, { recursive: true });
    }

    // Clone the repository using public URL
    const cloneUrl = `https://github.com/${owner}/${repo}.git`;
    await execAsync(`git clone --depth=1 --branch=${defaultBranch} ${cloneUrl} ${tempDir}`, {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });

    console.log(`Successfully cloned ${owner}/${repo} to ${tempDir}`);
    return tempDir;
  } catch (error) {
    console.error(`Error cloning repository: ${error}`);
    // Return the temp directory path even if cloning fails
    return tempDir;
  }
};

// Helper function to fetch file content
export const fetchFileContent = async (owner: string, repo: string, filePath: string): Promise<string> => {
  try {
    const response = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`,
      {
        headers: githubHeaders
      }
    );
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  } catch (error) {
    throw handleGitHubError(error as AxiosError);
  }
};

// Helper function to get code chunks from Postgres
export const getCodeChunksFromPostgres = async (namespace: string): Promise<any[]> => {
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

// Helper function to save code chunks to Postgres
export const saveCodeChunksToPostgres = async (namespace: string, chunks: any[]): Promise<void> => {
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
          namespace, id, file_path, file_name, relative_dir, 
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

// Helper function to read code chunks from file
export const readCodeChunksFromFile = async (filePath: string): Promise<any[]> => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading code chunks file:', error);
    return [];
  }
};

// Helper function to format chunk for database
const formatChunkForDatabase = (chunk: any, namespace: string) => {
  const relativePath = chunk.relative_path;
  const pathParts = relativePath.split('/');
  const fileName = pathParts[pathParts.length - 1];
  const relativeDir = pathParts.slice(0, -1).join('/');
  const extension = path.extname(fileName);

  return {
    namespace,
    id: chunk.id,
    file_path: relativePath,
    file_name: fileName,
    relative_dir: relativeDir,
    extension: extension,
    type: chunk.language || 'unknown',
    text: '', // We don't store content in the database
    start_line: chunk.start_line,
    end_line: chunk.end_line,
    size: chunk.size || 0,
    is_test_file: chunk.is_test_file || false,
    zone_guess: chunk.zone_guess || '',
    function_name: chunk.function_name || null
  };
};

// Helper function to chunk repository
export const chunkRepository = async (owner: string, repo: string, sessionId: string): Promise<any[]> => {
  const walkthroughDir = path.join('/tmp', 'walkthrough');
  const repoDir = path.join(walkthroughDir, `${owner}_${repo}_${sessionId}`);
  const outputFile = path.join(walkthroughDir, `${repo}_chunks_${sessionId}.json`);
  const errorFile = path.join(walkthroughDir, `${repo}_errors_${sessionId}.json`);
  const scriptPath = path.join(process.cwd(), '..', 'scripts', 'chunk_repo_unified.py');

  if (!fs.existsSync(repoDir)) {
    throw new Error(`Repository directory not found: ${repoDir}`);
  }

  return new Promise((resolve, reject) => {
    try {
      const pythonProcess = spawn('python3', [scriptPath, repoDir, outputFile, errorFile], {
        env: { ...process.env }
      });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Python process failed with code ${code}`));
          return;
        }

        try {
          if (!fs.existsSync(outputFile)) {
            throw new Error(`Output file not found: ${outputFile}`);
          }

          const codeChunksFile = outputFile.replace('.json', '.code.json');
          
          if (!fs.existsSync(codeChunksFile)) {
            throw new Error(`Code chunks file not found: ${codeChunksFile}`);
          }

          const rawChunks = await readCodeChunksFromFile(codeChunksFile);
          const namespace = `${owner}_${repo}`;
          const formattedChunks = rawChunks.map(chunk => formatChunkForDatabase(chunk, namespace));
          await saveCodeChunks(namespace, formattedChunks);
          
          resolve(formattedChunks);
        } catch (error) {
          reject(error);
        }
      });

      pythonProcess.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

// Helper function to embed and upsert chunks to LanceDB
export const embedAndUpsertChunks = async (
  owner: string, 
  repo: string, 
  sessionId: string,
  onProgress?: (progress: { stage: string; message: string; progress?: number }) => void
): Promise<void> => {
  const walkthroughDir = path.join('/tmp', 'walkthrough');
  const outputFile = path.join(walkthroughDir, `${repo}_chunks_${sessionId}.json`);
  const chunksFile = outputFile.replace('.json', '.code.json');
  const namespace = `${owner}_${repo}`;
  const scriptPath = path.join(process.cwd(), '..', 'scripts', 'embedAndUpsert.cjs');

  if (!fs.existsSync(chunksFile)) {
    throw new Error(`Chunks file not found: ${chunksFile}`);
  }

  return new Promise((resolve, reject) => {
    try {
      const nodeProcess = spawn('node', [scriptPath, chunksFile, namespace], {
        env: { ...process.env }
      });

      nodeProcess.stdout.on('data', (data) => {
        const output = data.toString();
        try {
          const progressEvent = JSON.parse(output);
          if (progressEvent.stage) {
            onProgress?.({
              stage: progressEvent.stage,
              message: progressEvent.message,
              progress: progressEvent.progress
            });
          }
        } catch (e) {
          // Ignore non-JSON output
        }
      });

      nodeProcess.stderr.on('data', (data) => {
        // Only log actual errors
        if (data.toString().includes('error') || data.toString().includes('Error')) {
          console.error('Script error:', data.toString());
        }
      });

      nodeProcess.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Node process exited with code ${code}`));
          return;
        }
        resolve();
      });

      nodeProcess.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

// Helper function to perform intelligent file search
export const intelligentFileSearch = async (
  namespace: string,
  query: string,
  contexts: Array<{ path: string; type: string; start_line?: number; end_line?: number }>,
  pinecone: any
): Promise<Array<{ filePath: string; similarity: number; boost: number }>> => {
  try {
    // Get embedding for the query
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query,
      encoding_format: 'float'
    });

    // Query Pinecone with a larger topK to get more candidates
    const queryResponse = await pinecone.index(process.env.PINECONE_INDEX)
      .namespace(namespace)
      .query({
        vector: embedding.data[0].embedding,
        topK: 50,
        includeMetadata: true,
        includeValues: false
      });

    // Group matches by file path to calculate file-level relevance
    const fileScores = new Map<string, { totalScore: number; count: number; matches: any[] }>();
    
    queryResponse.matches.forEach((match: any) => {
      if (!match.metadata?.filePath) return;
      
      const filePath = match.metadata.filePath;
      const current = fileScores.get(filePath) || { totalScore: 0, count: 0, matches: [] };
      
      current.totalScore += match.score || 0;
      current.count += 1;
      current.matches.push(match);
      fileScores.set(filePath, current);
    });

    // Calculate file-level relevance scores
    const fileRelevance = Array.from(fileScores.entries()).map(([filePath, data]) => ({
      filePath,
      similarity: data.totalScore / data.count,
      matches: data.matches
    }));

    // Apply context-based boosting
    const contextFunctions = contexts.filter(c => c.type === 'function');
    const contextFiles = contexts.filter(c => c.type === 'blob');
    const contextFolders = contexts.filter(c => c.type === 'tree');

    const boostedFiles = fileRelevance.map(file => {
      let boost = 0;
      
      // Check if file is in a context folder - using exact path matching
      if (contextFolders.some(ctx => {
        const normalizedFilePath = file.filePath.replace(/^\/+/, '');
        const normalizedContextPath = ctx.path.replace(/^\/+/, '');
        return normalizedFilePath.startsWith(normalizedContextPath + '/') || 
               normalizedFilePath === normalizedContextPath;
      })) {
        boost += 1;
        console.log(`📈 Boosting file ${file.filePath} due to context folder match`);
      }
      
      // Check if file is directly selected - using exact path matching
      if (contextFiles.some(ctx => {
        const normalizedFilePath = file.filePath.replace(/^\/+/, '');
        const normalizedContextPath = ctx.path.replace(/^\/+/, '');
        return normalizedFilePath === normalizedContextPath;
      })) {
        boost += 2;
        console.log(`📈 Boosting file ${file.filePath} due to direct file match`);
      }
      
      // Check if file contains selected functions - using exact path and line matching
      if (contextFunctions.some(ctx => {
        const startLine = ctx.start_line ?? 0;
        const endLine = ctx.end_line ?? 0;
        const normalizedFilePath = file.filePath.replace(/^\/+/, '');
        const normalizedContextPath = ctx.path.replace(/^\/+/, '');
        const functionMatch = file.matches.find((m: any) => 
          m.metadata.filePath.replace(/^\/+/, '') === normalizedContextPath &&
          m.metadata.startLine <= endLine &&
          m.metadata.endLine >= startLine
        );
        if (functionMatch) {
          console.log(`📈 Boosting file ${file.filePath} due to function match`);
        }
        return functionMatch;
      })) {
        boost += 3;
      }

      // Calculate final score with reduced boost impact
      const finalScore = file.similarity * (1 + (boost * 0.1)); // Reduced to 10% boost per level

      return {
        filePath: file.filePath,
        similarity: finalScore,
        boost
      };
    });

    // Sort by final score and return top results
    return boostedFiles
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  } catch (error) {
    console.error('Error in intelligent file search:', error);
    return [];
  }
}; 