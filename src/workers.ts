import {toWebHandler} from 'h3';

// eslint-disable-next-line n/no-unpublished-import
import type {Request, ExecutionContext} from '@cloudflare/workers-types';

import {app} from './app';

const handler = toWebHandler(app);

export default {
  async fetch(
    request: Request,
    env: {
      KV: KVNamespace;
    },
    ctx: ExecutionContext
  ) {
    return handler(request, {
      cloudflare: {env, ctx},
    });
  },
};
