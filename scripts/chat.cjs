require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

// Initialize clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    controllerHostUrl: 'https://api.pinecone.io'
});

const NAMESPACE = 'PromptVaultAdmin';
const QUESTION = "Explain how the server is started, including any middleware setup or dev server logic.";

async function getEmbedding(text) {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text,
            encoding_format: 'float'
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error getting embedding:', error.message);
        throw error;
    }
}

async function searchPinecone(question) {
    try {
        // Get embedding for the question
        const questionEmbedding = await getEmbedding(question);
        
        // Get the index
        const index = pinecone.index(process.env.PINECONE_INDEX);
        
        // Query Pinecone
        const queryResponse = await index.namespace(NAMESPACE).query({
            vector: questionEmbedding,
            topK: 10,
            includeMetadata: true,
            includeValues: false
        });

        return queryResponse.matches;
    } catch (error) {
        console.error('Error searching Pinecone:', error.message);
        throw error;
    }
}

async function getAIResponse(question, chunks) {
    try {
        // Format the chunks for the prompt
        const formattedChunks = chunks.map(chunk => {
            const metadata = chunk.metadata;
            return `File: ${metadata.filePath}\nType: ${metadata.type}\n${metadata.functionName ? `Function: ${metadata.functionName}\n` : ''}Content:\n${metadata.content}\n`;
        }).join('\n---\n');

        // Create the prompt
        const prompt = `Based on the following code chunks, ${question}\n\n${formattedChunks}`;

        // Get response from OpenAI
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that explains code. Focus on explaining the server startup process, middleware setup, and development server logic based on the provided code chunks."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error getting AI response:', error.message);
        throw error;
    }
}

async function main() {
    try {
        console.log('🔍 Searching for relevant code chunks...\n');
        const matches = await searchPinecone(QUESTION);
        
        console.log('📄 Found relevant files:');
        matches.forEach((match, i) => {
            console.log(`${i + 1}. ${match.metadata.filePath} (similarity: ${match.score.toFixed(3)})`);
        });

        console.log('\n💭 Generating explanation...\n');
        const response = await getAIResponse(QUESTION, matches);
        
        console.log('📝 Explanation:');
        console.log(response);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main(); 