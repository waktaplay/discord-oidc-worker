import {toWebHandler} from 'h3';

import type {
  Request,
  ScheduledEvent,
  ExecutionContext,
  // eslint-disable-next-line n/no-unpublished-import
} from '@cloudflare/workers-types';

import {app} from './app';
import {CloudflareEnv} from './types/cloudflare';
import {cacheRoles} from './utils/roles';

const handler = toWebHandler(app);

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return handler(request, {
      cloudflare: {env, ctx},
    });
  },
  async scheduled(
    event: ScheduledEvent,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ) {
    if (
      env.CACHE_ROLES &&
      env.DISCORD_TOKEN &&
      env.SERVERS_ROLE_CLAIMS &&
      (env.SERVERS_ROLE_CLAIMS as string[]).length > 0
    ) {
      ctx.waitUntil(cacheRoles(event, env));
    }
  },
};
