import json
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.security import hash_password, SecretKeyVault
from app.models.entities import (
    User,
    Site,
    Block,
    Apartment,
    Occupant,
    Meter,
    MeterAssignment,
    ReadingSession,
    MeterReading,
    ReadingIngestEvent,
    BillingPeriod,
    Invoice,
    Allocation,
    Alert,
    AuditLog,
)

FIRST_8_A_BLOK = [
    {
        "no": 101,
        "label": "A-101",
        "occupant": "Ahmet Yılmaz",
        "serial": "SH-775021",
        "wmbus": "64775021",
        "first_idx": Decimal("1250.40"),
        "last_idx": Decimal("1540.75"),
        "cons": Decimal("290.35"),
        "common": Decimal("80.00"),
        "usage": Decimal("1160.20"),
        "total": Decimal("1240.20"),
        "status": "read",
    },
    {
        "no": 102,
        "label": "A-102",
        "occupant": "Elif Demir",
        "serial": "SH-775022",
        "wmbus": "64775022",
        "first_idx": Decimal("980.10"),
        "last_idx": Decimal("1190.90"),
        "cons": Decimal("210.80"),
        "common": Decimal("80.00"),
        "usage": Decimal("843.20"),
        "total": Decimal("923.20"),
        "status": "read",
    },
    {
        "no": 103,
        "label": "A-103",
        "occupant": "Mehmet Kaya",
        "serial": "SH-775023",
        "wmbus": "64775023",
        "first_idx": Decimal("1410.00"),
        "last_idx": Decimal("1760.50"),
        "cons": Decimal("350.50"),
        "common": Decimal("80.00"),
        "usage": Decimal("1402.00"),
        "total": Decimal("1482.00"),
        "status": "read",
    },
    {
        "no": 104,
        "label": "A-104",
        "occupant": "Zeynep Arslan",
        "serial": "SH-775024",
        "wmbus": "64775024",
        "first_idx": Decimal("860.25"),
        "last_idx": Decimal("1040.75"),
        "cons": Decimal("180.50"),
        "common": Decimal("80.00"),
        "usage": Decimal("722.00"),
        "total": Decimal("802.00"),
        "status": "read",
    },
    {
        "no": 105,
        "label": "A-105",
        "occupant": "Mustafa Çelik",
        "serial": "SH-775025",
        "wmbus": "64775025",
        "first_idx": Decimal("1620.30"),
        "last_idx": Decimal("1901.40"),
        "cons": Decimal("281.10"),
        "common": Decimal("80.00"),
        "usage": Decimal("1124.40"),
        "total": Decimal("1204.40"),
        "status": "read",
    },
    {
        "no": 106,
        "label": "A-106",
        "occupant": "Fatma Öztürk",
        "serial": "SH-775026",
        "wmbus": "64775026",
        "first_idx": Decimal("1340.00"),
        "last_idx": Decimal("1340.00"),
        "cons": Decimal("0.00"),
        "common": Decimal("80.00"),
        "usage": Decimal("0.00"),
        "total": Decimal("80.00"),
        "status": "needs_review",
    },
    {
        "no": 107,
        "label": "A-107",
        "occupant": "Ali Demir",
        "serial": "SH-775027",
        "wmbus": "64775027",
        "first_idx": Decimal("1280.50"),
        "last_idx": None,
        "cons": None,
        "common": None,
        "usage": None,
        "total": None,
        "status": "unread",
    },
    {
        "no": 108,
        "label": "A-108",
        "occupant": "Ayşe Kaya",
        "serial": "SH-775028",
        "wmbus": "64775028",
        "first_idx": Decimal("1905.10"),
        "last_idx": Decimal("2210.80"),
        "cons": Decimal("305.70"),
        "common": Decimal("80.00"),
        "usage": Decimal("1222.80"),
        "total": Decimal("1302.80"),
        "status": "read",
    },
]

TURKISH_FIRST_NAMES = [
    "Hüseyin", "Hatice", "İbrahim", "Emine", "Hasan", "Ömer", "Merve", "Burak",
    "Esra", "Kemal", "Selin", "Yusuf", "Büşra", "Serkan", "Gökhan", "Kübra",
    "Murat", "Tuğba", "kadir", "Derya", "Sinan", "Pınar", "Cem", "Aslı",
]
TURKISH_LAST_NAMES = [
    "Şahin", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan",
    "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
]


