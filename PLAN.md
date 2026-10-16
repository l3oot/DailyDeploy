# DailyApp Re-engineering Plan — Web App บน Vercel

เอกสารนี้เป็นแผนย้าย DailyApp จาก Flutter + หลาย microservice ไปเป็น **web app ชุดเดียวที่ deploy บน Vercel ได้** โดยใช้ **backend ที่เบากว่าและ Vercel รองรับโดยตรง**

โค้ดใหม่ทั้งหมดวางในโฟลเดอร์นี้ (`DailyApp/Re-eng`) — โปรเจกต์เดิม (`dailyappui`, `Personservice`, `Nearwakeservice`, `Toiletservice`) **ไม่ลบ** จนกว่าเวอร์ชันใหม่จะใช้งานได้

---

## 1. สรุปสถานะปัจจุบัน

ระบบตอนนี้เป็น **mobile-first + Docker microservice** ไม่ได้ออกแบบมาให้รันบน Vercel


| ส่วน                              | ของเดิม                              | Runtime                                                             |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| UI                                | Flutter (`dailyappui`)               | Android / iOS / desktop (มีโฟลเดอร์ `web` แต่ไม่ได้เป็นเป้า deploy) |
| Auth / User / Google Places proxy | `Personservice`                      | ASP.NET Core 10 + EF Core + JWT RS256                               |
| Nearwake (สถานที่ + รายการโปรด)   | `Nearwakeservice`                    | Express 5 + Prisma + JWT                                            |
| Toilet (ห้องน้ำตรงใจ)             | `Toiletservice`                      | Express 5 + Prisma + JWT                                            |
| Gateway                           | Kong + Nginx                         | Docker long-running                                                 |
| Monitoring                        | Prometheus + Grafana + node-exporter | Docker                                                              |
| Database                          | PostgreSQL ชุดเดียว (`dailyApp`)     | เครื่องตัวเอง / Docker                                              |




### ฟีเจอร์ที่แอปมีอยู่จริง

1. **ใกล้ถึงปลุก (nearwake)** — เลือกปลายทาง, GPS geofence, foreground task, แจ้งเตือน, สั่น, เสียง, รายการโปรด
2. **ห้องน้ำตรงใจ (besttoilet)** — แผนที่, สร้าง/แก้/นับจุดห้องน้ำ
3. **คำนวณค่าแท็กซี่ (caltaxi)** — คำนวณฝั่ง client ตามอัตรา กรมการขนส่งทางบก
4. **บัญชี** — login อีเมล+OTP (Auth0), Google Sign-In, guest session, refresh token, โปรไฟล์



### API ที่ต้องคงพฤติกรรมเดิม (รวมผ่าน Kong เป็น `/api/v1`)

```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/google
POST   /api/v1/auth/send-otp
POST   /api/v1/auth/verify-otp
POST   /api/v1/auth/refreshtoken
POST   /api/v1/auth/logout
PATCH  /api/v1/auth/changepassword

GET    /api/v1/users/:authUuid
POST   /api/v1/users
PUT    /api/v1/users
POST   /api/v1/users/favorite
GET    /api/v1/users/favorite

GET    /api/v1/ggmap/location?input=

POST   /api/v1/nearwake/location
GET    /api/v1/nearwake/location
POST   /api/v1/nearwake/favoriteplace
GET    /api/v1/nearwake/favoriteplace/:userUuid
PUT    /api/v1/nearwake/favoriteplace
DELETE /api/v1/nearwake/favoriteplace/:favoritePlaceUuid

POST   /api/v1/toilet/location
GET    /api/v1/toilet/location
PUT    /api/v1/toilet/location
GET    /api/v1/toilet/location/count
```

รูปแบบตอบกลับปัจจุบัน: `{ IsSuccess, Message, Data, ErrorMessage, ErrorType }`

### ตารางใน Postgres ที่ใช้อยู่

- `auth`, `user`, `refresh_token`, `feature`, `favorite` — จาก Personservice
- `storeplace`, `favorite_place` — จาก Nearwake
- `toilet` — จาก Toilet (FK ไป `user`)

