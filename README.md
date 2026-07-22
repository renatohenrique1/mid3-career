# MID3 Career

App para registrar sets de tênis em torneios, com ranking e pontuação.

## Fluxo

1. **Entrar / Criar conta** (nome + senha)
2. Áreas: **Feed · Ranking · Stats · Torneios · Sets**
3. Torneios têm **formato** (clássico / TB / FH / BH / 15–40) e pontuação própria
4. Encerrar torneio define o campeão pelo ranking e publica no feed

## Dados

- **Sem `.env.local`** → `localStorage` no navegador  
- **Com Supabase configurado** → sync na nuvem (iPhone + PCs)

Guia completo: [`SUPABASE.md`](./SUPABASE.md)  
iPhone (grátis): [`IPHONE.md`](./IPHONE.md)

## Rodar local

```bash
npm install
npm run dev
```

Opcional — Supabase:

```bash
cp .env.example .env.local
# preencha URL + anon key
npm run dev
```
