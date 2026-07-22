# iPhone de graça — MID3 Career

Sem App Store. O caminho gratuito é: **site na Vercel + Supabase + Safari → Tela de Início**.

## Checklist rápido

1. App no GitHub  
2. Deploy na Vercel (free) com as env vars do Supabase  
3. Liberar a URL no Supabase Auth  
4. No iPhone: Safari → Adicionar à Tela de Início  

---

## Passo 1 — Código no GitHub

Se ainda não tiver repositório remoto:

```bash
git add .
git commit -m "Prepare PWA and Supabase for iPhone deploy"
git branch -M main
git remote add origin https://github.com/SEU_USER/mid3-career.git
git push -u origin main
```

(Crie o repo vazio no GitHub antes, se precisar.)

---

## Passo 2 — Deploy na Vercel (grátis)

1. Entre em [vercel.com](https://vercel.com) com a conta GitHub  
2. **Add New… → Project** → importe `mid3-career`  
3. Em **Environment Variables**, adicione as mesmas do `.env.local`:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://eiuochnckqfuccgxlvlj.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | sua anon/publishable key |

4. Deploy  
5. Anote a URL, tipo: `https://mid3-career.vercel.app`

---

## Passo 3 — Liberar o site no Supabase

1. Supabase → **Authentication** → **URL Configuration**  
2. **Site URL** = `https://mid3-career.vercel.app` (a sua URL real)  
3. Em **Redirect URLs**, adicione a mesma URL (e `http://localhost:5173` se quiser testar no PC)  
4. Save  

Confirme também: **Email** provider com **Confirm email** desligado (já orientado no `SUPABASE.md`).

---

## Passo 4 — No iPhone (Safari)

1. Abra a URL da Vercel **no Safari** (não no Chrome do iPhone)  
2. Toque em **Compartilhar** (quadrado com seta)  
3. **Adicionar à Tela de Início**  
4. Nome: `MID3` → Adicionar  

Pronto: ícone na home, abre em tela cheia, dados no Supabase (mesmo ranking no PC e no celular).

---

## Testar

1. Crie uma conta no iPhone (nome + senha, mín. 6 caracteres)  
2. No PC, abra a mesma URL e entre com a mesma conta (ou outra)  
3. Registre um set e veja se aparece nos dois  

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| Continua “Backend: local” | Env vars na Vercel + **redeploy** |
| Login falha no celular | Site URL / Redirect no Supabase + Confirm email off |
| Ícone feio / abre no Safari | Use Safari + “Adicionar à Tela de Início” de novo |
| Amigos não veem os dados | Todos precisam da **mesma URL** (Vercel), não `localhost` |

---

## Custo

- Vercel Hobby: grátis  
- Supabase Free: grátis (pausa se ~7 dias sem uso — basta abrir o app)  
- App Store: **não precisa**  
