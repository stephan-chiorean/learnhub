import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { 
  fetchRepoMetadata, 
  fetchRepoTree, 
  cloneRepository, 
  fetchFileContent, 
  chunkRepository,
  embedAndUpsertChunks,
  initializeEnvironment,
  intelligentFileSearch,
} from './workspaces/workspaceHelpers.ts';
import { readAllRows } from './helpers/lance.ts'; // adjust path as needed
import { b } from '../baml_client/index.js'
import { FileMetadata } from '../baml_client/types.js'
import { getCodeChunks, getCodeChunkSummaries, initializeDatabase, pool } from './db/index.ts';
import lancedb from '@lancedb/lancedb';

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

// Initialize LanceDB
const db = await lancedb.connect('~/.walkthrough/lancedb');
let chunksTable, embeddingsTable;
try {
  chunksTable = await db.openTable('chunks');
  embeddingsTable = await db.openTable('embeddings');
  console.log('✅ Connected to existing LanceDB tables');

  // Verify schemas
  const chunksSchema = await chunksTable.schema();
  console.log('📊 Chunks table schema:', JSON.stringify(chunksSchema, null, 2));
  const embeddingsSchema = await embeddingsTable.schema();
  console.log('📊 Embeddings table schema:', JSON.stringify(embeddingsSchema, null, 2));
} catch (error) {
  console.error('❌ Error connecting to LanceDB tables:', error);
  console.log('Please run init_lancedb.js first to create the tables');
  process.exit(1);
}

// Define types for our data structures
interface ChunkMetadata {
  filePath: string;
  type: string;
  content: string;
  functionName?: string;
  startLine: number;
  endLine: number;
}

interface SearchResult {
  id: string;
  score: number;
  metadata?: ChunkMetadata;
}

// Add type definitions for context and summary
interface Context {
  path: string;
  type: string;
  start_line?: number;
  end_line?: number;
}

interface Summary {
  chunk_id: string;
  summary: string;
}

// Add these interfaces at the top with other interfaces
interface Chunk {
  id: string;
  chunk_hash: string;
  relative_path: string;
  start_line: number;
  end_line: number;
  content: string;
}

interface Embedding {
  chunk_hash: string;
  embedding: number[];
  score?: number;
}


