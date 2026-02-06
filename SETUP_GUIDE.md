# SpeakMate AI - To'liq O'rnatish va Ishga Tushirish Rejasi

## Loyiha Strukturasi (Tayyor)

```
c:\personal coach\
├── backend/          ← FastAPI server (TAYYOR ✅)
│   ├── app/
│   │   ├── api/routes/     - REST endpoints
│   │   ├── api/websocket/  - Real-time audio
│   │   ├── services/       - Business logic
│   │   └── workers/        - Background jobs
│   └── supabase/           - Database schema
│
├── mobile/           ← React Native app (TAYYOR ✅)
│   ├── app/
│   │   ├── (auth)/         - Login/Register
│   │   ├── (tabs)/         - Main screens
│   │   ├── session/        - Conversation
│   │   └── results/        - Analysis
│   └── services/           - API/WebSocket
│
└── SETUP_GUIDE.md    ← SIZ SHU YERDASIZ
```

## Arxitektura

```
┌─────────────────────────────────────────────────────────────────┐
│                        SpeakMate AI                              │
├─────────────────────────────────────────────────────────────────┤
│  Mobile App (Expo)  ←───WebSocket────→  Backend (FastAPI)       │
│         ↓                                        ↓               │
│   Audio Recording                         Google Cloud           │
│   + Real-time UI                          - Speech-to-Text       │
│                                           - Text-to-Speech       │
│                                           - Gemini AI            │
│                                                  ↓               │
│                                            Supabase              │
│                                           - PostgreSQL           │
│                                           - Auth                 │
│                                           - Storage              │
└─────────────────────────────────────────────────────────────────┘
```

---

## BOSQICH 1: Google Cloud Sozlash (30-45 daqiqa)

### 1.1 Google Cloud Console'ga kirish
1. https://console.cloud.google.com ga boring
2. Google account bilan kiring
3. "New Project" bosing → Nom: `speakmate-ai`

### 1.2 API'larni yoqish
Google Cloud Console → APIs & Services → Enable APIs:

```
✅ Cloud Speech-to-Text API
✅ Cloud Text-to-Speech API  
✅ Generative Language API (Gemini)
```

Har birini qidiring va "Enable" bosing.

### 1.3 Service Account yaratish
1. IAM & Admin → Service Accounts → Create Service Account
2. Nom: `speakmate-backend`
3. Role qo'shing:
   - `Cloud Speech Client`
   - `Cloud Text-to-Speech Client`
4. "Create Key" → JSON → Download qiling
5. Faylni `backend/credentials/google-service-account.json` ga saqlang

### 1.4 Gemini API Key olish
1. https://makersuite.google.com/app/apikey ga boring
2. "Create API Key" bosing
3. Keyni nusxalang ( keyinroq ishlatamiz)

### 1.5 Billing sozlash
⚠️ **Muhim**: Google Cloud pullik, lekin yangi account uchun $300 kredit bor.

1. Billing → Link a billing account
2. Karta ma'lumotlarini kiriting
3. Free tier limitlarini tekshiring:
   - Speech-to-Text: 60 daqiqa/oy bepul
   - Text-to-Speech: 1M belgidan bepul
   - Gemini: Ma'lum limitgacha bepul

---

## BOSQICH 2: Supabase Sozlash (20-30 daqiqa)

### 2.1 Supabase Project yaratish
1. https://supabase.com ga boring
2. "Start your project" → GitHub bilan kiring
3. "New Project" bosing:
   - Name: `speakmate-ai`
   - Database Password: **kuchli parol** (saqlang!)
   - Region: Yaqin region (Frankfurt yoki London)
4. Yaratilishini kuting (~2 daqiqa)

### 2.2 API Keys olish
Project Settings → API:
```
Project URL:     https://xxxxx.supabase.co  (SUPABASE_URL)
anon public:     eyJhbGci...               (SUPABASE_KEY)
service_role:    eyJhbGci...               (SUPABASE_SERVICE_ROLE_KEY)
```

### 2.3 Database Schema yaratish
1. SQL Editor → New Query
2. `backend/supabase/schema_production.sql` faylini oching
3. Barcha SQL kodini nusxalang
4. Supabase SQL Editor'ga qo'ying
5. "Run" bosing

### 2.4 Storage Bucket yaratish
Storage → New Bucket:
- Name: `speakmate-assets`
- Public: No
- File size limit: 50MB

### 2.5 Auth sozlash
Authentication → Providers:
- Email: Enabled ✅
- Phone: Optional
- Google OAuth: Tavsiya etiladi (keyinroq)

