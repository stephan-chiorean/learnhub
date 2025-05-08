import { LessonPlan } from "../../components/CourseConsole";

export const newcourse: LessonPlan = {
  "sectionId": "stephan-chiorean_learnhub_server-entrypoints-and-initialization",
  "lessons": [
    {
      "title": "Setting Up the Server",
      "steps": [
        {
          "title": "Importing Required Modules",
          "filePath": "server/index.ts",
          "startLine": 1,
          "endLine": 5,
          "explanation": [
            "The code begins by importing essential modules and functions.",
            "Express is imported to create the server and handle HTTP requests.",
            "CORS is imported to enable Cross-Origin Resource Sharing.",
            "Dotenv is imported to load environment variables from a .env file.",
            "OpenAI and randomUUID from the crypto module are also imported."
          ]
        },
        {
          "title": "Importing Workspace Helpers",
          "filePath": "server/index.ts",
          "startLine": 6,
          "endLine": 15,
          "explanation": [
            "The code imports various helper functions from the workspaceHelpers file.",
            "These functions are used for tasks such as fetching repository metadata and cloning repositories.",
            "The initializeEnvironment function is also imported to set up environment variables."
          ]
        },
        {
          "title": "Configuring Environment Variables",
          "filePath": "server/index.ts",
          "startLine": 18,
          "endLine": 19,
          "explanation": [
            "The dotenv.config function is called to load environment variables from the .env file.",
            "The initializeEnvironment function is called to set up necessary environment variables and clients."
          ]
        },
        {
          "title": "Creating the Express Application",
          "filePath": "server/index.ts",
          "startLine": 21,
          "endLine": 22,
          "explanation": [
            "An Express application instance is created and assigned to the app variable.",
            "The server is configured to listen on port 3001."
          ]
        },
        {
          "title": "Setting Up Middleware",
          "filePath": "server/index.ts",
          "startLine": 24,
          "endLine": 26,
          "explanation": [
            "CORS middleware is added to the Express application to handle Cross-Origin Resource Sharing.",
            "The express.json middleware is added to parse incoming JSON requests."
          ]
        },
        {
          "title": "Configuring OpenAI",
          "filePath": "server/index.ts",
          "startLine": 28,
          "endLine": 30,
          "explanation": [
            "An OpenAI instance is created using the API key from environment variables.",
            "This instance is used to interact with OpenAI's API for generating summaries and embeddings."
          ]
        }
      ]
    },
    {
      "title": "Defining API Endpoints",
      "steps": [
        {
          "title": "Creating a Workspace",
          "filePath": "server/index.ts",
          "startLine": 52,
          "endLine": 102,
          "explanation": [
            "A POST endpoint is defined at /api/createWorkspace to create a new workspace.",
            "The endpoint extracts the owner and repo from the request body.",
            "A unique session ID is generated using randomUUID.",
            "The namespace is constructed using the owner and repo.",
            "The checkNamespaceExists function checks if the namespace already exists in Pinecone.",
            "If the namespace does not exist, the repository is cloned, chunked, and embedded.",
            "The fetchRepoTree function fetches the directory tree of the repository.",
            "The response includes metadata, directory tree, cloned path, and processing status."
          ]
        },
        {
          "title": "Fetching File Content",
          "filePath": "server/index.ts",
          "startLine": 104,
          "endLine": 119,
          "explanation": [
            "A GET endpoint is defined at /api/fileContent to fetch the content of a file.",
            "The endpoint extracts the owner, repo, and path from the query parameters.",
            "The fetchFileContent function retrieves the content of the specified file.",
            "The response includes the content of the file."
          ]
        },
        {
          "title": "Generating a Summary",
          "filePath": "server/index.ts",
          "startLine": 121,
          "endLine": 183,
          "explanation": [
            "A POST endpoint is defined at /api/generateSummary to generate a summary of code.",
            "The endpoint extracts the code from the request body.",
            "The OpenAI API is used to generate a summary of the code.",
            "The response includes the generated summary in JSON format."
          ]
        },
        {
          "title": "Handling Chat Requests",
          "filePath": "server/index.ts",
          "startLine": 186,
          "endLine": 286,
          "explanation": [
            "A POST endpoint is defined at /api/chat to handle chat requests.",
            "The endpoint extracts the namespace and question from the request body.",
            "The OpenAI API is used to generate an embedding for the question.",
            "The Pinecone API is used to query the namespace with the embedding.",
            "The response includes a structured JSON response based on the code chunks."
          ]
        },
        {
          "title": "Generating a Plan",
          "filePath": "server/index.ts",
          "startLine": 289,
          "endLine": 404,
          "explanation": [
            "A POST endpoint is defined at /api/plan to generate a plan for a namespace.",
            "The endpoint extracts the namespace from the request body.",
            "The Pinecone API is used to fetch all files in the namespace.",
            "The OpenAI API is used to generate a structured walkthrough plan.",
            "The response includes the generated plan in JSON format."
          ]
        },
        {
          "title": "Generating a Lesson Plan",
          "filePath": "server/index.ts",
          "startLine": 407,
          "endLine": 580,
          "explanation": [
            "A POST endpoint is defined at /api/generateLessonPlan to generate a lesson plan.",
            "The endpoint extracts the section, sectionId, description, and files from the request body.",
            "The fetchFileContent function retrieves the content of each file.",
            "The OpenAI API is used to generate a detailed lesson plan.",
            "The response includes the generated lesson plan in JSON format."
          ]
        }
      ]
    },
    {
      "title": "Initializing Environment and Helper Functions",
      "steps": [
        {
          "title": "Importing Required Modules",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 1,
          "endLine": 7,
          "explanation": [
            "The code begins by importing essential modules and functions.",
            "Axios is imported for making HTTP requests.",
            "Child_process, util, fs, and path modules are imported for file system operations.",
            "The randomUUID function from the crypto module is imported.",
            "The Pinecone client is imported for interacting with the Pinecone database."
          ]
        },
        {
          "title": "Initializing Environment Variables and Clients",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 23,
          "endLine": 52,
          "explanation": [
            "The initializeEnvironment function sets up environment variables and clients.",
            "It checks for the presence of required environment variables.",
            "The Pinecone client is initialized with the API key and controller host URL.",
            "GitHub headers are set up for making authenticated API requests."
          ]
        },
        {
          "title": "Handling GitHub API Errors",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 82,
          "endLine": 120,
          "explanation": [
            "The handleGitHubError function handles errors from GitHub API requests.",
            "It checks for specific error conditions such as rate limiting and repository not found.",
            "It returns appropriate error messages and status codes based on the error."
          ]
        },
        {
          "title": "Building Nested Tree Structure",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 123,
          "endLine": 161,
          "explanation": [
            "The buildNestedTree function constructs a nested tree structure from a list of items.",
            "It creates nodes for each item and builds a hierarchy based on the item paths.",
            "The function returns the constructed tree structure."
          ]
        },
        {
          "title": "Checking Namespace Existence",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 164,
          "endLine": 173,
          "explanation": [
            "The checkNamespaceExists function checks if a namespace exists in Pinecone.",
            "It queries the Pinecone index and checks for the presence of the namespace.",
            "The function returns a boolean indicating the existence of the namespace."
          ]
        },
        {
          "title": "Fetching Repository Metadata",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 176,
          "endLine": 185,
          "explanation": [
            "The fetchRepoMetadata function fetches metadata for a repository from GitHub.",
            "It makes an authenticated API request to the GitHub API.",
            "The function returns the repository metadata."
          ]
        },
        {
          "title": "Fetching Repository Tree",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 188,
          "endLine": 200,
          "explanation": [
            "The fetchRepoTree function fetches the directory tree of a repository from GitHub.",
            "It makes an authenticated API request to the GitHub API.",
            "The buildNestedTree function is used to construct the tree structure.",
            "The function returns the constructed tree."
          ]
        },
        {
          "title": "Cloning Repository",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 203,
          "endLine": 226,
          "explanation": [
            "The cloneRepository function clones a repository to a temporary directory.",
            "It constructs the paths for the walkthrough and temporary directories.",
            "The repository is cloned using the git clone command.",
            "The function returns the path to the cloned repository."
          ]
        },
        {
          "title": "Fetching File Content",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 229,
          "endLine": 241,
          "explanation": [
            "The fetchFileContent function fetches the content of a file from GitHub.",
            "It makes an authenticated API request to the GitHub API.",
            "The content is decoded from base64 and returned as a string."
          ]
        },
        {
          "title": "Chunking Repository",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 244,
          "endLine": 263,
          "explanation": [
            "The chunkRepository function chunks the repository into smaller parts.",
            "It constructs the paths for the repository and output files.",
            "The chunkRepo script is executed to perform the chunking.",
            "The function logs the success or failure of the chunking process."
          ]
        },
        {
          "title": "Embedding and Upserting Chunks",
          "filePath": "server/workspaces/workspaceHelpers.ts",
          "startLine": 265,
          "endLine": 282,
          "explanation": [
            "The embedAndUpsertChunks function embeds and upserts chunks to Pinecone.",
            "It constructs the paths for the chunks file and namespace.",
            "The embedAndUpsert script is executed to perform the embedding and upserting.",
            "The function logs the success or failure of the process."
          ]
        }
      ]
    }
  ]
}