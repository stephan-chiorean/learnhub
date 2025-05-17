require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');
const tiktoken = require('@dqbd/tiktoken');
const OpenAI = require('openai');
const Bottleneck = require('bottleneck');

const enc = tiktoken.encoding_for_model('gpt-3.5-turbo');

// Token limits and rate limiting
const GPT_3_5_LIMIT = 3800;
const GPT_4_O_LIMIT = 120000;
const TPM_LIMIT = 30000;
const RETRY_DELAY = 60000;
const MAX_RETRIES = 3;
const BATCH_SIZE = 50;
const UPSERT_BATCH_SIZE = 25;

// Command line args
const [,, chunksFile, summariesFile, namespace] = process.argv;
if (!chunksFile || !summariesFile || !namespace) {
  console.error('Usage: node embedAndUpsert.cjs <chunksFile> <summariesFile> <namespace>');
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure Bottleneck for OpenAI rate limits (500 RPM, 30k TPM)
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
let totalSummaries = 0;
let processedSummaries = 0;
let totalVectors = 0;
let processedVectors = 0;

// Utility
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function emitProgress(stage, message, progress = null) {
  const elapsed = (Date.now() - startTime) / 1000;
  const stats = {
    totalChunks,
    processedChunks,
    totalSummaries,
    processedSummaries,
    totalVectors,
    processedVectors
  };

  // Calculate overall progress based on the stage
  let overallProgress = null;
  if (progress !== null) {
    if (stage === 'summary') {
      overallProgress = ((processedChunks - BATCH_SIZE + processedSummaries) / totalChunks) * 100;
    } else if (stage === 'embedding') {
      overallProgress = ((processedChunks - BATCH_SIZE + processedVectors) / totalChunks) * 100;
    } else {
      overallProgress = progress;
    }
  }

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    stage,
    message,
    elapsed,
    progress: overallProgress,
    stats
  }));
}

function splitLargeChunk(chunk) {
  const lines = chunk.text.split('\n');
  const chunks = [];
  let currentChunk = [];
  let currentTokens = 0;

  for (const line of lines) {
    const lineTokens = enc.encode(line).length;
    if (currentTokens + lineTokens > GPT_3_5_LIMIT) {
      if (currentChunk.length > 0) {
        chunks.push({
          ...chunk,
          text: currentChunk.join('\n'),
          id: `${chunk.id}_part${chunks.length + 1}`
        });
        currentChunk = [];
        currentTokens = 0;
      }
    }
    currentChunk.push(line);
    currentTokens += lineTokens;
  }

  if (currentChunk.length > 0) {
    chunks.push({
      ...chunk,
      text: currentChunk.join('\n'),
      id: `${chunk.id}_part${chunks.length + 1}`
    });
  }

  return chunks;
}

async function generateNaturalLanguageSummary(chunk, retryCount = 0) {
  const codeContent = typeof chunk.text === 'string' ? chunk.text : chunk.content;
  if (!codeContent) {
    emitProgress('summary', `Skipping chunk ${chunk.id} - no content`);
    return null;
  }

  const promptPrefix = `Explain the following ${chunk.type} found in ${chunk.filePath || chunk.file_path} in plain English:\n\n`;
  const totalTokens = enc.encode(promptPrefix + codeContent).length;

  if (totalTokens > GPT_4_O_LIMIT) {
    emitProgress('summary', `⚠️ Skipping chunk ${chunk.id} - too large (${totalTokens} tokens)`);
    return null;
  }

  const model = totalTokens > GPT_3_5_LIMIT ? 'gpt-4o' : 'gpt-3.5-turbo';

  try {
    // Use gptLimiter to schedule the request
    const completion = await gptLimiter.schedule(() =>
      openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are a senior software engineer who explains code clearly and concisely." },
          { role: "user", content: promptPrefix + codeContent }
        ],
        temperature: 0.3,
        max_tokens: 150
      })
    );

    const summary = completion.choices[0].message.content.trim();
    processedSummaries++;
    emitProgress('summary', `✅ Summary for ${chunk.id}`, (processedSummaries / totalSummaries) * 100);

    // Clean metadata to ensure no null values
    return {
      id: chunk.id,
      filePath: chunk.filePath || chunk.file_path || '',
      type: chunk.type || 'unknown',
      summary,
      functionName: chunk.functionName || chunk.function_name || '',
      startLine: chunk.startLine ?? chunk.start_line ?? 0,
      endLine: chunk.endLine ?? chunk.end_line ?? 0,
      extension: chunk.extension || '',
      fileName: chunk.fileName || '',
      relativeDir: chunk.relativeDir || '',
      isTestFile: chunk.isTestFile || false,
      zoneGuess: chunk.zoneGuess || ''
    };
  } catch (error) {
    if (error.code === 'rate_limit_exceeded' && retryCount < MAX_RETRIES) {
      emitProgress('summary', `🔁 Retry ${retryCount + 1} for ${chunk.id} in ${RETRY_DELAY / 1000}s`);
      await wait(RETRY_DELAY);
      return generateNaturalLanguageSummary(chunk, retryCount + 1);
    }
    emitProgress('error', `❌ Failed summary for ${chunk.id}: ${error.message}`);
    return null;
  }
}

