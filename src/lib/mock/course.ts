export const course = {
    "sectionId": "server-entrypoints-and-initialization",
    "lessons": [
      {
        "title": "Understanding the Server Initialization",
        "steps": [
          {
            "title": "Importing Necessary Modules",
            "filePath": "server/index.ts",
            "startLine": 1,
            "endLine": 13,
            "code": "import express, { Request, Response } from 'express';\nimport cors from 'cors';\nimport dotenv from 'dotenv';\nimport OpenAI from 'openai';\nimport { randomUUID } from 'crypto';\nimport { \n  fetchRepoMetadata, \n  fetchRepoTree, \n  cloneRepository, \n  fetchFileContent, \n  checkNamespaceExists, \n  chunkRepository,\n  embedAndUpsertChunks,\n  initializeEnvironment \n} from './workspaces/workspaceHelpers.ts';\nimport { Pinecone } from '@pinecone-database/pinecone';",
            "explanation": "At the beginning of the server initialization file, several modules are imported. These include 'express' for setting up the server, 'cors' for handling Cross-Origin Resource Sharing, 'dotenv' for managing environment variables, and 'openai' for leveraging OpenAI's API. Several helper functions are imported from 'workspaceHelpers.ts', which assist in managing workspaces."
          },
          {
            "title": "Setting Up Environment Variables and Initialization",
            "filePath": "server/index.ts",
            "startLine": 15,
            "endLine": 18,
            "code": "dotenv.config({ path: '../.env' });\ninitializeEnvironment();\n\nconst app = express();\nconst port = 3001;",
            "explanation": "Environment variables are set up using 'dotenv', and the environment is initialized using the 'initializeEnvironment' function. An instance of the express application is created and the port is set as 3001."
          },
          {
            "title": "Setting Up Middleware",
            "filePath": "server/index.ts",
            "startLine": 21,
            "endLine": 24,
            "code": "app.use(cors());\napp.use(express.json());\n\nconst openai = new OpenAI({\n  apiKey: process.env.OPENAI_API_KEY,\n});",
            "explanation": "Middleware for CORS and express.json() are set up in the express application. 'express.json()' is a middleware that parses incoming requests with JSON payloads. An instance of OpenAI is also created using the OpenAI API key from the configured environment variables."
          }
        ]
      },
      {
        "title": "Understanding API Endpoints",
        "steps": [
          {
            "title": "Create Workspace Endpoint",
            "filePath": "server/index.ts",
            "startLine": 26,
            "endLine": 66,
            "code": "app.post('/api/createWorkspace', async (req: Request, res: Response) => {\n  ...\n});",
            "explanation": "This is the '/api/createWorkspace' endpoint. It's a POST request that takes in the 'owner' and 'repo' from the request body and uses them to handle workspace creation tasks. If the namespace already exists in 'Pinecone', it reuses it. If not, it clones the repository, chunks it, and embeds and upserts the chunks. It also fetches the repository metadata and directory tree, which is then sent in the response."
          },
          {
            "title": "File Content Endpoint",
            "filePath": "server/index.ts",
            "startLine": 68,
            "endLine": 86,
            "code": "app.get('/api/fileContent', async (req: Request, res: Response) => {\n  ...\n});",
            "explanation": "This is the '/api/fileContent' endpoint. It's a GET request that fetches the file content based on the 'owner', 'repo', and 'path' provided in the request query. The fetched content is then sent in the response."
          },
          {
            "title": "Generate Summary Endpoint",
            "filePath": "server/index.ts",
            "startLine": 88,
            "endLine": 132,
            "code": "app.post('/api/generateSummary', async (req: Request, res: Response) => {\n  ...\n});",
            "explanation": "This is the '/api/generateSummary' endpoint. It's a POST request that takes in 'code' from the request body. It then sends this code to the OpenAI API to generate a summary. The generated summary is then sent in the response."
          },
          {
            "title": "Chat Endpoint",
            "filePath": "server/index.ts",
            "startLine": 134,
            "endLine": 224,
            "code": "app.post('/api/chat', async (req: Request, res: Response) => {\n  ...\n});",
            "explanation": "This is the '/api/chat' endpoint. It's a POST request that processes a 'chat' request. The 'namespace' and 'question' are extracted from the request body and used to fetch embeddings for the 'question' and query the 'Pinecone' database. It then formats the results and sends them to the OpenAI API to generate a response. The generated response is then sent in the response."
          },
          {
            "title": "Plan Endpoint",
            "filePath": "server/index.ts",
            "startLine": 226,
            "endLine": 340,
            "code": "app.post('/api/plan', async (req: Request, res: Response) => {\n  ...\n});",
            "explanation": "This is the '/api/plan' endpoint. It's a POST request that generates a plan for a given 'namespace'. It fetches all files in the 'namespace' from 'Pinecone', and sends them to the OpenAI API to generate a plan. The generated plan is then sent in the response."
          }
        ]
      },
      {
        "title": "Starting the Server",
        "steps": [
          {
            "title": "Listening on Port",
            "filePath": "server/index.ts",
            "startLine": 342,
            "endLine": 344,
            "code": "app.listen(port, () => {\n  console.log(`Server running on port ${port}`);\n});",
            "explanation": "Finally, the server is started and begins listening on the designated port. A console message is displayed to indicate that the server is running."
          }
        ]
      }
    ]
  }