Prisma ของ Nearwake/Toilet map ตาราง `user` ซ้ำกับ Personservice — schema จริงเป็น **DB เดียว** ไม่ใช่ 3 ฐาน

---



## 2. ทำไมของเดิมขึ้น Vercel ไม่ได้ (หรือขึ้นแล้วไม่คุ้ม)

Vercel เป็น **serverless / edge** ไม่ใช่ VM ที่รัน process ค้างคืน


| ของเดิม                                                  | ปัญหาบน Vercel                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| ASP.NET Core (`Personservice`)                           | ไม่ใช่ runtime หลักของ Vercel                                              |
| Express `app.listen(PORT)`                               | ต้องแปลงเป็น serverless handler; cold start + connection pool หนัก         |
| Kong + Nginx                                             | รัน Docker ไม่ได้บน Vercel — routing ใช้ `vercel.json` / Next rewrites แทน |
| Prometheus / Grafana                                     | ไม่มีที่รัน long-lived metrics scraper                                     |
| JWT อ่านไฟล์ `private.pem` / `public.pem`                | serverless ไม่มีไฟล์ key ใน container แบบเดิม — ต้องใส่ใน env              |
| Flutter foreground task / local notification / vibration | plugin พวกนี้ **ใช้บนเบราว์เซอร์ไม่ได้หรือจำกัดมาก**                       |
| 3 services + gateway                                     | เกินความจำเป็นสำหรับแอปขนาดนี้ และแพง/ซับซ้อนบน serverless                 |


ข้อสรุป: **อย่า lift-and-shift** Express/.NET ขึ้น Vercel — รวม API เป็น backend เบาตัวเดียว แล้วเขียน UI เป็น web จริง

---



## 3. สแตกเป้าหมายที่แนะนำ



### เลือกหลัก (แนะนำ)


| ชั้น      | เทคโนโลยี                                                         | เหตุผล                                                                                   |
| --------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Frontend  | **Next.js (App Router) + TypeScript + Tailwind**                  | first-class บน Vercel, SSR/SSG, routing, ชุดเดียวกับ API                                 |
| Backend   | **Hono** บน Vercel (serverless)                                   | เบากว่า Express มาก, รองรับ Vercel อย่างเป็นทางการ, TypeScript, middleware JWT/CORS ง่าย |
| ORM       | Prisma                                                            | Prisma ก็ใช้ได้ถ้าใส่ connection pooler                                                  |
| DB        | **Supabase**                                                      | มี connection pooling ที่ Vercel ต้องการ                                                 |
| Auth      | JWT ใน **httpOnly cookie** + Google Identity Services + OTP อีเมล | เหมาะกับเว็บกว่า Bearer ใน `flutter_secure_storage`                                      |
| Maps      | **Google Maps JavaScript API** (+ Places / Routes)                | แทน `google_maps_flutter`                                                                |
| Email OTP | **Resend** (หรือคง Auth0 passwordless ช่วงแรก)                    | Auth0 ยังใช้ได้ แต่ Resend เบากว่าและถูกกว่าในระยะยาว                                    |
| PWA       | `next-pwa` / Serwist                                              | ติดตั้งบนมือถือ, notification ขณะแท็บเปิดอยู่                                            |
| Hosting   | **Vercel โปรเจกต์เดียว**                                          | frontend + `/api/`* deploy พร้อมกัน                                                      |


### สิ่งที่ตัดออกจากสแตกใหม่ (ไม่ย้ายขึ้น Vercel)

- Kong, Nginx, Docker Compose ของ API
- Prometheus, Grafana, node-exporter (ใช้ Vercel Analytics + Runtime Logs แทน)
- RSA key แบบไฟล์ใน repo
- `flutter_foreground_task`, `awesome_notifications` แบบ native

---



## 4. สิ่งที่เว็บทำได้ / ทำไม่ได้เทียบมือถือ

ต้องตกลงกับผลิตภัณฑ์ก่อนลงมือ เพราะ **ใกล้ถึงปลุก** พึ่ง native background GPS


