# Gramadinho IFCE

Mapa 3D do gramado do IFCE com Three.js e personagem controlável.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build para GitHub Pages

```bash
npm run build
```

O projeto já está configurado com `base: "./"` no Vite, então o build gerado em `dist/` funciona como site estático no GitHub Pages.

## Deploy com GitHub Actions

1. Faça push para a branch `main`.
2. No GitHub, entre em `Settings > Pages`.
3. Em `Build and deployment`, selecione `GitHub Actions`.
4. O workflow em [`.github/workflows/deploy.yml`](/home/crdev/projetos/GramadinhoIFCE/.github/workflows/deploy.yml:1) vai publicar automaticamente o conteúdo de `dist/`.

## Controles

- `WASD` ou setas para mover.