---

## BOSQICH 3: Backend Sozlash (15-20 daqiqa)

### 3.1 Python muhitini tayyorlash

```powershell
# PowerShell'da:
cd "c:\personal coach\backend"

# Virtual environment yaratish
python -m venv venv

# Aktivatsiya
.\venv\Scripts\Activate

# Paketlarni o'rnatish
pip install -r requirements.txt
```

### 3.2 Environment faylini sozlash

```powershell
# .env faylini yaratish
copy .env.example .env
```

`.env` faylini oching va to'ldiring:

```env
# APP
APP_NAME=SpeakMate AI
APP_VERSION=1.0.0
DEBUG=true
ENVIRONMENT=development

# SERVER
HOST=0.0.0.0
PORT=8000

# SUPABASE (2.2-dan olgan ma'lumotlar)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GOOGLE CLOUD (1.3 va 1.4-dan)
GOOGLE_CLOUD_PROJECT=speakmate-ai
GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-service-account.json
GOOGLE_API_KEY=your-gemini-api-key

# REDIS (hozircha o'chirib qo'yamiz)
REDIS_ENABLED=false

# SECURITY
RATE_LIMIT_ENABLED=true
CORS_ORIGINS=["http://localhost:3000","http://localhost:19006"]
```

### 3.3 Credentials papkasini yaratish

```powershell
mkdir credentials
# Google service account JSON faylini shu papkaga ko'chiring
```

### 3.4 Backend'ni test qilish

```powershell
# Serverni ishga tushirish
python run.py --mode dev
```

Brauzerda: http://localhost:8000
- `/` - API info ko'rinishi kerak
- `/health` - Health check
- `/docs` - Swagger documentation

---

## BOSQICH 4: Mobile App Sozlash (15-20 daqiqa)

> **Eslatma**: Mobile app allaqachon `mobile/` papkada tayyor!

### 4.1 Node.js tekshirish

```powershell
# Node.js versiyasini tekshiring (18+ kerak)
node --version

# Agar yo'q bo'lsa: https://nodejs.org dan o'rnating
```

### 4.2 Paketlarni o'rnatish

```powershell
cd "c:\personal coach\mobile"

# Paketlarni o'rnatish
npm install
```

### 4.3 Environment faylini sozlash

```powershell
# .env faylini yaratish
copy .env.example .env
```

`mobile/.env` faylini oching va to'ldiring:

```env
# Kompyuteringizning local IP manzili
# PowerShell'da: ipconfig | findstr IPv4
EXPO_PUBLIC_API_URL=http://192.168.1.XXX:8000
EXPO_PUBLIC_WS_URL=ws://192.168.1.XXX:8000

# Supabase (2.2-dan olgan ma'lumotlar)
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-anon-key
```

### 4.4 Local IP manzilni topish

```powershell
# PowerShell'da:
ipconfig | findstr IPv4

# Natija: IPv4 Address. . . . . . . : 192.168.1.XXX
# Shu XXX qismini .env ga yozing
```

### 4.5 Mavjud struktura

```
mobile/
├── app/                  # Expo Router sahifalari
│   ├── (auth)/          # Login/Register
│   │   ├── index.tsx    # Auth bosh sahifa
│   │   ├── login.tsx    # Email login
│   │   └── register.tsx # Register
│   ├── (tabs)/          # Asosiy tablar
│   │   ├── index.tsx    # Home
│   │   ├── practice.tsx # IELTS practice
│   │   ├── history.tsx  # Sessions history
│   │   └── profile.tsx  # User profile
│   ├── session/         # Conversation
│   │   ├── [id].tsx     # Session sahifa
│   │   └── active.tsx   # Active session
│   └── results/         # Analysis
│       └── [id].tsx     # Results sahifa
├── services/            # API va WebSocket
│   ├── api.ts
│   ├── websocket.ts
│   ├── audio.ts
│   └── supabase.ts
├── stores/              # Zustand state
│   ├── authStore.ts
│   └── sessionStore.ts
└── constants/
    └── Config.ts
```

---

## BOSQICH 5: Test va Debug (doimiy)

### 5.1 Backend tekshirish

```powershell
# Terminal 1: Backend
cd "c:\personal coach\backend"
.\venv\Scripts\Activate
python run.py --mode dev
```

Tekshirish:
- http://localhost:8000/health → `{"status": "healthy"}`
- http://localhost:8000/docs → Swagger UI

### 5.2 Mobile App tekshirish

```powershell
# Terminal 2: Mobile
cd "c:\personal coach\mobile"
npx expo start
```

