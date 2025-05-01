import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { 
  fetchRepoMetadata, 
  fetchRepoTree, 
  cloneRepository, 
  fetchFileContent, 
  checkNamespaceExists, 
  chunkRepository,
  embedAndUpsertChunks,
  initializeEnvironment 
} from './workspaces/workspaceHelpers.ts';

dotenv.config({ path: '../.env' });
initializeEnvironment();

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/createWorkspace
app.post('/api/createWorkspace', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Owner and repo are required' });
    }

    // Generate unique session ID
    const sessionId = randomUUID();
    const namespace = `${owner}_${repo}`;

    // Check if namespace exists in Pinecone
    // TODO: Implement codebase update check
    const namespaceExists = await checkNamespaceExists(namespace);
    let tempDir: string | null = null;

    // Fetch repository metadata
    const repoData = await fetchRepoMetadata(owner, repo);
    const defaultBranch = repoData.default_branch;

    // Only embed codebase if namespace doesn't already exist
    if (!namespaceExists) {
      tempDir = await cloneRepository(owner, repo, defaultBranch, sessionId);
      await chunkRepository(owner, repo, sessionId);
      await embedAndUpsertChunks(owner, repo, sessionId);
    } else {
      console.log(`✅ Reusing existing namespace: ${namespace}`);
    }

    // Fetch directory tree
    const nestedTree = await fetchRepoTree(owner, repo, defaultBranch);

    res.json({
      metadata: {
        name: repoData.name,
        description: repoData.description,
        defaultBranch,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
      },
      directoryTree: nestedTree,
      clonedPath: tempDir,
      needsProcessing: !namespaceExists
    });
  } catch (error) {
    const { status, message } = error as { status: number; message: string };
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

    const content = await fetchFileContent(owner as string, repo as string, path as string);
    res.json({ content });
  } catch (error) {
    const { status, message } = error as { status: number; message: string };
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
      model: "gpt-4",
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