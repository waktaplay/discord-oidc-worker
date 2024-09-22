import {
  createRouter,
  defineEventHandler,
  readFormData,
  setResponseHeaders,
  setResponseStatus,
} from 'h3';

import {
  APIGuild,
  APIGuildMember,
  APIUser,
  type RESTPostOAuth2AccessTokenResult,
} from 'discord-api-types/v10';

import * as jose from 'jose';

import {JwtPlugin} from '../plugins/jwk.plugin';
import {CachePlugin} from '../plugins/cache.plugin';

import {H3EventContextWithCloudflare} from '../types/cloudflare';

const router = createRouter();
const jwtPlugin = new JwtPlugin();
const cachePlugin = new CachePlugin();

router.post(
  '/token',
  defineEventHandler(async e => {
    const c = e.context as H3EventContextWithCloudflare;
    const body = await readFormData(e);
    const code = body.get('code');

    await cachePlugin.init(c.cloudflare.env.KV);

    if (!code) {
      setResponseHeaders(e, {
        'content-type': 'text/plain',
      });

      setResponseStatus(e, 400, 'Bad Request');
      return '400 Bad Request: Invalid parameters.';
    }

    if (
      !c.cloudflare.env?.DISCORD_CLIENT_ID ||
      !c.cloudflare.env?.DISCORD_CLIENT_SECRET ||
      !c.cloudflare.env?.REDIRECT_URL
    ) {
      setResponseHeaders(e, {
        'content-type': 'text/plain',
      });

      setResponseStatus(e, 500, 'Internal Server Error');
      return '500 Internal Server Error: `Client ID` or `Client Secret` or `Redirect URL` is not correctly set.';
    }

    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const params = new URLSearchParams({
      client_id: c.cloudflare.env.DISCORD_CLIENT_ID,
      client_secret: c.cloudflare.env.DISCORD_CLIENT_SECRET,
      redirect_uri: c.cloudflare.env.REDIRECT_URL,
      code: code,
      grant_type: 'authorization_code',
    }).toString();

    const r = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'DiscordBot (https://github.com/waktaplay/discord-oidc-worker, v2.0.2)',
      },
    }).then(res => res.json<RESTPostOAuth2AccessTokenResult>());

    if (!r) {
      setResponseHeaders(e, {
        'content-type': 'text/plain',
      });

      setResponseStatus(e, 400, 'Bad Request');
      return '400 Bad Request: Error while fetching the access token.';
    }

    const returned_scope = r['scope'].split(' ');

    const userInfo = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${r['access_token']}`,
        'User-Agent':
          'DiscordBot (https://github.com/waktaplay/discord-oidc-worker, v2.0.2)',
      },
    }).then(res => res.json<APIUser>());

    if (!userInfo || !userInfo.id) {
      setResponseHeaders(e, {
        'content-type': 'text/plain',
      });

      setResponseStatus(e, 400, 'Bad Request');
      return '400 Bad Request: Error while fetching the user info.';
    }

    if (!userInfo['verified']) {
      setResponseHeaders(e, {
        'content-type': 'text/plain',
      });

      setResponseStatus(e, 403, 'Forbidden');
      return "403 Forbidden: You don't have access to login to this resource.";
    }

    let servers: string[] = [];

    if (returned_scope.includes('guilds')) {
      const serversResp = await fetch(
        'https://discord.com/api/v10/users/@me/guilds',
        {
          headers: {
            Authorization: `Bearer ${r['access_token']}`,
            'User-Agent':
              'DiscordBot (https://github.com/waktaplay/discord-oidc-worker, v2.0.2)',
          },
        }
      );

      if (serversResp.ok && serversResp.status === 200) {
        const serverJson = await serversResp.json<APIGuild[]>();
        servers = serverJson.map(x => x['id']);
      }
    }

    const roleClaims: {
      [key: string]: string[];
    } = {};

    if (
      c.cloudflare.env.DISCORD_TOKEN &&
      c.cloudflare.env.SERVERS_ROLE_CLAIMS &&
      (c.cloudflare.env.SERVERS_ROLE_CLAIMS as string[]).length > 0
    ) {
      await Promise.all(
        c.cloudflare.env.SERVERS_ROLE_CLAIMS.map(async (guildId: string) => {
          if (c.cloudflare.env.CACHE_ROLES) {
            const roleCache = await cachePlugin.get<{
              // User ID
              [key: string]: string[];
            }>(`roles:${guildId}`);

            if (roleCache && userInfo['id'] in roleCache) {
              roleClaims[`roles:${guildId}`] = roleCache[userInfo['id']];
            }
          } else {
            if (servers.includes(guildId)) {
              const isFromMember = returned_scope.includes(
                'guilds.members.read'
              );

              const memberResp = await fetch(
                isFromMember
                  ? `https://discord.com/api/users/@me/guilds/${guildId}/member`
                  : `https://discord.com/api/v10/guilds/${guildId}/members/${userInfo['id']}`,
                {
                  headers: {
                    Authorization: isFromMember
                      ? `Bearer ${r['access_token']}`
                      : `Bot ${c.cloudflare.env.DISCORD_TOKEN}`,
                    'User-Agent':
                      'DiscordBot (https://github.com/waktaplay/discord-oidc-worker, v2.0.2)',
                  },
                }
              ).then(res => res.json<APIGuildMember>());

              roleClaims[`roles:${guildId}`] = memberResp.roles;
            }
          }
        })
      );
    }

    let preferred_username = userInfo['username'];

    if (userInfo['discriminator'] && userInfo['discriminator'] !== '0') {
      preferred_username += `#${userInfo['discriminator']}`;
    }

    const displayName = userInfo['global_name'] ?? userInfo['username'];

    const idToken = await new jose.SignJWT({
      aud: c.cloudflare.env.DISCORD_CLIENT_ID,
      iss: 'https://www.cloudflare.com',

      email: userInfo['email'],

      ...userInfo,
      username: displayName,
      global_name: userInfo['global_name'],
      preferred_username,
      avatar_url: `https://cdn.discordapp.com/avatars/${userInfo['id']}/${userInfo['avatar']}.png`,

      ...roleClaims,
      guilds: servers,
    })
      .setProtectedHeader({alg: 'RS256'})
      .setExpirationTime('1h')
      .setAudience(c.cloudflare.env.DISCORD_CLIENT_ID)
      .sign(
        (await jwtPlugin.loadOrGenerateKeyPair(c.cloudflare.env.KV)).privateKey
      );

    return {
      ...r,
      scope: 'identify email',
      id_token: idToken,
    };
  })
);

export default router;