| ความสามารถ                        | มือถือ (ของเดิม)         | เว็บบน Vercel                                      |
| --------------------------------- | ------------------------ | -------------------------------------------------- |
| แผนที่ + เลือกปลายทาง             | ได้                      | ได้ (Maps JS)                                      |
| GPS ขณะเปิดหน้าเว็บ               | ได้                      | ได้ (`navigator.geolocation.watchPosition`)        |
| ติดตามตอนล็อกจอ / สลับแอป         | ได้ (foreground service) | **จำกัดมาก** โดยเฉพาะ iOS Safari                   |
| Local notification + สั่น + เสียง | ได้                      | Notification API ได้เมื่ออนุญาต; สั่น/เสียงมีจำกัด |
| Google Sign-In                    | ได้                      | ได้ (GIS / OAuth web client)                       |
| Guest mode                        | ได้                      | ได้ (`localStorage`)                               |
| ค่าแท็กซี่                        | ได้ (client)             | ได้ (ย้าย logic ตรงๆ)                              |
| ห้องน้ำตรงใจ CRUD                 | ได้                      | ได้                                                |


ข้อเสนอสำหรับ nearwake บนเว็บ (เฟส 1):

- ติดตามได้ **ขณะแท็บเปิดอยู่** + แจ้งเตือนในเบราว์เซอร์เมื่อเข้า geofence
- แสดงคำเตือนชัดว่า “เปิดหน้านี้ค้างไว้จนกว่าจะถึง”
- เฟสหลังค่อยพิจารณา Capacitor/PWA หรือคงแอป Flutter ไว้เฉพาะ nearwake

อย่าสัญญาว่าเว็บจะปลุกได้เหมือนแอป native

---



## 5. โครงสร้างโฟลเดอร์ใหม่ (`Re-eng/`)

```
Re-eng/
  PLAN.md                 ← ไฟล์นี้
  package.json            ← npm workspaces (optional)
  apps/web/               ← Next.js App Router
    app/
      page.tsx            ← welcome / session bootstrap
      login/page.tsx
      home/page.tsx
      nearwake/page.tsx
      toilet/page.tsx
      taxi/page.tsx
      account/page.tsx
      api/[[...route]]/route.ts   ← mount Hono
    components/
    lib/                  ← maps, geofence, taxi calculator, i18n
    public/
  packages/api/           ← Hono app (auth, users, nearwake, toilet, ggmap)
    src/
      index.ts
      middleware/auth.ts
      routes/
      services/
      db/schema.ts        ← Drizzle schema รวมตารางทั้งหมด
  drizzle/                ← migrations
  vercel.json
  .env.example
```

ถ้าอยากเรียบกว่านี้ในเฟสแรก: **ไม่ใช้ workspaces** — รวมทุกอย่างใน `apps/web` แล้วค่อยแยก `packages/api` เมื่อ API โต

แนะนำเริ่มแบบ **โปรเจกต์เดียวใน** `Re-eng/` เพื่อ deploy Vercel ง่ายสุด

```
Re-eng/
  app/                    ← หน้าเว็บ
  app/api/[[...route]]/   ← Hono
  server/                 ← routes + db + services ของ Hono
  lib/                    ← โค้ดฝั่ง client
  vercel.json
```

---



## 6. Backend ใหม่ — รวม 3 services เป็น API เดียว



### โมดูล Hono

```
/api/v1/auth/*        ← แทน Personservice AuthController
/api/v1/users/*       ← แทน UsersController
/api/v1/ggmap/*       ← แทน GoogleMapController (proxy Places, เก็บ API key ที่ server)
/api/v1/nearwake/*    ← แทน Nearwakeservice
/api/v1/toilet/*      ← แทน Toiletservice
```

Kong หายไปเพราะ path เหล่านี้อยู่ในแอปเดียวกันอยู่แล้ว

### Auth ที่ปรับให้เข้ากับเว็บ + serverless

