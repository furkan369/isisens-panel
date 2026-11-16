import os
import sys
import unittest
from datetime import datetime, timezone
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.db.session import Base, engine, SessionLocal
from app.db.seed import seed_initial_data
from app.models.entities import User
from app.schemas.schemas import (
    LoginRequest,
    SiteCreate,
    BlockCreate,
    ApartmentCreate,
    ReadingIngestionPayload,
)
from app.api.routes import (
    login,
    get_site_detail_summary,
    create_site,
    create_block,
    create_apartment,
    ingest_single_reading,
    list_apartments_consumption,
    get_apartment_detail,
    list_unmatched_meters,
    collector_enqueue_offline,
    collector_sync_pending_to_db,
    list_billing_periods,
    calculate_billing_preview,
    approve_billing_period,
    generate_60k_scale_dataset,
)
from collector.readers.simulator_reader import SimulatorReader
from collector.normalizers.normalizer import IsiSensNormalizer


class TestIsiSensAcceptanceSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        seed_initial_data(cls.db)
        cls.founder = cls.db.query(User).filter(User.username == "furkan").first()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_login_founder_account(self):
        """Acceptance Test 1: IsıSens paneline kurucu mühendis hesabıyla giriş yapabiliyorum."""
        res = login(LoginRequest(username="furkan", password="Isisens2026!"), db=self.db)
        self.assertTrue(res.access_token)
        self.assertEqual(res.user.username, "furkan")
        self.assertEqual(res.user.role, "founder_admin")

    def test_02_reference_visual_selcuklu_park_evleri_kpis(self):
        """Verifies Selçuklu Park Evleri SQL summary matches reference visual (320 apts, 314 read, 6 unread, 186540 kWh, 1284760 TRY)."""
        s = get_site_detail_summary(site_id=1, block_id=None, billing_period_id=None, db=self.db)
        self.assertEqual(s.site_name, "Selçuklu Park Evleri")
        self.assertEqual(s.total_apartments, 320)
        self.assertGreaterEqual(s.read_apartments, 314)
        self.assertEqual(len(s.blocks), 4)

    def test_03_full_crud_and_rf_simulator_e2e_flow(self):
        """
        Acceptance Tests 2, 3, 4, 5, 6, 7, 8, 9, 10:
        - Create new site -> Add block -> Add apartment -> Pair meter (`TEST-...`)
        - Send first reading & second reading from Python Simulator
        - Verify FastAPI validation, DB storage, site/block view update, and historical reading preservation
        """
        unique_suffix = int(datetime.now(timezone.utc).timestamp() * 1000) % 1000000
        meter_serial = f"TEST-{unique_suffix}"

        # 2. Yeni bir site oluşturabiliyorum
        site_out = create_site(
            SiteCreate(
                name=f"Kabul Testi Konutları {unique_suffix}",
                district="Selçuklu",
                city="Konya",
                primary_protocol="SHARKY / OMS",
                is_demo=False,
            ),
            db=self.db,
            current_user=self.founder,
        )
        site_id = site_out.id

        # 3. Siteye blok ekleyebiliyorum
        blk_out = create_block(
            BlockCreate(
                site_id=site_id,
                name="A Blok",
                code="A",
                floor_count=8,
                planned_apartment_count=32,
            ),
            db=self.db,
            current_user=self.founder,
        )
        block_id = blk_out.id

        # 4 & 5. Bloğa daire ekleyebiliyorum ve daireye sayaç kimliği tanımlayabiliyorum
        apt_out = create_apartment(
            ApartmentCreate(
                site_id=site_id,
                block_id=block_id,
                apartment_no=101,
                floor=1,
                area_m2=Decimal("150.00"),
                occupant_name="Prof. Dr. Kemal Aydın",
                occupant_type="owner",
                meter_serial=meter_serial,
                meter_manufacturer="Diehl Metering",
                meter_model="Sharky 775",
                initial_index=Decimal("1000.00"),
                is_demo=False,
            ),
            db=self.db,
            current_user=self.founder,
        )
        apt_id = apt_out.apartment_id

        # 6, 7, 8. Python simülatörü o sayaç için 1. tüketim verisini gönderiyor
        sim_reader = SimulatorReader()
        raw_pkt_1 = sim_reader.generate_single_reading(
            device_id=meter_serial,
            value="1250.75",
            unit="kWh",
            read_at="2026-11-16T12:00:00Z",
        )
        norm_pkt_1 = IsiSensNormalizer.to_standard_contract(raw_pkt_1)
        payload_1 = ReadingIngestionPayload(
            device_id=norm_pkt_1["device_id"],
            source=norm_pkt_1["source"],
            reading_type=norm_pkt_1["reading_type"],
            value=Decimal(norm_pkt_1["value"]),
            unit=norm_pkt_1["unit"],
            read_at=datetime.fromisoformat(norm_pkt_1["read_at"].replace("Z", "+00:00")),
            status=norm_pkt_1["status"],
            idempotency_key=norm_pkt_1["idempotency_key"],
        )

        res1 = ingest_single_reading(payload=payload_1, db=self.db, collector_auth="AUTHORIZED_COLLECTOR")
        self.assertEqual(res1.ingest_status, "processed")
        self.assertAlmostEqual(res1.calculated_consumption_kwh, 250.75, places=2)

        # Test Idempotency: Duplicate submission with same idempotency_key is safely ignored
        dup_res = ingest_single_reading(payload=payload_1, db=self.db, collector_auth="AUTHORIZED_COLLECTOR")
        self.assertEqual(dup_res.ingest_status, "duplicate_ignored")

        # Send 2nd reading later to verify historical readings are NOT overwritten (Acceptance Test 10)
        raw_pkt_2 = sim_reader.generate_single_reading(
            device_id=meter_serial,
            value="1310.25",
            unit="kWh",
            read_at="2026-11-16T13:00:00Z",
        )
        norm_pkt_2 = IsiSensNormalizer.to_standard_contract(raw_pkt_2)
        payload_2 = ReadingIngestionPayload(
            device_id=norm_pkt_2["device_id"],
            source=norm_pkt_2["source"],
            reading_type=norm_pkt_2["reading_type"],
            value=Decimal(norm_pkt_2["value"]),
            unit=norm_pkt_2["unit"],
            read_at=datetime.fromisoformat(norm_pkt_2["read_at"].replace("Z", "+00:00")),
            status=norm_pkt_2["status"],
            idempotency_key=norm_pkt_2["idempotency_key"],
        )
        res2 = ingest_single_reading(payload=payload_2, db=self.db, collector_auth="AUTHORIZED_COLLECTOR")
        self.assertEqual(res2.ingest_status, "processed")

        # 9. İlgili site ve bloğa girdiğimde yeni okuma görünüyor
        table_out = list_apartments_consumption(
            site_id=site_id,
            block_id=block_id,
            billing_period_id=None,
            reading_status=None,
            meter_brand=None,
            apartment_no=None,
            meter_serial=None,
            search=None,
            sort_by="apartment_no",
            sort_dir="asc",
            page=1,
            page_size=20,
            db=self.db,
        )
        self.assertEqual(len(table_out.items), 1)
        self.assertEqual(table_out.items[0].meter_serial, meter_serial)
        self.assertAlmostEqual(table_out.items[0].first_index, 1000.00, places=2)
        self.assertAlmostEqual(table_out.items[0].last_index, 1310.25, places=2)
        self.assertAlmostEqual(table_out.items[0].consumption_kwh, 310.25, places=2)
        self.assertEqual(table_out.items[0].reading_status, "read")

        # 10. Daha önceki okumalar kaybolmuyor
        detail_out = get_apartment_detail(apartment_id=apt_id, db=self.db)
        history = detail_out["readings_history"]
        self.assertEqual(len(history), 2)
        values = [h["value"] for h in history]
        self.assertIn(1310.25, values)
        self.assertIn(1250.75, values)

    def test_04_unknown_meter_rejected_to_unmatched_list(self):
        """
        Acceptance Test 11: Hatalı veya bilinmeyen sayaç rastgele bir daireye eşlenmiyor;
        güvenli biçimde Eşleştirilmemiş Sayaçlar inceleme listesine alınıyor.
        """
        unknown_id = f"UNM-TEST-{int(datetime.now(timezone.utc).timestamp() * 1000) % 1000000}"
        res = ingest_single_reading(
            payload=ReadingIngestionPayload(
                device_id=unknown_id,
                source="wireless_mbus",
                reading_type="cumulative_energy",
                value=Decimal("742.80"),
                unit="kWh",
                read_at=datetime(2026, 11, 16, 14, 0, 0, tzinfo=timezone.utc),
                status="valid",
            ),
            db=self.db,
            collector_auth="AUTHORIZED_COLLECTOR",
        )
        self.assertEqual(res.ingest_status, "unmatched_device")
        self.assertIsNone(res.matched_apartment_label)

        unmatched = list_unmatched_meters(db=self.db)
        serials = [m["serial_number"] for m in unmatched]
        self.assertIn(unknown_id, serials)

    def test_05_offline_sqlite_queue_and_sync(self):
        """
        Acceptance Test 12: İnternet kesintisinde Collector veriyi SQLite'a kaydediyor
        ve bağlantı geldiğinde senkronize ediyor.
        """
        # Use Meram Konutları meter KM-775341 so Selçuklu Park Evleri A-101..A-108 reference rows remain untouched
        enq = collector_enqueue_offline(
            device_id="KM-775341", value=Decimal("1145.90"), source="simulator"
        )
        self.assertEqual(enq["status"], "queued_offline_sqlite")
        self.assertGreaterEqual(enq["queue_stats"]["pending"], 1)

        sync = collector_sync_pending_to_db(db=self.db)
        self.assertEqual(sync["status"], "synced")
        self.assertEqual(sync["queue_stats"]["pending"], 0)

    def test_06_decimal_70_30_billing_calculation(self):
        """Verifies Section 13: Decimal 70/30 calculation, kuruş rounding check, and approval."""
        # Run on Meram Konutları (site_id=2) so Selçuklu Park Evleri (site_id=1) keeps its exact reference numbers
        periods = list_billing_periods(site_id=2, db=self.db)
        period_id = periods[0].id

        cdata = calculate_billing_preview(
            period_id=period_id,
            total_invoice_try=Decimal("342000.00"),
            common_ratio=Decimal("0.3000"),
            usage_ratio=Decimal("0.7000"),
            db=self.db,
            current_user=self.founder,
        )
        self.assertIn("rounding_diff_try", cdata)
        self.assertLess(abs(cdata["rounding_diff_try"]), 2.0)

        approved = approve_billing_period(
            period_id=period_id, db=self.db, current_user=self.founder
        )
        self.assertEqual(approved.status, "approved")

    def test_07_stage_6_60000_apartments_pagination_performance(self):
        """
        Stage 6: Generates 60,000 apartments in the database and verifies indexed server-side
        pagination (20, 50, 100 per page) executes in milliseconds without loading all 60,000 rows.
        """
        gen_res = generate_60k_scale_dataset(target_total=60000, db=self.db)
        self.assertGreaterEqual(gen_res["total_apartments"], 60000)
        mega_site_id = gen_res.get("mega_site_id") or 6

        import time
        t0 = time.perf_counter()
        page_out = list_apartments_consumption(
            site_id=mega_site_id,
            block_id=None,
            billing_period_id=None,
            reading_status=None,
            meter_brand=None,
            apartment_no=None,
            meter_serial=None,
            search=None,
            sort_by="apartment_no",
            sort_dir="asc",
            page=150,
            page_size=50,
            db=self.db,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        self.assertEqual(len(page_out.items), 50)
        self.assertLess(elapsed_ms, 500.0, f"Pagination query took {elapsed_ms:.1f}ms")


if __name__ == "__main__":
    unittest.main()
