import {createRouter, defineEventHandler} from 'h3';
import {JwtPlugin} from '../plugins/jwk.plugin';

const router = createRouter();
const jwtPlugin = new JwtPlugin();

router.get(
  '/jwks.json',
  defineEventHandler(async e => {
    const publicKey = (
      await jwtPlugin.loadOrGenerateKeyPair(e.context.cloudflare.env.KV)
    ).publicKey;

    return {
      keys: [
        {
          alg: 'RS256',
          kid: 'jwtRS256',
          ...(await crypto.subtle.exportKey('jwk', publicKey)),
        },
      ],
    };
  })
);

export default router;
