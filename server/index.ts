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
import { Pinecone } from '@pinecone-database/pinecone';

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

// POST /api/chat
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { namespace, question } = req.body;

    if (!namespace || !question) {
      return res.status(400).json({ error: 'Namespace and question are required' });
    }

    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
      return res.status(500).json({ error: 'Pinecone configuration is missing' });
    }

    // Get embedding for the question
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: question,
      encoding_format: 'float'
    });

    // Query Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      controllerHostUrl: 'https://api.pinecone.io'
    });

    const index = pinecone.index(process.env.PINECONE_INDEX);
    const queryResponse = await index.namespace(namespace).query({
      vector: embedding.data[0].embedding,
      topK: 10,
      includeMetadata: true,
      includeValues: false
    });

    // Format the chunks for the prompt
    const formattedChunks = queryResponse.matches
      .filter(match => match.metadata) // Filter out matches without metadata
      .map(match => {
        const metadata = match.metadata!; // We know it exists due to filter
        return `File: ${metadata.filePath}\nType: ${metadata.type}\n${metadata.functionName ? `Function: ${metadata.functionName}\n` : ''}Content:\n${metadata.content}\n`;
      })
      .join('\n---\n');

    // Create the prompt
    const prompt = `Based on the following code chunks, ${question}\n\n${formattedChunks}\n\nPlease provide a structured response in JSON format with the following structure:
    {
      "title": "A concise title for the response",
      "mainPurpose": "One paragraph explaining the main purpose or answer",
      "keyComponents": [
        {"name": "Component 1", "description": "Description of component 1"},
        {"name": "Component 2", "description": "Description of component 2"}
      ],
      "overallStructure": "One paragraph explaining the overall structure or flow"
    }`;

    // Get response from OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that explains code. Focus on explaining the code based on the provided code chunks. Always respond with valid JSON matching the requested structure."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7
    });

    let responseJson;
    try {
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }
      responseJson = JSON.parse(content);
    } catch (e) {
      // If parsing fails, create a structured response from the raw text
      responseJson = {
        title: "Code Explanation",
        mainPurpose: response.choices[0].message.content || "No response available",
        keyComponents: [],
        overallStructure: ""
      };
    }

    res.json({ 
      response: JSON.stringify(responseJson),
      relevantFiles: queryResponse.matches
        .filter(match => match.metadata) // Filter out matches without metadata
        .map(match => ({
          filePath: match.metadata!.filePath,
          similarity: match.score
        }))
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});