app.get('/api/chunks', async (req: Request, res: Response) => {
  const { namespace } = req.query;
  const chunks = await getCodeChunks(namespace as string);
  const summaries = await getCodeChunkSummaries(namespace as string);

  // Combine chunks with their summaries
  const chunksWithSummaries = chunks.map(chunk => {
    const summary = summaries.find(s => s.chunk_id === chunk.chunk_id);
    return {
      ...chunk,
      summary: summary?.summary || null
    };
  });

  res.json(chunksWithSummaries);
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

    // Check if namespace exists in Postgres
    let namespaceExists = false;
    try {
      const result = await pool.query(
        'SELECT COUNT(*) FROM code_chunks WHERE namespace = $1',
        [namespace]
      );
      namespaceExists = parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Error checking namespace in Postgres:', error);
      namespaceExists = false;
    }

    // Check if chunks exist in LanceDB for this namespace
    let lanceDbExists = false;
    try {
      // First, let's check what's in the table
      const allChunks = await chunksTable
        .query()
        .limit(5)
        .toArray();
      console.log('📊 Sample chunks in LanceDB:', allChunks.map(c => c.relative_path));

      // Now try our namespace query
      const chunks = await chunksTable
        .query()
        .where(`relative_path LIKE '${namespace}%'`)
        .limit(1)
        .toArray();
      
      console.log('🔍 Query results:', {
        namespace,
        query: `relative_path LIKE '${namespace}%'`,
        foundChunks: chunks.length,
        sampleChunks: chunks.map(c => c.relative_path)
      });
      
      lanceDbExists = chunks.length > 0;
      console.log(`📊 Found chunks in LanceDB for ${namespace}: ${lanceDbExists}`);
    } catch (error) {
      console.error('Error checking LanceDB:', error);
      lanceDbExists = false;
    }

    let tempDir: string | null = null;
    let codeChunks: any[] = [];

    // Fetch repository metadata
    const repoData = await fetchRepoMetadata(owner, repo);
    const defaultBranch = repoData.default_branch;

    // Try to get chunks from Postgres
    codeChunks = await getCodeChunks(namespace);

    // Only process if we don't have data in both Postgres and LanceDB
    if (false) {
      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'cloning', message: 'Cloning repository...' })}\n\n`);
      tempDir = await cloneRepository(owner, repo, defaultBranch, sessionId);
      
      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'chunking', message: 'Processing code chunks...' })}\n\n`);
      console.log('CHUNKING')
      codeChunks = await chunkRepository(owner, repo, sessionId);
      console.log('CHUNKED')
      
      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'embedding', message: 'Generating embeddings...' })}\n\n`);
      console.log('EMBEDDING')
      await embedAndUpsertChunks(owner, repo, sessionId, (progress) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
      });
      console.log('EMBEDDED')
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
        needsProcessing: !namespaceExists || !lanceDbExists
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
    const { namespace, question, contexts } = req.body;
    console.log('📝 Chat Request:', { namespace, question, contexts });

    if (!namespace || !question) {
      return res.status(400).json({ error: 'Namespace and question are required' });
    }

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: question,
      encoding_format: 'float'
    });
    const questionEmbedding = embeddingResponse.data[0].embedding;

    // Optional scoped filter
    let chunkHashFilter: string[] | null = null;

    if (contexts?.length) {
      const contextPath = contexts.find((ctx: Context) => ctx.type === 'tree')?.path;
      if (contextPath) {
        const normalizedPath = contextPath.replace(/^\/+/, '');
        const chunkIter = await chunksTable
          .query()
          .where(`relative_path LIKE '${normalizedPath}%'`);
        const matchingChunks = await readAllRows<Chunk>(chunkIter);
    
        console.log('📂 Context path filter:', normalizedPath);
        console.log('🧩 Matching chunks found:', matchingChunks.length);
        console.log('🧱 Sample chunk paths:', matchingChunks.slice(0, 5).map(c => c.relative_path));
    
        chunkHashFilter = matchingChunks.map(c => c.chunk_hash);
    
        if (chunkHashFilter.length === 0) {
          console.warn('⚠️ No chunks matched this context path.');
          return res.json({ response: '[]', relevantFiles: [] });
        }
      }
    }

    // Run vector query
    let queryBuilder = embeddingsTable.query();
    if (chunkHashFilter) {
      const clause = chunkHashFilter.map(h => `'${h}'`).join(',');
      queryBuilder = queryBuilder.where(`chunk_hash IN (${clause})`);
    }

    const embeddingIter = await queryBuilder
      .nearestTo(questionEmbedding)
      .limit(15)

    const embeddingResults = await readAllRows<Embedding>(embeddingIter);
    if (!embeddingResults.length) {
      return res.json({ response: '[]', relevantFiles: [] });
    }

    const chunkHashes = embeddingResults.map(e => e.chunk_hash);
    const hashClause = chunkHashes.map(h => `'${h}'`).join(',');

    const chunkIter = await chunksTable
      .query()
      .where(`chunk_hash IN (${hashClause})`)
    const matchedChunks = await readAllRows<Chunk>(chunkIter);

    const joined = matchedChunks.map(chunk => {
      const score = embeddingResults.find(e => e.chunk_hash === chunk.chunk_hash)?.score || 0;
      return {
        id: chunk.id,
        score,
        metadata: {
          filePath: chunk.relative_path,
          content: chunk.content,
          startLine: chunk.start_line,
          endLine: chunk.end_line
        }
      };
    });

    const fileRelevance = new Map<string, number>();
    for (const result of joined) {
      const path = result.metadata.filePath;
      const prev = fileRelevance.get(path) || 0;
      fileRelevance.set(path, Math.max(prev, result.score));
    }

    const relevantFiles = Array.from(fileRelevance.entries())
      .map(([filePath, similarity]) => ({ filePath, similarity }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

      console.log('🧠 Retrieved matchedChunks:', matchedChunks.length);
      console.log('📄 Sample chunk content:', matchedChunks.slice(0, 3).map(chunk => ({
        id: chunk.id,
        path: chunk.relative_path,
        hash: chunk.chunk_hash,
        contentPreview: chunk.content?.slice(0, 80) ?? '[NO CONTENT]',
      })));

    const formattedChunks = joined.map(result => {
      const meta = result.metadata;
      return `File: ${meta.filePath}\nContent:\n${meta.content}\n`;
    }).join('\n---\n');

    const contextMentions = (contexts || []).map((ctx: Context) => {
      if (ctx.type === 'tree') return `Folder: ${ctx.path}`;
      if (ctx.type === 'blob') return `File: ${ctx.path}`;
      if (ctx.type === 'function') return `Function: ${ctx.path} [lines ${ctx.start_line}-${ctx.end_line}]`;
      return '';
    }).filter(Boolean);

    const prompt = `The user has selected the following context as most relevant:\n${contextMentions.join('\n')}\n\nHere are the most relevant code chunks:\n${formattedChunks}\n\nBased on all of the above, ${question}\n\nPlease provide a structured response in JSON format with the following structure:
{
  "title": "A concise title for the response",
  "mainPurpose": "One paragraph explaining the main purpose or answer",
  "keyComponents": [
    {"name": "Component 1", "description": "Description of component 1"},
    {"name": "Component 2", "description": "Description of component 2"}
  ],
  "overallStructure": "One paragraph explaining the overall structure or flow"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that explains code. Always respond with valid JSON matching the requested structure.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 1
    });

    let parsed;
    try {
      parsed = JSON.parse(completion.choices[0].message.content || '');
    } catch {
      parsed = {
        title: 'Code Explanation',
        mainPurpose: completion.choices[0].message.content || '',
        keyComponents: [],
        overallStructure: ''
      };
    }

    res.json({
      response: JSON.stringify(parsed),
      relevantFiles
    });
  } catch (err) {
    console.error('❌ Error in /api/chat:', err);
    res.status(500).json({ error: 'Chat failed' });
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

    // Fetch all files in the namespace from LanceDB
    const lanceResults = await chunksTable
      .search(Array(1536).fill(0)) // dummy vector
      .filter(`relative_path LIKE '${namespace}/%'`)
      .limit(1000)
      .toArray();

    // Convert the files to FileMetadata format
    const files: FileMetadata[] = lanceResults
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

// POST /api/generateAnnotations
app.post('/api/generateAnnotations', async (req: Request, res: Response) => {
  try {
    const { directories, namespace } = req.body;
    console.log('🔍 Generating annotations for:', directories);

    if (!directories || !Array.isArray(directories) || directories.length === 0) {
      return res.status(400).json({ error: 'An array of directory paths is required.' });
    }

    if (!namespace) {
      return res.status(400).json({ error: 'Namespace is required.' });
    }

    const annotations: Record<string, string> = {};

    for (const dirPath of directories) {
      try {
        // Get immediate contents of the directory
        const result = await pool.query(
          `SELECT DISTINCT 
            c.file_path,
            c.type,
            c.function_name,
            c.text,
            COUNT(*) OVER (PARTITION BY c.type) as type_count
          FROM code_chunks c
          WHERE c.namespace = $1
          AND (
            c.file_path = $2 
            OR c.file_path LIKE $3
          )
          AND c.file_path NOT LIKE $4
          GROUP BY c.file_path, c.type, c.function_name, c.text
          ORDER BY c.file_path ASC`,
          [
            namespace,
            dirPath,
            `${dirPath}/%`,
            `${dirPath}/%/%` // Exclude deeper nested files
          ]
        );

        // Analyze the immediate contents
        const contents = result.rows.map((row: any) => ({
          path: row.file_path,
          type: row.type,
          functionName: row.function_name,
          text: row.text,
          typeCount: row.type_count
        }));

        // Count file types
        const typeCounts = contents.reduce((acc: Record<string, number>, curr: any) => {
          acc[curr.type] = (acc[curr.type] || 0) + 1;
          return acc;
        }, {});

        // Create a semantic query based on directory contents
        const semanticQuery = `Directory ${dirPath} contains: ${Object.entries(typeCounts)
          .map(([type, count]) => `${count} ${type} files`)
          .join(', ')}. ${contents
          .slice(0, 3)
          .map(c => `${c.type} ${c.functionName || c.path.split('/').pop()}`)
          .join(', ')}`;

        // Get semantic search results from LanceDB
        const semanticQueryResponse = await chunksTable
          .search((await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: semanticQuery,
            encoding_format: 'float'
          })).data[0].embedding)
          .limit(5)
          .toArray();

        // Extract relevant code chunks for context
        const relevantChunks = semanticQueryResponse
          .filter(match => match.metadata && match.metadata.filePath)
          .map(match => ({
            path: match.metadata!.filePath,
            type: match.metadata!.type,
            functionName: match.metadata!.functionName,
            text: typeof match.metadata!.text === 'string' ? match.metadata!.text : ''
          }));

        // Generate a concise description using both directory contents and semantic search results
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a technical writer. Create a detailed, two-sentence description of a directory based on its contents and semantic context.
Focus on:
1. The main purpose or theme of the directory
2. The types of files it contains (e.g., "React components", "API endpoints", "utility functions")
3. Any notable immediate subdirectories
4. The overall architecture or design patterns used

Keep it informative and specific. Avoid generic phrases like "contains source code" or "contains files".
Example good descriptions:
- "This directory contains React components for user authentication and profile management. It implements a modular architecture with separate components for login, registration, and profile editing."
- "This directory houses API endpoints for user data and authentication. It follows RESTful principles and includes middleware for request validation and error handling."
- "This directory contains utility functions for data formatting and validation. It provides reusable helper functions for date manipulation, string processing, and data type conversion."
- "This directory serves as the main application entry point and core configuration files. It includes the application bootstrap code, environment configuration, and global state management setup."

IMPORTANT:
- Write exactly two sentences
- Do not include any prefixes like "Directory:" or "Content:"
- Do not use quotes
- Focus on the actual purpose and contents`
            },
            {
              role: "user",
              content: `Directory: ${dirPath}
Contents:
${Object.entries(typeCounts).map(([type, count]) => `${type}: ${count} files`).join('\n')}
${contents.length > 0 ? `\nSample files:\n${contents.slice(0, 3).map(c => `- ${c.path.split('/').pop()}`).join('\n')}` : ''}

Semantic Context:
${relevantChunks.map(chunk => `File: ${chunk.path}
Type: ${chunk.type}
${chunk.functionName ? `Function: ${chunk.functionName}\n` : ''}Content: ${chunk.text.slice(0, 200)}...`).join('\n\n')}`
            }
          ],
          temperature: 0.3,
          max_tokens: 150,
        });

        const description = completion.choices[0]?.message?.content?.trim();
        if (description) {
          // Clean up any potential formatting issues
          const cleanDescription = description
            .replace(/^["']|["']$/g, '') // Remove surrounding quotes
            .replace(/^(Directory:|Content:)\s*/i, '') // Remove prefixes
            .replace(/\n/g, ' ') // Replace newlines with spaces
            .trim();
          annotations[dirPath] = cleanDescription;
        } else {
          // Fallback to a simple description based on the directory name
          const dirName = dirPath.split('/').pop() || dirPath;
          annotations[dirPath] = `This directory contains ${dirName} related files and components. It organizes the codebase's ${dirName} functionality in a structured manner.`;
        }
      } catch (error) {
        console.error(`Error generating annotation for ${dirPath}:`, error);
        annotations[dirPath] = `Contains ${dirPath.split('/').pop() || dirPath} related files`;
      }
    }

    res.json({ annotations });

  } catch (error) {
    console.error('Error in /api/generateAnnotations:', error);
    res.status(500).json({ error: 'Failed to generate annotations.' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
