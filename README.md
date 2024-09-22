# Discord OIDC Provider for Cloudflare Access

Simply put: Allows you to authorise with Cloudflare Access using your Discord account via a Cloudflare Worker.
Wraps OIDC around the Discord OAuth2 API to achieve this, storing signing keys in KV.

This is a fork of [Erisa/discord-oidc-worker](https://github.com/Erisa/discord-oidc-worker) with the following changes:

- Rewritten entirely in [TypeScript](https://www.typescriptlang.org/) with [h3](https://h3.unjs.io/) for performance improvements.
- More wide range of claims are now supported, as well as the caches Discord API responses to prevent rate limiting.
- Removed config.json and replaced it with environment variables.


## Setup

Requirements:

- A Cloudflare Access account - make sure you've gone through the onboarding flow and have a `NAME.cloudflareaccess.com` subdomain.
- A [Discord developer application](https://discord.com/developers/applications) to use for OAuth2.
  - Add a redirect URI `https://YOURNAME.cloudflareaccess.com/cdn-cgi/access/callback` to the Discord application.
- An installation of Node.js

Steps:

1. Clone the repository and `cd` into it: `git clone https://github.com/waktaplay/discord-oidc-worker.git && cd discord-oidc-worker`

2. Install dependencies: `pnpm install` (or `npm install` if you don't have `pnpm` installed)

3. Create a KV namespace on Cloudflare [here](https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces).

4. Edit `wrangler.toml` to use your new KV namespace ID.

5. Add your Discord application ID, redirect URL to your environment variables in wrangler.toml.
   - ❗ Please note that the redirect URL should be in the format `https://YOURNAME.cloudflareaccess.com/cdn-cgi/access/callback`. Change `YOURNAME` to your Cloudflare Access subdomain.
   - ❗ Also, Redirect URL you set on environment variable should be the same URL you added to Discord.

Example:

```toml
[vars]
DISCORD_CLIENT_ID="YOUR_CLIENT_ID"
REDIRECT_URL="https://YOURNAME.cloudflareaccess.com/cdn-cgi/access/callback"
```

6. Add your Discord application OAuth2 secret to your environment variables:

   `wrangler secret put DISCORD_CLIENT_SECRET`

7. Publish the Worker with `wrangler deploy`!


## Usage

1. Go to the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com)

2. Navigate to Settings > Authentication, select "Add new" under Login methods, select OpenID Connect.

3. Fill the following fields:

   - Name: Whatever you want, e.g. `Discord`

   - App ID: Your Discord application ID.

   - Client secret: Your Discord application OAuth2 secret.

   - Auth URL: `https://discord-oidc.YOURNAME.workers.dev/authorize/email` or swap out `/email` for `/guilds` to include the Guilds scope.

   - Token URL: `https://discord-oidc.YOURNAME.workers.dev/token`

   - Certificate URL: `https://discord-oidc.YOURNAME.workers.dev/jwks.json`

   - Proof Key for Code Exchange (PKCE): Enabled

   - OIDC Claims:

     - Email is included automatically without being set here.

     - It would be recommended to add `id` here, as the users unique Discord user ID.

     - `preferred_username` will map to the users username and discrim if they have one e.g. `Erisa#9999` or `erisachu`

     - `username` will map to the non-unique Display Name of the user, or username if there is none. E.g. `Erisa`. Basically a safer form of `global_name`, which might sometimes be null.

     - If the Auth URL is `/guilds` then the `guilds` claim can be used to provide a list of guild IDs.

     - Anything else from here will work: https://discord.com/developers/docs/resources/user#user-object-user-structure

- See the Examples section below for help with constructing policies.


## Usage with roles (Bot required)
> :warning: This method can run into ratelimits pretty quickly if used by many users at the same time. It is recommended to use the [cached roles](#usage-with-cached-roles-bot-required-safer-method) method.
> However, this method allows to check for roles in real-time and is less likely to incur charges for KV namespace reads/writes.

1. Follow the above setup, making sure to use the `/guilds` auth URL.

2. Create a Discord Bot for the OAuth2 application, generate an OAuth2 URL with the `bot` scope and use it to invite the bot to your server.

   - The bot does not need any permissions, it just needs to exist in the server.

3. Generate a bot token and paste it into `wrangler secret put DISCORD_TOKEN`.

4. Populate `wrangler.toml` with a list of server IDs that you wish to check user roles for. **Make sure the bot is a member of all servers in this list**.

Example:

```toml
[vars]
DISCORD_CLIENT_ID="YOUR_CLIENT_ID"
REDIRECT_URL="https://YOURNAME.cloudflareaccess.com/cdn-cgi/access/callback"
SERVERS_ROLE_CLAIMS=["YOUR_SERVER_ID", "YOUR_OTHER_SERVER_ID", ...]
CACHE_ROLES=false
```

5. Edit the OIDC provider in Cloudflare Access and add the server IDs as claims prefixed with `roles:`, e.g. `roles:438781053675634713`

6. When creating a policy, reference the `roles:` claims as the name, and use the role ID as the claim value. This will match users in that server who have that role.


## Usage with roles (Without bot)
> :warning: This method relies on bearer tokens and runs into rate limits very quickly. It is not recommended to use this method unless you have a very small number of servers to check roles for.
> However, this method allows to check for roles in real-time and is less likely to incur charges for KV namespace reads/writes.

1. Follow the above setup, making sure to use the `/roles` auth URL.

2. Populate `wrangler.toml` with a list of server IDs that you wish to check user roles for. **You should set `CACHE_ROLES` to `false` when you use this method**.

Example:

```toml
[vars]
DISCORD_CLIENT_ID="YOUR_CLIENT_ID"
REDIRECT_URL="https://YOURNAME.cloudflareaccess.com/cdn-cgi/access/callback"
SERVERS_ROLE_CLAIMS=["YOUR_SERVER_ID", "YOUR_OTHER_SERVER_ID", ...]
CACHE_ROLES=false
```

3. Edit the OIDC provider in Cloudflare Access and add the server IDs as claims prefixed with `roles:`, e.g. `roles:438781053675634713`

4. When creating a policy, reference the `roles:` claims as the name, and use the role ID as the claim value. This will match users in that server who have that role.


## Usage with cached roles (Bot required, safer method)
> :warning: This method relies heavily on the KV namespace, so you may be charged for KV namespace usage when you reach your limit.
> If you don't want to worry about KV namespace limits, use the [Usage with roles (Bot required)](#usage-with-roles-bot-required) method.

1. Follow the above setup, making sure to use the `/guilds` auth URL.

2. Create a Discord Bot for the OAuth2 application, generate an OAuth2 URL with the `bot` scope and use it to invite the bot to your server.

   - The bot does not need any permissions, it just needs to exist in the server.

3. Generate a bot token and paste it into `wrangler secret put DISCORD_TOKEN`.

4. Populate `wrangler.toml` with a list of server IDs that you wish to check user roles for. **Make sure the bot is a member of all servers in this list**.

5. Set `CACHE_ROLES` to `true` in `wrangler.toml`. This will cache the roles **every hour**, and will not check the API for roles until the cache expires.

Example:

```toml
[vars]
DISCORD_CLIENT_ID="YOUR_CLIENT_ID"
REDIRECT_URL="https://YOURNAME.cloudflareaccess.com/cdn-cgi/access/callback"
SERVERS_ROLE_CLAIMS=["YOUR_SERVER_ID", "YOUR_OTHER_SERVER_ID", ...]
CACHE_ROLES=true
```

5. Edit the OIDC provider in Cloudflare Access and add the server IDs as claims prefixed with `roles:`, e.g. `roles:438781053675634713`

6. When creating a policy, reference the `roles:` claims as the name, and use the role ID as the claim value. This will match users in that server who have that role.


## Examples

My setup, as an example:

![](https://up.erisa.uk/firefox_5978jWH1ti.png)
![](https://up.erisa.uk/firefox_9Hzgvt2FiP.png)

To use this in a policy, simply enable it as an Identity provider in your Access application and then create a rule using `OIDC Claims` and the relevant claim above. Make sure the claim has been added to your provider in the steps above.

With roles:

![](https://up.erisa.uk/firefox_rfqxMIRj8t.png)

This example would allow me to access the application if I was myself on Discord or if I was a member of a specific server:
![](https://up.erisa.uk/firefox_1w0BXtk80X.png)


## Security

If you find a security vulnerability in this repository, do NOT create an Issue or Pull Request. Please contact me through email or message (minsu.kim@lunaiz.com or Discord iam.ayaan).
