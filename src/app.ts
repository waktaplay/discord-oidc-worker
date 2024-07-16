import {
  createApp,
  defineEventHandler,
  setResponseHeaders,
  setResponseStatus,
} from 'h3';

import jwkController from './controllers/jwk.controller';
import authorizeController from './controllers/authorize.controller';
import tokenController from './controllers/token.controller';

export const app = createApp();

app.use(jwkController);
app.use(authorizeController);
app.use(tokenController);

app.use(
  defineEventHandler(e => {
    setResponseHeaders(e, {
      'content-type': 'text/plain',
    });

    setResponseStatus(e, 404, 'Not Found');
    return '404 Not Found';
  })
);
