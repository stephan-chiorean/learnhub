import axios, { AxiosError } from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Pinecone } from '@pinecone-database/pinecone';

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

// Helper function to chunk repository
export const chunkRepository = async (owner: string, repo: string, sessionId: string): Promise<void> => {
  const walkthroughDir = path.join('/tmp', 'walkthrough');
  const repoDir = path.join(walkthroughDir, `${owner}_${repo}_${sessionId}`);
  const outputFile = path.join(walkthroughDir, `${repo}_chunks_${sessionId}.json`);
  const errorFile = path.join(walkthroughDir, `${repo}_errors_${sessionId}.json`);
  const scriptPath = path.join(process.cwd(), '..', 'scripts', 'chunkRepo.cjs');

  try {
    // Run the chunkRepo script with the dynamic paths
    await execAsync(`node "${scriptPath}" "${repoDir}" "${outputFile}" "${errorFile}"`, {
      env: { ...process.env }
    });

    console.log(`Successfully chunked repository ${owner}/${repo}`);
  } catch (error) {
    console.error(`Error chunking repository: ${error}`);
    throw error;
  }
};

// Helper function to embed and upsert chunks to Pinecone
export const embedAndUpsertChunks = async (owner: string, repo: string, sessionId: string): Promise<void> => {
  const walkthroughDir = path.join('/tmp', 'walkthrough');
  const chunksFile = path.join(walkthroughDir, `${repo}_chunks_${sessionId}.json`);
  const namespace = `${owner}_${repo}`;
  const scriptPath = path.join(process.cwd(), '..', 'scripts', 'embedAndUpsert.cjs');

  try {
    // Run the embedAndUpsert script with the dynamic paths
    await execAsync(`node "${scriptPath}" "${chunksFile}" "${namespace}"`, {
      env: { ...process.env }
    });

    console.log(`Successfully embedded and upserted chunks for ${owner}/${repo}`);
  } catch (error) {
    console.error(`Error embedding and upserting chunks: ${error}`);
    throw error;
  }
}; 