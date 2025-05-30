import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import * as arrow from 'apache-arrow';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeLanceDB() {
  try {
    const dbPath = path.join(os.homedir(), '.walkthrough', 'lancedb');
    console.log('🔌 Connecting to LanceDB at:', dbPath);
    const db = await lancedb.connect(dbPath);

    // Drop and recreate chunks table
    try {
      await db.dropTable('chunks');
      console.log('🗑️ Dropped existing chunks table');
    } catch (_) {}

    const chunksSchema = new arrow.Schema([
      new arrow.Field('id', new arrow.Utf8()),
      new arrow.Field('chunk_hash', new arrow.Utf8()),
      new arrow.Field('relative_path', new arrow.Utf8()),
      new arrow.Field('start_line', new arrow.Int32()),
      new arrow.Field('end_line', new arrow.Int32()),
      new arrow.Field('content', new arrow.Utf8(), true) // optional
    ]);

    await db.createEmptyTable('chunks', chunksSchema, { mode: 'overwrite' });
    console.log('✅ Created chunks table');

    // Drop and recreate embeddings table
    try {
      await db.dropTable('embeddings');
      console.log('🗑️ Dropped existing embeddings table');
    } catch (_) {}

    const embeddingsSchema = new arrow.Schema([
      new arrow.Field('chunk_hash', new arrow.Utf8()),
      new arrow.Field(
        'embedding',
        new arrow.FixedSizeList(1536, new arrow.Field('item', new arrow.Float32()))
      )
    ]);

    const embeddingsTable = await db.createEmptyTable('embeddings', embeddingsSchema, {
      mode: 'overwrite'
    });
    console.log('✅ Created embeddings table');

    // Add a dummy row to verify
    await embeddingsTable.add([
      {
        chunk_hash: 'sample_hash',
        embedding: Array(1536).fill(0)
      }
    ]);
    console.log('✅ Added sample embedding');

    const schema = await embeddingsTable.schema();
    console.log('📊 Embeddings schema:', schema.toString());
  } catch (err) {
    console.error('❌ Error initializing LanceDB:', err);
    process.exit(1);
  }
}

initializeLanceDB();