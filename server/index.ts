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
  checkNamespaceExists, 
  chunkRepository,
  embedAndUpsertChunks,
  initializeEnvironment,
  intelligentFileSearch,
} from './workspaces/workspaceHelpers.ts';
import { Pinecone } from '@pinecone-database/pinecone';
import { b } from '../baml_client/index.js'
import { FileMetadata } from '../baml_client/types.js'
import { getCodeChunks, initializeDatabase, pool } from './db/index.ts';

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

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY as string,
  controllerHostUrl: 'https://api.pinecone.io'
});

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

    // Generate annotations for top-level directories
    const topLevelAnnotations: Record<string, string> = {};
    if (nestedTree && nestedTree.length > 0) {
      for (const item of nestedTree) {
        if (item.type === 'tree') { // 'tree' usually means directory
          try {
            const completion = await openai.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content: "You are an expert technical writer. Given a directory path, provide a very brief, one-sentence description of its likely purpose or the type of files it might contain. Focus on common conventions in software projects."
                },
                {
                  role: "user",
                  content: `Provide a one-sentence description for the top-level directory: "${item.name}" (path: ${item.path})`
                }
              ],
              temperature: 0.3,
              max_tokens: 50,
            });
            const description = completion.choices[0]?.message?.content?.trim();
            if (description) {
              topLevelAnnotations[item.path] = description;
            } else {
              topLevelAnnotations[item.path] = `General purpose directory: ${item.name}`;
            }
          } catch (e) {
            console.error(`Error generating annotation for ${item.path}:`, e);
            topLevelAnnotations[item.path] = `Could not generate annotation for ${item.path}.`;
          }
        }
      }
    }

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
        needsProcessing: !namespaceExists,
        annotations: topLevelAnnotations,
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
    console.log('📝 Chat Request:', {
      namespace,
      question,
      contexts: JSON.stringify(contexts, null, 2)
    });

    if (!namespace || !question) {
      console.log('❌ Missing required fields:', { namespace, question });
      return res.status(400).json({ error: 'Namespace and question are required' });
    }

    // Ensure namespace is a string
    const namespaceStr = String(namespace);

    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
      console.log('❌ Missing Pinecone configuration');
      return res.status(500).json({ error: 'Pinecone configuration is missing' });
    }

    // Use intelligent file search to find relevant files
    console.log('🔍 Starting intelligent file search...');
    const semanticFiles = await intelligentFileSearch(namespaceStr, question, contexts || [], pinecone);
    console.log('📊 Semantic files found:', JSON.stringify(semanticFiles, null, 2));

    // Get chunks from the context directory using SQL
    const contextPath = contexts?.find((ctx: { type: string; path: string }) => ctx.type === 'tree')?.path;
    console.log('🔍 Context path:', contextPath);
    
    let contextMatches: any[] = [];
    let sqlRelevantFiles: Array<{ filePath: string; similarity: number }> = [];
    
    if (contextPath) {
      // Normalize the context path
      const normalizedContextPath = contextPath.replace(/^\/+/, '');
      
      // Query database for chunks from the context directory and related files
      const result = await pool.query(
        `WITH related_files AS (
          -- Get files in the context directory
          SELECT file_path, 1.0 as relevance
          FROM code_chunks 
          WHERE namespace = $1 
          AND (
            file_path = $2 
            OR file_path LIKE $3
            OR file_path LIKE $4
          )
          UNION
          -- Get files that import or reference files in the context
          SELECT DISTINCT c2.file_path, 0.8 as relevance
          FROM code_chunks c1
          JOIN code_chunks c2 ON c2.namespace = c1.namespace
          WHERE c1.namespace = $1
          AND (
            c1.file_path = $2 
            OR c1.file_path LIKE $3
            OR c1.file_path LIKE $4
          )
          AND (
            c2.text LIKE '%import%' || c1.file_name || '%'
            OR c2.text LIKE '%require%' || c1.file_name || '%'
            OR c2.text LIKE '%from%' || c1.file_name || '%'
          )
        )
        SELECT c.*, rf.relevance
        FROM code_chunks c
        JOIN related_files rf ON c.file_path = rf.file_path
        WHERE c.namespace = $1
        ORDER BY rf.relevance DESC, c.start_line ASC`,
        [
          namespaceStr,
          normalizedContextPath,
          `${normalizedContextPath}/%`,
          `%/${normalizedContextPath}/%`
        ]
      );
      
      // Extract unique file paths and their highest relevance scores
      const fileRelevance = new Map<string, number>();
      result.rows.forEach((row: { file_path: string; relevance: number }) => {
        const currentRelevance = fileRelevance.get(row.file_path) || 0;
        fileRelevance.set(row.file_path, Math.max(currentRelevance, row.relevance));
      });

      // Convert to array format
      sqlRelevantFiles = Array.from(fileRelevance.entries()).map(([filePath, relevance]) => ({
        filePath,
        similarity: relevance
      }));

      contextMatches = result.rows.map((row: {
        chunk_id: string;
        file_path: string;
        type: string;
        text: string;
        function_name: string | null;
        start_line: number;
        end_line: number;
        relevance: number;
      }) => ({
        id: row.chunk_id,
        score: row.relevance,
        metadata: {
          filePath: row.file_path,
          type: row.type,
          content: row.text,
          functionName: row.function_name,
          startLine: row.start_line,
          endLine: row.end_line
        }
      }));
    }

    console.log('📊 Retrieved chunks from context:', contextMatches.length);
    console.log('📊 Context chunks:', contextMatches.map(m => m.metadata?.filePath));

    // Then, get chunks that might reference the context files using Pinecone
    const semanticQueryResponse = await pinecone.index(process.env.PINECONE_INDEX).query({
      vector: (await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: question,
        encoding_format: 'float'
      })).data[0].embedding,
      topK: 50,
      includeMetadata: true,
      includeValues: false
    });

    // Filter out chunks we already have from context
    const semanticMatches = semanticQueryResponse.matches
      .filter(match => !contextMatches.some(cm => cm.id === match.id))
      .slice(0, 10);

    console.log('📊 Retrieved chunks from semantic search:', semanticMatches.length);

    // Combine chunks, prioritizing context matches
    const allMatches = [...contextMatches, ...semanticMatches];
    console.log('📊 Total chunks:', allMatches.length);

    // Combine and normalize relevance scores from both sources
    const combinedRelevantFiles = new Map<string, { semantic: number; sql: number }>();
    
    // Add semantic scores
    semanticFiles.forEach(file => {
      combinedRelevantFiles.set(file.filePath, { 
        semantic: file.similarity,
        sql: 0
      });
    });
    
    // Add SQL scores
    sqlRelevantFiles.forEach(file => {
      const current = combinedRelevantFiles.get(file.filePath) || { semantic: 0, sql: 0 };
      combinedRelevantFiles.set(file.filePath, {
        ...current,
        sql: file.similarity
      });
    });

    // Calculate final scores with SQL relevance having higher weight
    const finalRelevantFiles = Array.from(combinedRelevantFiles.entries())
      .map(([filePath, scores]) => ({
        filePath,
        similarity: (scores.semantic * 0.3) + (scores.sql * 0.7) // SQL relevance has 70% weight
      }))
      .sort((a, b) => b.similarity - a.similarity);

    // Filter files based on relevance thresholds
    let filteredRelevantFiles = finalRelevantFiles;
    
    // If we have files with high relevance (>= 70%), only keep those
    const highRelevanceFiles = finalRelevantFiles.filter(file => file.similarity >= 0.7);
    if (highRelevanceFiles.length > 0) {
      filteredRelevantFiles = highRelevanceFiles.slice(0, 5); // Max 5 high relevance files
    } else {
      // If no high relevance files, take top 2 most relevant
      filteredRelevantFiles = finalRelevantFiles.slice(0, 2);
    }

    // Format chunks for the prompt
    const formattedChunks = allMatches
      .filter(match => match.metadata)
      .map(match => {
        const metadata = match.metadata!;
        return `File: ${metadata.filePath}\nType: ${metadata.type}\n${metadata.functionName ? `Function: ${metadata.functionName}\n` : ''}Content:\n${metadata.content}\n`;
      })
      .join('\n---\n');

    // Create the prompt with context mentions
    const contextMentions = (contexts || []).map((ctx: { path: string; type: string; start_line?: number; end_line?: number }) => {
      if (ctx.type === 'tree') return `Folder: ${ctx.path}`;
      if (ctx.type === 'blob') return `File: ${ctx.path}`;
      if (ctx.type === 'function') return `Function: ${ctx.path} [lines ${ctx.start_line}-${ctx.end_line}]`;
      return '';
    }).filter(Boolean);

    console.log('📝 Context mentions:', contextMentions);

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

    console.log('🤖 Sending request to OpenAI...');
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
        console.log('❌ Empty response from OpenAI');
        throw new Error('Empty response from OpenAI');
      }
      responseJson = JSON.parse(content);
      console.log('✅ Successfully parsed OpenAI response');
    } catch (e) {
      console.log('❌ Error parsing OpenAI response:', e);
      responseJson = {
        title: "Code Explanation",
        mainPurpose: response.choices[0].message.content || "No response available",
        keyComponents: [],
        overallStructure: ""
      };
    }

    console.log('📤 Sending response to client');
    res.json({ 
      response: JSON.stringify(responseJson),
      relevantFiles: filteredRelevantFiles
    });
  } catch (error) {
    console.error('❌ Error in chat endpoint:', error);
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

// POST /api/generateAnnotations
app.post('/api/generateAnnotations', async (req: Request, res: Response) => {
  try {
    const { directories } = req.body; // Expecting an array of directory paths

    if (!directories || !Array.isArray(directories) || directories.length === 0) {
      return res.status(400).json({ error: 'An array of directory paths is required.' });
    }

    const annotations: Record<string, string> = {};

    for (const dirPath of directories) {
      try {
        // For simplicity, we'll generate a generic description based on the path.
        // In a real scenario, you might analyze files within the directory.
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo", // Cheaper model for simple annotations
          messages: [
            {
              role: "system",
              content: "You are an expert technical writer. Given a directory path, provide a very brief, one-sentence description of its likely purpose or the type of files it might contain. Focus on common conventions in software projects."
            },
            {
              role: "user",
              content: `Provide a one-sentence description for the directory: "${dirPath}"`
            }
          ],
          temperature: 0.3,
          max_tokens: 50,
        });
        const description = completion.choices[0]?.message?.content?.trim() || `General purpose directory: ${dirPath}`;
        annotations[dirPath] = description;
      } catch (error) {
        console.error(`Error generating annotation for ${dirPath}:`, error);
        annotations[dirPath] = `Could not generate annotation for ${dirPath}.`;
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