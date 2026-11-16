import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Home,
  Building2,
  Layers,
  Gauge,
  BarChart2,
  AlertTriangle,
  FileText,
  PieChart,
  Users,
  Settings,
  Search,
  Bell,
  ChevronDown,
} from 'lucide-react';
import { IsiSensLogo, SidebarNeonWaveSvg } from '../components/IsiSensLogo';
import { LoginModal } from '../components/CrudModals';
import { isisensApi } from '../services/api';
import type { NavSection } from '../types';

interface MainLayoutProps {
  activeSection: NavSection;
  onChangeSection: (section: NavSection) => void;
  globalSearch: string;
  onGlobalSearchChange: (val: string) => void;
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  activeSection,
  onChangeSection,
  globalSearch,
  onGlobalSearchChange,
  children,
}) => {
  const queryClient = useQueryClient();
  const [openLogin, setOpenLogin] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => isisensApi.getMe(),
  });

  const { data: overviewData } = useQuery({
    queryKey: ['overview'],
    queryFn: () => isisensApi.getOverview(),
  });

  const openAlertsCount = overviewData?.kpis?.open_alerts_count ?? 24;

  const primaryMenuItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'genel-bakis', label: 'Genel Bakış', icon: Home },
    { id: 'siteler', label: 'Siteler', icon: Building2 },
    { id: 'bloklar', label: 'Bloklar', icon: Layers },
    { id: 'sayaclar', label: 'Sayaçlar', icon: Gauge },
    { id: 'okumalar', label: 'Okumalar', icon: BarChart2 },
    {
      id: 'ariza-uyarilar',
      label: 'Arıza & Uyarılar',
      icon: AlertTriangle,
      badge: openAlertsCount,
    },
    { id: 'faturalandirma', label: 'Faturalandırma', icon: FileText },
    { id: 'raporlar', label: 'Raporlar', icon: PieChart },
  ];

  const bottomMenuItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'kullanicilar', label: 'Kullanıcılar', icon: Users },
    { id: 'sistem-ayarlari', label: 'Sistem Ayarları', icon: Settings },
  ];

  return (
    <div className="min-h-screen w-full flex bg-[#050B18] text-white">
      {/* ====================================================================
          LEFT MAIN NAVIGATION SIDEBAR (Matches Reference Visual 1:1)
      ==================================================================== */}
      <aside className="w-[244px] xl:w-[254px] flex-shrink-0 bg-gradient-to-b from-[#071124] via-[#060E1F] to-[#050B18] border-r border-white/[0.08] flex flex-col justify-between relative overflow-hidden">
        <div>
          {/* Top Brand Logo */}
          <div className="px-5 pt-5 pb-6">
            <IsiSensLogo />
          </div>

          {/* Primary Navigation Items */}
          <nav className="px-3.5 space-y-1.5">
            {primaryMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeSection(item.id)}
                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-[14px] transition-all ${
                    isActive
                      ? 'isisens-nav-active text-white font-bold'
                      : 'text-[#D0DCEF] hover:text-white hover:bg-white/[0.04] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-[18px] h-[18px] ${
                        isActive ? 'text-white' : 'text-[#AEBCCB]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#E53935] text-white shadow-[0_0_10px_rgba(229,57,53,0.6)]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="my-3 mx-5 h-[1px] bg-white/[0.08]" />

          {/* Secondary Navigation Items */}
          <nav className="px-3.5 space-y-1.5">
            {bottomMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeSection(item.id)}
                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-[14px] transition-all ${
                    isActive
                      ? 'isisens-nav-active text-white font-bold'
                      : 'text-[#D0DCEF] hover:text-white hover:bg-white/[0.04] font-medium'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] ${
                      isActive ? 'text-white' : 'text-[#AEBCCB]'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Decorative Glowing Neon Waves */}
        <SidebarNeonWaveSvg />
      </aside>

      {/* ====================================================================
          RIGHT WORKSPACE: TOP HEADER BAR + MAIN CONTENT AREA
      ==================================================================== */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="h-[68px] px-6 border-b border-white/[0.08] bg-[#060E1E]/90 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-[21px] font-extrabold text-white tracking-tight">
              IsıSens Sistem Paneli
            </h1>
            <span className="text-white/20 text-lg font-light">|</span>
            <div className="hidden md:flex items-center gap-2 text-[13px] text-[#D0DCEF] font-medium">
              <span>Operasyon</span>
              <span className="text-[#12D9E8]">•</span>
              <span>İzleme</span>
              <span className="text-[#12D9E8]">•</span>
              <span>Yönetim</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Global Search Box */}
            <div className="relative w-72 xl:w-96">
              <Search className="w-4 h-4 text-[#AEBCCB] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                placeholder="Site, blok, daire, sayaç veya kullanıcı ara..."
                className="w-full bg-[#0B162B] border border-white/15 rounded-full pl-10 pr-4 py-2 text-xs text-white placeholder-[#AEBCCB]/75 focus:outline-none focus:border-[#12D9E8]/60"
              />
            </div>

            {/* Notification Bell with Glowing Dot */}
            <button
              onClick={() => onChangeSection('ariza-uyarilar')}
              title="Arıza ve Uyarı Bildirimleri"
              className="relative w-10 h-10 rounded-full bg-[#0B162B] hover:bg-[#122240] border border-white/15 flex items-center justify-center text-[#D0DCEF] transition"
            >
              <Bell className="w-4 h-4" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF792D] absolute top-2 right-2.5 shadow-[0_0_8px_#FF792D]" />
            </button>

            <span className="text-white/15 text-lg font-light">|</span>

            {/* User Profile Pill */}
            <button
              onClick={() => setOpenLogin(true)}
              className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-white/[0.04] transition text-left"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0F2C4C] to-[#09182E] border border-[#12D9E8]/60 shadow-[0_0_12px_rgba(18,217,232,0.3)] flex items-center justify-center font-extrabold text-sm text-white">
                is
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-bold text-white">IsıSens Ekibi</div>
                <div className="text-[11px] text-[#AEBCCB]">
                  {currentUser ? `Sistem Yöneticisi (${currentUser.username})` : 'Sistem Yöneticisi'}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-[#AEBCCB] ml-0.5" />
            </button>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 overflow-x-hidden">{children}</main>
      </div>

      {/* Login / Founder Account Switcher Modal */}
      <LoginModal
        open={openLogin}
        onClose={() => setOpenLogin(false)}
        onLoggedIn={() => {
          queryClient.invalidateQueries({ queryKey: ['me'] });
          queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
        }}
      />
    </div>
  );
};

