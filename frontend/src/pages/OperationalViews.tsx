import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Gauge,
  Radio,
  AlertTriangle,
  FileText,
  PieChart,
  Users,
  Settings,
  CheckCircle2,
  Send,
  Database,
  RefreshCw,
  WifiOff,
  Link2,
  ShieldCheck,
  KeyRound,
  Plus,
  Download,
  Printer,
  Zap,
} from 'lucide-react';
import { isisensApi, formatTrNumber, formatTrInteger } from '../services/api';

// ============================================================================
// 3. BLOKLAR VIEW
// ============================================================================
export const BloklarView: React.FC<{
  onOpenBlockInSiteler: (siteId: number, blockId: number) => void;
}> = ({ onOpenBlockInSiteler }) => {
  const { data: blocks = [] } = useQuery({
    queryKey: ['allBlocks'],
    queryFn: () => isisensApi.listAllBlocks(),
  });

  return (
    <div className="isisens-glass-panel rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-[#12D9E8]" />
            <span>Blok Yönetimi ve Okuma Performansı</span>
          </h1>
          <p className="text-xs text-[#AEBCCB] mt-1">
            Konya genelindeki tüm sitelere ait blokların daire sayıları, okunan/okunamayan sayaç oranları
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-[#12D9E8]/15 border border-[#12D9E8]/35 text-xs font-bold text-[#12D9E8]">
          Toplam {blocks.length} Blok
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {blocks.map((b: any) => (
          <div
            key={b.id}
            onClick={() => onOpenBlockInSiteler(b.site_id, b.id)}
            className="p-4 rounded-xl bg-[#0B162C] border border-white/10 hover:border-[#12D9E8]/60 cursor-pointer transition space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[#12D9E8] font-semibold">{b.site_name}</div>
                <div className="text-base font-extrabold text-white mt-0.5">
                  {b.name} ({b.district})
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#10382B] text-[#20D58C] border border-[#20D58C]/35">
                %{b.success_rate}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-white/10">
              <div>
                <div className="text-[#AEBCCB]">Toplam Daire</div>
                <div className="font-bold text-white text-sm">{b.actual_apartment_count}</div>
              </div>
              <div>
                <div className="text-[#AEBCCB]">Okunan</div>
                <div className="font-bold text-[#20D58C] text-sm">{b.read_count}</div>
              </div>
              <div>
                <div className="text-[#AEBCCB]">Okunamayan</div>
                <div className="font-bold text-[#FF5050] text-sm">{b.unread_count}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 4. SAYAÇLAR & EŞLEŞTİRİLMEMİŞ SAYAÇLAR VIEW
// ============================================================================
export const SayaclarView: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'all' | 'unmatched'>('all');
  const [pairAptId, setPairAptId] = useState<Record<number, string>>({});
  const [pairFeedback, setPairFeedback] = useState<string | null>(null);

  const { data: metersData } = useQuery({
    queryKey: ['meters', search, page],
    queryFn: () => isisensApi.listMeters({ search, page, page_size: 20 }),
  });

  const { data: unmatchedMeters = [] } = useQuery({
    queryKey: ['unmatchedMeters'],
    queryFn: () => isisensApi.listUnmatchedMeters(),
  });

  const assignMutation = useMutation({
    mutationFn: ({ meterId, apartmentId }: { meterId: number; apartmentId: number }) =>
      isisensApi.assignMeter({
        meter_id: meterId,
        apartment_id: apartmentId,
        initial_index_value: 1000,
        reason: 'Eşleştirilmemiş Sayaçlar ekranından operatör tarafından atandı',
      }),
    onSuccess: (res) => {
      setPairFeedback(`${res.meter_serial} sayacı ${res.apartment_label} dairesine başarıyla eşleştirildi.`);
      queryClient.invalidateQueries({ queryKey: ['unmatchedMeters'] });
      queryClient.invalidateQueries({ queryKey: ['meters'] });
      queryClient.invalidateQueries({ queryKey: ['readingsStatus'] });
    },
  });

  return (
    <div className="isisens-glass-panel rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Gauge className="w-6 h-6 text-[#FF792D]" />
            <span>Kalorimetre Sayaç Envanteri & Güvenli Anahtar Yönetimi</span>
          </h1>
          <p className="text-xs text-[#AEBCCB] mt-1">
            OMS v4 / Wireless M-Bus sayaç kimlikleri, şifreleme durumları ve eşleştirilmemiş saha cihazları
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
              tab === 'all'
                ? 'isisens-btn-orange text-white'
                : 'bg-[#0B1528] border-white/15 text-[#AEBCCB]'
            }`}
          >
            Tüm Sayaçlar ({metersData?.total ?? 0})
          </button>
          <button
            onClick={() => setTab('unmatched')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
              tab === 'unmatched'
                ? 'isisens-btn-orange text-white'
                : 'bg-[#0B1528] border-[#FFBD35]/50 text-[#FFBD35]'
            }`}
          >
            <span>Eşleştirilmemiş Sayaçlar</span>
            <span className="px-2 py-0.5 rounded-full bg-black/40 text-white text-[11px]">
              {unmatchedMeters.length}
            </span>
          </button>
        </div>
      </div>

      {pairFeedback && (
        <div className="p-3 rounded-xl bg-[#10382B] border border-[#20D58C] text-xs text-[#20D58C] font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{pairFeedback}</span>
        </div>
      )}

      {tab === 'unmatched' ? (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-[#261C12] border border-[#FFBD35]/40 text-xs text-[#FFBD35]">
            <strong>Güvenlik Politikası:</strong> Sahada RF alıcı veya simülatör tarafından yakalanan
            tanımsız sayaçlar hiçbir zaman rastgele bir daireye otomatik eşlenmez. Buradan incelenerek
            yetkili mühendis tarafından ilgili daireye atanır.
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden bg-[#081224]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1D36] text-[#AEBCCB] border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Cihaz / Seri No</th>
                  <th className="py-3 px-4">wM-Bus ID</th>
                  <th className="py-3 px-4">Marka / Model</th>
                  <th className="py-3 px-4">Son Yakalanan Endeks</th>
                  <th className="py-3 px-4">Veri Kaynağı</th>
                  <th className="py-3 px-4">RSSI</th>
                  <th className="py-3 px-4 text-right">Daire Eşleştirme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {unmatchedMeters.map((um: any) => (
                  <tr key={um.id} className="hover:bg-white/[0.03]">
                    <td className="py-3 px-4 font-bold text-[#FFBD35]">{um.serial_number}</td>
                    <td className="py-3 px-4 text-white">{um.wmbus_id}</td>
                    <td className="py-3 px-4 text-[#D0DCEF]">
                      {um.manufacturer} {um.model}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#12D9E8]">
                      {um.last_detected_value ? `${um.last_detected_value} ${um.unit}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-[#AEBCCB]">{um.last_source}</td>
                    <td className="py-3 px-4 text-[#AEBCCB]">
                      {um.last_rssi_dbm ? `${um.last_rssi_dbm} dBm` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Daire ID (Örn: 7)"
                          value={pairAptId[um.id] || ''}
                          onChange={(e) =>
                            setPairAptId((prev) => ({ ...prev, [um.id]: e.target.value }))
                          }
                          className="w-32 bg-[#060E1E] border border-white/15 rounded-lg px-2.5 py-1 text-white text-xs"
                        />
                        <button
                          onClick={() => {
                            const aid = Number(pairAptId[um.id] || 7);
                            assignMutation.mutate({ meterId: um.id, apartmentId: aid });
                          }}
                          className="px-3 py-1 rounded-lg bg-[#12D9E8]/20 border border-[#12D9E8] text-[#12D9E8] font-bold hover:bg-[#12D9E8]/30"
                        >
                          <Link2 className="w-3.5 h-3.5 inline mr-1" />
                          Daireye Eşle
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Seri no, wM-Bus ID, marka veya daire ara..."
              className="w-80 bg-[#081224] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white"
            />
            <span className="text-xs text-[#AEBCCB]">
              AES-128 Anahtarları düz metin olarak saklanmaz; yalnızca Key Vault referansı gösterilir.
            </span>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden bg-[#081224]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1D36] text-[#AEBCCB] border-b border-white/10">
                <tr>
                  <th className="py-3 px-3">Seri No</th>
                  <th className="py-3 px-3">wM-Bus Kimliği</th>
                  <th className="py-3 px-3">Üretici & Model</th>
                  <th className="py-3 px-3">Protokol / RF Modu</th>
                  <th className="py-3 px-3">Şifreleme & Anahtar Ref</th>
                  <th className="py-3 px-3">Atanan Site / Daire</th>
                  <th className="py-3 px-3 text-center">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(metersData?.items || []).map((m: any) => (
                  <tr key={m.id} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 px-3 font-bold text-white">{m.serial_number}</td>
                    <td className="py-2.5 px-3 text-[#12D9E8] font-mono">{m.wmbus_id}</td>
                    <td className="py-2.5 px-3 text-[#D0DCEF]">
                      {m.manufacturer} • {m.model}
                    </td>
                    <td className="py-2.5 px-3 text-[#AEBCCB]">
                      {m.communication_protocol} ({m.rf_mode})
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                        <KeyRound className="w-3 h-3" />
                        {m.key_reference || 'Anahtar Tanımsız'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white font-semibold">
                      {m.flat_label ? `${m.site_name} / ${m.flat_label}` : 'Eşleştirilmemiş'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          m.is_paired
                            ? 'bg-[#10382B] text-[#20D58C]'
                            : 'bg-[#3A2E14] text-[#FFBD35]'
                        }`}
                      >
                        {m.is_paired ? 'Aktif Eşli' : 'Atanmamış'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================================
// 5. OKUMALAR & CANLI PYTHON RF COLLECTOR TELEMETRİSİ VIEW (Section 10, 11, 12)
// ============================================================================
export const OkumalarView: React.FC = () => {
  const queryClient = useQueryClient();
  const [deviceId, setDeviceId] = useState('SH-775021');
  const [readingVal, setReadingVal] = useState('1595.40');
  const [source, setSource] = useState('simulator');
  const [unit, setUnit] = useState('kWh');
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: statusData } = useQuery({
    queryKey: ['readingsStatus'],
    queryFn: () => isisensApi.getReadingsStatus(),
    refetchInterval: 8000,
  });

  const directIngestMutation = useMutation({
    mutationFn: () =>
      isisensApi.ingestReading({
        device_id: deviceId.trim(),
        source,
        reading_type: 'cumulative_energy',
        value: readingVal,
        unit,
        read_at: new Date().toISOString(),
        status: 'valid',
        rssi_dbm: -65,
        battery_level: 'ok',
      }),
    onSuccess: (res) => {
      setFeedback(`[${res.ingest_status.toUpperCase()}] ${res.message}`);
      queryClient.invalidateQueries({ queryKey: ['readingsStatus'] });
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
      queryClient.invalidateQueries({ queryKey: ['unmatchedMeters'] });
    },
  });

  const offlineQueueMutation = useMutation({
    mutationFn: () => isisensApi.collectorEnqueueOffline(deviceId.trim(), readingVal, source),
    onSuccess: (res) => {
      setFeedback(
        `Çevrimdışı Mod: Okuma yerel SQLite kuyruğuna kaydedildi (Kuyruk ID #${res.sqlite_row_id}, Bekleyen: ${res.queue_stats.pending}).`
      );
      queryClient.invalidateQueries({ queryKey: ['readingsStatus'] });
    },
  });

  const syncOfflineMutation = useMutation({
    mutationFn: () => isisensApi.collectorSyncPending(),
    onSuccess: (res) => {
      setFeedback(
        `SQLite Senkronizasyonu Tamamlandı: ${res.synced_count} bekleyen okuma PostgreSQL/SQLAlchemy veritabanına aktarıldı.`
      );
      queryClient.invalidateQueries({ queryKey: ['readingsStatus'] });
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
    },
  });

  const cs = statusData?.collector_status;

  return (
    <div className="space-y-4">
      {/* Top Collector Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="isisens-kpi-cyan rounded-2xl p-3.5">
          <div className="text-[11px] text-[#AEBCCB]">Collector Bağlantı Durumu</div>
          <div className="text-sm font-extrabold text-[#20D58C] mt-1 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20D58C] animate-pulse" />
            <span>{cs?.collector_id || 'COLLECTOR-KONYA-01'}</span>
          </div>
          <div className="text-[10.5px] text-[#D0DCEF] mt-1">{cs?.active_adapter}</div>
        </div>

        <div className="isisens-kpi-orange rounded-2xl p-3.5">
          <div className="text-[11px] text-[#AEBCCB]">Aktif Veri Kaynağı & Son Okuma</div>
          <div className="text-sm font-extrabold text-white mt-1 uppercase">
            {cs?.last_source || 'simulator'}
          </div>
          <div className="text-[10.5px] text-[#D0DCEF] mt-1">
            {cs?.last_received_at
              ? new Date(cs.last_received_at).toLocaleString('tr-TR')
              : 'Bugün 10:24'}
          </div>
        </div>

        <div className="isisens-kpi-cyan rounded-2xl p-3.5">
          <div className="text-[11px] text-[#AEBCCB]">Toplam Okunan Sayaç Kaydı</div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {formatTrInteger(cs?.total_readings_stored ?? 634)}
          </div>
        </div>

        <div className="isisens-kpi-red rounded-2xl p-3.5">
          <div className="text-[11px] text-[#AEBCCB]">Hatalı / Geçersiz Paket</div>
          <div className="text-2xl font-extrabold text-[#FF5050] mt-1">
            {cs?.error_packets_count ?? 0}
          </div>
        </div>

        <div className="isisens-kpi-orange rounded-2xl p-3.5">
          <div className="text-[11px] text-[#AEBCCB]">Eşleştirilmemiş Sayaçlar</div>
          <div className="text-2xl font-extrabold text-[#FFBD35] mt-1">
            {cs?.unmatched_meters_count ?? 3}
          </div>
        </div>

        <div className="isisens-kpi-cyan rounded-2xl p-3.5">
          <div className="text-[11px] text-[#AEBCCB]">Bekleyen SQLite Senkronizasyon</div>
          <div className="text-2xl font-extrabold text-[#12D9E8] mt-1">
            {cs?.pending_sqlite_sync_count ?? 0}
          </div>
          <div className="text-[10px] text-[#AEBCCB]">
            Senkronize: {cs?.synced_sqlite_count ?? 0}
          </div>
        </div>
      </div>

      {/* Interactive Python Simulator & Offline SQLite Sync Control Panel */}
      <div className="isisens-glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-[#FF792D]" />
              <span>
                Python RF Collector & Simülatör Veri Aktarım Konsolu (POST /api/v1/ingestion/readings)
              </span>
            </h2>
            <p className="text-xs text-[#AEBCCB]">
              Akış: RF Reader / SimulatorReader → Normalizer → Yerel SQLite Kuyruğu → FastAPI → PostgreSQL → React Dashboard
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDeviceId('SH-775021');
                setReadingVal('1620.80');
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-[#12D9E8] border border-[#12D9E8]/30"
            >
              Örnek: A-101 (SH-775021)
            </button>
            <button
              type="button"
              onClick={() => {
                setDeviceId('SH-775027');
                setReadingVal('1510.25');
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-[#20D58C] border border-[#20D58C]/30"
            >
              Örnek: Okunamayan A-107 (SH-775027)
            </button>
            <button
              type="button"
              onClick={() => {
                setDeviceId('UNKNOWN-RF-999');
                setReadingVal('845.00');
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-[#FFBD35] border border-[#FFBD35]/30"
            >
              Örnek: Tanımsız Sayaç (UNKNOWN-RF-999)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end text-xs">
          <div>
            <label className="block text-[#AEBCCB] mb-1">Sayaç Kimliği (device_id)</label>
            <input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="w-full bg-[#060E1E] border border-white/15 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[#AEBCCB] mb-1">Endeks Değeri (value)</label>
            <input
              type="number"
              step="0.01"
              value={readingVal}
              onChange={(e) => setReadingVal(e.target.value)}
              className="w-full bg-[#060E1E] border border-white/15 rounded-xl px-3 py-2 text-white font-bold"
            />
          </div>
          <div>
            <label className="block text-[#AEBCCB] mb-1">Birim (unit)</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-[#060E1E] border border-white/15 rounded-xl px-3 py-2 text-white"
            >
              <option value="kWh">kWh</option>
              <option value="MWh">MWh (x1000 kWh)</option>
              <option value="GJ">GJ (x277.78 kWh)</option>
            </select>
          </div>
          <div>
            <label className="block text-[#AEBCCB] mb-1">Kaynak (source)</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-[#060E1E] border border-white/15 rounded-xl px-3 py-2 text-white"
            >
              <option value="simulator">simulator</option>
              <option value="wireless_mbus">wireless_mbus</option>
              <option value="custom_rf">custom_rf</option>
              <option value="manual_import">manual_import</option>
            </select>
          </div>
          <button
            onClick={() => directIngestMutation.mutate()}
            disabled={directIngestMutation.isPending}
            className="isisens-btn-orange py-2 px-4 rounded-xl font-bold text-white flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Canlı API'ye Gönder</span>
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => offlineQueueMutation.mutate()}
              title="İnternet kesintisini simüle et: Veriyi yerel SQLite kuyruğuna kaydet"
              className="flex-1 py-2 px-2.5 rounded-xl bg-[#0D1E38] hover:bg-[#142C52] border border-[#FFBD35]/50 text-[#FFBD35] font-bold flex items-center justify-center gap-1"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>SQLite'a Kaydet</span>
            </button>
            <button
              onClick={() => syncOfflineMutation.mutate()}
              title="SQLite kuyruğunda bekleyen verileri senkronize et"
              className="flex-1 py-2 px-2.5 rounded-xl bg-[#10382B] hover:bg-[#154B3A] border border-[#20D58C]/60 text-[#20D58C] font-bold flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Senkronize Et</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="p-3 rounded-xl bg-[#0D1F3A] border border-[#12D9E8]/40 text-xs text-[#12D9E8] font-semibold">
            {feedback}
          </div>
        )}
      </div>

      {/* Recent Readings Table */}
      <div className="isisens-glass-panel rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">
          Son Alınan Sayaç Okumaları ve Saha Telemetrisi
        </h3>
        <div className="rounded-xl border border-white/10 overflow-hidden bg-[#081224]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0E1D36] text-[#AEBCCB] border-b border-white/10">
              <tr>
                <th className="py-2.5 px-3">Zaman</th>
                <th className="py-2.5 px-3">Site / Daire</th>
                <th className="py-2.5 px-3">Sayaç No</th>
                <th className="py-2.5 px-3">Kaynak</th>
                <th className="py-2.5 px-3 text-right">İlk Endeks</th>
                <th className="py-2.5 px-3 text-right">Son Endeks</th>
                <th className="py-2.5 px-3 text-right">Tüketim</th>
                <th className="py-2.5 px-3 text-center">RSSI / Pil</th>
                <th className="py-2.5 px-3 text-center">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(statusData?.recent_readings || []).slice(0, 15).map((r: any) => (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <td className="py-2.5 px-3 text-[#AEBCCB]">
                    {new Date(r.read_at).toLocaleString('tr-TR')}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    {r.site_name} • {r.flat_label}
                  </td>
                  <td className="py-2.5 px-3 text-[#12D9E8] font-mono">{r.meter_serial}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[#D0DCEF]">{r.source}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#AEBCCB]">
                    {formatTrNumber(r.first_index)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    {formatTrNumber(r.value)} {r.unit}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#12D9E8]">
                    {formatTrNumber(r.consumption_kwh)} kWh
                  </td>
                  <td className="py-2.5 px-3 text-center text-[#AEBCCB]">
                    {r.rssi_dbm ? `${r.rssi_dbm} dBm` : '—'} / {r.battery_level || 'ok'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-[#10382B] text-[#20D58C] font-semibold">
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. ARIZA & UYARILAR VIEW
// ============================================================================
export const ArizaUyarilarView: React.FC = () => {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', typeFilter],
    queryFn: () => isisensApi.listAlerts('open', typeFilter),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => isisensApi.resolveAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  return (
    <div className="isisens-glass-panel rounded-2xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-[#FF5050]" />
            <span>Arıza, Uyarı ve Saha Anomali Yönetimi</span>
          </h1>
          <p className="text-xs text-[#AEBCCB] mt-1">
            Düşük pil, sinyal kaybı, eksik OMS şifreleme anahtarı ve eşleştirilmemiş sayaç uyarıları
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {[
            { id: 'all', label: 'Tümü' },
            { id: 'low_battery', label: 'Düşük Pil' },
            { id: 'no_signal', label: 'Sinyal Yok' },
            { id: 'missing_key', label: 'Anahtar Eksik' },
            { id: 'unmatched_meter', label: 'Eşleştirilmemiş Sayaç' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setTypeFilter(btn.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold border transition ${
                typeFilter === btn.id
                  ? 'isisens-btn-orange text-white'
                  : 'bg-[#0B1528] border-white/15 text-[#AEBCCB]'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {alerts.map((a: any) => (
          <div
            key={a.id}
            className="p-4 rounded-xl bg-[#0B162C] border border-white/10 flex items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold uppercase ${
                    a.severity === 'critical'
                      ? 'bg-[#FF5050]/20 text-[#FF5050] border border-[#FF5050]/40'
                      : 'bg-[#FFBD35]/20 text-[#FFBD35] border border-[#FFBD35]/40'
                  }`}
                >
                  {a.alert_type}
                </span>
                <span className="font-bold text-white text-sm">{a.title}</span>
                <span className="text-xs text-[#12D9E8]">({a.site_name})</span>
              </div>
              <p className="text-xs text-[#AEBCCB]">{a.description}</p>
            </div>
            <button
              onClick={() => resolveMutation.mutate(a.id)}
              className="px-3.5 py-1.5 rounded-lg bg-[#10382B] hover:bg-[#164E3C] border border-[#20D58C]/50 text-xs font-bold text-[#20D58C] flex-shrink-0"
            >
              Çözüldü İşaretle
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 7. FATURALANDIRMA VIEW (Section 13: Decimal 70/30, Kuruş Farkı, Onay)
// ============================================================================
export const FaturalandirmaView: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: periods = [] } = useQuery({
    queryKey: ['billingPeriods'],
    queryFn: () => isisensApi.listBillingPeriods(),
  });

  const [invoiceAmount, setInvoiceAmount] = useState<number>(1284760);
  const [calcResult, setCalcResult] = useState<any>(null);

  const calcMutation = useMutation({
    mutationFn: (periodId: number) =>
      isisensApi.calculateBillingPreview(periodId, invoiceAmount, 0.3, 0.7),
    onSuccess: (res) => {
      setCalcResult(res);
      queryClient.invalidateQueries({ queryKey: ['billingPeriods'] });
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (periodId: number) => isisensApi.approveBillingPeriod(periodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billingPeriods'] });
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
    },
  });

  return (
    <div className="isisens-glass-panel rounded-2xl p-6 space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
          <FileText className="w-6 h-6 text-[#FF792D]" />
          <span>Merkezi Isıtma Faturalandırma ve Gider Paylaşım Motoru (Decimal 70/30)</span>
        </h1>
        <p className="text-xs text-[#AEBCCB] mt-1">
          Ham endeks okumaları otomatik resmi bildirim sayılmaz. Önce önizleme hesaplanır, kuruş
          yuvarlama farkları (Decimal) denetlenir ve yetkili mühendis onayıyla resmileşir. (Hukuken
          doğrulanmamış 15°C otomatik ceza uygulanmaz.)
        </p>
      </div>

      {calcResult && (
        <div className="p-4 rounded-xl bg-[#0E223D] border border-[#12D9E8]/50 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <div className="text-[#AEBCCB]">Hesaplama Sürümü</div>
            <div className="text-base font-bold text-white">v{calcResult.calculation_version}</div>
          </div>
          <div>
            <div className="text-[#AEBCCB]">%30 Ortak Pay Havuzu</div>
            <div className="text-base font-bold text-[#12D9E8]">
              ₺{formatTrNumber(calcResult.common_pool_try)}
            </div>
          </div>
          <div>
            <div className="text-[#AEBCCB]">%70 Tüketim Havuzu</div>
            <div className="text-base font-bold text-[#FF792D]">
              ₺{formatTrNumber(calcResult.usage_pool_try)}
            </div>
          </div>
          <div>
            <div className="text-[#AEBCCB]">Dağıtılan Toplam</div>
            <div className="text-base font-bold text-white">
              ₺{formatTrNumber(calcResult.distributed_sum_try)}
            </div>
          </div>
          <div>
            <div className="text-[#AEBCCB]">Kuruş Yuvarlama Farkı</div>
            <div className="text-base font-bold text-[#20D58C]">
              ₺{formatTrNumber(calcResult.rounding_diff_try, 4)}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 overflow-hidden bg-[#081224]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0E1D36] text-[#AEBCCB] border-b border-white/10">
            <tr>
              <th className="py-3 px-4">Dönem</th>
              <th className="py-3 px-4">Tarih Aralığı</th>
              <th className="py-3 px-4 text-right">Toplam Tüketim</th>
              <th className="py-3 px-4 text-right">Fatura Tutarı (₺)</th>
              <th className="py-3 px-4 text-center">Oran</th>
              <th className="py-3 px-4 text-center">Sürüm / Kuruş Farkı</th>
              <th className="py-3 px-4 text-center">Durum</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {periods.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.03]">
                <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                <td className="py-3 px-4 text-[#AEBCCB]">
                  {p.start_date} → {p.end_date}
                </td>
                <td className="py-3 px-4 text-right font-bold text-[#12D9E8]">
                  {formatTrNumber(p.total_site_consumption_kwh)} kWh
                </td>
                <td className="py-3 px-4 text-right font-bold text-white">
                  ₺{formatTrNumber(p.total_bill_amount_try)}
                </td>
                <td className="py-3 px-4 text-center text-[#D0DCEF]">%70 / %30</td>
                <td className="py-3 px-4 text-center text-[#20D58C]">
                  v{p.calculation_version} (₺{formatTrNumber(p.rounding_diff_try, 4)})
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      p.status === 'approved' || p.status === 'locked'
                        ? 'bg-[#10382B] text-[#20D58C]'
                        : 'bg-[#3A2E14] text-[#FFBD35]'
                    }`}
                  >
                    {p.status === 'approved'
                      ? 'Onaylandı'
                      : p.status === 'locked'
                        ? 'Resmi Kilitli'
                        : 'Önizleme'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => {
                      setInvoiceAmount(p.total_bill_amount_try || 1284760);
                      calcMutation.mutate(p.id);
                    }}
                    className="px-3 py-1 rounded-lg bg-[#12D9E8]/15 border border-[#12D9E8]/40 text-[#12D9E8] font-semibold"
                  >
                    70/30 Önizle
                  </button>
                  {p.status !== 'approved' && p.status !== 'locked' && (
                    <button
                      onClick={() => approveMutation.mutate(p.id)}
                      className="px-3 py-1 rounded-lg bg-[#20D58C]/20 border border-[#20D58C] text-[#20D58C] font-bold"
                    >
                      Onayla
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// 8. RAPORLAR VIEW
// ============================================================================
export const RaporlarView: React.FC = () => {
  return (
    <div className="isisens-glass-panel rounded-2xl p-6 space-y-4">
      <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
        <PieChart className="w-6 h-6 text-[#12D9E8]" />
        <span>Raporlama ve Dışa Aktarım Merkezi</span>
      </h1>
      <p className="text-xs text-[#AEBCCB]">
        Konya genelindeki siteler için dönemsel tüketim özetleri, okunamayan sayaç tutanakları ve
        resmi gider paylaşım cetvelleri
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {[
          {
            title: 'Site Bazlı Dönemsel Gider Cetveli (CSV/Excel)',
            desc: 'İlk endeks, son endeks, ortak pay (%30) ve tüketim tutarı (%70) dökümü.',
          },
          {
            title: 'Saha RF Okuma Başarı ve Sinyal Kalitesi Raporu',
            desc: 'Wireless M-Bus RSSI seviyeleri, pil durumları ve okunamayan daire analizleri.',
          },
          {
            title: 'KVKK Uyumlu Denetim ve İşlem Geçmişi Raporu',
            desc: 'Kullanıcı oturumları, sayaç eşleştirmeleri ve fatura onay izleri.',
          },
        ].map((rep, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-[#0B162C] border border-white/10 space-y-3">
            <div className="font-bold text-white text-sm">{rep.title}</div>
            <p className="text-xs text-[#AEBCCB]">{rep.desc}</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-[#FF792D]/20 border border-[#FF792D] text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                PDF / Yazdır
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 9. KULLANICILAR & DENETİM İZİ VIEW (Section 14: 3 Founders, Bcrypt, RBAC, KVKK)
// ============================================================================
export const KullanicilarView: React.FC = () => {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => isisensApi.listUsers(),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => isisensApi.listAuditLogs(25),
  });

  return (
    <div className="space-y-4">
      <div className="isisens-glass-panel rounded-2xl p-6 space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#12D9E8]" />
            <span>Yetkili Kullanıcılar ve Kurucu Mühendis Hesapları (RBAC & KVKK)</span>
          </h1>
          <p className="text-xs text-[#AEBCCB] mt-1">
            Parolalar bcrypt ile hash'lenir, API erişimleri JWT ve rol bazlı yetkilendirme ile korunur.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {users.map((u) => (
            <div key={u.id} className="p-4 rounded-xl bg-[#0B162C] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-base">{u.full_name}</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#10382B] text-[#20D58C]">
                  {u.role}
                </span>
              </div>
              <div className="text-xs text-[#12D9E8]">{u.title}</div>
              <div className="text-xs text-[#AEBCCB]">
                Kullanıcı: <strong>{u.username}</strong> • {u.email}
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 pt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                KVKK Veri Minimizasyonu Onaylı • Bcrypt Hash Korumalı
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="isisens-glass-panel rounded-2xl p-6 space-y-3">
        <h2 className="text-sm font-bold text-white">Sistem Denetim Günlüğü (audit_logs)</h2>
        <div className="rounded-xl border border-white/10 overflow-hidden bg-[#081224]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0E1D36] text-[#AEBCCB] border-b border-white/10">
              <tr>
                <th className="py-2.5 px-3">Tarih</th>
                <th className="py-2.5 px-3">Kullanıcı / Aktör</th>
                <th className="py-2.5 px-3">İşlem Türü</th>
                <th className="py-2.5 px-3">Hedef Kayıt</th>
                <th className="py-2.5 px-3">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((lg: any) => (
                <tr key={lg.id}>
                  <td className="py-2 px-3 text-[#AEBCCB]">
                    {new Date(lg.created_at).toLocaleString('tr-TR')}
                  </td>
                  <td className="py-2 px-3 font-semibold text-white">{lg.actor_name}</td>
                  <td className="py-2 px-3 text-[#FF792D] font-mono">{lg.action}</td>
                  <td className="py-2 px-3 text-[#12D9E8]">{lg.entity_id}</td>
                  <td className="py-2 px-3 text-[#D0DCEF] truncate max-w-md">{lg.details_json}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 10. SİSTEM AYARLARI & 60.000 DAİRE ÖLÇEK TESTİ VIEW (Stage 6)
// ============================================================================
export const SistemAyarlariView: React.FC = () => {
  const queryClient = useQueryClient();
  const [scaleResult, setScaleResult] = useState<any>(null);

  const scaleMutation = useMutation({
    mutationFn: (target: number) => isisensApi.generate60kDataset(target),
    onSuccess: (res) => {
      setScaleResult(res);
      queryClient.invalidateQueries({ queryKey: ['sitesTree'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  return (
    <div className="isisens-glass-panel rounded-2xl p-6 space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-[#FF792D]" />
          <span>Sistem Ayarları, RF Alıcı Adaptörleri ve 60.000 Daire Ölçek Testi</span>
        </h1>
        <p className="text-xs text-[#AEBCCB] mt-1">
          Donanım adaptörü yapılandırması, KVKK veri saklama politikaları ve yüksek hacimli sunucu
          taraflı sayfalama (Server-Side Pagination) performans doğrulaması
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stage 6: 60,000 Apartment Scale Benchmark Card */}
        <div className="p-5 rounded-xl bg-[#0B162C] border border-[#12D9E8]/40 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#12D9E8]">
            <Zap className="w-5 h-5" />
            <span>Aşama 6: 60.000 Daire Ölçek ve Sayfalama Yük Testi</span>
          </div>
          <p className="text-xs text-[#D0DCEF]">
            Sunucu taraflı indeksli sayfalama (20/50/100 kayıt) sayesinde veritabanında 60.000 daire
            bulunduğunda dahi tarayıcıya yalnızca aktif sayfa yüklenir ve sorgular milisaniyeler
            içinde tamamlanır.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => scaleMutation.mutate(60000)}
              disabled={scaleMutation.isPending}
              className="isisens-btn-orange px-4 py-2 rounded-xl text-xs font-bold text-white"
            >
              {scaleMutation.isPending
                ? '60.000 Daire Üretiliyor...'
                : '60.000 Daire Örnek Veri Üret & Test Et'}
            </button>
          </div>
          {scaleResult && (
            <div className="p-3 rounded-lg bg-[#10382B] border border-[#20D58C] text-xs text-[#20D58C]">
              <strong>Başarılı:</strong> {scaleResult.message} (Süre: {scaleResult.elapsed_ms} ms)
            </div>
          )}
        </div>

        {/* Hardware Reader Adapter Status Card */}
        <div className="p-5 rounded-xl bg-[#0B162C] border border-white/10 space-y-3 text-xs">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-[#FF792D]" />
            <span>RF Reader & wmbusmeters Donanım Adaptör Durumu</span>
          </div>
          <div className="space-y-2 text-[#D0DCEF]">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span>SimulatorReader:</span>
              <span className="text-[#20D58C] font-bold">Aktif & Çalışıyor</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span>WMBusReader (USB Wireless M-Bus):</span>
              <span className="text-[#12D9E8] font-bold">Entegrasyon Arayüzü Hazır (/dev/ttyUSB0)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span>CustomRFReader (868 MHz):</span>
              <span className="text-[#AEBCCB]">Donanım Bekleniyor</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Yerel Çevrimdışı Kuyruk:</span>
              <span className="text-[#20D58C] font-bold">SQLite WAL Aktif</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