- เลิกอ่าน PEM จากไฟล์ → เก็บ `JWT_SECRET` (HS256) ใน Vercel env **หรือ** เก็บ PEM ทั้งก้อนใน env ถ้ายังอยาก RS256
- Access token สั้น (~15 นาที) ใน httpOnly cookie (`Secure`, `SameSite=Lax`)
- Refresh token ยังเก็บตาราง `refresh_token` เหมือนเดิม (revoke เมื่อ logout)
- Google: รับ `idToken` จาก GIS แล้ว verify ด้วย `google-auth-library` (เทียบ `AuthService.LoginGoogleAsync`)
- OTP: เฟส 1 ยังยิง Auth0 ได้เพื่อไม่เปลี่ยน UX login; เฟส 2 ย้ายไป Resend + เก็บ OTP hash ใน DB/KV (TTL สั้น)
- Guest: ไม่ต้องมี JWT — flag ใน `localStorage` เหมือน `GuestSessionService`
- Password hash: ใช้ **bcrypt/argon2** แทน SHA256 ของเดิม (ตอน migrate ต้อง re-hash หรือบังคับตั้งรหัสใหม่ถ้ามี user จริง)



### DB / serverless

- ใช้ **pooled connection string** (`-pooler` ของ Neon/Supabase) ใน `DATABASE_URL`
- อย่าเปิด connection ใหม่ทุก request โดยไม่ใช้ pool
- รวม schema เป็นไฟล์เดียว — เลิก Prisma แยก 2 ชุดที่ชี้ตาราง `user` ซ้ำ
- Google Maps API key อยู่ฝั่ง server เท่านั้น (กันโควต้าเหมือน Personservice ทำ proxy อยู่แล้ว)



### สิ่งที่ไม่ต้องมีใน API ใหม่ (เฟส 1)

- `/metrics` + `prom-client`
- Swagger UI (ใช้ OpenAPI YAML เป็นเอกสารใน repo พอ หรือ Scalar ทีหลัง)
- Rate limit แบบ in-memory ของ .NET → ใช้ Vercel Firewall หรือ Upstash Redis ทีหลังสำหรับ `/ggmap/location`

---



## 7. Frontend ใหม่ — map หน้าจอ Flutter → เส้นทางเว็บ


| Flutter                             | เส้นทางเว็บ                     | หมายเหตุ                                  |
| ----------------------------------- | ------------------------------- | ----------------------------------------- |
| `SessionStartPage`                  | `app/page.tsx` (bootstrap)      | refresh cookie → `/home` หรือ `/welcome`  |
| `WelcomePage`                       | `/welcome`                      |                                           |
| `LoginPage`                         | `/login`                        | OTP + Google + ยอมรับข้อกำหนด             |
| `HomePage`                          | `/home`                         | bento / เมนู 3 ฟีเจอร์ + นับห้องน้ำ       |
| `DestinationSelectPage` + `MapPage` | `/nearwake`                     | geolocation ขณะแท็บเปิด                   |
| `ToiletMapPage`                     | `/toilet`                       |                                           |
| `TaxiFarePage`                      | `/taxi`                         | ย้าย `TaxiFareCalculator` เป็น TypeScript |
| `AccountPage`                       | `/account`                      |                                           |
| `TermsOfServicePage`                | `/terms`                        |                                           |
| `NotificationSettingsPage`          | `/settings/notifications`       | ขอสิทธิ์ Notification API                 |
| l10n (`AppLocalizations`)           | `next-intl`                     | ไทย / อังกฤษ ตามของเดิม                   |
| สีครีม + Prompt font                | Tailwind + `next/font` (Prompt) | รักษา visual language                     |




### Client libraries ที่ต้องเขียนใหม่ (ไม่พอร์ต Dart ตรงๆ)

- `lib/api.ts` — fetch ไป `/api/v1/*` (cookie ส่งอัตโนมัติ)
- `lib/geofence.ts` — Haversine + `watchPosition` + Notification
- `lib/maps.ts` — Places autocomplete, marker, polyline
- `lib/taxi.ts` — logic ค่าโดยสาร (กม.แรก 40 บาท ฯลฯ)
- PWA service worker — cache shell, ไม่เอา GPS ไปรันพื้นหลังเกินที่เบราว์เซอร์อนุญาต

อย่าพยายาม compile Flutter เป็น web แล้วห่อ Vercel — plugin ที่แอปพึ่งจะพัง

---



## 8. แผนงานเป็นเฟส



### เฟส 0 — เตรียม (1–2 วัน)

