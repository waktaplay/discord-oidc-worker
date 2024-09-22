// eslint-disable-next-line n/no-unpublished-import
import type {ScheduledEvent} from '@cloudflare/workers-types';
import {APIGuildMember} from 'discord-api-types/v10';
import {CachePlugin} from '../plugins/cache.plugin';

export async function cacheRoles(
  _: ScheduledEvent,
  env: {
    KV: KVNamespace;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any | undefined;
  }
) {
  if (
    env.CACHE_ROLES &&
    env.DISCORD_TOKEN &&
    env.SERVERS_ROLE_CLAIMS &&
    (env.SERVERS_ROLE_CLAIMS as string[]).length > 0
  ) {
    const cachePlugin = new CachePlugin();
    await cachePlugin.init(env.KV);

    const memberRoleCache: {
      // Guild ID
      [key: string]: {
        // User ID
        [key: string]: string[];
      };
    } = {};

    await Promise.all(
      env.SERVERS_ROLE_CLAIMS.map(async (guildId: string) => {
        const tempMemberList: APIGuildMember[] = [];

        let last = '0';
        let recd = 1000;

        while (recd > 0) {
          // eslint-disable-next-line n/no-unsupported-features/node-builtins
          const params = new URLSearchParams({
            limit: '1000',
            after: last.toString(),
          }).toString();

          const incrMemberPromise = fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members?${params}`,
            {
              headers: {
                Authorization: `Bot ${env.DISCORD_TOKEN}`,
                'User-Agent':
                  'DiscordBot (https://github.com/waktaplay/discord-oidc-worker, v2.0.2)',
              },
            }
          );

          // This is for retrying if the request fails
          let incrMemberResp = await incrMemberPromise;

          // That might work as a minified ratelimit handler
          if (!incrMemberResp.ok && incrMemberResp.status !== 200) {
            // wait 10 seconds and try again
            await new Promise(resolve => setTimeout(resolve, 10000));
            incrMemberResp = await incrMemberPromise;
          }

          const incrMemberJson = await incrMemberResp.json<APIGuildMember[]>();
          recd = incrMemberJson.length;

          if (recd === 0) {
            last = '0';
          } else {
            incrMemberJson.map(item => {
              tempMemberList.push(item);
            });

            last = incrMemberJson[recd - 1]['user']['id'];
          }
        }

        memberRoleCache[guildId] = {};
        tempMemberList.map(item => {
          memberRoleCache[guildId][item['user']['id']] = item['roles'];
        });

        await cachePlugin.put(
          `roles:${guildId}`,
          memberRoleCache[guildId],
          3600
        );

        console.log(
          `Cached roles for ${Object.keys(memberRoleCache[guildId]).length} members in ${guildId}`
        );
      })
    );

    console.log(
      `Cached roles for ${Object.keys(memberRoleCache).length} servers`
    );
  }
}
