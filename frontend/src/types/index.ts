export type NavSection =
  | 'genel-bakis'
  | 'siteler'
  | 'bloklar'
  | 'sayaclar'
  | 'okumalar'
  | 'ariza-uyarilar'
  | 'faturalandirma'
  | 'raporlar'
  | 'kullanicilar'
  | 'sistem-ayarlari';

export type SiteDetailTab =
  | 'daireler'
  | 'sayaclar'
  | 'okumalar'
  | 'gider-dagilimi'
  | 'raporlar'
  | 'site-ayarlari';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  title: string;
  role: string;
  is_active: boolean;
  kvkk_approved: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface BlockSummary {
  id: number;
  site_id: number;
  name: string;
  code: string;
  floor_count: number;
  planned_apartment_count: number;
  actual_apartment_count: number;
  read_count: number;
  unread_count: number;
}

export interface SiteTreeItem {
  id: number;
  name: string;
  code: string;
  district: string;
  city: string;
  primary_protocol: string;
  status: string;
  is_demo: boolean;
  block_count: number;
  apartment_count: number;
  read_count: number;
  unread_count: number;
  success_rate: number;
  blocks: BlockSummary[];
}

export interface BillingPeriod {
  id: number;
  site_id: number;
  name: string;
  period_code: string;
  start_date: string;
  end_date: string;
  total_site_consumption_kwh: number;
  total_bill_amount_try: number;
  unit_price_per_kwh: number;
  common_fee_per_apartment_try: number;
  common_share_ratio: number;
  usage_share_ratio: number;
  calculation_method: string;
  calculation_version: number;
  rounding_diff_try: number;
  status: string;
  approved_at?: string | null;
  created_at: string;
}

export interface SiteDetailSummary {
  site_id: number;
  site_name: string;
  site_code: string;
  district: string;
  city: string;
  status: string;
  is_demo: boolean;
  primary_protocol: string;
  block_count: number;
  total_apartments: number;
  read_apartments: number;
  unread_apartments: number;
  read_percentage: number;
  unread_percentage: number;
  total_consumption_kwh: number;
  estimated_total_amount_try: number;
  active_period?: BillingPeriod | null;
  available_periods: BillingPeriod[];
  blocks: BlockSummary[];
}

export interface ApartmentConsumptionRow {
  apartment_id: number;
  site_id: number;
  block_id: number;
  block_name: string;
  apartment_no: number;
  flat_label: string;
  floor: number;
  area_m2: number;
  occupant_name: string;
  occupant_type: string;
  meter_id?: number | null;
  meter_serial: string;
  meter_wmbus_id?: string | null;
  meter_brand_model: string;
  meter_manufacturer: string;
  meter_model: string;
  encryption_status: string;
  first_index?: number | null;
  last_index?: number | null;
  consumption_kwh?: number | null;
  common_share_try?: number | null;
  usage_share_try?: number | null;
  total_amount_try?: number | null;
  last_read_at?: string | null;
  reading_status: 'read' | 'pending' | 'unread' | 'invalid_data' | 'needs_review' | 'missing_key';
  is_demo: boolean;
}

export interface PaginatedApartments {
  items: ApartmentConsumptionRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  scope_total_apartments: number;
  scope_read_apartments: number;
  scope_unread_apartments: number;
  period_start_label: string;
  period_end_label: string;
}

export interface ApartmentDetailData {
  apartment: {
    id: number;
    site_id: number;
    site_name: string;
    block_id: number;
    block_name: string;
    apartment_no: number;
    flat_label: string;
    floor: number;
    area_m2: number;
    reading_status: string;
    last_read_at?: string | null;
    is_demo: boolean;
  };
  occupants: Array<{
    id: number;
    full_name: string;
    occupant_type: string;
    phone_masked?: string | null;
    is_active: boolean;
    start_date: string;
  }>;
  meter_assignments: Array<{
    assignment_id: number;
    meter_id: number;
    serial_number: string;
    wmbus_id: string;
    manufacturer: string;
    model: string;
    protocol: string;
    rf_mode: string;
    unit: string;
    encryption_status: string;
    key_reference?: string | null;
    battery_status?: string | null;
    last_rssi_dbm?: number | null;
    assigned_at: string;
    unassigned_at?: string | null;
    initial_index_value: number;
    is_active: boolean;
    reason?: string | null;
  }>;
  readings_history: Array<{
    id: number;
    meter_serial: string;
    reading_type: string;
    first_index: number;
    value: number;
    consumption_kwh?: number | null;
    unit: string;
    read_at: string;
    source: string;
    status: string;
    rssi_dbm?: number | null;
    battery_level?: string | null;
    flow_temp_c?: number | null;
    return_temp_c?: number | null;
    idempotency_key: string;
    is_official: boolean;
  }>;
  billing_history: Array<{
    allocation_id: number;
    period_id: number;
    period_name: string;
    period_code: string;
    start_date: string;
    end_date: string;
    first_index: number;
    last_index?: number | null;
    consumption_kwh?: number | null;
    common_share_try?: number | null;
    usage_share_try?: number | null;
    total_amount_try?: number | null;
    calculation_version: number;
    status: string;
  }>;
}

