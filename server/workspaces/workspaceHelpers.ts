import axios, { AxiosError } from 'axios';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Pinecone } from '@pinecone-database/pinecone';
import { Pool } from 'pg';
import { getCodeChunks, saveCodeChunks } from '../db/index.ts';
import cliProgress from 'cli-progress';

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

// Helper function to chunk repository
export const chunkRepository = async (owner: string, repo: string, sessionId: string): Promise<any[]> => {
  const walkthroughDir = path.join('/tmp', 'walkthrough');
  const repoDir = path.join(walkthroughDir, `${owner}_${repo}_${sessionId}`);
  const outputFile = path.join(walkthroughDir, `${repo}_chunks_${sessionId}.json`);
  const errorFile = path.join(walkthroughDir, `${repo}_errors_${sessionId}.json`);
  const scriptPath = path.join(process.cwd(), '..', 'scripts', 'chunk_repo_unified.py');

  return new Promise((resolve, reject) => {
    try {
      // Spawn the Python process
      const pythonProcess = spawn('python3', [scriptPath, repoDir, outputFile, errorFile], {
        env: { ...process.env }
      });

      // Handle stdout
      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // Forward the output to console
        process.stdout.write(output);
      });

      // Handle stderr
      pythonProcess.stderr.on('data', (data) => {
        const error = data.toString();
        // Forward the error to console
        process.stderr.write(error);
      });

      // Handle process completion
      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}`));
          return;
        }

        try {
          // Read and return the code chunks
          const codeChunksFile = outputFile.replace('.json', '.code.json');
          const chunks = await readCodeChunksFromFile(codeChunksFile);
          
          // Save chunks to database
          const namespace = `${owner}_${repo}`;
          await saveCodeChunks(namespace, chunks);
          
          resolve(chunks);
        } catch (error) {
          reject(error);
        }
      });

      // Handle process errors
      pythonProcess.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

// Helper function to embed and upsert chunks to Pinecone
export const embedAndUpsertChunks = async (owner: string, repo: string, sessionId: string): Promise<void> => {
  const walkthroughDir = path.join('/tmp', 'walkthrough');
  const chunksFile = path.join(walkthroughDir, `${repo}_chunks_${sessionId}.code.json`);
  const summariesFile = path.join(walkthroughDir, `${repo}_summaries_${sessionId}.json`);
  const namespace = `${owner}_${repo}`;
  const scriptPath = path.join(process.cwd(), '..', 'scripts', 'embedAndUpsert.cjs');

  return new Promise((resolve, reject) => {
    try {
      // Create progress bars
      const multibar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: '{bar} | {stage} | {value}/{total} | {percentage}%',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        stopOnComplete: true
      });

      // Create bars for each stage
      const processingBar = multibar.create(100, 0, { stage: 'Processing' });
      const embeddingBar = multibar.create(100, 0, { stage: 'Embedding' });
      const upsertingBar = multibar.create(100, 0, { stage: 'Upserting' });

      // Spawn the Node.js process
      const nodeProcess = spawn('node', [scriptPath, chunksFile, summariesFile, namespace], {
        env: { ...process.env }
      });

      // Handle stdout
      nodeProcess.stdout.on('data', (data) => {
        const output = data.toString();
        try {
          // Try to parse as JSON for structured progress events
          const progressEvent = JSON.parse(output);
          if (progressEvent.stage === 'processing') {
            processingBar.update(Math.round(progressEvent.progress || 0));
          } else if (progressEvent.stage === 'embedding') {
            embeddingBar.update(Math.round(progressEvent.progress || 0));
          } else if (progressEvent.stage === 'upserting') {
            upsertingBar.update(Math.round(progressEvent.progress || 0));
          } else if (progressEvent.stage === 'complete') {
            multibar.stop();
            console.log(`\n✅ ${progressEvent.message}`);
          } else if (progressEvent.stage === 'error') {
            multibar.stop();
            console.error(`\n❌ ${progressEvent.message}`);
          } else {
            // For other events, just log the message
            console.log(output);
          }
        } catch (e) {
          // If not JSON, just output as is
          console.log(output);
        }
      });

      // Handle stderr
      nodeProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error(error);
      });

      // Handle process completion
      nodeProcess.on('close', (code) => {
        if (code !== 0) {
          multibar.stop();
          reject(new Error(`Node process exited with code ${code}`));
          return;
        }
        resolve();
      });

      // Handle process errors
      nodeProcess.on('error', (error) => {
        multibar.stop();
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
}; 