# Supabase — MID3 Career

O app funciona em dois modos:

| Variáveis `.env.local` | Modo |
|---|---|
| **Ausentes** | `localStorage` (como hoje) |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Supabase (sync entre aparelhos) |

## 1. Criar o projeto

1. Abra [supabase.com](https://supabase.com) → New project  
2. Espere o banco ficar pronto  

## 2. Rodar o schema

1. Dashboard → **SQL Editor** → New query  
2. Cole o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql)  
3. Run  

Se o projeto **já existia**, rode também [`supabase/migration_classic_structure.sql`](./supabase/migration_classic_structure.sql) (colunas `structure`, `starts_on`, `ends_on` no clássico).

## 3. Auth (nome + senha)

1. **Authentication** → **Providers** → **Email**  
2. Desative **Confirm email** (senão o signup fica pendente)  
3. Salve  

O app gera um e-mail interno a partir do nome (`nome@mid3career.app`) só para o Auth do Supabase. Na UI continua **nome + senha**.

## 4. Chaves no app

1. **Project Settings** → **API**  
2. Copie **Project URL** e **anon public** key  
3. Na pasta do projeto:

```bash
cp .env.example .env.local
```

4. Preencha:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

5. Reinicie o Vite (`npm run dev`)

Na tela de loading deve aparecer `Backend: Supabase`.

## 5. Deploy (Vercel / Netlify)

1. Conecte o repo  
2. Defina as mesmas env vars no painel do host  
3. No Supabase → **Authentication** → **URL Configuration** → adicione a URL do site em **Site URL** / Redirect  

Guia do iPhone: [`IPHONE.md`](./IPHONE.md)

## 6. iPhone

1. Abra a URL no Safari  
2. Compartilhar → **Adicionar à Tela de Início**  

(Detalhes em [`IPHONE.md`](./IPHONE.md).)  

## Observações

- Contas **locais** não migram sozinhas para o Supabase — crie de novo na nuvem  
- Plano free do Supabase basta para o grupo; projeto pausa se ficar ~7 dias sem uso  
- Senha mínima no Supabase: **6 caracteres**  
