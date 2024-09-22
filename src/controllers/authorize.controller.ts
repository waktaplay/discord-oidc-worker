import {
  createRouter,
  defineEventHandler,
  getQuery,
  sendRedirect,
  setResponseHeaders,
  setResponseStatus,
} from 'h3';

import {H3EventContextWithCloudflare} from '../types/cloudflare';

const router = createRouter();

router.get(
  '/authorize/:scopemode',
  defineEventHandler(async e => {
    const c = e.context as H3EventContextWithCloudflare;
    const query = getQuery(e);

    const scopeMode = {
      email: 'identify email',
      guilds: 'identify email guilds',
      roles: 'identify email guilds guilds.members.read',
    };

    if (
      !c.cloudflare.env?.DISCORD_CLIENT_ID ||
      !c.cloudflare.env?.REDIRECT_URL
    ) {
      setResponseHeaders(e, {
        'content-type': 'text/plain',
      });

      setResponseStatus(e, 500, 'Internal Server Error');
      return '500 Internal Server Error: `Client ID` or `Redirect URL` is not correctly set.';
    }

    if (
      query.client_id !== c.cloudflare.env.DISCORD_CLIENT_ID ||
      query.redirect_uri !== c.cloudflare.env.REDIRECT_URL ||
      c.params?.scopemode === undefined ||
      !Object.keys(scopeMode).includes(c.params.scopemode)
    ) {
      setResponseHeaders(e, {
        'content-type': 'text/plain',
      });

      setResponseStatus(e, 400, 'Bad Request');
      return '400 Bad Request: Invalid parameters.';
    }

    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const params = new URLSearchParams({
      client_id: c.cloudflare.env.DISCORD_CLIENT_ID as string,
      redirect_uri: c.cloudflare.env.REDIRECT_URL as string,
      response_type: 'code',
      scope: scopeMode[c.params.scopemode as keyof typeof scopeMode],
      state: query.state as string,
      prompt: 'none',
    }).toString();

    return sendRedirect(
      e,
      `https://discord.com/api/oauth2/authorize?${params}`
    );
  })
);

export default router;
