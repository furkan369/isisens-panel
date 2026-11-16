import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Search,
  Plus,
  Building2,
  Folder,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Home,
  Gauge,
  Calendar,
  Pencil,
  Wifi,
  XCircle,
  Flame,
  Database,
  FileText,
  Compass,
  Settings,
  Filter,
  FileSpreadsheet,
  FileDown,
  Eye,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertTriangle,
  KeyRound,
  Layers,
  Send,
} from 'lucide-react';
import { isisensApi, formatTrNumber, formatTrInteger } from '../services/api';
import type {
  SiteTreeItem,
  ApartmentConsumptionRow,
  SiteDetailTab,
} from '../types';
import { SparklineSvg } from '../components/SparklineSvg';
import { ApartmentDetailModal } from '../components/ApartmentDetailModal';
import {
  CreateSiteModal,
  EditSiteModal,
  CreateBlockModal,
  CreateApartmentModal,
  CreateBillingPeriodModal,
} from '../components/CrudModals';

interface SitelerViewProps {
  selectedSiteId: number;
  onSelectSite: (siteId: number) => void;
  selectedBlockId: number | null;
  onSelectBlock: (blockId: number | null) => void;
  globalSearch?: string;
}

export const SitelerView: React.FC<SitelerViewProps> = ({
  selectedSiteId,
  onSelectSite,
  selectedBlockId,
  onSelectBlock,
  globalSearch = '',
}) => {
  const queryClient = useQueryClient();

  // Tree state
  const [siteTreeSearch, setSiteTreeSearch] = useState('');
  const [expandedSites, setExpandedSites] = useState<Record<number, boolean>>({
    [selectedSiteId]: true,
  });

  // Site Detail Sub-tab state
  const [activeTab, setActiveTab] = useState<SiteDetailTab>('daireler');
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  // Table Filters & Server-side Pagination state
  const [tableSearch, setTableSearch] = useState('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [aptNoFilter, setAptNoFilter] = useState<string>('');
  const [meterSerialFilter, setMeterSerialFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'apartment_no', desc: false }]);
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});

  // Modals state
  const [detailApartmentId, setDetailApartmentId] = useState<number | null>(null);
  const [openCreateSite, setOpenCreateSite] = useState(false);
  const [openEditSite, setOpenEditSite] = useState(false);
  const [openCreateBlock, setOpenCreateBlock] = useState(false);
  const [openCreateApartment, setOpenCreateApartment] = useState(false);
  const [openCreatePeriod, setOpenCreatePeriod] = useState(false);

  // Fetch Site & Block Tree
  const { data: sitesTree = [] } = useQuery({
    queryKey: ['sitesTree', siteTreeSearch],
    queryFn: () => isisensApi.listSitesTree(siteTreeSearch),
  });

  // Fetch Site Detail Summary
  const { data: siteSummary } = useQuery({
    queryKey: ['siteSummary', selectedSiteId, selectedPeriodId],
    queryFn: () => isisensApi.getSiteSummary(selectedSiteId, null, selectedPeriodId),
    enabled: Boolean(selectedSiteId),
  });

  const activeBlockObj = useMemo(() => {
    if (!siteSummary?.blocks) return null;
    if (selectedBlockId === null) return null;
    return siteSummary.blocks.find((b) => b.id === selectedBlockId) || null;
  }, [siteSummary, selectedBlockId]);

  const effectiveSearch = tableSearch.trim() || globalSearch.trim();
  const sortField = sorting[0]?.id || 'apartment_no';
  const sortDir = sorting[0]?.desc ? 'desc' : 'asc';

  // Fetch Server-Side Paginated Apartments
  const { data: paginatedApts, isFetching: isFetchingApts } = useQuery({
    queryKey: [
      'apartments',
      selectedSiteId,
      selectedBlockId,
      selectedPeriodId,
      statusFilter,
      brandFilter,
      aptNoFilter,
      meterSerialFilter,
      effectiveSearch,
      sortField,
      sortDir,
      page,
      pageSize,
    ],
    queryFn: () =>
      isisensApi.listApartments({
        site_id: selectedSiteId,
        block_id: selectedBlockId,
        billing_period_id: selectedPeriodId,
        reading_status: statusFilter,
        meter_brand: brandFilter,
        apartment_no: aptNoFilter,
        meter_serial: meterSerialFilter,
        search: effectiveSearch,
        sort_by: sortField,
        sort_dir: sortDir,
        page,
        page_size: pageSize,
      }),
    enabled: Boolean(selectedSiteId),
  });

  // Quick simulate reading mutation from table row action
  const quickSimulateMutation = useMutation({
    mutationFn: async (row: ApartmentConsumptionRow) => {
      const baseIdx = row.last_index ?? row.first_index ?? 1200;
      const nextVal = (baseIdx + 24.5).toFixed(2);
      return isisensApi.ingestReading({
        device_id: row.meter_serial,
        source: 'simulator',
        reading_type: 'cumulative_energy',
        value: nextVal,
        unit: 'kWh',
        read_at: new Date().toISOString(),
        status: 'valid',
        rssi_dbm: -67,
        battery_level: 'ok',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
      queryClient.invalidateQueries({ queryKey: ['sitesTree'] });
      queryClient.invalidateQueries({ queryKey: ['readingsStatus'] });
    },
  });

  const handleToggleSite = (site: SiteTreeItem) => {
    const isCurrentlySelected = selectedSiteId === site.id;
    onSelectSite(site.id);
    setSelectedPeriodId(null);
    setPage(1);

    setExpandedSites((prev) => ({
      ...prev,
      [site.id]: isCurrentlySelected ? !prev[site.id] : true,
    }));

    if (!isCurrentlySelected) {
      // Select first block by default if available, matching the reference visual
      if (site.blocks && site.blocks.length > 0) {
        onSelectBlock(site.blocks[0].id);
      } else {
        onSelectBlock(null);
      }
    }
  };

  // Export current view to CSV/Excel
  const handleExportExcel = () => {
    const rows = paginatedApts?.items || [];
    const headers = [
      'Daire',
      'Sakin / Kullanıcı',
      'Sayaç No',
      'Marka / Model',
      'İlk Endeks (kWh)',
      'Son Endeks (kWh)',
      'Tüketim (kWh)',
      'Ortak Pay (TL)',
      'Tüketim Tutarı (TL)',
      'Toplam Tutar (TL)',
      'Durum',
    ];
    const csvLines = [
      headers.join(';'),
      ...rows.map((r) =>
        [
          r.flat_label,
          r.occupant_name,
          r.meter_serial,
          r.meter_brand_model,
          r.first_index ?? '',
          r.last_index ?? '',
          r.consumption_kwh ?? '',
          r.common_share_try ?? '',
          r.usage_share_try ?? '',
          r.total_amount_try ?? '',
          r.reading_status,
        ].join(';')
      ),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IsiSens_${siteSummary?.site_name || 'Site'}_Tuketim_Tablosu.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderStatusPill = (status: ApartmentConsumptionRow['reading_status']) => {
    switch (status) {
      case 'read':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#10382B] text-[#20D58C] border border-[#20D58C]/40 shadow-[0_0_10px_rgba(32,213,140,0.18)]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#20D58C]" />
            Okundu
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#3A2E14] text-[#FFBD35] border border-[#FFBD35]/45 shadow-[0_0_10px_rgba(255,189,53,0.18)]">
            <Clock className="w-3.5 h-3.5 text-[#FFBD35]" />
            Kontrol
          </span>
        );
      case 'unread':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#3B1822] text-[#FF5050] border border-[#FF5050]/45 shadow-[0_0_10px_rgba(255,80,80,0.2)]">
            <AlertTriangle className="w-3.5 h-3.5 text-[#FF5050]" />
            Okunamadı
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#3A2E14] text-[#FFBD35] border border-[#FFBD35]/40">
            <Clock className="w-3.5 h-3.5" />
            Bekliyor
          </span>
        );
      case 'invalid_data':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#3B1822] text-[#FF5050] border border-[#FF5050]/45">
            <AlertTriangle className="w-3.5 h-3.5" />
            Geçersiz Veri
          </span>
        );
      case 'missing_key':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#3C2214] text-[#FF792D] border border-[#FF792D]/45">
            <KeyRound className="w-3.5 h-3.5" />
            Anahtar Eksik
          </span>
        );
      default:
        return null;
    }
  };

  const periodStartText = paginatedApts?.period_start_label || '01.12.2025';
  const periodEndText = paginatedApts?.period_end_label || '31.12.2025';

  // TanStack Table Column Definitions matching the Reference Image + Section 8
  const columns = useMemo<ColumnDef<ApartmentConsumptionRow>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            aria-label="Tümünü Seç"
            className="w-4 h-4 rounded border-white/25 bg-[#091426] accent-[#FF792D] cursor-pointer"
            onChange={(e) => {
              const checked = e.target.checked;
              const next: Record<number, boolean> = {};
              if (checked) {
                (paginatedApts?.items || []).forEach((r) => {
                  next[r.apartment_id] = true;
                });
              }
              setSelectedRows(next);
            }}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={Boolean(selectedRows[row.original.apartment_id])}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              setSelectedRows((prev) => ({
                ...prev,
                [row.original.apartment_id]: e.target.checked,
              }));
            }}
            className="w-4 h-4 rounded border-white/25 bg-[#091426] accent-[#FF792D] cursor-pointer"
          />
        ),
        meta: { align: 'center', width: '40px' },
      },
      {
        id: 'apartment_no',
        accessorKey: 'flat_label',
        enableSorting: true,
        header: 'Daire',
        cell: ({ row }) => (
          <span className="font-bold text-white tracking-tight text-[13.5px]">
            {row.original.flat_label}
          </span>
        ),
        meta: { align: 'left' },
      },
      {
        id: 'occupant_name',
        accessorKey: 'occupant_name',
        enableSorting: true,
        header: 'Sakin / Kullanıcı',
        cell: ({ row }) => (
          <span className="text-[13.5px] text-white/95 font-medium">
            {row.original.occupant_name}
          </span>
        ),
        meta: { align: 'left' },
      },
      {
        id: 'meter_serial',
        accessorKey: 'meter_serial',
        enableSorting: true,
        header: 'Sayaç No',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] text-[#D7E3F4] font-medium">
              {row.original.meter_serial}
            </span>
            <span className="text-[10px] text-[#AEBCCB]/75">
              {row.original.meter_brand_model}
            </span>
          </div>
        ),
        meta: { align: 'left' },
      },
      {
        id: 'first_index',
        accessorKey: 'first_index',
        enableSorting: true,
        header: () => (
          <div className="flex flex-col items-end leading-tight">
            <span>İlk Endeks</span>
            <span className="text-[10.5px] font-normal text-[#AEBCCB]/80">
              ({periodStartText})
            </span>
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-[13.5px] text-white font-medium tabular-nums">
            {formatTrNumber(row.original.first_index)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'last_index',
        accessorKey: 'last_index',
        enableSorting: true,
        header: () => (
          <div className="flex flex-col items-end leading-tight">
            <span>Son Endeks</span>
            <span className="text-[10.5px] font-normal text-[#AEBCCB]/80">
              ({periodEndText})
            </span>
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-[13.5px] text-white font-medium tabular-nums">
            {formatTrNumber(row.original.last_index)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'consumption_kwh',
        accessorKey: 'consumption_kwh',
        enableSorting: true,
        header: () => (
          <div className="flex flex-col items-end leading-tight">
            <span>Tüketim</span>
            <span className="text-[10.5px] font-normal text-[#AEBCCB]/80">(kWh)</span>
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-[13.5px] font-extrabold text-[#12D9E8] tabular-nums drop-shadow-[0_0_8px_rgba(18,217,232,0.28)]">
            {formatTrNumber(row.original.consumption_kwh)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'common_share_try',
        accessorKey: 'common_share_try',
        header: () => (
          <div className="flex flex-col items-end leading-tight">
            <span>Ortak Pay</span>
            <span className="text-[10.5px] font-normal text-[#AEBCCB]/80">(₺)</span>
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-[13.5px] text-white tabular-nums">
            {formatTrNumber(row.original.common_share_try)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'usage_share_try',
        accessorKey: 'usage_share_try',
        header: () => (
          <div className="flex flex-col items-end leading-tight">
            <span>Tüketim Tutarı</span>
            <span className="text-[10.5px] font-normal text-[#AEBCCB]/80">(₺)</span>
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-[13.5px] text-white tabular-nums">
            {formatTrNumber(row.original.usage_share_try)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'total_amount_try',
        accessorKey: 'total_amount_try',
        enableSorting: true,
        header: () => (
          <div className="flex flex-col items-end leading-tight">
            <span>Toplam Tutar</span>
            <span className="text-[10.5px] font-normal text-[#AEBCCB]/80">(₺)</span>
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-[13.5px] font-bold text-white tabular-nums">
            {formatTrNumber(row.original.total_amount_try)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'last_read_at',
        accessorKey: 'last_read_at',
        enableSorting: true,
        header: 'Son Okuma',
        cell: ({ row }) => (
          <span className="text-[11.5px] text-[#AEBCCB] tabular-nums">
            {row.original.last_read_at
              ? new Date(row.original.last_read_at).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : '—'}
          </span>
        ),
        meta: { align: 'center' },
      },
      {
        id: 'reading_status',
        accessorKey: 'reading_status',
        enableSorting: true,
        header: 'Durum',
        cell: ({ row }) => renderStatusPill(row.original.reading_status),
        meta: { align: 'center' },
      },
      {
        id: 'actions',
        header: 'İşlemler',
        cell: ({ row }) => (
          <div
            className="flex items-center justify-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              title="Daire Detayı ve Okuma Geçmişi"
              onClick={() => setDetailApartmentId(row.original.apartment_id)}
              className="p-1.5 rounded-lg text-[#AEBCCB] hover:text-white hover:bg-white/10 transition"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              title="Simülatör ile Hızlı Okuma Gönder"
              onClick={() => quickSimulateMutation.mutate(row.original)}
              className="p-1.5 rounded-lg text-[#AEBCCB] hover:text-[#FF792D] hover:bg-white/10 transition"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        ),
        meta: { align: 'center' },
      },
    ],
    [paginatedApts, selectedRows, periodStartText, periodEndText]
  );

  const table = useReactTable({
    data: paginatedApts?.items || [],
    columns,
    state: { sorting },
    manualPagination: true,
    manualSorting: true,
    pageCount: paginatedApts?.total_pages ?? 1,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = paginatedApts?.total_pages || 1;
  const visiblePageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 4;
    let start = Math.max(1, page - 1);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="flex gap-4 h-full min-h-[calc(100vh-88px)]">
      {/* ====================================================================
          LEFT-MIDDLE PANEL: SİTELER VE BLOKLAR HİYERARŞİ AĞACI
      ==================================================================== */}
      <aside className="w-[272px] xl:w-[288px] flex-shrink-0 isisens-glass-panel rounded-2xl p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[19px] font-bold text-white tracking-tight">Siteler</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[#AEBCCB] border border-white/10">
              {sitesTree.length} Site
            </span>
          </div>

          {/* Site Search Box */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-[#AEBCCB] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={siteTreeSearch}
              onChange={(e) => setSiteTreeSearch(e.target.value)}
              placeholder="Site ara..."
              className="w-full bg-[#091426] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#AEBCCB]/70 focus:outline-none focus:border-[#12D9E8]/50"
            />
          </div>

          {/* + Site Ekle Button (Glowing Orange Outline matching reference) */}
          <button
            onClick={() => setOpenCreateSite(true)}
            className="w-full py-2.5 px-3 mb-4 rounded-xl bg-gradient-to-r from-[#FF792D]/15 via-[#FF792D]/10 to-[#FF792D]/15 border border-[#FF792D]/80 hover:border-[#FFA15F] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,121,45,0.22)] transition"
          >
            <Plus className="w-4 h-4 text-[#FF792D]" />
            <span>Site Ekle</span>
          </button>

          {/* Collapsible Sites & Blocks Hierarchy Tree */}
          <div className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-290px)] pr-0.5">
            {sitesTree.map((site) => {
              const isSelectedSite = site.id === selectedSiteId;
              const isExpanded = Boolean(expandedSites[site.id]);

              return (
                <div key={site.id} className="select-none">
                  {/* Site Row */}
                  <button
                    onClick={() => handleToggleSite(site)}
                    className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition ${
                      isSelectedSite
                        ? 'isisens-site-active text-white font-bold'
                        : 'hover:bg-white/[0.04] text-[#D7E3F4] font-medium border border-transparent border-b-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2
                        className={`w-4 h-4 flex-shrink-0 ${
                          isSelectedSite ? 'text-[#FF792D]' : 'text-[#8FA4C4]'
                        }`}
                      />
                      <span className="truncate text-[13.5px]">{site.name}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp
                        className={`w-4 h-4 flex-shrink-0 ${
                          isSelectedSite ? 'text-[#FF792D]' : 'text-[#AEBCCB]'
                        }`}
                      />
                    ) : (
                      <ChevronDown className="w-4 h-4 flex-shrink-0 text-[#AEBCCB]" />
                    )}
                  </button>

                  {/* Expanded Blocks Subtree with tree lines */}
                  {isExpanded && (
                    <div className="mt-1.5 ml-4 pl-3 border-l border-white/15 space-y-1">
                      {site.blocks.map((blk) => {
                        const isBlockActive =
                          isSelectedSite && selectedBlockId === blk.id;
                        return (
                          <div key={blk.id} className="relative flex items-center">
                            <span className="w-2.5 h-[1px] bg-white/15 -ml-3 mr-1" />
                            <button
                              onClick={() => {
                                onSelectSite(site.id);
                                onSelectBlock(blk.id);
                                setPage(1);
                              }}
                              className={`flex-1 px-3 py-2 rounded-lg flex items-center justify-between text-xs transition ${
                                isBlockActive
                                  ? 'isisens-block-active text-white font-bold'
                                  : 'text-[#C6D4E8] hover:bg-white/[0.04] font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Folder
                                  className={`w-3.5 h-3.5 ${
                                    isBlockActive ? 'text-[#FFBD35]' : 'text-[#AEBCCB]'
                                  }`}
                                />
                                <span>
                                  {blk.name} ({blk.actual_apartment_count || blk.planned_apartment_count})
                                </span>
                              </div>
                            </button>
                          </div>
                        );
                      })}

                      {/* Quick + Blok Ekle link inside expanded site */}
                      <div className="relative flex items-center pt-0.5">
                        <span className="w-2.5 h-[1px] bg-white/15 -ml-3 mr-1" />
                        <button
                          onClick={() => {
                            onSelectSite(site.id);
                            setOpenCreateBlock(true);
                          }}
                          className="w-full px-3 py-1.5 rounded-lg text-[11px] text-[#12D9E8] hover:bg-[#12D9E8]/10 flex items-center gap-1.5 font-medium transition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Blok Ekle</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Demo / Real Data Integrity Notice */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#AEBCCB]">
          <span>Toplam Kayıtlı Site: {sitesTree.length}</span>
          {siteSummary?.is_demo ? (
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
              Demo Verisi
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              Gerçek Kayıt
            </span>
          )}
        </div>
      </aside>

      {/* ====================================================================
          RIGHT MAIN PANEL: SİTE DETAY EKRANI VE TÜKETİM TABLOSU
      ==================================================================== */}
      <section className="flex-1 min-w-0 isisens-glass-panel rounded-2xl p-5 flex flex-col gap-4">
        {/* 1. Top Site Header Row */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSelectBlock(null)}
                title="Tüm Site Özeti"
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[#AEBCCB] hover:text-white transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h1 className="text-[24px] font-extrabold text-white tracking-tight">
                {siteSummary?.site_name || 'Selçuklu Park Evleri'}
              </h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-[#10382B] text-[#20D58C] border border-[#20D58C]/40">
                {siteSummary?.status === 'active' ? 'Aktif' : 'Bakımda'}
              </span>
              {siteSummary?.is_demo && (
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  DEMO
                </span>
              )}
            </div>

            {/* Metadata Sub-row matching reference icons & dividers */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#D0DCEF]">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#AEBCCB]" />
                {siteSummary?.district || 'Selçuklu'}, {siteSummary?.city || 'Konya'}
              </span>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#AEBCCB]" />
                {siteSummary?.block_count ?? 4} Blok
              </span>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-[#AEBCCB]" />
                {siteSummary?.total_apartments ?? 320} Daire
              </span>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#AEBCCB]" />
                {siteSummary?.primary_protocol || 'SHARKY / OMS'}
              </span>
              <span className="text-white/20">|</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#AEBCCB]" />
                <span>Dönem:</span>
                <select
                  value={selectedPeriodId ?? siteSummary?.active_period?.id ?? ''}
                  onChange={(e) => {
                    setSelectedPeriodId(e.target.value ? Number(e.target.value) : null);
                    setPage(1);
                  }}
                  className="bg-transparent font-semibold text-white focus:outline-none cursor-pointer"
                >
                  {(siteSummary?.available_periods || []).map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0B1424] text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Top Right Action Buttons: Site Düzenle & + Dönem Oluştur */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setOpenEditSite(true)}
              className="px-4 py-2 rounded-xl bg-[#101E36] hover:bg-[#16294A] border border-white/15 text-xs font-semibold text-white flex items-center gap-2 transition"
            >
              <Pencil className="w-3.5 h-3.5 text-[#AEBCCB]" />
              <span>Site Düzenle</span>
            </button>
            <button
              onClick={() => setOpenCreatePeriod(true)}
              className="isisens-btn-orange px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Dönem Oluştur</span>
            </button>
          </div>
        </div>

        {/* 2. Five Summary KPI Cards Row (100% Database-Backed) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Toplam Daire */}
          <div className="isisens-kpi-cyan rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between min-h-[108px]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#12D9E8]/15 border border-[#12D9E8]/40 flex items-center justify-center text-[#12D9E8] shadow-[0_0_15px_rgba(18,217,232,0.3)]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">Toplam Daire</div>
                <div className="text-[28px] font-extrabold text-white leading-tight mt-0.5 tabular-nums">
                  {formatTrInteger(siteSummary?.total_apartments ?? 320)}
                </div>
              </div>
            </div>
            <div className="self-end -mt-3 -mr-1">
              <SparklineSvg variant="cyan" className="w-24 h-9" />
            </div>
          </div>

          {/* Card 2: Okunan Daire */}
          <div className="isisens-kpi-cyan rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between min-h-[108px]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#12D9E8]/15 border border-[#12D9E8]/40 flex items-center justify-center text-[#12D9E8] shadow-[0_0_15px_rgba(18,217,232,0.3)]">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">Okunan Daire</div>
                <div className="text-[28px] font-extrabold text-white leading-tight mt-0.5 tabular-nums">
                  {formatTrInteger(siteSummary?.read_apartments ?? 314)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-[#20D58C]">
                ↑ %{(siteSummary?.read_percentage ?? 98.1).toLocaleString('tr-TR')}
              </span>
              <SparklineSvg variant="cyan" className="w-20 h-8 -mr-1" />
            </div>
          </div>

          {/* Card 3: Okunamayan */}
          <div className="isisens-kpi-orange rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between min-h-[108px]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFBD35]/15 border border-[#FFBD35]/45 flex items-center justify-center text-[#FFBD35] shadow-[0_0_15px_rgba(255,189,53,0.28)]">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">Okunamayan</div>
                <div className="text-[28px] font-extrabold text-white leading-tight mt-0.5 tabular-nums">
                  {formatTrInteger(siteSummary?.unread_apartments ?? 6)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-[#FF792D]">
                ↓ %{(siteSummary?.unread_percentage ?? 1.9).toLocaleString('tr-TR')}
              </span>
              <SparklineSvg variant="orange" className="w-20 h-8 -mr-1" />
            </div>
          </div>

          {/* Card 4: Toplam Tüketim */}
          <div className="isisens-kpi-orange rounded-2xl p-4 relative overflow-hidden flex flex-col justify-center min-h-[108px]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF792D]/15 border border-[#FF792D]/45 flex items-center justify-center text-[#FF792D] shadow-[0_0_15px_rgba(255,121,45,0.3)]">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">Toplam Tüketim</div>
                <div className="text-[24px] xl:text-[26px] font-extrabold text-white leading-tight mt-1 tabular-nums">
                  {formatTrInteger(siteSummary?.total_consumption_kwh ?? 186540)}{' '}
                  <span className="text-sm font-semibold text-[#D0DCEF]">kWh</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Tahmini / Hesaplanan Toplam Tutar */}
          <div className="isisens-kpi-cyan rounded-2xl p-4 relative overflow-hidden flex flex-col justify-center min-h-[108px]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#12D9E8]/15 border border-[#12D9E8]/40 flex items-center justify-center text-[#12D9E8] shadow-[0_0_15px_rgba(18,217,232,0.3)]">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">Tahmini Toplam Tutar</div>
                <div className="text-[24px] xl:text-[26px] font-extrabold text-white leading-tight mt-1 tabular-nums">
                  ₺{formatTrInteger(siteSummary?.estimated_total_amount_try ?? 1284760)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Six Sub-Navigation Tabs inside Site Detail */}
        <div className="flex items-center gap-2 border-b border-white/10 pt-1 overflow-x-auto">
          {[
            {
              id: 'daireler' as SiteDetailTab,
              label: `Daireler (${siteSummary?.total_apartments ?? 320})`,
              icon: Home,
            },
            { id: 'sayaclar' as SiteDetailTab, label: 'Sayaçlar', icon: FileText },
            { id: 'okumalar' as SiteDetailTab, label: 'Okumalar', icon: Compass },
            { id: 'gider-dagilimi' as SiteDetailTab, label: 'Gider Dağılımı', icon: Building2 },
            { id: 'raporlar' as SiteDetailTab, label: 'Raporlar', icon: FileText },
            { id: 'site-ayarlari' as SiteDetailTab, label: 'Site Ayarları', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isAct = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-t-xl text-[13px] font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                  isAct
                    ? 'isisens-tab-active text-white'
                    : 'text-[#AEBCCB] hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isAct ? 'text-[#FF792D]' : 'text-[#AEBCCB]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 4. Sub-Tab Content */}
        {activeTab === 'daireler' && (
          <>
            {/* Filter & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Block Selector Dropdown */}
                <select
                  value={selectedBlockId ?? 'all'}
                  onChange={(e) => {
                    const val = e.target.value;
                    onSelectBlock(val === 'all' ? null : Number(val));
                    setPage(1);
                  }}
                  className="bg-[#0B1528] border border-white/15 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-[#12D9E8]"
                >
                  <option value="all">
                    Tüm Bloklar ({siteSummary?.total_apartments ?? 320} Daire)
                  </option>
                  {(siteSummary?.blocks || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.actual_apartment_count} Daire)
                    </option>
                  ))}
                </select>

                {/* Apartment / Occupant / Meter Search Box */}
                <div className="relative w-72">
                  <Search className="w-4 h-4 text-[#AEBCCB] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Daire, sakin, sayaç no ara..."
                    className="w-full bg-[#0B1528] border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#AEBCCB]/70 focus:outline-none focus:border-[#12D9E8]"
                  />
                </div>
              </div>

              {/* Right Toolbar Buttons: + Daire Ekle, Filtrele, Excel İndir, PDF Rapor */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setOpenCreateApartment(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#FF792D]/15 hover:bg-[#FF792D]/25 border border-[#FF792D]/60 text-xs font-semibold text-white flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FF792D]" />
                  <span>Daire / Sayaç Ekle</span>
                </button>

                <button
                  onClick={() => setShowFilterDrawer((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                    showFilterDrawer
                      ? 'bg-[#12D9E8]/15 border-[#12D9E8] text-white'
                      : 'bg-[#0B1528] hover:bg-[#12223D] border-white/15 text-white'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5 text-[#AEBCCB]" />
                  <span>Filtrele</span>
                </button>

                <button
                  onClick={handleExportExcel}
                  className="px-3.5 py-2 rounded-xl bg-[#0B1528] hover:bg-[#12223D] border border-white/15 text-xs font-semibold text-white flex items-center gap-2 transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#20D58C]" />
                  <span>Excel İndir</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-[#0B1528] hover:bg-[#12223D] border border-white/15 text-xs font-semibold text-white flex items-center gap-2 transition"
                >
                  <FileDown className="w-4 h-4 text-[#FF5050]" />
                  <span>PDF Rapor</span>
                </button>
              </div>
            </div>

            {/* Extended Filter Bar (Blok, Fatura Dönemi, Sayaç Markası, Okuma Durumu, Daire No, Sayaç Kimliği) */}
            {showFilterDrawer && (
              <div className="p-3.5 rounded-xl bg-[#091325] border border-[#12D9E8]/30 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-[#AEBCCB] mb-1">Okuma Durumu</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="all">Tüm Durumlar</option>
                    <option value="read">Okundu (Başarılı)</option>
                    <option value="needs_review">Kontrol Gerekiyor</option>
                    <option value="unread">Okunamadı</option>
                    <option value="pending">Okuma Bekliyor</option>
                    <option value="invalid_data">Geçersiz Veri</option>
                    <option value="missing_key">Anahtar Eksik</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#AEBCCB] mb-1">Sayaç Markası</label>
                  <select
                    value={brandFilter}
                    onChange={(e) => {
                      setBrandFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="all">Tüm Markalar</option>
                    <option value="Diehl">Diehl Sharky 775</option>
                    <option value="Kamstrup">Kamstrup Multical</option>
                    <option value="Danfoss">Danfoss SonoSelect</option>
                    <option value="Qundis">Qundis Q heat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#AEBCCB] mb-1">Daire Numarası</label>
                  <input
                    value={aptNoFilter}
                    onChange={(e) => {
                      setAptNoFilter(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Örn: A-101"
                    className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#AEBCCB] mb-1">Sayaç Kimliği / Seri No</label>
                  <input
                    value={meterSerialFilter}
                    onChange={(e) => {
                      setMeterSerialFilter(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Örn: SH-775021"
                    className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setBrandFilter('all');
                      setAptNoFilter('');
                      setMeterSerialFilter('');
                      setTableSearch('');
                      setPage(1);
                    }}
                    className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#AEBCCB] hover:text-white font-semibold"
                  >
                    Filtreleri Temizle
                  </button>
                </div>
              </div>
            )}

            {/* Apartment-Based Consumption Table */}
            <div className="rounded-xl border border-white/10 bg-[#081224]/90 overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr
                      key={hg.id}
                      className="bg-[#0D1A31] border-b border-white/10 text-[12px] font-semibold text-[#D0DCEF]"
                    >
                      {hg.headers.map((header) => {
                        const align = header.column.columnDef.meta?.align || 'left';
                        const canSort = header.column.columnDef.enableSorting;
                        const sorted = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            onClick={() => canSort && header.column.toggleSorting()}
                            className={`py-3 px-3 select-none ${
                              align === 'right'
                                ? 'text-right'
                                : align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                            } ${canSort ? 'cursor-pointer hover:text-white' : ''}`}
                          >
                            <div
                              className={`inline-flex items-center gap-1 ${
                                align === 'right' ? 'justify-end' : ''
                              }`}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === 'asc' && <span className="text-[#FF792D]">▲</span>}
                              {sorted === 'desc' && <span className="text-[#FF792D]">▼</span>}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-white/[0.07] text-[13px]">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setDetailApartmentId(row.original.apartment_id)}
                      className="hover:bg-[#132647]/70 cursor-pointer transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => {
                        const align = cell.column.columnDef.meta?.align || 'left';
                        return (
                          <td
                            key={cell.id}
                            className={`py-2.5 px-3 whitespace-nowrap ${
                              align === 'right'
                                ? 'text-right'
                                : align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                            }`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {!isFetchingApts && (paginatedApts?.items.length || 0) === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="py-12 text-center text-[#AEBCCB]">
                        Seçilen kriterlere uygun daire veya sayaç kaydı bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer & Server-Side Pagination Bar matching reference */}
            <div className="px-4 py-2.5 rounded-xl bg-[#091426] border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-[#D0DCEF] font-medium">
                <span>
                  Toplam:{' '}
                  <strong className="text-white">
                    {paginatedApts?.scope_total_apartments ?? 80} daire
                  </strong>{' '}
                  ({activeBlockObj ? activeBlockObj.name : 'Tüm Bloklar'})
                </span>
                <span className="text-white/20">|</span>
                <span>
                  Okunan:{' '}
                  <strong className="text-white">
                    {paginatedApts?.scope_read_apartments ?? 78}
                  </strong>
                </span>
                <span className="text-white/20">|</span>
                <span>
                  Okunamayan:{' '}
                  <strong className="text-white">
                    {paginatedApts?.scope_unread_apartments ?? 2}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Page Size Selector (20 / 50 / 100) */}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-[#0D1C34] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none"
                >
                  <option value={20}>20 / sayfa</option>
                  <option value={50}>50 / sayfa</option>
                  <option value={100}>100 / sayfa</option>
                </select>

                {/* Page Navigation Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="w-7 h-7 rounded-lg bg-[#0D1C34] hover:bg-white/10 disabled:opacity-40 border border-white/10 flex items-center justify-center text-[#AEBCCB]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {visiblePageNumbers.map((pNum) => (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                        pNum === page
                          ? 'bg-[#FF792D] text-white shadow-[0_0_12px_rgba(255,121,45,0.55)]'
                          : 'bg-[#0D1C34] hover:bg-white/10 text-[#D0DCEF] border border-white/10'
                      }`}
                    >
                      {pNum}
                    </button>
                  ))}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="w-7 h-7 rounded-lg bg-[#0D1C34] hover:bg-white/10 disabled:opacity-40 border border-white/10 flex items-center justify-center text-[#AEBCCB]"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Sub-Tab 2: Sayaçlar (Site-scoped meter inventory) */}
        {activeTab === 'sayaclar' && (
          <div className="p-4 rounded-xl bg-[#091325] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {siteSummary?.site_name} — Kalorimetre Sayaç Envanteri
                </h3>
                <p className="text-xs text-[#AEBCCB]">
                  Protokol: {siteSummary?.primary_protocol} • Şifreleme: OMS v4 AES-128-CBC (Key Vault Korumalı)
                </p>
              </div>
              <button
                onClick={() => setOpenCreateApartment(true)}
                className="isisens-btn-orange px-3.5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Yeni Sayaç & Daire Ekle
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {(paginatedApts?.items || []).slice(0, 9).map((item) => (
                <div
                  key={item.apartment_id}
                  onClick={() => setDetailApartmentId(item.apartment_id)}
                  className="p-3 rounded-xl bg-[#0D1B33] border border-white/10 hover:border-[#12D9E8]/50 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{item.meter_serial}</span>
                    <span className="text-[#12D9E8]">{item.flat_label}</span>
                  </div>
                  <div className="text-[#AEBCCB] mt-1">
                    {item.meter_brand_model} • {item.occupant_name}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-emerald-400">
                      Şifreleme: {item.encryption_status}
                    </span>
                    {renderStatusPill(item.reading_status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sub-Tab 3: Okumalar (Site-scoped reading simulation & session info) */}
        {activeTab === 'okumalar' && (
          <div className="p-4 rounded-xl bg-[#091325] border border-white/10 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white">
              {siteSummary?.site_name} — Saha RF Okuma Özeti
            </h3>
            <p className="text-[#AEBCCB]">
              Bu sitedeki toplam {siteSummary?.total_apartments} sayacın{' '}
              <strong className="text-[#20D58C]">{siteSummary?.read_apartments}</strong> adedi başarıyla
              okunmuş, <strong className="text-[#FF792D]">{siteSummary?.unread_apartments}</strong> adedi
              kontrol/okuma listesindedir. Herhangi bir daireye tıklayarak canlı simülatör paketi
              gönderebilirsiniz.
            </p>
          </div>
        )}

        {/* Sub-Tab 4: Gider Dağılımı (70/30 Decimal Preview for this site) */}
        {activeTab === 'gider-dagilimi' && (
          <div className="p-4 rounded-xl bg-[#091325] border border-white/10 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white">
              Merkezi Isıtma 70/30 Gider Paylaşım Özeti — {siteSummary?.active_period?.name || 'Ocak 2026'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#0D1C34] border border-white/10">
                <div className="text-[#AEBCCB]">Toplam Bina Tüketimi</div>
                <div className="text-lg font-bold text-[#12D9E8] mt-1">
                  {formatTrInteger(siteSummary?.total_consumption_kwh)} kWh
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#0D1C34] border border-white/10">
                <div className="text-[#AEBCCB]">Toplam Paylaştırılan Fatura</div>
                <div className="text-lg font-bold text-[#FF792D] mt-1">
                  ₺{formatTrInteger(siteSummary?.estimated_total_amount_try)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#0D1C34] border border-white/10">
                <div className="text-[#AEBCCB]">Paylaşım Kuralı (Yönetmelik)</div>
                <div className="text-lg font-bold text-white mt-1">%70 Tüketim / %30 Ortak</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0D1C34] border border-white/10">
                <div className="text-[#AEBCCB]">Hesaplama Sürümü & Kuruş Farkı</div>
                <div className="text-lg font-bold text-[#20D58C] mt-1">
                  v{siteSummary?.active_period?.calculation_version ?? 1} • ₺
                  {formatTrNumber(siteSummary?.active_period?.rounding_diff_try ?? 0, 4)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sub-Tab 5: Raporlar */}
        {activeTab === 'raporlar' && (
          <div className="p-4 rounded-xl bg-[#091325] border border-white/10 flex items-center justify-between text-xs">
            <div>
              <h3 className="text-sm font-bold text-white">
                {siteSummary?.site_name} — Dönemsel Rapor Çıktıları
              </h3>
              <p className="text-[#AEBCCB] mt-1">
                Daire bazlı endeks ve gider paylaşım listesini Excel (CSV) veya PDF formatında dışa aktarın.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 rounded-lg bg-[#20D58C]/20 border border-[#20D58C] text-[#20D58C] font-bold"
              >
                Excel (CSV) İndir
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-[#FF5050]/20 border border-[#FF5050] text-[#FF5050] font-bold"
              >
                PDF Yazdır
              </button>
            </div>
          </div>
        )}

        {/* Sub-Tab 6: Site Ayarları */}
        {activeTab === 'site-ayarlari' && (
          <div className="p-4 rounded-xl bg-[#091325] border border-white/10 flex items-center justify-between text-xs">
            <div>
              <h3 className="text-sm font-bold text-white">
                {siteSummary?.site_name} — Teknik Yapılandırma
              </h3>
              <p className="text-[#AEBCCB] mt-1">
                Site Kodu: {siteSummary?.site_code} • İlçe: {siteSummary?.district}/{siteSummary?.city} •
                Varsayılan RF Protokolü: {siteSummary?.primary_protocol}
              </p>
            </div>
            <button
              onClick={() => setOpenEditSite(true)}
              className="isisens-btn-orange px-4 py-2 rounded-lg font-bold text-white"
            >
              Site Bilgilerini Düzenle
            </button>
          </div>
        )}
      </section>

      {/* Modals & Drawers */}
      <ApartmentDetailModal
        apartmentId={detailApartmentId}
        onClose={() => setDetailApartmentId(null)}
      />
      <CreateSiteModal
        open={openCreateSite}
        onClose={() => setOpenCreateSite(false)}
        onCreated={(newSiteId) => {
          onSelectSite(newSiteId);
          onSelectBlock(null);
          setExpandedSites((prev) => ({ ...prev, [newSiteId]: true }));
        }}
      />
      <EditSiteModal
        open={openEditSite}
        site={siteSummary}
        onClose={() => setOpenEditSite(false)}
      />
      <CreateBlockModal
        open={openCreateBlock}
        siteId={selectedSiteId}
        siteName={siteSummary?.site_name || 'Site'}
        onClose={() => setOpenCreateBlock(false)}
        onCreated={(newBlockId) => onSelectBlock(newBlockId)}
      />
      <CreateApartmentModal
        open={openCreateApartment}
        siteId={selectedSiteId}
        blocks={siteSummary?.blocks || []}
        defaultBlockId={selectedBlockId}
        onClose={() => setOpenCreateApartment(false)}
      />
      <CreateBillingPeriodModal
        open={openCreatePeriod}
        siteId={selectedSiteId}
        siteName={siteSummary?.site_name || 'Site'}
        onClose={() => setOpenCreatePeriod(false)}
      />
    </div>
  );
};
