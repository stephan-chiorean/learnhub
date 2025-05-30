export async function readAllRows<T = any>(iterator: AsyncIterable<any>): Promise<T[]> {
    const results: T[] = [];
    for await (const batch of iterator) {
      for (let i = 0; i < batch.numRows; i++) {
        results.push(batch.get(i) as T);
      }
    }
    return results;
  }