- `w` - Web brauzerda ochish
- Expo Go app orqali telefonda test qilish

### 5.3 WebSocket test

```javascript
// Browser console'da:
const ws = new WebSocket('ws://localhost:8000/ws/test-session');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({type: 'session.start', payload: {mode: 'free'}}));
```

---

## BOSQICH 6: Production Deployment

### 6.1 Backend Deployment (Railway/Render)

**Railway.app** (tavsiya):
1. https://railway.app ga boring
2. GitHub repo'ni ulang
3. Environment variables qo'shing
4. Deploy

**Yoki Render.com**:
1. https://render.com
2. New Web Service → GitHub repo
3. Build command: `pip install -r requirements.txt`
4. Start command: `python run.py --mode prod`

### 6.2 Mobile App Build

```powershell
# EAS Build o'rnatish
npm install -g eas-cli
eas login
eas build:configure

# Android APK build
eas build --platform android --profile preview

# iOS (Mac kerak)
eas build --platform ios --profile preview
```

---

## CHECKLIST - Nima qilish kerak

Har bir qadamni bajarib, belgilang:

### Bosqich 1: Google Cloud (30-45 min)
- [ ] 1.1 Google Cloud Console'ga kirdim
- [ ] 1.2 Yangi project yaratdim: `speakmate-ai`
- [ ] 1.3 Speech-to-Text API enabled qildim
- [ ] 1.4 Text-to-Speech API enabled qildim
- [ ] 1.5 Generative Language API enabled qildim
- [ ] 1.6 Service Account yaratdim
- [ ] 1.7 JSON key yuklab oldim → `backend/credentials/`
- [ ] 1.8 Gemini API Key oldim
- [ ] 1.9 Billing sozladim

### Bosqich 2: Supabase (20-30 min)
- [ ] 2.1 Supabase.com'ga ro'yxatdan o'tdim
- [ ] 2.2 Project yaratdim
- [ ] 2.3 API keys nusxaladim (URL, anon key, service key)
- [ ] 2.4 SQL Editor'da schema_production.sql ishlatdim
- [ ] 2.5 Storage bucket yaratdim: `speakmate-assets`
- [ ] 2.6 Auth sozladim (Email enabled)

### Bosqich 3: Backend (15-20 min)
- [ ] 3.1 Python 3.11+ o'rnatilgan
- [ ] 3.2 Virtual environment yaratdim
- [ ] 3.3 `pip install -r requirements.txt` bajardim
- [ ] 3.4 `.env` faylini to'ldirdim
- [ ] 3.5 Google credentials faylini qo'ydim
- [ ] 3.6 `python run.py --mode dev` ishladi
- [ ] 3.7 http://localhost:8000/health ishlayapti

### Bosqich 4: Mobile App (15-20 min)
- [ ] 4.1 Node.js 18+ o'rnatilgan
- [ ] 4.2 `cd mobile && npm install` bajardim
- [ ] 4.3 Local IP manzilni topdim
- [ ] 4.4 `mobile/.env` to'ldirdim
- [ ] 4.5 `npx expo start` ishladi
- [ ] 4.6 Telefonda yoki emulatorda ochildi

### Bosqich 5: Integration Test
- [ ] 5.1 Backend va Mobile bir vaqtda ishlayapti
- [ ] 5.2 Register/Login ishlayapti
- [ ] 5.3 Session yaratish ishlayapti
- [ ] 5.4 Audio recording test qildim
- [ ] 5.5 AI javob qaytardi

---

## Yordam va Muammolar

### Keng tarqalgan xatolar:

**1. CORS xatosi:**
```python
# backend/app/core/config.py
CORS_ORIGINS=["*"]  # Development uchun
```

**2. WebSocket ulanmayapti:**
- Firewall tekshiring
- IP manzilni to'g'ri yozing
- Token mavjudligini tekshiring

**3. Google API xatosi:**
- Credentials fayl yo'lini tekshiring
- API enabled ekanligini tekshiring
- Billing sozlanganligini tekshiring

**4. Supabase xatosi:**
- URL va KEY to'g'riligini tekshiring
- RLS policies tekshiring

---

## Keyingi Qadamlar

1. **MVP Test**: Asosiy flow'ni test qiling (login → suhbat → natija)
2. **UI Polish**: Dizaynni yaxshilang
3. **Error Handling**: Xatolarni to'g'ri handle qiling
4. **Analytics**: Foydalanuvchi statistikasini qo'shing
5. **Monetization**: Subscription tizimini qo'shing

Savollar bo'lsa yozing! 🚀
