import {createRouter, defineEventHandler} from 'h3';
import {JwtPlugin} from '../plugins/jwk.plugin';

import {H3EventContextWithCloudflare} from '../types/cloudflare';

const router = createRouter();
const jwtPlugin = new JwtPlugin();

router.get(
  '/jwks.json',
  defineEventHandler(async e => {
    const c = e.context as H3EventContextWithCloudflare;

    const publicKey = (
      await jwtPlugin.loadOrGenerateKeyPair(c.cloudflare.env.KV)
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
