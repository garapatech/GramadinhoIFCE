# Gramadinho IFCE

Mapa 3D multijogador do gramado do IFCE — Next.js + Three.js + PartyKit.

Duas (ou mais) pessoas abrindo o mesmo link conseguem se ver andando pelo gramado, com nick acima da cabeça, chat em tempo real e voz via microfone.

## Stack

- **Next.js 15 (App Router)** — frontend, deploy na Vercel.
- **Three.js** — cena 3D, personagens, NPCs, animação.
- **PartyKit** — servidor de WebSockets serverless (free tier), broadcast de posição e chat.

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local
npm run setup:hooks
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

## Changelog automatico

O repositorio tem um hook de `pre-commit` versionado em `.githooks/pre-commit`.

Ative uma vez por clone:

```bash
npm run setup:hooks
```

A cada commit, o hook atualiza `CHANGELOG.md`.

Para gerar uma entrada semantica e mais verbosa, crie antes da alteracao final:

```bash
npm run changelog:add -- --title "Adicao de piscina" --description "Criada uma nova area no mapa com piscina, ajuste de navegacao do personagem e atualizacao visual da cena."
```

Isso grava um rascunho local em `.changelog-next.md`. No proximo commit, o hook converte esse rascunho em entrada no `CHANGELOG.md`.

Se nao houver rascunho manual, ele cai no modo tecnico e registra:

- branch atual
- resumo de insercoes e remocoes
- lista de arquivos staged

Exemplo de resultado:

```md
## Adicao de piscina
- Data: 20/05/2026, 21:10:00
- Branch: `main`
- Summary: 3 arquivo(s), 120 insercao(oes), 18 remocao(oes)

### Descricao
Criada uma nova area no mapa com piscina, ajuste de navegacao do personagem e atualizacao visual da cena.

### Arquivos
- `src/features/game/engine.js` (M)
- `src/features/game/GameView.jsx` (M)
```

O controle continua no proprio Git e no changelog, sem precisar manter `agents.md`.

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
- Botão `Voz` — solicitar microfone e entrar no chat de voz

## Estrutura

```
src/
  app/                 # Rotas Next.js App Router (menu + jogo)
  features/
    avatar/            # Configuração e personalização do personagem
    chat/              # Interface do chat
    game/              # GameView e engine Three.js
    media/             # Player de mídia do campus
    menu/              # Tela inicial
    multiplayer/       # PartySocket e voz WebRTC
  party/
    index.ts           # Servidor PartyKit (estado + chat + sinalizacao WebRTC)
partykit.json          # Config do PartyKit
```

O audio usa WebRTC entre navegadores. Em producao, `localhost` e HTTPS funcionam para solicitar microfone; redes mais restritas podem exigir servidores TURN configurados em `NEXT_PUBLIC_RTC_ICE_SERVERS`.
