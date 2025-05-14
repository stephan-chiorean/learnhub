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
  initializeEnvironment,
} from './workspaces/workspaceHelpers.ts';
import { Pinecone } from '@pinecone-database/pinecone';
import { b } from '../baml_client/index.js'
import { FileMetadata } from '../baml_client/types.js'
import { getCodeChunks, initializeDatabase } from './db/index.ts';

dotenv.config();
initializeEnvironment();
initializeDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add these type definitions before the endpoint
interface LessonStep {
  title: string;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  code: string | null;
  explanation: string;
}

interface Lesson {
  title: string;
  steps: LessonStep[];
}

interface LessonPlan {
  sectionId: string;
  lessons: Lesson[];
}

app.get('/api/chunks', async (req: Request, res: Response) => {
  const { namespace } = req.query;
  const chunks = await getCodeChunks(namespace as string);
  res.json(chunks);
});

// POST /api/createWorkspace
app.post('/api/createWorkspace', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Owner and repo are required' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Generate unique session ID
    const sessionId = randomUUID();
    const namespace = `${owner}_${repo}`;

    // Send initial progress
    res.write(`data: ${JSON.stringify({ type: 'init', message: 'Starting workspace creation...' })}\n\n`);

    // Check if namespace exists in Pinecone
    const namespaceExists = await checkNamespaceExists(namespace);
    let tempDir: string | null = null;
    let codeChunks: any[] = [];

    // Fetch repository metadata
    const repoData = await fetchRepoMetadata(owner, repo);
    const defaultBranch = repoData.default_branch;

    // Try to get chunks from Postgres
    codeChunks = await getCodeChunks(namespace);

    if (!namespaceExists || codeChunks.length === 0) {
      // If namespace doesn't exist, process everything
      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'cloning', message: 'Cloning repository...' })}\n\n`);
      tempDir = await cloneRepository(owner, repo, defaultBranch, sessionId);
      
      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'chunking', message: 'Processing code chunks...' })}\n\n`);
      codeChunks = await chunkRepository(owner, repo, sessionId);
      
      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'embedding', message: 'Generating embeddings...' })}\n\n`);
      await embedAndUpsertChunks(owner, repo, sessionId, (progress) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'complete', message: 'Using existing embeddings' })}\n\n`);
      console.log(`✅ Reusing existing namespace: ${namespace}`);
    }

    // Fetch directory tree
    res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'tree', message: 'Fetching directory structure...' })}\n\n`);
    const nestedTree = await fetchRepoTree(owner, repo, defaultBranch);

    // Send final response
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      data: {
        metadata: {
          name: repoData.name,
          description: repoData.description,
          defaultBranch,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
        },
        directoryTree: nestedTree,
        codeChunks,
        clonedPath: tempDir,
        needsProcessing: !namespaceExists
      }
    })}\n\n`);

    res.end();
  } catch (error) {
    const { status, message } = error as { status: number; message: string };
    res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
    res.end();
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

// POST /api/plan
app.post('/api/plan', async (req: Request, res: Response) => {
  try {
    const { namespace } = req.body;
    console.log(`✅ Generating plan for: ${namespace}`);
    if (!namespace) {
      return res.status(400).json({ error: 'Namespace is required' });
    }
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
      return res.status(500).json({ error: 'Pinecone configuration is missing' });
    }

    // Fetch all files in the namespace from Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      controllerHostUrl: 'https://api.pinecone.io'
    });
    const index = pinecone.index(process.env.PINECONE_INDEX);
    // Use a dummy vector and large topK to fetch everything
    const queryResponse = await index.namespace(namespace).query({
      vector: Array(1536).fill(0), // dummy vector for ada-002
      topK: 1000,
      includeMetadata: true,
      includeValues: false
    });

    // Convert the files to FileMetadata format
    const files: FileMetadata[] = queryResponse.matches
      .filter(match => match.metadata && typeof match.metadata.filePath === 'string')
      .map(match => ({
        filePath: match.metadata!.filePath
      })) as FileMetadata[];

    // Use the BAML function instead of direct OpenAI call
    const plan = await b.GenerateCodeWalkthrough(files);
    res.json({plan});
  } catch (error) {
    console.error('Error in plan endpoint:', error);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// POST /api/generateLessonPlan
app.post('/api/generateLessonPlan', async (req: Request, res: Response) => {
  try {
    const { section, sectionId, description, files } = req.body;

    if (!section || !sectionId || !description || !files) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract namespace from sectionId (assuming format: owner_repo)
    const namespace = sectionId.split('_').slice(0, 2).join('_');
    const [owner, repo] = namespace.split('_');

    // Fetch all file contents
    const fileContents = await Promise.all(
      files.map(async (filePath: string) => {
        try {
          const content = await fetchFileContent(owner, repo, filePath);
          return {
            path: filePath,
            content
          };
        } catch (error) {
          console.error(`Failed to fetch content for ${filePath}:`, error);
          return {
            path: filePath,
            content: null
          };
        }
      })
    );

    // Format file contents for the prompt
    const formattedFileContents = fileContents
      .filter(file => file.content !== null)
      .map(file => {
    const lines = file.content!.split('\n').map((line: string, index: number) => `Line ${index + 1}: ${line}`).join('\n');
    return `File: ${file.path}\n${lines}`;
    }).join('\n---\n');

    const prompt = `
Create a detailed lesson plan for the following section of code.

Section: ${section}
Section ID: ${sectionId}
Description:
${description.join('\n')}

Files:
${files.join(', ')}

File Contents:
${formattedFileContents}

Follow all global rules carefully when generating the lesson plan.

The lesson plan should be a JSON object using this structure:
{
  "sectionId": string,
  "lessons": [
    {
      "title": string,
      "steps": [
        {
          "title": string,
          "filePath": string | null,
          "startLine": number | null,
          "endLine": number | null,
          "explanation": string[]
        }
      ]
    }
  ]
}

Additional task-specific instructions:
- Break complex code into logical steps for better understanding.
- Include all relevant code sections and endpoints in the steps.
- Explanations must be arrays of clear, complete thoughts as strings.
- Each explanation point should be a full sentence and self-contained.
- Only include error handling or edge cases if crucial to understanding.
- Do NOT include markdown, backticks, or formatting in your output.
- Never wrap the response in a code block. Output ONLY the raw JSON.
- Ensure line numbers are 100% accurate — double-check each carefully.
- For each step, ensure the line numbers precisely match the code being explained.
- Use the provided file contents to verify line numbers and code sections.
- All file contents are provided with explicit line numbers. You MUST reference the exact line numbers shown when generating startLine and endLine.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-05-13", // Use the 128k context version
      messages: [
        {
          role: "system",
          content: `
            You are a technical documentation expert. Your task is to create detailed lesson plans for code sections.
            - NEVER wrap your response in markdown or code blocks.
            - Output ONLY the raw JSON object.
            - Line numbers MUST be 100% accurate - double-check each one.
            - Format explanations as arrays of complete descriptions.
            - Ensure all explanations are clear and detailed.
            - Include all relevant code sections.
            - Break down complex code into logical steps.
            - Each step should have precise line numbers.
            - Verify line numbers against the provided file contents.
          `.trim()
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 4096, // Adjusted to allow larger responses
    });

    const lessonPlanJson = completion.choices[0]?.message?.content?.trim();
    if (!lessonPlanJson) {
      return res.status(500).json({ error: 'Failed to generate lesson plan' });
    }

    try {
      const lessonPlan = JSON.parse(lessonPlanJson);
      res.json(lessonPlan);
    } catch (e) {
      const cleanedJson = lessonPlanJson.replace(/^[^\{]*(\{[\s\S]*\})[^\}]*$/m, '$1');
      try {
        const lessonPlan = JSON.parse(cleanedJson);
        res.json(lessonPlan);
      } catch (e2) {
        return res.status(500).json({ 
          error: 'Failed to parse lesson plan JSON', 
          raw: completion.choices[0]?.message?.content 
        });
      }
    }
  } catch (error) {
    console.error('Error generating lesson plan:', error);
    res.status(500).json({ error: 'Failed to generate lesson plan' });
  }
});

// Add type guard function
function isLessonPlan(obj: any): obj is LessonPlan {
  return (
    obj &&
    typeof obj.sectionId === 'string' &&
    Array.isArray(obj.lessons) &&
    obj.lessons.every((lesson: any) =>
      lesson &&
      typeof lesson.title === 'string' &&
      Array.isArray(lesson.steps) &&
      lesson.steps.every((step: any) =>
        step &&
        typeof step.title === 'string' &&
        Array.isArray(step.explanation) &&
        step.explanation.every((exp: any) => typeof exp === 'string') &&
        (step.filePath === null || typeof step.filePath === 'string') &&
        (step.startLine === null || typeof step.startLine === 'number') &&
        (step.endLine === null || typeof step.endLine === 'number') &&
        (step.code === null || typeof step.code === 'string')
      )
    )
  );
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});