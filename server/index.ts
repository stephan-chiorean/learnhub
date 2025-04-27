import express, { Request, Response } from 'express';
import cors from 'cors';
import axios, { AxiosError } from 'axios';

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// GitHub API base URL
const GITHUB_API = 'https://api.github.com';

interface GitHubError {
  status: number;
  message: string;
}

interface GitHubErrorResponse {
  message: string;
}

// Helper function to handle GitHub API errors
const handleGitHubError = (error: AxiosError): GitHubError => {
  if (error.response) {
    const data = error.response.data as GitHubErrorResponse;
    return {
      status: error.response.status,
      message: data.message || 'GitHub API error'
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

    // Fetch repo metadata
    const repoResponse = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}`);
    const repoData = repoResponse.data;

    // Fetch default branch (usually 'main')
    const defaultBranch = repoData.default_branch;

    // Fetch directory tree
    const treeResponse = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`
    );
    const treeData = treeResponse.data;

    res.json({
      metadata: {
        name: repoData.name,
        description: repoData.description,
        defaultBranch,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
      },
      directoryTree: treeData.tree
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

    // Fetch file content
    const response = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`
    );

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