- สร้าง Next.js ใน `Re-eng/`
- ตั้ง Neon/Supabase แล้วชี้ `DATABASE_URL` (staging แยกจากเครื่อง local)
- คัดลอก schema รวมตาราง แล้ว generate migration (ยังไม่ตัดของเก่า)
- `.env.example` ชุดใหม่ (JWT, Google, DB, Resend/Auth0, Maps)
- เชื่อม Git → Vercel preview



### เฟส 1 — โครงเว็บ + Auth (แกน)

- หน้า welcome / login / home (layout + i18n + ธีม)
- Hono: register, login, google, refresh, logout
- OTP: ต่อ Auth0 ชุดเดิมก่อน เพื่อให้ login ไหลเหมือนแอป
- Cookie session ใช้ได้บน localhost และ Vercel preview
- Guest เข้า `/home` ได้ แต่เรียก API ที่ต้อง login ไม่ได้

**คำนิยามเสร็จ:** สมัคร/login/google/guest บน deployed preview ได้

### เฟส 2 — รวม API ธุรกิจ + หน้า 3 ฟีเจอร์

- users + favorite feature
- nearwake location + favorite place
- toilet CRUD + count
- `GET /ggmap/location` proxy
- หน้า `/nearwake`, `/toilet`, `/taxi`, `/account`
- ย้ายสูตรแท็กซี่เป็น TypeScript ให้ผลตรงกับ `taxi_fare_calculator.dart`

**คำนิยามเสร็จ:** CRUD เท่า OpenAPI เดิม ทำงานบน Vercel + Postgres

### เฟส 3 — Nearwake แบบเว็บ + PWA

- `watchPosition` + geofence radius
- ขอสิทธิ์ notification, เล่นเสียงเมื่อเข้าเขต (แท็บต้องเปิด)
- UX เตือนข้อจำกัดเบราว์เซอร์
- ติดตั้ง PWA ได้
- Longdo search ถ้ายังต้องใช้ (key ฝั่ง server)

**คำนิยามเสร็จ:** ใช้ใกล้ถึงปลุกได้บน Chrome/Android ขณะเปิดแท็บ; iOS เป็น best-effort

### เฟส 4 — Hardening แล้วตัดของเก่า

- CORS เฉพาะโดเมน Vercel
- Google Maps key restrict โดเมน
- bcrypt + ย้าย user ถ้ามีข้อมูลจริง
- ตรวจ HTTP status ให้ตรง `TypeError` เดิม
- Vercel env production, custom domain
- เอกสาร “เลิกใช้ Docker API stack ได้อย่างไร”
- เก็บ Flutter ไว้เป็น mobile app ถ้ายังต้องการ background GPS

---



## 9. Deploy บน Vercel



### โปรเจกต์

- Root Directory: `Re-eng`
- Framework preset: Next.js
- Build: `next build`
- Node 20+



### Environment variables (production + preview)

```
DATABASE_URL=
JWT_SECRET=
JWT_ISSUER=
JWT_AUDIENCE=
GOOGLE_CLIENT_ID=
GOOGLE_API_KEY=
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
RESEND_API_KEY=          # เฟส 2 ถ้าเลิก Auth0 OTP
LONGDO_API_KEY=
```

ห้ามใส่ Google API key ใน bundle ฝั่ง client ยกเว้น Maps JS ที่ restrict โดเมนแล้ว

### สิ่งที่ Vercel ทำให้แทนของเดิม


| ของเดิม           | ของใหม่                 |
| ----------------- | ----------------------- |
| Nginx :80         | Vercel HTTPS + CDN      |
| Kong path routing | Hono routes `/api/v1/*` |
| 3 containers      | 1 serverless project    |
| Grafana           | Vercel Observability    |


Postgres **ไม่ได้อยู่บน Vercel** — อยู่ Neon/Supabase แล้ว Vercel ต่อผ่าน `DATABASE_URL`

---



## 10. กลยุทธ์ข้อมูล

