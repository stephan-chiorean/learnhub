import express, { Request, Response } from 'express';
import cors from 'cors';
import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: '../.env' });

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// GitHub API configuration
const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is not set');
  process.exit(1);
}

// Common headers for GitHub API requests
const githubHeaders = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'LearnHub-App',
  'Authorization': `token ${GITHUB_TOKEN}`
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
    
    const node: TreeNode = {
      name,
      path: item.path,
      type: item.type,
      children: item.type === 'tree' ? [] : undefined
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const execAsync = promisify(exec);

// POST /api/createWorkspace
app.post('/api/createWorkspace', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Owner and repo are required' });
    }

    // Fetch repo metadata with error handling
    let repoResponse;
    try {
      repoResponse = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, {
        headers: githubHeaders
      });
    } catch (error) {
      const { status, message } = handleGitHubError(error as AxiosError);
      return res.status(status).json({ error: message });
    }

    const repoData = repoResponse.data;
    const defaultBranch = repoData.default_branch;

    // Fetch directory tree with error handling
    let treeResponse;
    try {
      treeResponse = await axios.get(
        `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        {
          headers: githubHeaders
        }
      );
    } catch (error) {
      const { status, message } = handleGitHubError(error as AxiosError);
      return res.status(status).json({ error: message });
    }

    // Transform flat tree into nested structure
    const nestedTree = buildNestedTree(treeResponse.data.tree);

    // Generate unique session ID and create temp directory path
    const sessionId = randomUUID();
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
    } catch (error) {
      console.error(`Error cloning repository: ${error}`);
      // Don't fail the request if cloning fails, just log the error
    }

    res.json({
      metadata: {
        name: repoData.name,
        description: repoData.description,
        defaultBranch,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
      },
      directoryTree: nestedTree,
      clonedPath: tempDir
    });
  } catch (error) {
    const { status, message } = handleGitHubError(error as AxiosError);
    res.status(status).json({ error: message });
  }
});

// GET /api/fileContent
app.get('/api/fileContent', async (req: Request, res: Response) => {
  try {
    const { owner, repo, path } = req.query;

    if (!owner || !repo || !path) {
      return res.status(400).json({ error: 'Owner, repo, and path are required' });
    }

    // Fetch file content with error handling
    let response;
    try {
      response = await axios.get(
        `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: githubHeaders
        }
      );
    } catch (error) {
      const { status, message } = handleGitHubError(error as AxiosError);
      return res.status(status).json({ error: message });
    }

    // Decode base64 content
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

    res.json({ content });
  } catch (error) {
    const { status, message } = handleGitHubError(error as AxiosError);
    res.status(status).json({ error: message });
  }
});

// POST /api/generateSummary
app.post('/api/generateSummary', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ error: 'Valid code content is required' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `
            You are a professional technical writer. Your job is to analyze code and return a JSON summary with the following structure:
            {
              "title": string, // A concise title for the code
              "mainPurpose": string, // One paragraph summarizing the code's primary goal
              "keyComponents": [
                {"name": string, "description": string}, // Each key component and a short description
                ...
              ],
              "overallStructure": string // One paragraph summarizing the overall flow and organization
            }
            - Do NOT include any Markdown or code fences in your response.
            - Only output valid JSON, nothing else.
            - Do not add explanations or extra text.
            - Use plain English, not Markdown.
          `.trim()
        },
        {
          role: "user",
          content: `Summarize this code as JSON:\n\n${code}`
        }
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    let summaryJson = completion.choices[0]?.message?.content?.trim();
    if (!summaryJson) {
      return res.status(500).json({ error: 'Failed to generate summary' });
    }

    // Try to parse the JSON
    try {
      summaryJson = JSON.parse(summaryJson);
    } catch (e) {
      // Try to fix common issues (e.g., code block wrappers)
      summaryJson = (summaryJson || '').replace(/^[^\{]*({[\s\S]*})[^\}]*$/m, '$1');
      try {
        summaryJson = JSON.parse(summaryJson);
      } catch (e2) {
        return res.status(500).json({ error: 'Failed to parse summary JSON', raw: completion.choices[0]?.message?.content });
      }
    }

    res.json({ summary: summaryJson });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 