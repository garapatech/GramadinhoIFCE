# Gramadinho IFCE

Mapa 3D multijogador do gramado do IFCE — Next.js + Three.js + PartyKit.

Duas (ou mais) pessoas abrindo o mesmo link conseguem se ver andando pelo gramado, com nick acima da cabeça e chat em tempo real.

## Stack

- **Next.js 15 (App Router)** — frontend, deploy na Vercel.
- **Three.js** — cena 3D, personagens, NPCs, animação.
- **PartyKit** — servidor de WebSockets serverless (free tier), broadcast de posição e chat.

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local
npm run dev:all
```

Isso sobe:

- Next.js em `http://localhost:3000`
- PartyKit em `127.0.0.1:1999`

Se preferir terminais separados:

```bash
npm run dev:party   # terminal 1
npm run dev         # terminal 2
```

Abra dois navegadores (ou janelas anônimas) em `http://localhost:3000` para testar o multiplayer.

## Deploy

### 1. Deploy do servidor PartyKit

```bash
npx partykit login
npm run deploy:party
```

No final você vai receber um host parecido com:

```
gramadinho-ifce.SEU-USUARIO.partykit.dev
```

### 2. Deploy do Next.js na Vercel

```bash
npx vercel
```

Na primeira execução, defina a variável de ambiente na Vercel:

```
NEXT_PUBLIC_PARTYKIT_HOST=gramadinho-ifce.SEU-USUARIO.partykit.dev
```

(Pode ser feito também pelo painel da Vercel em *Project → Settings → Environment Variables*.)

Depois disso, qualquer push para `main` faz redeploy automático.

## Controles

- `WASD` ou setas — mover
- `E` — interagir com bancos, NPCs, etc.
- `Enter` — abrir chat
- `Esc` — sair do chat

## Estrutura

```
app/                 # Páginas Next (menu + jogo)
components/          # MainMenu, GameView, Chat
lib/
  game.js            # bootGame(): toda a lógica Three.js
  multiplayer.js     # wrapper do PartySocket
party/
  index.ts           # servidor PartyKit (estado + chat)
partykit.json        # config do PartyKit
```
