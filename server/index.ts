import express, { Request, Response } from 'express';
import cors from 'cors';
import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';

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

    res.json({
      metadata: {
        name: repoData.name,
        description: repoData.description,
        defaultBranch,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
      },
      directoryTree: treeResponse.data.tree
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 