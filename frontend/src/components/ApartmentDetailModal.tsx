import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Home,
  User,
  Gauge,
  Activity,
  FileSpreadsheet,
  Send,
  ShieldCheck,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Clock,
  KeyRound,
} from 'lucide-react';
import { isisensApi, formatTrNumber } from '../services/api';

interface Props {
  apartmentId: number | null;
  onClose: () => void;
}

export const ApartmentDetailModal: React.FC<Props> = ({ apartmentId, onClose }) => {
  const queryClient = useQueryClient();
  const [simValue, setSimValue] = useState<string>('');
  const [simSource, setSimSource] = useState<string>('simulator');
  const [simFeedback, setSimFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['apartmentDetail', apartmentId],
    queryFn: () => isisensApi.getApartmentDetail(apartmentId!),
    enabled: apartmentId !== null,
  });

  const activeMeter = data?.meter_assignments?.find((m) => m.is_active);

  const sendReadingMutation = useMutation({
    mutationFn: async () => {
      if (!activeMeter) throw new Error('Bu dairede aktif sayaç bulunamadı.');
      const latestVal = data?.readings_history?.[0]?.value ?? activeMeter.initial_index_value ?? 1000;
      const numericVal = simValue.trim() ? Number(simValue) : Number((latestVal + 25.4).toFixed(2));
      return isisensApi.ingestReading({
        device_id: activeMeter.serial_number,
        source: simSource,
        reading_type: 'cumulative_energy',
        value: numericVal.toFixed(2),
        unit: 'kWh',
        read_at: new Date().toISOString(),
        status: 'valid',
        rssi_dbm: -66,
        battery_level: 'ok',
      });
    },
    onSuccess: (res) => {
      setSimFeedback(res.message || 'Okuma başarıyla kaydedildi.');
      setSimValue('');
      queryClient.invalidateQueries({ queryKey: ['apartmentDetail', apartmentId] });
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
      queryClient.invalidateQueries({ queryKey: ['sitesTree'] });
      queryClient.invalidateQueries({ queryKey: ['readingsStatus'] });
    },
    onError: (err: any) => {
      setSimFeedback(err?.response?.data?.detail || err.message || 'Okuma gönderilemedi.');
    },
  });

  if (apartmentId === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl h-full bg-[#091326] border-l border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0B172E] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF792D]/15 border border-[#FF792D]/40 flex items-center justify-center text-[#FF792D]">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white">
                  Daire Detayı — {data?.apartment.flat_label || `#${apartmentId}`}
                </h2>
                {data?.apartment.is_demo && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    DEMO KAYDI
                  </span>
                )}
              </div>
              <p className="text-xs text-[#AEBCCB]">
                {data?.apartment.site_name} • {data?.apartment.block_name} • Kat {data?.apartment.floor} •{' '}
                {data?.apartment.area_m2} m²
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#AEBCCB] hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !data ? (
            <div className="py-16 text-center text-[#AEBCCB]">Daire verileri yükleniyor...</div>
          ) : (
            <>
              {/* Occupant & Active Meter Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#101E36] border border-white/10">
                  <div className="flex items-center gap-2 text-xs text-[#12D9E8] font-semibold mb-2">
                    <User className="w-4 h-4" />
                    AKTİF SAKİN / KULLANICI BİLGİSİ (KVKK KORUMALI)
                  </div>
                  {data.occupants[0] ? (
                    <div className="space-y-1 text-sm">
                      <div className="font-bold text-white text-base">{data.occupants[0].full_name}</div>
                      <div className="text-xs text-[#AEBCCB]">
                        Tip: {data.occupants[0].occupant_type === 'owner' ? 'Kat Maliki' : 'Kiracı'} • Tel:{' '}
                        {data.occupants[0].phone_masked || '—'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[#AEBCCB]">Kayıtlı sakin bulunmuyor.</div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#101E36] border border-white/10">
                  <div className="flex items-center gap-2 text-xs text-[#FF792D] font-semibold mb-2">
                    <Gauge className="w-4 h-4" />
                    AKTİF KALORİMETRE SAYACI
                  </div>
                  {activeMeter ? (
                    <div className="space-y-1 text-sm">
                      <div className="font-bold text-white text-base flex items-center justify-between">
                        <span>{activeMeter.serial_number}</span>
                        <span className="text-xs font-normal px-2 py-0.5 rounded bg-[#12D9E8]/15 text-[#12D9E8] border border-[#12D9E8]/30">
                          {activeMeter.rf_mode} • {activeMeter.unit}
                        </span>
                      </div>
                      <div className="text-xs text-[#AEBCCB]">
                        {activeMeter.manufacturer} {activeMeter.model} • wM-Bus ID: {activeMeter.wmbus_id}
                      </div>
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1 pt-0.5">
                        <KeyRound className="w-3 h-3" />
                        Şifreleme: {activeMeter.encryption_status} ({activeMeter.key_reference || 'Anahtar Yok'})
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-rose-400">Bu daireye atanmış aktif sayaç yok.</div>
                  )}
                </div>
              </div>

              {/* Quick RF / Simulator Reading Trigger for this Apartment */}
              {activeMeter && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-[#12223D] to-[#172846] border border-[#FF792D]/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#FF792D]">
                      <Radio className="w-4 h-4" />
                      CANLI RF / SİMÜLATÖR OKUMA TESTİ ({activeMeter.serial_number})
                    </div>
                    <span className="text-[11px] text-[#AEBCCB]">
                      POST /api/v1/ingestion/readings
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      value={simValue}
                      onChange={(e) => setSimValue(e.target.value)}
                      placeholder={`Yeni Endeks (Örn: ${(
                        (data.readings_history?.[0]?.value ?? activeMeter.initial_index_value ?? 1200) + 35.5
                      ).toFixed(2)})`}
                      className="flex-1 bg-[#081223] border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-[#AEBCCB]/50 focus:outline-none focus:border-[#FF792D]"
                    />
                    <select
                      value={simSource}
                      onChange={(e) => setSimSource(e.target.value)}
                      className="bg-[#081223] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#12D9E8]"
                    >
                      <option value="simulator">simulator</option>
                      <option value="wireless_mbus">wireless_mbus</option>
                      <option value="custom_rf">custom_rf</option>
                      <option value="manual_import">manual_import</option>
                    </select>
                    <button
                      onClick={() => sendReadingMutation.mutate()}
                      disabled={sendReadingMutation.isPending}
                      className="isisens-btn-orange px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendReadingMutation.isPending ? 'Gönderiliyor...' : 'Okuma Gönder'}
                    </button>
                  </div>
                  {simFeedback && (
                    <div className="mt-2 text-xs text-[#20D58C] font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {simFeedback}
                    </div>
                  )}
                </div>
              )}

              {/* Chronological Meter Readings History (`meter_readings`) */}
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-[#12D9E8]" />
                  Okuma Geçmişi ({data.readings_history.length} Kayıt — Ham Veriler Korunur)
                </h3>
                <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0B1528]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#101F38] text-[#AEBCCB] border-b border-white/10">
                      <tr>
                        <th className="py-2.5 px-3">Tarih / Saat</th>
                        <th className="py-2.5 px-3">Sayaç No</th>
                        <th className="py-2.5 px-3">Kaynak</th>
                        <th className="py-2.5 px-3 text-right">İlk Endeks</th>
                        <th className="py-2.5 px-3 text-right">Okunan Endeks</th>
                        <th className="py-2.5 px-3 text-right">Tüketim</th>
                        <th className="py-2.5 px-3 text-center">RSSI / Pil</th>
                        <th className="py-2.5 px-3 text-center">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.readings_history.map((r) => (
                        <tr key={r.id} className="hover:bg-white/[0.03]">
                          <td className="py-2.5 px-3 text-white font-medium">
                            {new Date(r.read_at).toLocaleString('tr-TR')}
                          </td>
                          <td className="py-2.5 px-3 text-[#AEBCCB]">{r.meter_serial}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-white/5 text-[#12D9E8] border border-[#12D9E8]/25">
                              {r.source}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#AEBCCB]">
                            {formatTrNumber(r.first_index)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-white">
                            {formatTrNumber(r.value)} {r.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#12D9E8]">
                            {r.consumption_kwh !== null && r.consumption_kwh !== undefined
                              ? `${formatTrNumber(r.consumption_kwh)} kWh`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[#AEBCCB]">
                            {r.rssi_dbm ? `${r.rssi_dbm} dBm` : '—'} / {r.battery_level || 'ok'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                r.status === 'valid'
                                  ? 'bg-[#20D58C]/15 text-[#20D58C] border border-[#20D58C]/30'
                                  : r.status === 'needs_review'
                                    ? 'bg-[#FFBD35]/15 text-[#FFBD35] border border-[#FFBD35]/30'
                                    : 'bg-[#FF5050]/15 text-[#FF5050] border border-[#FF5050]/30'
                              }`}
                            >
                              {r.status === 'valid'
                                ? 'Geçerli'
                                : r.status === 'needs_review'
                                  ? 'Kontrol'
                                  : r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.readings_history.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-[#AEBCCB]">
                            Bu daire için henüz okuma kaydı bulunmuyor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Billing Calculation History (`allocations`) */}
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                  <FileSpreadsheet className="w-4 h-4 text-[#FF792D]" />
                  Dönemsel Gider Paylaşım ve Hesaplama Geçmişi (%30 Ortak / %70 Tüketim)
                </h3>
                <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0B1528]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#101F38] text-[#AEBCCB] border-b border-white/10">
                      <tr>
                        <th className="py-2.5 px-3">Dönem</th>
                        <th className="py-2.5 px-3 text-right">İlk Endeks</th>
                        <th className="py-2.5 px-3 text-right">Son Endeks</th>
                        <th className="py-2.5 px-3 text-right">Tüketim (kWh)</th>
                        <th className="py-2.5 px-3 text-right">Ortak Pay (₺)</th>
                        <th className="py-2.5 px-3 text-right">Tüketim Tutarı (₺)</th>
                        <th className="py-2.5 px-3 text-right">Toplam Tutar (₺)</th>
                        <th className="py-2.5 px-3 text-center">Sürüm / Onay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.billing_history.map((b) => (
                        <tr key={b.allocation_id} className="hover:bg-white/[0.03]">
                          <td className="py-2.5 px-3 font-semibold text-white">{b.period_name}</td>
                          <td className="py-2.5 px-3 text-right text-[#AEBCCB]">
                            {formatTrNumber(b.first_index)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-white">
                            {formatTrNumber(b.last_index)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#12D9E8]">
                            {formatTrNumber(b.consumption_kwh)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#AEBCCB]">
                            {formatTrNumber(b.common_share_try)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-white">
                            {formatTrNumber(b.usage_share_try)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#FF792D]">
                            ₺{formatTrNumber(b.total_amount_try)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              v{b.calculation_version} • {b.status === 'approved' ? 'Onaylı' : 'Önizleme'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Meter Assignment History (`meter_assignments`) */}
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-[#20D58C]" />
                  Sayaç Atama ve Değişim Geçmişi
                </h3>
                <div className="space-y-2">
                  {data.meter_assignments.map((ma) => (
                    <div
                      key={ma.assignment_id}
                      className="p-3 rounded-lg bg-[#0B1528] border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{ma.serial_number}</span>
                        <span className="text-[#AEBCCB] ml-2">
                          ({ma.manufacturer} {ma.model} • Başlangıç Endeksi:{' '}
                          {formatTrNumber(ma.initial_index_value)} kWh)
                        </span>
                        <div className="text-[11px] text-[#AEBCCB] mt-0.5">
                          Atanma: {new Date(ma.assigned_at).toLocaleDateString('tr-TR')}{' '}
                          {ma.unassigned_at
                            ? `• Sökülme: ${new Date(ma.unassigned_at).toLocaleDateString('tr-TR')}`
                            : '• Halen Aktif'}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full font-semibold ${
                          ma.is_active
                            ? 'bg-[#20D58C]/15 text-[#20D58C] border border-[#20D58C]/30'
                            : 'bg-white/10 text-[#AEBCCB]'
                        }`}
                      >
                        {ma.is_active ? 'Aktif Sayaç' : 'Geçmiş Sayaç'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

