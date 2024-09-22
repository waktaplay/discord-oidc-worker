export class CachePlugin {
  declare KV: KVNamespace;

  async init(KV: KVNamespace) {
    this.KV = KV;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.KV) {
      throw new Error('KV namespace not initialized');
    }

    return ((await this.KV.get(key, {type: 'json'})) as T) || null;
  }

  async put(key: string, value: unknown, expirationTtl = 3600) {
    if (!this.KV) {
      throw new Error('KV namespace not initialized');
    }

    await this.KV.put(key, JSON.stringify(value), {expirationTtl});
    return;
  }
}
