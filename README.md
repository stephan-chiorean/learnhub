# LearnHub

A modern web application for learning and exploring GitHub repositories. Built with React, Node.js, and Tailwind CSS.

## Features

- Clean and intuitive user interface
- GitHub repository exploration
- AI-powered explanations and summarization
- Notebook functionality with notes per section
- Section navigator for seamless repo exploration
- Theme toggle (light / dark)
- Responsive design with modern styling using Tailwind CSS

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- GitHub account
- OpenAI API key
- Pinecone account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/stephan-chiorean/learnhub.git
cd learnhub
```

2. Create a `.env` file at the root of the project with the following variables:
```env
GITHUB_TOKEN=your_github_token
OPENAI_API_KEY=your_openai_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_HOST=your_pinecone_host
PINECONE_INDEX=your_pinecone_index
```

### Running the Application

1. Start the frontend:
```bash
# From the root directory
npm install
npm run dev
```

2. Start the backend:
```bash
# In a new terminal
cd server
npm install
npm run dev
```

The backend of the application should now be running at `http://localhost:3000`
Frontend will be accesible at `http://localhost:5173`


