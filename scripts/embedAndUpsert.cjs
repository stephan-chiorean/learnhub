require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const Bottleneck = require('bottleneck');
const lancedb = require('@lancedb/lancedb');
const os = require('os');
const arrow = require('apache-arrow');

// Token limits and rate limiting
const TPM_LIMIT = 30000;
const BATCH_SIZE = 50;

// Command line args
const [,, chunksFile, namespace] = process.argv;

if (!chunksFile || !namespace) {
  console.error('❌ Usage: node embedAndUpsert.cjs <chunksFile> <namespace>');
  process.exit(1);
}

// Verify chunks file exists
if (!fs.existsSync(chunksFile)) {
  console.error(`❌ Error: Chunks file not found: ${chunksFile}`);
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure Bottleneck for OpenAI rate limits
const gptLimiter = new Bottleneck({
  maxConcurrent: 10,
  reservoir: 500,
  reservoirRefreshAmount: 500,
  reservoirRefreshInterval: 60 * 1000
});

// State
let startTime = Date.now();
let totalChunks = 0;
let processedChunks = 0;
let totalVectors = 0;
let processedVectors = 0;

function emitProgress(stage, message, progress = null) {
  const elapsed = (Date.now() - startTime) / 1000;
  const stats = {
    totalChunks,
    processedChunks,
    totalVectors,
    processedVectors
  };

  const progressEvent = {
    timestamp: new Date().toISOString(),
    stage,
    message,
    elapsed,
    progress,
    stats
  };

  console.log('📊 Progress:', JSON.stringify(progressEvent));
}

async function getEmbedding(text) {
  try {
    const response = await gptLimiter.schedule(() =>
      openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
        encoding_format: 'float'
      })
    );
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Embedding error:', error);
    emitProgress('error', `❌ Embedding error: ${error.message}`);
    throw error;
  }
}

// Helper function to format chunk for LanceDB
function formatChunkForLanceDB(chunk) {
  return {
    id: chunk.id,
    chunk_hash: chunk.chunk_hash,
    relative_path: `${namespace}/${chunk.relative_path}`,
    start_line: chunk.start_line,
    end_line: chunk.end_line,
    content: chunk.content
  };
}

async function processChunks() {
  try {
    emitProgress('init', '📦 Initializing LanceDB...');
    
    // Initialize LanceDB
    const db = await lancedb.connect('~/.walkthrough/lancedb');
    let chunksTable, embeddingsTable;
    
    try {
      try {
        chunksTable = await db.openTable('chunks');
        embeddingsTable = await db.openTable('embeddings');

        // Verify schemas
        const chunksSchema = await chunksTable.schema();
        const embeddingsSchema = await embeddingsTable.schema();
      } catch (error) {
        console.error('❌ Error connecting to LanceDB tables:', error);
        console.error('Please run init_lancedb.js first to create the tables');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error managing tables:', error);
      process.exit(1);
    }

    emitProgress('init', '📄 Reading chunks...');
    const rawChunks = JSON.parse(fs.readFileSync(chunksFile, 'utf-8'));
    const chunks = rawChunks.map(formatChunkForLanceDB);
    totalChunks = chunks.length;
    emitProgress('init', `🔍 Found ${totalChunks} chunks`);

    // First, store all chunks in the chunks table
    try {
      const schema = await chunksTable.schema();
      await chunksTable.add(chunks);
      emitProgress('chunks', `💾 Stored ${chunks.length} chunks in chunks table`);
    } catch (error) {
      console.error('❌ Failed to write chunks:', error);
      const schema = await chunksTable.schema();
      console.error('Error details:', {
        schema: schema,
        schemaFields: schema.fields.map(f => f.name),
        firstChunk: chunks[0],
        firstChunkKeys: Object.keys(chunks[0])
      });
      emitProgress('error', `❌ Failed to write chunks to LanceDB: ${error.message}`);
      process.exit(1);
    }

    // Then process chunks in batches for embeddings
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      emitProgress('batch', `⚙️ Processing batch ${batchNumber}`, (i / totalChunks) * 100);

      // Generate embeddings in parallel with fault tolerance
      totalVectors = batch.length;
      processedVectors = 0;

      const vectorResults = await Promise.allSettled(
        batch.map(async chunk => {
          try {
            // Get the content from the file using the chunk's location
            // Remove the namespace prefix when reading the file
            const relativePath = chunk.relative_path.replace(`${namespace}/`, '');
            const filePath = path.join(process.cwd(), '..', relativePath);
            
            if (!fs.existsSync(filePath)) {
              console.error('❌ File not found:', filePath);
              emitProgress('error', `❌ File not found: ${filePath}`);
              return null;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const chunkContent = lines.slice(chunk.start_line - 1, chunk.end_line).join('\n');
            
            const values = await getEmbedding(chunkContent);
            processedVectors++;
            emitProgress('embedding', `📌 Vectorized ${chunk.chunk_hash}`, (processedVectors / totalVectors) * 100);
            
            return {
              chunk_hash: chunk.chunk_hash,
              embedding: values
            };
          } catch (error) {
            console.error('❌ Failed to process chunk:', chunk.chunk_hash, error);
            emitProgress('error', `❌ Failed to generate embedding for ${chunk.chunk_hash}: ${error.message}`);
            return null;
          }
        })
      );

      const validVectors = vectorResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

      // Write embeddings to LanceDB
      try {
        await embeddingsTable.add(validVectors);
        emitProgress('embeddings', `💾 Stored ${validVectors.length} embeddings in embeddings table`);
      } catch (error) {
        console.error('❌ Failed to write embeddings:', error);
        emitProgress('error', `❌ Failed to write embeddings to LanceDB: ${error.message}`);
        if (validVectors.length > 0) {
          console.error('Failed record structure:', JSON.stringify(validVectors[0], null, 2));
        }
      }

      processedChunks += batch.length;
      emitProgress('batch', `✅ Finished batch ${batchNumber}`, (processedChunks / totalChunks) * 100);
    }

    const totalTime = (Date.now() - startTime) / 1000;
    emitProgress('complete', `🏁 Done in ${totalTime.toFixed(2)} seconds`, 100);
  } catch (err) {
    console.error('❌ Fatal error:', err);
    emitProgress('fatal', `❌ Fatal: ${err.message}`);
    process.exit(1);
  }
}

processChunks();