def seed_initial_data(db: Session) -> None:
    existing_user = db.execute(select(func.count(User.id))).scalar_one()
    if existing_user > 0:
        return

    now = datetime(2026, 1, 15, 10, 24, 0, tzinfo=timezone.utc)
    default_pw = hash_password("Isisens2026!")

    # 1. Three Founder Computer Engineers
    founders = [
        User(
            username="furkan",
            email="furkan@isisens.com.tr",
            full_name="Furkan Kaya",
            title="Sistem Yöneticisi • Kurucu Bilgisayar Mühendisi",
            role="founder_admin",
            password_hash=default_pw,
            is_active=True,
            kvkk_approved=True,
            last_login_at=now,
        ),
        User(
            username="emre",
            email="emre@isisens.com.tr",
            full_name="Emre Yılmaz",
            title="IoT & RF Sistem Mimarı • Kurucu Bilgisayar Mühendisi",
            role="founder_admin",
            password_hash=default_pw,
            is_active=True,
            kvkk_approved=True,
            last_login_at=now - timedelta(hours=2),
        ),
        User(
            username="burak",
            email="burak@isisens.com.tr",
            full_name="Burak Demir",
            title="Veri & Faturalandırma Mimarı • Kurucu Bilgisayar Mühendisi",
            role="founder_admin",
            password_hash=default_pw,
            is_active=True,
            kvkk_approved=True,
            last_login_at=now - timedelta(hours=5),
        ),
    ]
    db.add_all(founders)
    db.flush()

    # 2. Create 5 Konya Sites (Demo marked clearly as is_demo=True)
    spe_site = Site(
        name="Selçuklu Park Evleri",
        code="SPE-4201",
        district="Selçuklu",
        city="Konya",
        address="Yazır Mah. Doç. Dr. Halil Ürün Cad. No:42 Selçuklu/Konya",
        heating_system="Merkezi Kalorimetre",
        primary_protocol="SHARKY / OMS",
        status="active",
        is_demo=True,
        common_share_ratio=Decimal("0.3000"),
        usage_share_ratio=Decimal("0.7000"),
        latitude=37.9502,
        longitude=32.4895,
    )
    meram_site = Site(
        name="Meram Konutları",
        code="MRM-4202",
        district="Meram",
        city="Konya",
        address="Alavardı Mah. Yaka Cad. No:118 Meram/Konya",
        heating_system="Merkezi Kalorimetre",
        primary_protocol="KAMSTRUP / OMS",
        status="active",
        is_demo=True,
        latitude=37.8541,
        longitude=32.4412,
    )
    karatay_site = Site(
        name="Karatay Yaşam Sitesi",
        code="KRT-4203",
        district="Karatay",
        city="Konya",
        address="Fetih Mah. Adana Çevre Yolu Cad. No:84 Karatay/Konya",
        heating_system="Merkezi Kalorimetre",
        primary_protocol="DANFOSS / OMS",
        status="active",
        is_demo=True,
        latitude=37.8820,
        longitude=32.5410,
    )
    bosna_site = Site(
        name="Bosna Konakları",
        code="BSN-4204",
        district="Selçuklu",
        city="Konya",
        address="Bosna Hersek Mah. Osmanlı Cad. No:19 Selçuklu/Konya",
        heating_system="Merkezi Kalorimetre",
        primary_protocol="QUNDIS / OMS",
        status="active",
        is_demo=True,
        latitude=38.0115,
        longitude=32.5190,
    )
    esenler_site = Site(
        name="Esenler Sitesi",
        code="ESN-4205",
        district="Meram",
        city="Konya",
        address="Havzan Mah. Yeni Meram Cad. No:65 Meram/Konya",
        heating_system="Merkezi Kalorimetre",
        primary_protocol="SHARKY / OMS",
        status="active",
        is_demo=True,
        latitude=37.8625,
        longitude=32.4680,
    )
    db.add_all([spe_site, meram_site, karatay_site, bosna_site, esenler_site])
    db.flush()

    # 3. Create Billing Periods for Selçuklu Park Evleri
    spe_period_jan = BillingPeriod(
        site_id=spe_site.id,
        name="Ocak 2026",
        period_code="2026-01",
        start_date=date(2025, 12, 1),
        end_date=date(2025, 12, 31),
        total_site_consumption_kwh=Decimal("186540.00"),
        total_bill_amount_try=Decimal("1284760.00"),
        unit_price_per_kwh=Decimal("4.0000"),
        common_fee_per_apartment_try=Decimal("80.00"),
        common_share_ratio=Decimal("0.3000"),
        usage_share_ratio=Decimal("0.7000"),
        calculation_method="TR_MERKEZI_70_30_DECIMAL",
        calculation_version=1,
        rounding_diff_try=Decimal("0.0000"),
        status="approved",
        approved_by_user_id=founders[0].id,
        approved_at=now - timedelta(days=1),
    )
    spe_period_dec = BillingPeriod(
        site_id=spe_site.id,
        name="Aralık 2025",
        period_code="2025-12",
        start_date=date(2025, 11, 1),
        end_date=date(2025, 11, 30),
        total_site_consumption_kwh=Decimal("164200.00"),
        total_bill_amount_try=Decimal("1120400.00"),
        unit_price_per_kwh=Decimal("3.8500"),
        common_fee_per_apartment_try=Decimal("75.00"),
        common_share_ratio=Decimal("0.3000"),
        usage_share_ratio=Decimal("0.7000"),
        calculation_method="TR_MERKEZI_70_30_DECIMAL",
        calculation_version=1,
        rounding_diff_try=Decimal("0.0000"),
        status="locked",
        approved_by_user_id=founders[0].id,
        approved_at=now - timedelta(days=32),
    )
    db.add_all([spe_period_jan, spe_period_dec])
    db.flush()

    db.add(
        Invoice(
            billing_period_id=spe_period_jan.id,
            site_id=spe_site.id,
            provider_name="Enerya Konya Gaz Dağıtım A.Ş.",
            invoice_no="ENR-2026-0018492",
            invoice_date=date(2026, 1, 2),
            due_date=date(2026, 1, 19),
            gas_volume_sm3=Decimal("19845.00"),
            total_energy_kwh=Decimal("186540.00"),
            total_amount_try=Decimal("1284760.00"),
            notes="Selçuklu Park Evleri Ocak 2026 Merkezi Kazan Doğalgaz Faturası",
        )
    )

    # Create a Reading Session for Selçuklu Park Evleri
    spe_session = ReadingSession(
        session_code="SES-SPE-202601-01",
        site_id=spe_site.id,
        collector_id="COLLECTOR-KONYA-01",
        source="wireless_mbus",
        adapter_name="WMBusReader / SimulatorReader",
        started_at=now - timedelta(minutes=18),
        ended_at=now,
        total_packets=320,
        valid_readings_count=314,
        error_count=6,
        unmatched_count=3,
        status="completed",
    )
    db.add(spe_session)
    db.flush()

    # 4. Create 4 Blocks for Selçuklu Park Evleri (A, B, C, D Blok — 80 apartments each = 320 total)
    spe_blocks = []
    for code in ["A", "B", "C", "D"]:
        blk = Block(
            site_id=spe_site.id,
            name=f"{code} Blok",
            code=code,
            floor_count=20,
            planned_apartment_count=80,
        )
        spe_blocks.append(blk)
    db.add_all(spe_blocks)
    db.flush()

    # Target totals across all 320 apartments in Selçuklu Park Evleri:
    # Total Apartments = 320
    # Read Apartments = 314 (78 in A, 79 in B, 79 in C, 78 in D)
    # Unread Apartments = 6 (2 in A: #107 & #145, 1 in B: #130, 1 in C: #150, 2 in D: #120 & #160)
    # Sum of consumption_kwh across the 314 read apartments = 186,540.00 kWh
    # Sum of total_amount_try across the 314 read apartments = 1,284,760.00 TRY

    unread_positions = {
        ("A", 107),
        ("A", 145),
        ("B", 130),
        ("C", 150),
        ("D", 120),
        ("D", 160),
    }

    first8_cons_sum = sum(r["cons"] for r in FIRST_8_A_BLOK if r["cons"] is not None)
    first8_total_sum = sum(r["total"] for r in FIRST_8_A_BLOK if r["total"] is not None)

    remaining_read_count = 314 - 7  # 7 of first 8 have consumption/allocations (101..106, 108) = 307 remaining read apartments
    remaining_cons_target = Decimal("186540.00") - first8_cons_sum
    remaining_total_target = Decimal("1284760.00") - first8_total_sum

    base_cons_per_apt = (remaining_cons_target // remaining_read_count).quantize(Decimal("0.01"))
    cons_remainder = remaining_cons_target - (base_cons_per_apt * remaining_read_count)

    base_total_per_apt = (remaining_total_target // remaining_read_count).quantize(Decimal("0.01"))
    total_remainder = remaining_total_target - (base_total_per_apt * remaining_read_count)

    serial_counter = 775021
    rem_idx = 0

    for blk_idx, blk in enumerate(spe_blocks):
        for i in range(1, 81):
            apt_no = 100 + i
            flat_label = f"{blk.code}-{apt_no}"
            floor = ((i - 1) // 4) + 1

            if blk.code == "A" and i <= 8:
                row_spec = FIRST_8_A_BLOK[i - 1]
                occ_name = row_spec["occupant"]
                serial_no = row_spec["serial"]
                wmbus_id = row_spec["wmbus"]
                first_idx = row_spec["first_idx"]
                last_idx = row_spec["last_idx"]
                cons_val = row_spec["cons"]
                common_val = row_spec["common"]
                usage_val = row_spec["usage"]
                total_val = row_spec["total"]
                r_status = row_spec["status"]
                serial_counter = max(serial_counter, int(serial_no.split("-")[1]) + 1)
            else:
                serial_no = f"SH-{serial_counter}"
                wmbus_id = f"64{serial_counter}"
                serial_counter += 1
                fn = TURKISH_FIRST_NAMES[(blk_idx * 80 + i) % len(TURKISH_FIRST_NAMES)].capitalize()
                ln = TURKISH_LAST_NAMES[(blk_idx * 17 + i * 3) % len(TURKISH_LAST_NAMES)]
                occ_name = f"{fn} {ln}"
                first_idx = Decimal(str(950 + ((blk_idx * 80 + i) * 7) % 900)) + Decimal("0.20")

                if (blk.code, apt_no) in unread_positions:
                    r_status = "unread"
                    last_idx = None
                    cons_val = None
                    common_val = None
                    usage_val = None
                    total_val = None
                else:
                    r_status = "read"
                    rem_idx += 1
                    cons_val = base_cons_per_apt + (cons_remainder if rem_idx == remaining_read_count else Decimal("0.00"))
                    last_idx = first_idx + cons_val
                    common_val = Decimal("80.00")
                    total_val = base_total_per_apt + (total_remainder if rem_idx == remaining_read_count else Decimal("0.00"))
                    usage_val = total_val - common_val

            apt = Apartment(
                site_id=spe_site.id,
                block_id=blk.id,
                apartment_no=apt_no,
                flat_label=flat_label,
                floor=floor,
                door_number=str(apt_no),
                area_m2=Decimal("145.00"),
                share_coefficient=Decimal("1.000000"),
                status="occupied",
                last_reading_status=r_status,
                last_read_at=now - timedelta(minutes=(i % 45)) if r_status != "unread" else None,
                is_demo=True,
            )
            db.add(apt)
            db.flush()

            db.add(
                Occupant(
                    apartment_id=apt.id,
                    full_name=occ_name,
                    occupant_type="owner" if i % 3 != 0 else "tenant",
                    phone_masked=f"053{(i % 9) + 1} *** ** {10 + (i % 89)}",
                    email_masked=f"{occ_name.lower().split()[0][:2]}***@example.com",
                    is_active=True,
                )
            )

            key_ref = SecretKeyVault.register_meter_key(serial_no, f"AES128-OMS-{serial_no}")
            meter = Meter(
                technical_uid=f"OMS-DIEHL-{serial_no}",
                serial_number=serial_no,
                wmbus_id=wmbus_id,
                manufacturer="Diehl Metering",
                model="Sharky 775",
                communication_protocol="SHARKY / OMS",
                rf_mode="T1",
                unit="kWh",
                driver_name="sharky",
                encryption_status="AES-128-CBC",
                key_reference=key_ref,
                battery_status="ok" if r_status != "unread" else "low",
                last_rssi_dbm=-68 - (i % 18) if r_status != "unread" else None,
                status="active",
                is_paired=True,
                is_demo=True,
            )
            db.add(meter)
            db.flush()

            db.add(
                MeterAssignment(
                    apartment_id=apt.id,
                    meter_id=meter.id,
                    assigned_at=now - timedelta(days=365),
                    initial_index_value=Decimal("100.00"),
                    is_active=True,
                    reason="İlk kurulum sayaç eşleştirmesi",
                    assigned_by_user_id=founders[0].id,
                )
            )

            # Historical reading from previous month (November/December)
            prev_month_first = (first_idx - Decimal("240.00")) if first_idx > Decimal("240.00") else Decimal("0.00")
            db.add(
                MeterReading(
                    meter_id=meter.id,
                    apartment_id=apt.id,
                    billing_period_id=spe_period_dec.id,
                    reading_type="cumulative_energy",
                    first_index=prev_month_first,
                    value=first_idx,
                    consumption_kwh=first_idx - prev_month_first,
                    unit="kWh",
                    read_at=datetime(2025, 11, 30, 14, 0, 0, tzinfo=timezone.utc),
                    source="wireless_mbus",
                    status="valid",
                    rssi_dbm=-70,
                    battery_level="ok",
                    idempotency_key=f"SEED-DEC2025-{serial_no}",
                    is_official=True,
                )
            )

            if last_idx is not None and cons_val is not None:
                db.add(
                    MeterReading(
                        meter_id=meter.id,
                        apartment_id=apt.id,
                        session_id=spe_session.id,
                        billing_period_id=spe_period_jan.id,
                        reading_type="cumulative_energy",
                        first_index=first_idx,
                        value=last_idx,
                        consumption_kwh=cons_val,
                        unit="kWh",
                        read_at=datetime(2025, 12, 31, 10, 24, 0, tzinfo=timezone.utc),
                        source="wireless_mbus",
                        status="valid" if r_status == "read" else "needs_review",
                        rssi_dbm=-68 - (i % 15),
                        battery_level="ok",
                        flow_temp_c=Decimal("54.20"),
                        return_temp_c=Decimal("41.80"),
                        idempotency_key=f"SEED-JAN2026-{serial_no}",
                        is_official=True,
                    )
                )

            db.add(
                Allocation(
                    billing_period_id=spe_period_jan.id,
                    apartment_id=apt.id,
                    meter_id=meter.id,
                    first_index=first_idx,
                    last_index=last_idx,
                    consumption_kwh=cons_val,
                    common_share_try=common_val,
                    usage_share_try=usage_val,
                    total_amount_try=total_val,
                    calculation_version=1,
                    reading_status=r_status,
                    status="approved",
                )
            )

    # 5. Seed blocks and representative apartments for the other 4 Konya sites
    other_sites_specs = [
        (meram_site, ["A", "B"], 12, "KM", "Kamstrup", "Multical 303", "multical302", Decimal("48200.00"), Decimal("342000.00")),
        (karatay_site, ["A", "B"], 10, "DF", "Danfoss", "SonoSelect", "sonoselect", Decimal("31400.00"), Decimal("218500.00")),
        (bosna_site, ["A", "B"], 12, "QN", "Qundis", "Q heat 5.5", "qheat", Decimal("64800.00"), Decimal("448900.00")),
        (esenler_site, ["A", "B"], 8, "SH", "Diehl Metering", "Sharky 775", "sharky", Decimal("22150.00"), Decimal("156400.00")),
    ]

    for site_obj, blk_codes, apts_per_blk, prefix, manuf, model_name, driver, site_kwh, site_try in other_sites_specs:
        bp = BillingPeriod(
            site_id=site_obj.id,
            name="Ocak 2026",
            period_code="2026-01",
            start_date=date(2025, 12, 1),
            end_date=date(2025, 12, 31),
            total_site_consumption_kwh=site_kwh,
            total_bill_amount_try=site_try,
            unit_price_per_kwh=Decimal("4.0000"),
            common_fee_per_apartment_try=Decimal("80.00"),
            status="preview",
        )
        db.add(bp)
        db.flush()

        for b_code in blk_codes:
            blk = Block(
                site_id=site_obj.id,
                name=f"{b_code} Blok",
                code=b_code,
                floor_count=10,
                planned_apartment_count=apts_per_blk,
            )
            db.add(blk)
            db.flush()

            for idx in range(1, apts_per_blk + 1):
                apt_no = 100 + idx
                flat_label = f"{b_code}-{apt_no}"
                serial_no = f"{prefix}-{serial_counter}"
                wmbus_id = f"68{serial_counter}"
                serial_counter += 1

                is_unread = idx == apts_per_blk
                r_stat = "unread" if is_unread else "read"

                apt = Apartment(
                    site_id=site_obj.id,
                    block_id=blk.id,
                    apartment_no=apt_no,
                    flat_label=flat_label,
                    floor=((idx - 1) // 2) + 1,
                    door_number=str(apt_no),
                    area_m2=Decimal("135.00"),
                    status="occupied",
                    last_reading_status=r_stat,
                    last_read_at=now - timedelta(hours=1) if not is_unread else None,
                    is_demo=True,
                )
                db.add(apt)
                db.flush()

                fn = TURKISH_FIRST_NAMES[(serial_counter + idx) % len(TURKISH_FIRST_NAMES)].capitalize()
                ln = TURKISH_LAST_NAMES[(serial_counter * 3 + idx) % len(TURKISH_LAST_NAMES)]
                db.add(
                    Occupant(
                        apartment_id=apt.id,
                        full_name=f"{fn} {ln}",
                        occupant_type="owner",
                        phone_masked="0532 *** ** 42",
                        is_active=True,
                    )
                )

                key_ref = SecretKeyVault.register_meter_key(serial_no, f"AES128-OMS-{serial_no}")
                mtr = Meter(
                    technical_uid=f"OMS-{prefix}-{serial_no}",
                    serial_number=serial_no,
                    wmbus_id=wmbus_id,
                    manufacturer=manuf,
                    model=model_name,
                    communication_protocol=site_obj.primary_protocol,
                    rf_mode="C1",
                    unit="kWh",
                    driver_name=driver,
                    encryption_status="AES-128-CBC",
                    key_reference=key_ref,
                    battery_status="ok",
                    last_rssi_dbm=-71,
                    status="active",
                    is_paired=True,
                    is_demo=True,
                )
                db.add(mtr)
                db.flush()

                db.add(
                    MeterAssignment(
                        apartment_id=apt.id,
                        meter_id=mtr.id,
                        assigned_at=now - timedelta(days=200),
                        initial_index_value=Decimal("200.00"),
                        is_active=True,
                        reason="İlk saha kurulumu",
                        assigned_by_user_id=founders[1].id,
                    )
                )

                f_idx = Decimal("840.00") + Decimal(str(idx * 15))
                l_idx = None if is_unread else f_idx + Decimal("245.50")
                c_val = None if is_unread else Decimal("245.50")
                u_try = None if is_unread else Decimal("982.00")
                t_try = None if is_unread else Decimal("1062.00")

                if not is_unread:
                    db.add(
                        MeterReading(
                            meter_id=mtr.id,
                            apartment_id=apt.id,
                            billing_period_id=bp.id,
                            reading_type="cumulative_energy",
                            first_index=f_idx,
                            value=l_idx,
                            consumption_kwh=c_val,
                            unit="kWh",
                            read_at=now - timedelta(hours=1),
                            source="wireless_mbus",
                            status="valid",
                            rssi_dbm=-71,
                            battery_level="ok",
                            idempotency_key=f"SEED-JAN2026-{serial_no}",
                            is_official=False,
                        )
                    )

                db.add(
                    Allocation(
                        billing_period_id=bp.id,
                        apartment_id=apt.id,
                        meter_id=mtr.id,
                        first_index=f_idx,
                        last_index=l_idx,
                        consumption_kwh=c_val,
                        common_share_try=Decimal("80.00") if not is_unread else None,
                        usage_share_try=u_try,
                        total_amount_try=t_try,
                        reading_status=r_stat,
                        status="preview",
                    )
                )

    # 6. Seed 3 Unassigned / Unmatched Meters detected in the field (for "Eşleştirilmemiş Sayaçlar" review screen)
    unmatched_specs = [
        ("UNM-884011", "69884011", "Diehl Metering", "Sharky 775", "1420.80"),
        ("UNM-884012", "69884012", "Kamstrup", "Multical 303", "685.40"),
        ("UNM-884019", "69884019", "Qundis", "Q heat 5.5", "312.15"),
    ]
    for u_serial, u_wmbus, u_manuf, u_model, u_val in unmatched_specs:
        u_meter = Meter(
            technical_uid=f"UNM-{u_serial}",
            serial_number=u_serial,
            wmbus_id=u_wmbus,
            manufacturer=u_manuf,
            model=u_model,
            communication_protocol="Wireless M-Bus / OMS v4",
            rf_mode="T1",
            unit="kWh",
            driver_name="sharky",
            encryption_status="AES-128-CBC",
            key_reference=None,
            battery_status="ok",
            last_rssi_dbm=-79,
            status="unassigned",
            is_paired=False,
            is_demo=True,
        )
        db.add(u_meter)
        db.flush()

        db.add(
            ReadingIngestEvent(
                idempotency_key=f"SEED-UNM-{u_serial}",
                collector_id="COLLECTOR-KONYA-01",
                device_id=u_serial,
                source="wireless_mbus",
                raw_payload_json=json.dumps(
                    {
                        "device_id": u_serial,
                        "source": "wireless_mbus",
                        "reading_type": "cumulative_energy",
                        "value": u_val,
                        "unit": "kWh",
                        "read_at": now.isoformat(),
                        "status": "valid",
                    }
                ),
                ingest_status="unmatched_device",
                error_message="Sahada RF sinyali yakalandı ancak henüz bir daireye atanmadı.",
                matched_meter_id=u_meter.id,
            )
        )

    # 7. Seed 24 Active Alerts (12 Low Battery + 7 No Signal + 5 Missing Key = 24 total alerts matching the reference UI!)
    for i in range(1, 13):
        db.add(
            Alert(
                site_id=spe_site.id if i <= 6 else meram_site.id,
                device_id=f"SH-775{100 + i}",
                alert_type="low_battery",
                severity="warning",
                title=f"Düşük Pil Uyarısı — SH-775{100 + i}",
                description="Sayaç batarya voltajı kritik eşik (%20) altında raporlandı. Saha bakımı planlanmalı.",
                status="open",
            )
        )
    for i in range(1, 8):
        db.add(
            Alert(
                site_id=spe_site.id if i <= 4 else karatay_site.id,
                device_id=f"SH-775{200 + i}",
                alert_type="no_signal",
                severity="critical",
                title=f"RF Sinyal Yok — SH-775{200 + i}",
                description="Son 2 okuma oturumunda Wireless M-Bus T1 paketi alınamadı.",
                status="open",
            )
        )
    for i in range(1, 6):
        db.add(
            Alert(
                site_id=bosna_site.id if i <= 3 else esenler_site.id,
                device_id=f"QN-775{300 + i}",
                alert_type="missing_key",
                severity="warning",
                title=f"OMS AES-128 Anahtar Eksik — QN-775{300 + i}",
                description="Şifreli OMS telgrafı alındı ancak Key Vault içinde sayaç şifre çözme anahtarı tanımlı değil.",
                status="open",
            )
        )

    # 8. Seed Recent Audit Logs (matching "Son İşlemler" in Overview reference)
    audit_entries = [
        ("IsıSens Ekibi", "READING_SESSION_COMPLETED", "site", "Selçuklu Park Evleri", "Selçuklu Park Evleri okuması tamamlandı."),
        ("Furkan Kaya", "SITE_CREATED", "site", "Bosna Konakları", "Yeni site eklendi: Bosna Konakları."),
        ("Emre Yılmaz", "METER_BATCH_UPDATED", "meter", "24 Adet", "Sayaç güncellemesi (24 adet) yapıldı."),
        ("Burak Demir", "USER_ROLE_UPDATED", "user", "IsıSens Ekibi", "Kullanıcı yetkisi güncellendi."),
    ]
    for idx, (actor, act, etype, eid, desc_txt) in enumerate(audit_entries):
        db.add(
            AuditLog(
                user_id=founders[idx % 3].id,
                actor_name=actor,
                action=act,
                entity_type=etype,
                entity_id=eid,
                details_json=json.dumps({"summary": desc_txt}),
                created_at=now - timedelta(minutes=idx * 35),
            )
        )

    db.commit()

