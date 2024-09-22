import type {H3EventContext} from 'h3';

// eslint-disable-next-line n/no-unpublished-import
import type {KVNamespace, ExecutionContext} from '@cloudflare/workers-types';

export interface CloudflareEnv {
  KV: KVNamespace;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any | undefined;
}

export interface H3EventContextWithCloudflare extends H3EventContext {
  cloudflare: {
    env: CloudflareEnv;
    ctx: ExecutionContext;
  };
}
