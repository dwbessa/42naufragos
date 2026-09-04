# discord-42-naufragos

Bot de verificação para o servidor Discord da comunidade 42 Rio (Naufragos). Vincula a conta Discord do membro à conta da intra (`intra.42.fr`) via OAuth2, confirma que ele pertence ao campus 42 Rio e libera acesso dando uma role automaticamente.

## Setup

### 1. Discord Developer Portal

1. Acesse https://discord.com/developers/applications e crie uma aplicação.
2. Na aba **Bot**, crie um bot, copie o token (`DISCORD_TOKEN`) e habilite **Server Members Intent**.
3. Em **OAuth2 > URL Generator**, marque os scopes `bot` e `applications.commands`, e nas permissões: `Manage Roles`, `Manage Nicknames`, `Send Messages`, `Use Slash Commands`. Abra a URL gerada e convide o bot pro seu servidor.
4. Anote o `Application ID` (`DISCORD_CLIENT_ID`) e o ID do seu servidor (`DISCORD_GUILD_ID` — ative o modo desenvolvedor no Discord pra copiar IDs com botão direito).
5. Crie a role que será dada aos verificados (ex: "Aluno 42 Rio") e copie o ID dela (`DISCORD_VERIFIED_ROLE_ID`). Certifique que o role do bot fica **acima** dessa role na hierarquia.

### 2. Intra 42

1. Acesse https://profile.intra.42.fr/oauth/applications/new e crie uma nova aplicação OAuth.
2. Redirect URI: `<PUBLIC_BASE_URL>/oauth/callback` (precisa ser HTTPS — em dev local use `ngrok http 3000` ou `cloudflared tunnel --url http://localhost:3000`, a intra não aceita `localhost`).
3. Scope: `public`.
4. Copie o UID (`FT_CLIENT_ID`) e o Secret (`FT_CLIENT_SECRET`).
5. Descubra o `campus_id` do 42 Rio: `GET https://api.intra.42.fr/v2/campus` (autenticado com seu próprio token de app). Confirme antes de fixar `FT_CAMPUS_ID` no `.env` (provavelmente `29`, mas confirme).

### 3. Projeto

```bash
cp .env.example .env   # preencha com os valores acima
npm install
npm run register-commands   # registra o /verify na guild configurada
npm run dev
```

### 4. Teste end-to-end

1. Com o túnel HTTPS ativo e `npm run dev` rodando, rode `/verify` no servidor Discord.
2. Abra o link recebido, logue na intra, autorize.
3. Confirme que foi redirecionado pra página de sucesso, que a role foi atribuída no Discord e que chegou uma DM de confirmação.
4. Rode `/verify` de novo — deve reconhecer que você já está verificado, sem duplicar.

## Deploy (Railway)

1. Crie um projeto no Railway a partir deste repositório.
2. Configure as mesmas variáveis de ambiente do `.env` no painel do Railway (`PUBLIC_BASE_URL` e `OAUTH_REDIRECT_URI` devem usar o domínio público que o Railway atribui).
3. Atualize o Redirect URI cadastrado na intra pra esse domínio final.
4. Build command: `npm run build`. Start command: `npm start`.

## Estrutura

```
src/
├── index.ts                 # bootstrap: discord client + servidor http
├── config.ts                 # validação das env vars
├── discord/                  # bot: client, comandos, handler de interactions
├── oauth/                    # integração com a API da 42 (authorize/token/me) + state store
├── db/                       # sqlite via node:sqlite (schema + queries)
├── web/                      # servidor express: callback do oauth
└── services/                 # regra de negócio da verificação
```

Fora do escopo deste bot: estrutura de canais/roles do servidor (proposta separada, aplicada manualmente na UI do Discord).