1. **Staging ว่าง** — migrate schema ใหม่บน Neon แล้วเทสด้วยบัญชีใหม่ (เร็วสุด)
2. **Production มี user จริง** — dump Postgres เดิม → Neon, ใช้ตารางชื่อเดิม เพื่อไม่ต้องแปลง UUID/FK
3. Password SHA256 เดิมไม่ควรใช้ต่อ — ถ้ามี user จริง ให้บังคับ OTP/Google ครั้งแรกแล้วค่อย set password ใหม่ หรือเก็บ `password_algo` แล้ว upgrade ตอน login

อย่าชี้ Vercel ไปที่ Postgres บนเครื่อง Windows / `host.docker.internal`

---



## 11. ความเสี่ยงและวิธีรับ


| ความเสี่ยง                   | ผลกระทบ               | แนวทาง                                                             |
| ---------------------------- | --------------------- | ------------------------------------------------------------------ |
| Background GPS บนเว็บ        | ใกล้ถึงปลุกไม่เท่าแอป | จำกัดสcope + เก็บ Flutter ไว้ mobile                               |
| Cold start + Prisma          | API ช้าเป็นพักๆ       | ใช้ Drizzle หรือ Prisma + pooler; เลี่ยง serverless connection ตรง |
| Auth0 OTP คู่กับ cookie ใหม่ | login พัง             | เฟส 1 ทำ auth ให้จบก่อนฟีเจอร์อื่น                                 |
| Maps ค่าใช้จ่าย              | key รั่วฝั่ง client   | proxy `/ggmap` เหมือนเดิม + restrict                               |
| UX Flutter (bento, wave)     | ย้ายแล้วไม่เหมือน     | ย้ายทีละหน้า เริ่ม home/login ก่อน polish                          |
| ตาราง `user` ซ้ำใน 2 Prisma  | migrate ผิด           | schema รวมชุดเดียว อิงตารางจริงใน Postgres                         |


---



## 12. สิ่งที่อยู่นอกขอบเขตเฟสแรก

- แปลง Flutter เป็น PWA แล้วขึ้น Vercel
- คง .NET / Express / Kong บน Vercel
- Feature-complete background tracking บน iOS Safari
- Grafana/Prometheus ชุดเดิม
- เขียน mobile app ใหม่ด้วย Capacitor (ทำได้ทีหลัง ถ้ายังต้องการร้านแอป)

---



## 13. ลำดับลงมือจริง (เมื่อเริ่มโค้ด)

1. `create-next-app` ใน `Re-eng/` + Tailwind + TypeScript
2. ติดตั้ง Hono แล้ว mount ที่ `app/api/[[...route]]/route.ts`
3. ต่อ Drizzle + Neon, สร้างตารางตามของเดิม
4. Auth routes + หน้า login
5. ย้าย toilet / nearwake / ggmap / taxi ตามลำดับความง่าย (taxi → toilet → nearwake)
6. Geofence บนเว็บ + PWA
7. ตั้งโปรเจกต์ Vercel, ใส่ env, เปิด production

ของเดิมใน `dailyappui` และสาม service **เก็บไว้เทียบ API และสูตรคำนวณ** จนกว่าเฟส 4 จะปิด

---



## 14. คำตัดสินทางเทคนิค (ล็อกไว้ก่อนลงมือ)


| หัวข้อ          | คำตัดสิน                                        |
| --------------- | ----------------------------------------------- |
| UI              | Next.js App Router — ไม่ใช้ Flutter Web         |
| API             | Hono รวม 3 services — ไม่คง .NET/Express แยกตัว |
| Deploy          | Vercel โปรเจกต์เดียว Root = `Re-eng`            |
| DB              | PostgreSQL บน Neon หรือ Supabase + pooler       |
| Auth เว็บ       | httpOnly cookie; OTP ช่วงแรกยังผ่าน Auth0 ได้   |
| Nearwake เฟส 1  | ติดตามได้เฉพาะแท็บเปิดอยู่                      |
| Monitoring เดิม | ไม่ย้าย                                         |


ถ้าต้องการเริ่มโค้ดต่อจากแผนนี้ ลำดับที่ปลอดภัยที่สุดคือ **เฟส 0 → เฟส 1 (auth + home)** ก่อนค่อยย้ายฟีเจอร์แผนที่