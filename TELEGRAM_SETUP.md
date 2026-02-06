# SpeakMate AI — Telegram Mini App Setup Guide

## Overview

SpeakMate AI Telegram Mini App 3 qismdan iborat:
1. **Telegram Bot** — foydalanuvchilarni kutib oladi, buyruqlar bilan ishlaydi
2. **Web App (Frontend)** — React SPA, Telegram ichida ochiladi
3. **Backend (FastAPI)** — mavjud backend, Telegram webhook va auth qo'shilgan

---

## 1. BotFather'da Bot yaratish

1. Telegram'da [@BotFather](https://t.me/BotFather) ga boring
2. `/newbot` buyrug'ini yuboring
3. Bot nomini kiriting: `SpeakMate AI`
4. Username tanlang: `SpeakMateBot` (yoki boshqa bo'sh nom)
5. **Bot token**ni nusxalang — bu `TELEGRAM_BOT_TOKEN`

### Bot sozlamalari (BotFather'da):
```
/mybots → SpeakMate AI → Bot Settings → Menu Button
  → URL: https://your-webapp-domain.com
  → Button text: Open SpeakMate

/mybots → SpeakMate AI → Bot Settings → Description
  → "🎙 IELTS Speaking Coach — Real-time AI practice"

/mybots → SpeakMate AI → Bot Settings → About
  → "AI-powered IELTS speaking practice with real-time feedback"
```

---

## 2. Web App Deploy (Vercel)

### Option A: Vercel (tavsiya etiladi)

```bash
# webapp papkasiga o'ting
cd webapp

# Vercel CLI o'rnating (birinchi marta)
npm i -g vercel

# Deploy qiling
vercel

# Production deploy
vercel --prod
```

**Vercel Dashboard'da:**
- Environment Variables qo'shing:
  - `VITE_API_URL` = `https://your-backend-domain.com`
  - `VITE_WS_URL` = `wss://your-backend-domain.com`

### Option B: Netlify

```bash
cd webapp
npm run build
# dist/ papkasini Netlify'ga upload qiling
```

**Netlify Settings:**
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: yuqoridagilar

### Muhim: HTTPS kerak!
Telegram Mini Apps faqat HTTPS URL'lar bilan ishlaydi.

---

## 3. Backend sozlash

### 3.1 .env faylini yangilang

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIjKlMnOpQrStUvWxYz
TELEGRAM_WEBHOOK_URL=https://your-backend-domain.com/telegram/webhook
TELEGRAM_WEBAPP_URL=https://your-webapp-domain.com

# CORS (webapp domain'ni qo'shing)
CORS_ORIGINS=["*"]
```

### 3.2 Supabase migration

Supabase Dashboard → SQL Editor'da quyidagini ishga tushiring:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'supabase';
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
```

### 3.3 Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3.4 Backend'ni ishga tushiring

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Backend ishga tushganda avtomatik ravishda:
- Telegram bot handler'lar ro'yxatdan o'tkaziladi
- Webhook sozlanadi

---

## 4. Test qilish

### Local development

1. **ngrok** ishlatib backend'ni internet'ga oching:
```bash
ngrok http 8000
```

2. `.env` faylda ngrok URL'ni qo'ying:
```env
TELEGRAM_WEBHOOK_URL=https://xxxxx.ngrok.io/telegram/webhook
TELEGRAM_WEBAPP_URL=https://your-webapp.vercel.app
```

3. Backend'ni qayta ishga tushiring

4. Telegram'da botga `/start` yuboring

### Tekshirish

- [ ] `/start` buyrug'i ishlaydi
- [ ] "Open SpeakMate" tugmasi Mini App'ni ochadi
- [ ] Mini App'da auth ishlaydi (token olinadi)
- [ ] Practice sahifasi ochiladi
- [ ] Sessiya boshlanadi (WebSocket ulanadi)
- [ ] Mikrofon yozish ishlaydi
- [ ] AI javob qaytaradi
- [ ] Sessiya yakunlanganda natijalar ko'rinadi
- [ ] History sahifasi ishlaydi

---

## 5. File Structure

```
backend/
  app/
    telegram/           ← NEW: Telegram bot module
      __init__.py
      bot.py            - Bot instance & dispatcher
      handlers.py       - /start, /help, /stats commands
      webhook.py        - FastAPI webhook endpoint
      keyboards.py      - Inline keyboards & Web App buttons
      notifications.py  - Proactive messages to users
    api/routes/
      auth.py           ← NEW: Telegram auth endpoint
    core/
      telegram_auth.py  ← NEW: initData HMAC validation
      config.py         ← UPDATED: Telegram settings added
    services/
      speech.py         ← UPDATED: WebM/Opus support added
    main.py             ← UPDATED: Bot lifecycle, auth route

webapp/                 ← NEW: Telegram Mini App (React + Vite)
  src/
    components/         - Layout, ScoreCard, ErrorList, Timer
    pages/              - Home, Practice, Session, Results, History, Profile
    services/           - api, websocket, telegram SDK, audio
    stores/             - authStore, sessionStore (Zustand)
    hooks/              - useTelegram, useAudio
    types/              - TypeScript types
  package.json
  vite.config.ts
  tailwind.config.js
```

---

## 6. Production Checklist

- [ ] HTTPS certificate (backend + webapp)
- [ ] `TELEGRAM_BOT_TOKEN` o'rnatilgan
- [ ] `TELEGRAM_WEBHOOK_URL` to'g'ri (HTTPS!)
- [ ] `TELEGRAM_WEBAPP_URL` to'g'ri (HTTPS!)
- [ ] Supabase migration bajarilgan
- [ ] `SUPABASE_JWT_SECRET` o'rnatilgan (production uchun)
- [ ] CORS sozlangan
- [ ] BotFather'da Menu Button URL o'rnatilgan