async function getEmbedding(text) {
  try {
    // Use gptLimiter to schedule the embedding request
    const response = await gptLimiter.schedule(() =>
      openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
        encoding_format: 'float'
      })
    );
    return response.data[0].embedding;
  } catch (error) {
    emitProgress('error', `❌ Embedding error: ${error.message}`);
    throw error;
  }
}

async function processChunks() {
  try {
    emitProgress('init', '📦 Initializing Pinecone...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      controllerHostUrl: 'https://api.pinecone.io'
    });

    const index = pinecone.index(process.env.PINECONE_INDEX);

    emitProgress('init', '📄 Reading chunks...');
    const chunks = JSON.parse(fs.readFileSync(chunksFile, 'utf-8'));
    totalChunks = chunks.length;
    emitProgress('init', `🔍 Found ${totalChunks} chunks`);

    const summaries = [];
    const vectors = [];

    // Process chunks in parallel batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      emitProgress('batch', `⚙️ Processing batch ${batchNumber}`, (i / totalChunks) * 100);

      // Expand large chunks
      const expandedBatch = [];
      for (const chunk of batch) {
        const tokens = enc.encode(chunk.text || chunk.content).length;
        if (tokens > GPT_4_O_LIMIT) {
          emitProgress('chunk', `⚠️ Skipping huge chunk ${chunk.id} (${tokens} tokens)`);
          continue;
        }
        expandedBatch.push(chunk);
      }

      // Update total summaries for this batch
      totalSummaries = expandedBatch.length;
      processedSummaries = 0;

      // Generate summaries in parallel with fault tolerance
      const summaryResults = await Promise.allSettled(
        expandedBatch.map(chunk => generateNaturalLanguageSummary(chunk))
      );

      const batchSummaries = summaryResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

      summaries.push(...batchSummaries);
      processedChunks += batch.length;

      // Generate embeddings in parallel with fault tolerance
      totalVectors = batchSummaries.length;
      processedVectors = 0;

      const vectorResults = await Promise.allSettled(
        batchSummaries.map(async summary => {
          if (!summary || !summary.summary) {
            emitProgress('error', `❌ Skipping embedding for ${summary?.id || 'unknown'} - no summary text`);
            return null;
          }

          try {
            const values = await getEmbedding(summary.summary);
            processedVectors++;
            emitProgress('embedding', `📌 Vectorized ${summary.id}`, (processedVectors / totalVectors) * 100);
            return {
              id: summary.id,
              values,
              metadata: summary
            };
          } catch (error) {
            emitProgress('error', `❌ Failed to generate embedding for ${summary.id}: ${error.message}`);
            return null;
          }
        })
      );

      const validVectors = vectorResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

      vectors.push(...validVectors);

      // Upsert vectors in parallel batches with fault tolerance
      const upsertPromises = [];
      for (let j = 0; j < validVectors.length; j += UPSERT_BATCH_SIZE) {
        const subBatch = validVectors.slice(j, j + UPSERT_BATCH_SIZE);
        upsertPromises.push(
          index.namespace(namespace).upsert(subBatch)
            .then(() => {
              emitProgress('upserting', `🧩 Upserted ${subBatch.length} vectors`);
            })
            .catch(error => {
              emitProgress('error', `❌ Failed to upsert batch: ${error.message}`);
            })
        );
      }

      // Wait for all upserts to complete before moving to next batch
      await Promise.allSettled(upsertPromises);

      emitProgress('batch', `✅ Finished batch ${batchNumber}`, (processedChunks / totalChunks) * 100);
    }

    // Save summaries even if some vectors failed to upsert
    fs.writeFileSync(summariesFile, JSON.stringify(summaries, null, 2));
    const totalTime = (Date.now() - startTime) / 1000;
    emitProgress('complete', `🏁 Done in ${totalTime.toFixed(2)} seconds`, 100);
  } catch (err) {
    emitProgress('fatal', `❌ Fatal: ${err.message}`);
    // Write partial results before exiting
    try {
      if (summaries.length > 0) {
        fs.writeFileSync(summariesFile, JSON.stringify(summaries, null, 2));
        emitProgress('error', `💾 Saved ${summaries.length} summaries before exit`);
      }
    } catch (writeError) {
      emitProgress('error', `❌ Failed to save summaries: ${writeError.message}`);
    }
    process.exit(1);
  }
}

processChunks();