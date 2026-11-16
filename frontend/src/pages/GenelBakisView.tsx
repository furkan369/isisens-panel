import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Layers,
  Gauge,
  Target,
  AlertTriangle,
  MapPin,
  BatteryLow,
  WifiOff,
  KeyRound,
  History,
  CheckSquare,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { isisensApi, formatTrInteger } from '../services/api';
import { SparklineSvg } from '../components/SparklineSvg';
import { KonyaDistrictMapSvg, SuccessDonutChartSvg } from '../components/KonyaDistrictMapSvg';
import type { NavSection } from '../types';

interface Props {
  onNavigateSite: (siteId: number) => void;
  onNavigateSection: (section: NavSection) => void;
}

export const GenelBakisView: React.FC<Props> = ({ onNavigateSite, onNavigateSection }) => {
  const { data } = useQuery({
    queryKey: ['overview'],
    queryFn: () => isisensApi.getOverview(),
  });

  const [selectedPreviewSiteIdx, setSelectedPreviewSiteIdx] = useState(0);
  const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});

  const sites = data?.sites || [];
  const featuredSite = sites[selectedPreviewSiteIdx] || sites[0];

  const kpis = data?.kpis || {
    total_apartments: 320,
    active_sites: 5,
    total_blocks: 12,
    read_meters_this_month: 314,
    unread_meters_this_month: 6,
    success_rate: 97.6,
    open_alerts_count: 24,
  };

  const alerts = data?.alert_breakdown || {
    low_battery: 12,
    no_signal: 7,
    missing_key: 5,
  };

  return (
    <div className="space-y-4">
      {/* ====================================================================
          TOP 5 KPI CARDS ROW (Matches Konya Site Bazlı IsıSens Paneli.png)
      ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Toplam Daire */}
        <div className="isisens-kpi-orange rounded-2xl p-4 flex flex-col justify-between min-h-[116px]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF792D]/15 border border-[#FF792D]/45 flex items-center justify-center text-[#FF792D]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">Toplam Daire</div>
                <div className="text-[26px] font-extrabold text-white leading-tight mt-0.5 tabular-nums">
                  {formatTrInteger(kpis.total_apartments)}
                </div>
              </div>
            </div>
            <SparklineSvg variant="orange" className="w-20 h-9" />
          </div>
          <div className="text-xs mt-2 flex items-center gap-1.5">
            <span className="font-bold text-[#20D58C]">↑ %2,8</span>
            <span className="text-[#AEBCCB]">(geçen aya göre)</span>
          </div>
        </div>

        {/* Card 2: Aktif Site */}
        <div className="isisens-kpi-cyan rounded-2xl p-4 flex flex-col justify-between min-h-[116px]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#12D9E8]/15 border border-[#12D9E8]/45 flex items-center justify-center text-[#12D9E8]">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">Aktif Site</div>
                <div className="text-[26px] font-extrabold text-white leading-tight mt-0.5 tabular-nums">
                  {formatTrInteger(kpis.active_sites)}
                </div>
              </div>
            </div>
            <SparklineSvg variant="cyan" className="w-20 h-9" />
          </div>
          <div className="text-xs mt-2 flex items-center gap-1.5">
            <span className="font-bold text-[#20D58C]">↑ %1,7</span>
            <span className="text-[#AEBCCB]">(geçen aya göre)</span>
          </div>
        </div>

        {/* Card 3: Bu Ay Okunan Sayaç */}
        <div className="isisens-kpi-orange rounded-2xl p-4 flex flex-col justify-between min-h-[116px]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFBD35]/15 border border-[#FFBD35]/45 flex items-center justify-center text-[#FFBD35]">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">Bu Ay Okunan Sayaç</div>
                <div className="text-[26px] font-extrabold text-white leading-tight mt-0.5 tabular-nums">
                  {formatTrInteger(kpis.read_meters_this_month)}
                </div>
              </div>
            </div>
            <SparklineSvg variant="orange" className="w-20 h-9" />
          </div>
          <div className="text-xs mt-2 flex items-center gap-1.5">
            <span className="font-bold text-[#20D58C]">↑ %3,9</span>
            <span className="text-[#AEBCCB]">(geçen aya göre)</span>
          </div>
        </div>

        {/* Card 4: Okuma Başarı Oranı */}
        <div className="isisens-kpi-cyan rounded-2xl p-4 flex flex-col justify-between min-h-[116px]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#12D9E8]/15 border border-[#12D9E8]/45 flex items-center justify-center text-[#12D9E8]">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">Okuma Başarı Oranı</div>
                <div className="text-[26px] font-extrabold text-white leading-tight mt-0.5 tabular-nums">
                  %{kpis.success_rate.toLocaleString('tr-TR', { minimumFractionDigits: 1 })}
                </div>
              </div>
            </div>
            <SparklineSvg variant="cyan" className="w-20 h-9" />
          </div>
          <div className="text-xs mt-2 flex items-center gap-1.5">
            <span className="font-bold text-[#20D58C]">↑ +0,9 puan</span>
            <span className="text-[#AEBCCB]">(geçen aya göre)</span>
          </div>
        </div>

        {/* Card 5: İncelenecek Uyarı */}
        <div
          onClick={() => onNavigateSection('ariza-uyarilar')}
          className="isisens-kpi-red rounded-2xl p-4 flex flex-col justify-between min-h-[116px] cursor-pointer hover:border-[#FF5050]/60 transition"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF5050]/15 border border-[#FF5050]/45 flex items-center justify-center text-[#FF5050]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D0DCEF] font-medium">İncelenecek Uyarı</div>
                <div className="text-[26px] font-extrabold text-white leading-tight mt-0.5 tabular-nums">
                  {kpis.open_alerts_count}
                </div>
              </div>
            </div>
            <SparklineSvg variant="red" className="w-20 h-9" />
          </div>
          <div className="text-xs mt-2 flex items-center gap-1.5">
            <span className="font-bold text-[#FF5050]">↑ +6</span>
            <span className="text-[#AEBCCB]">(dün: 18)</span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          MIDDLE 3-PANEL ROW: KONYA HARİTASI | SİTE BAZINDA DAİRE | BAŞARI ORANI
      ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Konya – Site Dağılımı */}
        <div className="lg:col-span-4 isisens-glass-panel rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
            <MapPin className="w-4 h-4 text-[#FFBD35]" />
            <span>Konya – Site Dağılımı</span>
          </div>
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-7">
              <KonyaDistrictMapSvg />
            </div>
            <div className="col-span-5 space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0D1A30] border border-white/10 flex items-center gap-2 font-semibold text-white">
                <Building2 className="w-4 h-4 text-[#12D9E8]" />
                <span>Konya Geneli</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0D1A30] border border-white/10">
                <div className="text-[11px] text-[#AEBCCB]">Aktif Site</div>
                <div className="text-base font-extrabold text-white">
                  {formatTrInteger(kpis.active_sites)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0D1A30] border border-white/10">
                <div className="text-[11px] text-[#AEBCCB]">Toplam Daire</div>
                <div className="text-base font-extrabold text-white">
                  {formatTrInteger(kpis.total_apartments)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0D1A30] border border-white/10">
                <div className="text-[11px] text-[#AEBCCB]">Toplam Blok</div>
                <div className="text-base font-extrabold text-white">
                  {formatTrInteger(kpis.total_blocks)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Site Bazında Daire Bilgileri */}
        <div className="lg:col-span-5 isisens-glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Layers className="w-4 h-4 text-[#12D9E8]" />
              <span>Site Bazında Daire Bilgileri</span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#0D1B33] border border-white/10 text-[11px] text-[#D0DCEF]">
              Daire Sayısına Göre ▾
            </span>
          </div>

          {/* 5 Site Mini Cards */}
          <div className="grid grid-cols-5 gap-2">
            {sites.slice(0, 5).map((s: any, idx: number) => {
              const isSelected = idx === selectedPreviewSiteIdx;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedPreviewSiteIdx(idx)}
                  className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-between transition ${
                    isSelected
                      ? 'bg-[#0E2442] border-[#12D9E8] shadow-[0_0_14px_rgba(18,217,232,0.28)]'
                      : 'bg-[#0A162C] border-white/10 hover:border-white/25'
                  }`}
                >
                  <Building2
                    className={`w-4 h-4 mb-1 ${isSelected ? 'text-[#12D9E8]' : 'text-[#AEBCCB]'}`}
                  />
                  <div className="text-[11px] font-bold text-white line-clamp-1">{s.name}</div>
                  <div className="text-[10.5px] text-[#AEBCCB] my-0.5">{s.apartment_count} Daire</div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.success_rate >= 97
                        ? 'bg-[#10382B] text-[#20D58C]'
                        : 'bg-[#3A2E14] text-[#FFBD35]'
                    }`}
                  >
                    %{s.success_rate.toLocaleString('tr-TR')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Site Quick Preview Row */}
          {featuredSite && (
            <div className="p-3 rounded-xl bg-[#0A162B] border border-white/10 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-5 space-y-2 border-r border-white/10 pr-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#12D9E8]" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{featuredSite.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#10382B] text-[#20D58C] font-semibold">
                        Aktif
                      </span>
                    </div>
                    <div className="text-[10.5px] text-[#AEBCCB]">
                      {featuredSite.district} / {featuredSite.city}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <div>
                    <div className="text-[10px] text-[#AEBCCB]">Daire</div>
                    <div className="font-bold text-white">{featuredSite.apartment_count}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#AEBCCB]">Blok</div>
                    <div className="font-bold text-white">{featuredSite.block_count}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#AEBCCB]">Başarı Oranı</div>
                    <div className="font-bold text-[#20D58C]">
                      %{featuredSite.success_rate.toLocaleString('tr-TR')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-7 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#D0DCEF] font-semibold">Daire Listesi (İlk 8)</span>
                  <button
                    onClick={() => onNavigateSite(featuredSite.id)}
                    className="text-[#12D9E8] hover:underline font-semibold flex items-center gap-0.5"
                  >
                    <span>Tüm Daireleri Gör</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(data?.featured_site_preview?.first_8_apartments || []).map((apt: any) => (
                    <button
                      key={apt.id}
                      onClick={() => onNavigateSite(featuredSite.id)}
                      className="px-2 py-1 rounded bg-[#0E1E38] border border-white/10 hover:border-[#12D9E8]/50 text-[10.5px] text-white flex items-center justify-between"
                    >
                      <span>Daire {apt.apartment_no}</span>
                      <span
                        className={
                          apt.status === 'read' ? 'text-[#20D58C]' : 'text-[#FFBD35]'
                        }
                      >
                        {apt.status === 'read' ? '✓' : '●'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Okuma Başarı Oranı Donut */}
        <div className="lg:col-span-3 isisens-glass-panel rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Target className="w-4 h-4 text-[#12D9E8]" />
            <span>Okuma Başarı Oranı</span>
          </div>
          <div className="flex items-center justify-between gap-3 my-auto py-2">
            <SuccessDonutChartSvg percentage={kpis.success_rate} />
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center gap-1.5 text-[#D0DCEF]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#12D9E8]" />
                  <span>Başarılı</span>
                </div>
                <div className="font-extrabold text-white text-sm mt-0.5">
                  {formatTrInteger(kpis.read_meters_this_month)}{' '}
                  <span className="text-[11px] font-normal text-[#AEBCCB]">
                    (%{kpis.success_rate.toLocaleString('tr-TR')})
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[#D0DCEF]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FF792D]" />
                  <span>Başarısız / Eksik</span>
                </div>
                <div className="font-extrabold text-white text-sm mt-0.5">
                  {formatTrInteger(kpis.unread_meters_this_month)}{' '}
                  <span className="text-[11px] font-normal text-[#AEBCCB]">
                    (%{(100 - kpis.success_rate).toFixed(1).replace('.', ',')})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          BOTTOM 3-PANEL ROW: SON SİTE OKUMALARI | UYARI CİHAZLARI | İŞLEMLER & GÖREVLER
      ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Son Site Okumaları Table */}
        <div className="lg:col-span-5 isisens-glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Layers className="w-4 h-4 text-[#12D9E8]" />
              <span>Son Site Okumaları</span>
            </div>
            <button
              onClick={() => onNavigateSection('siteler')}
              className="text-xs text-[#12D9E8] hover:underline flex items-center gap-0.5"
            >
              <span>Tümünü Gör</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[#AEBCCB] border-b border-white/10">
                <tr>
                  <th className="py-2 pr-2">Site Adı</th>
                  <th className="py-2 px-2">İlçe</th>
                  <th className="py-2 px-2 text-right">Daire</th>
                  <th className="py-2 px-2 text-right">Bu Ay Okuma</th>
                  <th className="py-2 px-2 text-center">Başarı Oranı</th>
                  <th className="py-2 pl-2 text-right">Son Okuma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sites.slice(0, 5).map((s: any) => (
                  <tr
                    key={s.id}
                    onClick={() => onNavigateSite(s.id)}
                    className="hover:bg-white/[0.04] cursor-pointer transition"
                  >
                    <td className="py-2.5 pr-2 font-semibold text-white flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-[#12D9E8]" />
                      <span>{s.name}</span>
                    </td>
                    <td className="py-2.5 px-2 text-[#D0DCEF]">{s.district}</td>
                    <td className="py-2.5 px-2 text-right text-white">{s.apartment_count}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-white">{s.read_count}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          s.success_rate >= 97
                            ? 'bg-[#10382B] text-[#20D58C]'
                            : 'bg-[#3A2E14] text-[#FFBD35]'
                        }`}
                      >
                        %{s.success_rate.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right text-[#AEBCCB]">{s.last_read_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Center: Uyarı Durumundaki Cihazlar */}
        <div className="lg:col-span-4 isisens-glass-panel rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
            <AlertTriangle className="w-4 h-4 text-[#FFBD35]" />
            <span>Uyarı Durumundaki Cihazlar</span>
          </div>
          <div className="space-y-2.5">
            <div
              onClick={() => onNavigateSection('ariza-uyarilar')}
              className="p-3 rounded-xl bg-gradient-to-r from-[#241A1E] to-[#131C31] border border-[#FF792D]/35 hover:border-[#FF792D] cursor-pointer flex items-center justify-between transition"
            >
              <div className="flex items-center gap-3">
                <BatteryLow className="w-6 h-6 text-[#FF792D]" />
                <div>
                  <div className="text-xs font-bold text-white">Düşük Pil</div>
                  <div className="text-[11px] text-[#AEBCCB]">Pil seviyesi %20'nin altında</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#FF5050]/25 border border-[#FF5050]/50 text-white text-xs font-bold">
                  {alerts.low_battery}
                </span>
                <ChevronRight className="w-4 h-4 text-[#AEBCCB]" />
              </div>
            </div>

            <div
              onClick={() => onNavigateSection('ariza-uyarilar')}
              className="p-3 rounded-xl bg-gradient-to-r from-[#261622] to-[#131C31] border border-[#FF5050]/35 hover:border-[#FF5050] cursor-pointer flex items-center justify-between transition"
            >
              <div className="flex items-center gap-3">
                <WifiOff className="w-6 h-6 text-[#FF5050]" />
                <div>
                  <div className="text-xs font-bold text-white">Sinyal Yok</div>
                  <div className="text-[11px] text-[#AEBCCB]">Belirli süredir çevrimdışı</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#FF5050]/25 border border-[#FF5050]/50 text-white text-xs font-bold">
                  {alerts.no_signal}
                </span>
                <ChevronRight className="w-4 h-4 text-[#AEBCCB]" />
              </div>
            </div>

            <div
              onClick={() => onNavigateSection('ariza-uyarilar')}
              className="p-3 rounded-xl bg-gradient-to-r from-[#251E18] to-[#131C31] border border-[#FFBD35]/35 hover:border-[#FFBD35] cursor-pointer flex items-center justify-between transition"
            >
              <div className="flex items-center gap-3">
                <KeyRound className="w-6 h-6 text-[#FFBD35]" />
                <div>
                  <div className="text-xs font-bold text-white">Anahtar Eksik</div>
                  <div className="text-[11px] text-[#AEBCCB]">
                    Cihazda güvenlik anahtarı tanımlı değil
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#FF792D]/25 border border-[#FF792D]/50 text-white text-xs font-bold">
                  {alerts.missing_key}
                </span>
                <ChevronRight className="w-4 h-4 text-[#AEBCCB]" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Split: Son İşlemler & Bekleyen Görevler */}
        <div className="lg:col-span-3 flex flex-col gap-3.5">
          {/* Son İşlemler */}
          <div className="isisens-glass-panel rounded-2xl p-3.5 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <History className="w-4 h-4 text-[#12D9E8]" />
                <span>Son İşlemler</span>
              </div>
              <span className="text-[11px] text-[#12D9E8]">Tümünü Gör ›</span>
            </div>
            <div className="space-y-2 text-[11.5px]">
              {(data?.recent_logs || []).slice(0, 4).map((lg: any) => (
                <div key={lg.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#20D58C] flex-shrink-0" />
                    <span className="text-[#D0DCEF] truncate">{lg.summary}</span>
                  </div>
                  <span className="text-[10.5px] text-[#AEBCCB] flex-shrink-0">{lg.time_label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bekleyen Görevler */}
          <div className="isisens-glass-panel rounded-2xl p-3.5 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <CheckSquare className="w-4 h-4 text-[#FFBD35]" />
                <span>Bekleyen Görevler</span>
              </div>
              <span className="text-[11px] text-[#12D9E8]">Tümünü Gör ›</span>
            </div>
            <div className="space-y-2 text-[11.5px]">
              {[
                { id: 1, label: 'Arızalı sayaçları kontrol et', badge: '7', color: 'bg-[#FF5050]' },
                { id: 2, label: 'Sinyal olmayan cihazları incele', badge: '5', color: 'bg-[#FF5050]' },
                { id: 3, label: 'Eksik anahtar tanımlamalarını tamamla', badge: '5', color: 'bg-[#FF792D]' },
                { id: 4, label: 'Ocak ayı fatura verilerini hazırla', badge: 'Bugün', color: 'bg-[#0E3A53] text-[#12D9E8]' },
              ].map((task) => (
                <label
                  key={task.id}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(checkedTasks[task.id])}
                      onChange={(e) =>
                        setCheckedTasks((prev) => ({ ...prev, [task.id]: e.target.checked }))
                      }
                      className="w-3.5 h-3.5 rounded border-white/25 bg-[#091426] accent-[#FF792D]"
                    />
                    <span
                      className={
                        checkedTasks[task.id] ? 'line-through text-[#AEBCCB]/50' : 'text-[#D0DCEF]'
                      }
                    >
                      {task.label}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${task.color}`}
                  >
                    {task.badge}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

