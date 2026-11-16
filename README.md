# IsıSens — Profesyonel Sistem Yönetim Paneli

**IsıSens**, Konya genelinde merkezi ısıtma sistemine sahip sitelerde **kalorimetre okuma (Wireless M-Bus / OMS)**, **saha RF telemetri toplama** ve **merkezi ısıtma gider paylaşımı (%70 Tüketim / %30 Ortak Pay)** süreçlerini yönetmek için geliştirilmiş uçtan uca IoT ve SaaS sistem yönetim platformudur.

---

## 1. Mimari ve Veri Akışı

```
[RF Reader / USB wM-Bus Alıcı / SimulatorReader]
        │
        ▼
[wmbusmeters / IsiSensNormalizer (JSON Çözümleme & Birim Dönüşümü)]
        │
        ▼
[Python Collector — Çevrimdışı SQLite Kuyruğu (OfflineSQLiteQueue)]
        │  (HTTPS POST /api/v1/ingestion/readings + Idempotency Key)
        ▼
[FastAPI Backend — SQLAlchemy 2.x ORM & Decimal 70/30 Hesaplama Motoru]
        │
        ▼
[PostgreSQL 16 Veritabanı (15 İlişkisel Tablo + Alembic Migration)]
        │
        ▼
[React 19 + TypeScript + Tailwind CSS + TanStack Query & Table Yönetim Paneli]
```

---

## 2. Proje Klasör Yapısı

```text
Panel/
├── frontend/                  # React + TypeScript (strict) + Vite + Tailwind CSS + TanStack Query/Table
│   ├── src/
│   │   ├── components/        # IsiSensLogo, SparklineSvg, KonyaDistrictMapSvg, ApartmentDetailModal, CrudModals
│   │   ├── layouts/           # MainLayout (Sol Neon Navigasyon & Üst Operasyon Barı)
│   │   ├── pages/             # SitelerView, GenelBakisView, Bloklar, Sayaçlar, Okumalar, Faturalandırma, vb.
│   │   ├── services/          # FastAPI Axios İstemcisi & Türkçe Sayı/Para Formatlayıcılar
│   │   ├── types/             # Strict TypeScript Veri Sözleşmeleri
│   │   └── styles/            # Koyu Lacivert (#050B18) & Neon Turuncu/Turkuaz (#FF792D / #12D9E8) Tasarım Dili
├── backend/                   # Python 3.12+ FastAPI + SQLAlchemy 2.x + Pydantic v2 + Alembic
│   ├── app/
│   │   ├── api/               # REST API Endpoint'leri (/api/v1/...)
│   │   ├── core/              # Yapılandırma, Bcrypt/JWT Güvenliği, OMS AES-128 SecretKeyVault
│   │   ├── db/                # PostgreSQL / SQLAlchemy Oturum Yönetimi ve Başlangıç Veri Tohumlama (seed.py)
│   │   ├── models/            # 15 PostgreSQL Tablo Modeli (entities.py)
│   │   ├── schemas/           # Pydantic İstek/Yanıt Şemaları
│   │   └── services/          # 9 Adımlı RF Okuma İşleme Motoru & Decimal 70/30 Gider Paylaşım Hesaplayıcı
│   ├── alembic/               # Alembic Veritabanı Migration Dosyaları
│   └── tests/                 # Uçtan Uca Kabul Testleri (12 Kabul Kriteri)
├── collector/                 # Bağımsız Saha RF Veri Toplama ve Çevrimdışı Senkronizasyon Modülü
│   ├── readers/               # ReaderAdapter, SimulatorReader, CustomRFReader, WMBusReader (wmbusmeters)
│   ├── normalizers/           # Farklı Sayaç Markaları (Diehl Sharky, Kamstrup, Danfoss, Qundis) Normalizer
│   ├── storage/               # Çevrimdışı SQLite Kuyruğu (OfflineSQLiteQueue)
│   ├── sync/                  # Yeniden Denemeli (Retry) HTTP/HTTPS Senkronizasyon İstemcisi
│   ├── simulator/             # CLI ve Programatik Simülatör Aracı (cli.py)
│   └── tests/                 # Collector Birim ve Çevrimdışı Kuyruk Testleri
├── docker-compose.yml         # PostgreSQL 16 + FastAPI Backend + React Frontend Dağıtımı
├── .env.example               # Ortam Değişkenleri Şablonu (Gizli anahtar içermez)
└── README.md
```

---

## 3. Veritabanı Tabloları (15 Tablo)

1. `users` — Kurucu bilgisayar mühendisleri ve rol bazlı (RBAC) yetkili kullanıcılar
2. `sites` — Konya genelindeki siteler (`is_demo` ayrımı ile)
3. `blocks` — Siteye bağlı bloklar (`A Blok`, `B Blok`, `C Blok`, `D Blok`)
4. `apartments` — Daireler, m² alanları, son okuma durumları ve indeksli sorgu alanları
5. `occupants` — KVKK uyumlu maskelenmiş daire sakini kayıtları
6. `meters` — Kalorimetre sayaçları (`technical_uid`, `serial_number`, `wmbus_id`, `key_reference`)
7. `meter_assignments` — Tarihçeli daire-sayaç eşleştirmeleri (`assigned_at`, `unassigned_at`)
8. `reading_sessions` — Saha RF / wM-Bus okuma oturumları
9. `meter_readings` — Silinmeyen, yalnızca eklenen (append-only) geçmiş sayaç okumaları
10. `reading_ingest_events` — `idempotency_key` korumalı ham veri alım kayıtları
11. `billing_periods` — Dönemsel faturalandırma ve hesaplama sürümü (`calculation_version`, `rounding_diff_try`)
12. `invoices` — Bina ana doğalgaz/ısıtma faturaları
13. `allocations` — Daire bazlı `%30 Ortak Pay` ve `%70 Tüketim Payı` hesaplama sonuçları
14. `alerts` — Düşük pil, sinyal kaybı, eksik anahtar ve eşleştirilmemiş sayaç uyarıları
15. `audit_logs` — Kullanıcı ve sistem işlem denetim kayıtları

---

## 4. Çalıştırma Talimatları

### A) Yerel Geliştirme Ortamında Çalıştırma

1. **Backend API'yi Başlatın:**
   ```bash
   cd backend
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *(API Belgeleri: `http://127.0.0.1:8000/docs`)*

2. **Frontend Yönetim Panelini Başlatın:**
   ```bash
   cd frontend
   npm run dev
   ```
   *(Panel Adresi: `http://127.0.0.1:5173`)*

3. **Python RF Collector / Simülatör ile Veri Gönderin:**
   ```bash
   # Doğrudan simüle edilmiş okuma gönderimi:
   python -m collector.simulator.cli --device-id SH-775021 --value 1615.80 --unit kWh --source simulator

   # İnternet kesintisini simüle ederek yerel SQLite kuyruğuna kaydetme:
   python -m collector.simulator.cli --device-id SH-775027 --value 1490.20 --offline

   # İnternet geldiğinde SQLite kuyruğundaki bekleyen verileri FastAPI'ye senkronize etme:
   python -m collector.simulator.cli --sync-only
   ```

### B) Docker Compose ile Çalıştırma (PostgreSQL 16 + Backend + Frontend)

```bash
cp .env.example .env
docker compose up --build -d
```

---

## 5. Kurucu Bilgisayar Mühendisi Hesapları

- **Kullanıcı Adı:** `furkan` | `emre` | `burak`
- **Parola:** `Isisens2026!`

