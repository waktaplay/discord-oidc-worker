import {
  createRouter,
  defineEventHandler,
  getQuery,
  sendRedirect,
  setResponseHeaders,
  setResponseStatus,
} from 'h3';

const router = createRouter();

router.get(
  '/authorize/:scopemode',
  defineEventHandler(async e => {
    const c = e.context;
    const query = getQuery(e);

    if (!c.cloudflare.env?.CLIENT_ID || !c.cloudflare.env?.REDIRECT_URL) {
      setResponseHeaders(e, {
        'content-type': 'text/plain',
      });

      setResponseStatus(e, 500, 'Internal Server Error');
      return '500 Internal Server Error: `Client ID` or `Redirect URL` is not correctly set.';
    }

    if (
      query.client_id !== c.cloudflare.env.CLIENT_ID ||
      query.redirect_uri !== c.cloudflare.env.REDIRECT_URL ||
      c.params?.scopemode === undefined ||
      !['guilds', 'email'].includes(c.params.scopemode)
    ) {
      setResponseHeaders(e, {
        'content-type': 'text/plain',
      });

      setResponseStatus(e, 400, 'Bad Request');
      return '400 Bad Request: Invalid parameters.';
    }

    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const params = new URLSearchParams({
      client_id: c.cloudflare.env.CLIENT_ID as string,
      redirect_uri: c.cloudflare.env.REDIRECT_URL as string,
      response_type: 'code',
      scope:
        c.params!.scopemode === 'guilds'
          ? 'identify email guilds'
          : 'identify email',
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
