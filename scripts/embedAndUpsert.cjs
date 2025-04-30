require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

const NAMESPACE = 'PromptVaultAdmin';
const BATCH_SIZE = 100;

// Initialize clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Log environment variables (without sensitive data)
console.log('Environment Configuration:');
console.log('PINECONE_HOST:', process.env.PINECONE_HOST);
console.log('PINECONE_INDEX:', process.env.PINECONE_INDEX);
console.log('API Keys present:', {
    OPENAI: !!process.env.OPENAI_API_KEY,
    PINECONE: !!process.env.PINECONE_API_KEY
});

async function processChunks() {
    try {
        // Initialize Pinecone client
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
            controllerHostUrl: 'https://api.pinecone.io'
        });

        // First, describe the index to verify configuration
        console.log('\nDescribing index...');
        const indexDescription = await pinecone.describeIndex(process.env.PINECONE_INDEX);
        console.log('Index Description:', JSON.stringify(indexDescription, null, 2));

        // Create index instance
        const index = pinecone.index(process.env.PINECONE_INDEX);

        // Read chunks from file
        const chunks = JSON.parse(fs.readFileSync('/tmp/walkthrough/PromptVaultAdmin_chunks5.json', 'utf-8'));
        console.log(`\nProcessing ${chunks.length} chunks...`);

        // Process chunks in batches
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(chunks.length / BATCH_SIZE)}`);

            try {
                // Get embeddings for the batch
                const vectors = await Promise.all(batch.map(async (chunk) => {
                    const embedding = await getEmbedding(chunk.content);
                    return {
                        id: chunk.id,
                        values: embedding,
                        metadata: {
                            filePath: chunk.filePath,
                            type: chunk.type,
                            ...(chunk.functionName && { functionName: chunk.functionName })
                        }
                    };
                }));

                // Upsert to Pinecone
                console.log('Attempting to upsert vectors to Pinecone...');
                await index.namespace(NAMESPACE).upsert(vectors);
                console.log(`Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}`);
            } catch (batchError) {
                console.error('Error processing batch:', batchError);
                console.error('Full error details:', JSON.stringify(batchError, null, 2));
                throw batchError;
            }
        }

        console.log('✅ All chunks processed and upserted successfully!');
    } catch (error) {
        console.error('Error processing chunks:', error.message);
        if (error.response) {
            console.error('Response error details:', error.response.data);
        }
        process.exit(1);
    }
}

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

processChunks(); 