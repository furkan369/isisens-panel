import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Building2, Layers, Home, Calendar, Lock } from 'lucide-react';
import { isisensApi } from '../services/api';
import type { SiteDetailSummary } from '../types';

export const CreateSiteModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated?: (siteId: number) => void;
}> = ({ open, onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('Selçuklu');
  const [city, setCity] = useState('Konya');
  const [address, setAddress] = useState('');
  const [protocol, setProtocol] = useState('SHARKY / OMS');
  const [isDemo, setIsDemo] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      isisensApi.createSite({
        name,
        district,
        city,
        address,
        primary_protocol: protocol,
        is_demo: isDemo,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['sitesTree'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setName('');
      setAddress('');
      onCreated?.(created.id);
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#0B1528] border border-white/15 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#101F38] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <Building2 className="w-5 h-5 text-[#FF792D]" />
            Yeni Site Oluştur
          </div>
          <button onClick={onClose} className="text-[#AEBCCB] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) mutation.mutate();
          }}
          className="p-5 space-y-4 text-sm"
        >
          <div>
            <label className="block text-xs text-[#AEBCCB] mb-1">Site Adı *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Beyşehir Göl Konutları"
              className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#FF792D]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">İlçe</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              >
                <option value="Selçuklu">Selçuklu</option>
                <option value="Meram">Meram</option>
                <option value="Karatay">Karatay</option>
                <option value="Beyşehir">Beyşehir</option>
                <option value="Ereğli">Ereğli</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">İl</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#AEBCCB] mb-1">Haberleşme Protokolü / Sayaç Tipi</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
            >
              <option value="SHARKY / OMS">SHARKY / OMS (Wireless M-Bus T1)</option>
              <option value="KAMSTRUP / OMS">KAMSTRUP / OMS (Wireless M-Bus C1)</option>
              <option value="DANFOSS / OMS">DANFOSS / OMS</option>
              <option value="QUNDIS / OMS">QUNDIS / OMS</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#AEBCCB] mb-1">Açık Adres</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Mahalle, Cadde, No..."
              className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#AEBCCB] cursor-pointer">
            <input
              type="checkbox"
              checked={isDemo}
              onChange={(e) => setIsDemo(e.target.checked)}
              className="rounded border-white/20"
            />
            Bu siteyi Demo Verisi olarak işaretle (Gerçek müşteri kaydıysa işaretini kaldırın)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#AEBCCB]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="isisens-btn-orange px-5 py-2 rounded-lg font-bold text-white"
            >
              {mutation.isPending ? 'Kaydediliyor...' : 'Site Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const EditSiteModal: React.FC<{
  open: boolean;
  site: SiteDetailSummary | null | undefined;
  onClose: () => void;
}> = ({ open, site, onClose }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(site?.site_name || '');
  const [district, setDistrict] = useState(site?.district || 'Selçuklu');
  const [protocol, setProtocol] = useState(site?.primary_protocol || 'SHARKY / OMS');
  const [status, setStatus] = useState(site?.status || 'active');

  React.useEffect(() => {
    if (site) {
      setName(site.site_name);
      setDistrict(site.district);
      setProtocol(site.primary_protocol);
      setStatus(site.status);
    }
  }, [site]);

  const mutation = useMutation({
    mutationFn: () =>
      isisensApi.updateSite(site!.site_id, {
        name,
        district,
        primary_protocol: protocol,
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sitesTree'] });
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
      onClose();
    },
  });

  if (!open || !site) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#0B1528] border border-white/15 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#101F38] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <Building2 className="w-5 h-5 text-[#12D9E8]" />
            Site Düzenle — {site.site_name}
          </div>
          <button onClick={onClose} className="text-[#AEBCCB] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-5 space-y-4 text-sm"
        >
          <div>
            <label className="block text-xs text-[#AEBCCB] mb-1">Site Adı</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">İlçe</label>
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              >
                <option value="active">Aktif</option>
                <option value="maintenance">Bakımda</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#AEBCCB] mb-1">Protokol</label>
            <input
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#AEBCCB]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="isisens-btn-orange px-5 py-2 rounded-lg font-bold text-white"
            >
              Güncelle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CreateBlockModal: React.FC<{
  open: boolean;
  siteId: number;
  siteName: string;
  onClose: () => void;
  onCreated?: (blockId: number) => void;
}> = ({ open, siteId, siteName, onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [floorCount, setFloorCount] = useState(10);
  const [plannedCount, setPlannedCount] = useState(40);

  const mutation = useMutation({
    mutationFn: () =>
      isisensApi.createBlock({
        site_id: siteId,
        name: name.trim(),
        code: code.trim() || undefined,
        floor_count: floorCount,
        planned_apartment_count: plannedCount,
      }),
    onSuccess: (blk) => {
      queryClient.invalidateQueries({ queryKey: ['sitesTree'] });
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
      queryClient.invalidateQueries({ queryKey: ['allBlocks'] });
      setName('');
      setCode('');
      onCreated?.(blk.id);
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#0B1528] border border-white/15 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#101F38] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <Layers className="w-5 h-5 text-[#12D9E8]" />
            Blok Ekle — {siteName}
          </div>
          <button onClick={onClose} className="text-[#AEBCCB] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) mutation.mutate();
          }}
          className="p-5 space-y-4 text-sm"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-[#AEBCCB] mb-1">Blok Adı *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: E Blok"
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Blok Kodu</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="E"
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Kat Sayısı</label>
              <input
                type="number"
                value={floorCount}
                onChange={(e) => setFloorCount(Number(e.target.value))}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Planlanan Daire</label>
              <input
                type="number"
                value={plannedCount}
                onChange={(e) => setPlannedCount(Number(e.target.value))}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#AEBCCB]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="isisens-btn-orange px-5 py-2 rounded-lg font-bold text-white"
            >
              {mutation.isPending ? 'Ekleniyor...' : 'Blok Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CreateApartmentModal: React.FC<{
  open: boolean;
  siteId: number;
  blocks: Array<{ id: number; name: string; code: string }>;
  defaultBlockId?: number | null;
  onClose: () => void;
}> = ({ open, siteId, blocks, defaultBlockId, onClose }) => {
  const queryClient = useQueryClient();
  const [blockId, setBlockId] = useState<number>(defaultBlockId || blocks[0]?.id || 1);
  const [apartmentNo, setApartmentNo] = useState<number>(181);
  const [floor, setFloor] = useState<number>(1);
  const [areaM2, setAreaM2] = useState<number>(145);
  const [occupantName, setOccupantName] = useState<string>('');
  const [meterSerial, setMeterSerial] = useState<string>('TEST-001');
  const [meterBrand, setMeterBrand] = useState<string>('Diehl Metering');
  const [meterModel, setMeterModel] = useState<string>('Sharky 775');
  const [initialIndex, setInitialIndex] = useState<number>(1000.0);

  React.useEffect(() => {
    if (defaultBlockId) setBlockId(defaultBlockId);
    else if (blocks[0]) setBlockId(blocks[0].id);
  }, [defaultBlockId, blocks]);

  const mutation = useMutation({
    mutationFn: () =>
      isisensApi.createApartment({
        site_id: siteId,
        block_id: blockId,
        apartment_no: apartmentNo,
        floor,
        area_m2: areaM2,
        occupant_name: occupantName.trim() || 'Yeni Daire Sakini',
        occupant_type: 'owner',
        meter_serial: meterSerial.trim() || undefined,
        meter_manufacturer: meterBrand,
        meter_model: meterModel,
        initial_index: initialIndex,
        is_demo: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
      queryClient.invalidateQueries({ queryKey: ['sitesTree'] });
      queryClient.invalidateQueries({ queryKey: ['meters'] });
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#0B1528] border border-white/15 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#101F38] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <Home className="w-5 h-5 text-[#FF792D]" />
            Daire ve Kalorimetre Sayacı Tanımla
          </div>
          <button onClick={onClose} className="text-[#AEBCCB] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-5 space-y-4 text-sm"
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Blok *</label>
              <select
                value={blockId}
                onChange={(e) => setBlockId(Number(e.target.value))}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Daire No *</label>
              <input
                type="number"
                required
                value={apartmentNo}
                onChange={(e) => setApartmentNo(Number(e.target.value))}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Alan (m²)</label>
              <input
                type="number"
                value={areaM2}
                onChange={(e) => setAreaM2(Number(e.target.value))}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#AEBCCB] mb-1">Sakin / Kullanıcı Adı Soyadı *</label>
            <input
              required
              value={occupantName}
              onChange={(e) => setOccupantName(e.target.value)}
              placeholder="Örn: Selim Aksoy"
              className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-[#071020] border border-[#12D9E8]/30 space-y-3">
            <div className="text-xs font-bold text-[#12D9E8]">
              KALORİMETRE SAYACI EŞLEŞTİRMESİ (İSTEĞE BAĞLI)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#AEBCCB] mb-1">Sayaç Seri No / Cihaz Kimliği</label>
                <input
                  value={meterSerial}
                  onChange={(e) => setMeterSerial(e.target.value)}
                  placeholder="Örn: TEST-001 veya SH-775999"
                  className="w-full bg-[#0B1528] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#AEBCCB] mb-1">İlk Endeks (kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={initialIndex}
                  onChange={(e) => setInitialIndex(Number(e.target.value))}
                  className="w-full bg-[#0B1528] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#AEBCCB] mb-1">Sayaç Markası</label>
                <input
                  value={meterBrand}
                  onChange={(e) => setMeterBrand(e.target.value)}
                  className="w-full bg-[#0B1528] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#AEBCCB] mb-1">Sayaç Modeli</label>
                <input
                  value={meterModel}
                  onChange={(e) => setMeterModel(e.target.value)}
                  className="w-full bg-[#0B1528] border border-white/15 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#AEBCCB]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="isisens-btn-orange px-5 py-2 rounded-lg font-bold text-white"
            >
              {mutation.isPending ? 'Kaydediliyor...' : 'Daire & Sayaç Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CreateBillingPeriodModal: React.FC<{
  open: boolean;
  siteId: number;
  siteName: string;
  onClose: () => void;
}> = ({ open, siteId, siteName, onClose }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('Şubat 2026');
  const [periodCode, setPeriodCode] = useState('2026-02');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');
  const [totalBill, setTotalBill] = useState(1320000);
  const [unitPrice, setUnitPrice] = useState(4.15);
  const [commonFee, setCommonFee] = useState(85);

  const mutation = useMutation({
    mutationFn: () =>
      isisensApi.createBillingPeriod({
        site_id: siteId,
        name,
        period_code: periodCode,
        start_date: startDate,
        end_date: endDate,
        total_bill_amount_try: totalBill,
        unit_price_per_kwh: unitPrice,
        common_fee_per_apartment_try: commonFee,
        common_share_ratio: 0.3,
        usage_share_ratio: 0.7,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteSummary'] });
      queryClient.invalidateQueries({ queryKey: ['billingPeriods'] });
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#0B1528] border border-white/15 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#101F38] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <Calendar className="w-5 h-5 text-[#FF792D]" />
            Yeni Faturalandırma Dönemi — {siteName}
          </div>
          <button onClick={onClose} className="text-[#AEBCCB] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-5 space-y-4 text-sm"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Dönem Adı</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Dönem Kodu</label>
              <input
                required
                value={periodCode}
                onChange={(e) => setPeriodCode(e.target.value)}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">İlk Okuma Tarihi</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Son Okuma Tarihi</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Toplam Fatura (₺)</label>
              <input
                type="number"
                value={totalBill}
                onChange={(e) => setTotalBill(Number(e.target.value))}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Birim Fiyat (₺/kWh)</label>
              <input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#AEBCCB] mb-1">Ortak Pay (₺)</label>
              <input
                type="number"
                step="0.01"
                value={commonFee}
                onChange={(e) => setCommonFee(Number(e.target.value))}
                className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#AEBCCB]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="isisens-btn-orange px-5 py-2 rounded-lg font-bold text-white"
            >
              {mutation.isPending ? 'Oluşturuluyor...' : 'Dönem Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const LoginModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onLoggedIn: () => void;
}> = ({ open, onClose, onLoggedIn }) => {
  const [username, setUsername] = useState('furkan');
  const [password, setPassword] = useState('Isisens2026!');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await isisensApi.login(username, password);
      onLoggedIn();
      onClose();
    } catch (error: any) {
      setErr(error?.response?.data?.detail || 'Giriş başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#0B1528] border border-white/15 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#101F38] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <Lock className="w-4 h-4 text-[#FF792D]" />
            IsıSens Kurucu Mühendis Oturumu
          </div>
          <button onClick={onClose} className="text-[#AEBCCB] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          <div className="flex gap-2">
            {['furkan', 'emre', 'burak'].map((u) => (
              <button
                type="button"
                key={u}
                onClick={() => {
                  setUsername(u);
                  setPassword('Isisens2026!');
                }}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold capitalize ${
                  username === u
                    ? 'bg-[#FF792D]/20 border-[#FF792D] text-white'
                    : 'bg-white/5 border-white/10 text-[#AEBCCB]'
                }`}
              >
                {u} (Kurucu)
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-[#AEBCCB] mb-1">Kullanıcı Adı veya E-posta</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#AEBCCB] mb-1">Parola</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#060E1E] border border-white/15 rounded-lg px-3 py-2 text-white"
            />
          </div>
          {err && <div className="text-xs text-[#FF5050] font-medium">{err}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#AEBCCB]"
            >
              Kapat
            </button>
            <button
              type="submit"
              disabled={loading}
              className="isisens-btn-orange px-5 py-2 rounded-lg font-bold text-white"
            >
              {loading ? 'Doğrulanıyor...' : 'Oturum Aç'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

