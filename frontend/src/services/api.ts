import axios from 'axios';
import type {
  User,
  SiteTreeItem,
  BlockSummary,
  SiteDetailSummary,
  PaginatedApartments,
  ApartmentDetailData,
  BillingPeriod,
  ApartmentConsumptionRow,
} from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('isisens_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const isisensApi = {
  // Auth & Users
  login: async (username: string, password: string) => {
    const { data } = await apiClient.post<{ access_token: string; user: User }>('/auth/login', {
      username,
      password,
    });
    localStorage.setItem('isisens_token', data.access_token);
    return data;
  },
  getMe: async () => {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },
  listUsers: async () => {
    const { data } = await apiClient.get<User[]>('/users');
    return data;
  },
  createUser: async (payload: {
    username: string;
    email: string;
    full_name: string;
    title: string;
    role: string;
    password: string;
  }) => {
    const { data } = await apiClient.post<User>('/users', payload);
    return data;
  },

  // Overview Dashboard
  getOverview: async () => {
    const { data } = await apiClient.get('/overview');
    return data;
  },

  // Sites & Blocks
  listSitesTree: async (search?: string) => {
    const { data } = await apiClient.get<SiteTreeItem[]>('/sites', {
      params: search ? { search } : undefined,
    });
    return data;
  },
  createSite: async (payload: {
    name: string;
    code?: string;
    district: string;
    city: string;
    address?: string;
    primary_protocol: string;
    is_demo: boolean;
  }) => {
    const { data } = await apiClient.post<SiteTreeItem>('/sites', payload);
    return data;
  },
  updateSite: async (
    siteId: number,
    payload: {
      name?: string;
      district?: string;
      city?: string;
      address?: string;
      primary_protocol?: string;
      status?: string;
      is_demo?: boolean;
    }
  ) => {
    const { data } = await apiClient.put<SiteTreeItem>(`/sites/${siteId}`, payload);
    return data;
  },
  createBlock: async (payload: {
    site_id: number;
    name: string;
    code?: string;
    floor_count: number;
    planned_apartment_count: number;
  }) => {
    const { data } = await apiClient.post<BlockSummary>('/blocks', payload);
    return data;
  },
  listAllBlocks: async (siteId?: number) => {
    const { data } = await apiClient.get('/blocks', {
      params: siteId ? { site_id: siteId } : undefined,
    });
    return data;
  },
  getSiteSummary: async (siteId: number, blockId?: number | null, billingPeriodId?: number | null) => {
    const { data } = await apiClient.get<SiteDetailSummary>(`/sites/${siteId}/summary`, {
      params: {
        ...(blockId ? { block_id: blockId } : {}),
        ...(billingPeriodId ? { billing_period_id: billingPeriodId } : {}),
      },
    });
    return data;
  },

  // Apartments
  listApartments: async (params: {
    site_id: number;
    block_id?: number | null;
    billing_period_id?: number | null;
    reading_status?: string;
    meter_brand?: string;
    apartment_no?: string;
    meter_serial?: string;
    search?: string;
    sort_by?: string;
    sort_dir?: string;
    page?: number;
    page_size?: number;
  }) => {
    const cleanParams: Record<string, any> = { site_id: params.site_id };
    if (params.block_id) cleanParams.block_id = params.block_id;
    if (params.billing_period_id) cleanParams.billing_period_id = params.billing_period_id;
    if (params.reading_status && params.reading_status !== 'all') cleanParams.reading_status = params.reading_status;
    if (params.meter_brand && params.meter_brand !== 'all') cleanParams.meter_brand = params.meter_brand;
    if (params.apartment_no) cleanParams.apartment_no = params.apartment_no;
    if (params.meter_serial) cleanParams.meter_serial = params.meter_serial;
    if (params.search) cleanParams.search = params.search;
    if (params.sort_by) cleanParams.sort_by = params.sort_by;
    if (params.sort_dir) cleanParams.sort_dir = params.sort_dir;
    cleanParams.page = params.page ?? 1;
    cleanParams.page_size = params.page_size ?? 20;

    const { data } = await apiClient.get<PaginatedApartments>('/apartments', {
      params: cleanParams,
    });
    return data;
  },
  createApartment: async (payload: {
    site_id: number;
    block_id: number;
    apartment_no: number;
    flat_label?: string;
    floor: number;
    area_m2: number;
    occupant_name: string;
    occupant_type: string;
    meter_serial?: string;
    meter_manufacturer?: string;
    meter_model?: string;
    initial_index: number;
    is_demo?: boolean;
  }) => {
    const { data } = await apiClient.post<ApartmentConsumptionRow>('/apartments', payload);
    return data;
  },
  getApartmentDetail: async (apartmentId: number) => {
    const { data } = await apiClient.get<ApartmentDetailData>(`/apartments/${apartmentId}/detail`);
    return data;
  },

  // Meters & Unmatched Meters
  listMeters: async (params?: {
    site_id?: number;
    paired_only?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }) => {
    const { data } = await apiClient.get('/meters', { params });
    return data;
  },
  listUnmatchedMeters: async () => {
    const { data } = await apiClient.get('/meters/unmatched');
    return data;
  },
  createMeter: async (payload: {
    serial_number: string;
    wmbus_id?: string;
    manufacturer: string;
    model: string;
    communication_protocol: string;
    rf_mode: string;
    unit: string;
    encryption_status: string;
    apartment_id?: number;
    initial_index_value?: number;
  }) => {
    const { data } = await apiClient.post('/meters', payload);
    return data;
  },
  assignMeter: async (payload: {
    apartment_id: number;
    meter_id: number;
    initial_index_value: number;
    reason?: string;
  }) => {
    const { data } = await apiClient.post('/meters/assign', payload);
    return data;
  },

  // Ingestion & Collector
  ingestReading: async (payload: {
    device_id: string;
    source: string;
    reading_type: string;
    value: string | number;
    unit: string;
    read_at: string;
    status: string;
    rssi_dbm?: number;
    battery_level?: string;
  }) => {
    const { data } = await apiClient.post('/ingestion/readings', payload);
    return data;
  },
  getReadingsStatus: async () => {
    const { data } = await apiClient.get('/readings/status');
    return data;
  },
  collectorEnqueueOffline: async (deviceId: string, value: string | number, source = 'simulator') => {
    const { data } = await apiClient.post('/readings/collector-enqueue', null, {
      params: { device_id: deviceId, value, source },
    });
    return data;
  },
  collectorSyncPending: async () => {
    const { data } = await apiClient.post('/readings/collector-sync');
    return data;
  },

  // Billing
  listBillingPeriods: async (siteId?: number) => {
    const { data } = await apiClient.get<BillingPeriod[]>('/billing/periods', {
      params: siteId ? { site_id: siteId } : undefined,
    });
    return data;
  },
  createBillingPeriod: async (payload: {
    site_id: number;
    name: string;
    period_code: string;
    start_date: string;
    end_date: string;
    total_bill_amount_try: number;
    unit_price_per_kwh: number;
    common_fee_per_apartment_try: number;
    common_share_ratio: number;
    usage_share_ratio: number;
  }) => {
    const { data } = await apiClient.post<BillingPeriod>('/billing/periods', payload);
    return data;
  },
  calculateBillingPreview: async (
    periodId: number,
    totalInvoiceTry: number,
    commonRatio = 0.3,
    usageRatio = 0.7
  ) => {
    const { data } = await apiClient.post(`/billing/periods/${periodId}/calculate`, null, {
      params: {
        total_invoice_try: totalInvoiceTry,
        common_ratio: commonRatio,
        usage_ratio: usageRatio,
      },
    });
    return data;
  },
  approveBillingPeriod: async (periodId: number) => {
    const { data } = await apiClient.post<BillingPeriod>(`/billing/periods/${periodId}/approve`);
    return data;
  },

  // Alerts, Audit & Scale
  listAlerts: async (statusFilter?: string, alertType?: string) => {
    const { data } = await apiClient.get('/alerts', {
      params: {
        ...(statusFilter ? { status_filter: statusFilter } : {}),
        ...(alertType ? { alert_type: alertType } : {}),
      },
    });
    return data;
  },
  resolveAlert: async (alertId: number) => {
    const { data } = await apiClient.patch(`/alerts/${alertId}/resolve`);
    return data;
  },
  listAuditLogs: async (limit = 50) => {
    const { data } = await apiClient.get('/audit-logs', { params: { limit } });
    return data;
  },
  generate60kDataset: async (targetTotal = 60000) => {
    const { data } = await apiClient.post('/system/generate-60k', null, {
      params: { target_total: targetTotal },
    });
    return data;
  },
};

export function formatTrNumber(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '—';
  return Number(val).toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatTrInteger(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '0';
  return Math.round(Number(val)).toLocaleString('tr-TR');
}

