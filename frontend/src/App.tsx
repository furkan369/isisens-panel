import React, { useState } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { SitelerView } from './pages/SitelerView';
import { GenelBakisView } from './pages/GenelBakisView';
import {
  BloklarView,
  SayaclarView,
  OkumalarView,
  ArizaUyarilarView,
  FaturalandirmaView,
  RaporlarView,
  KullanicilarView,
  SistemAyarlariView,
} from './pages/OperationalViews';
import type { NavSection } from './types';

export const App: React.FC = () => {
  // Default to "Siteler" with Selçuklu Park Evleri (Site 1) & A Blok (Block 1) selected
  // matching the primary reference visual `IsıSens Selçuklu Park Evleri Paneli.png`
  const [activeSection, setActiveSection] = useState<NavSection>('siteler');
  const [selectedSiteId, setSelectedSiteId] = useState<number>(1);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(1);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  return (
    <MainLayout
      activeSection={activeSection}
      onChangeSection={setActiveSection}
      globalSearch={globalSearch}
      onGlobalSearchChange={setGlobalSearch}
    >
      {activeSection === 'siteler' && (
        <SitelerView
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          globalSearch={globalSearch}
        />
      )}

      {activeSection === 'genel-bakis' && (
        <GenelBakisView
          onNavigateSite={(siteId) => {
            setSelectedSiteId(siteId);
            setSelectedBlockId(null);
            setActiveSection('siteler');
          }}
          onNavigateSection={setActiveSection}
        />
      )}

      {activeSection === 'bloklar' && (
        <BloklarView
          onOpenBlockInSiteler={(siteId, blockId) => {
            setSelectedSiteId(siteId);
            setSelectedBlockId(blockId);
            setActiveSection('siteler');
          }}
        />
      )}

      {activeSection === 'sayaclar' && <SayaclarView />}
      {activeSection === 'okumalar' && <OkumalarView />}
      {activeSection === 'ariza-uyarilar' && <ArizaUyarilarView />}
      {activeSection === 'faturalandirma' && <FaturalandirmaView />}
      {activeSection === 'raporlar' && <RaporlarView />}
      {activeSection === 'kullanicilar' && <KullanicilarView />}
      {activeSection === 'sistem-ayarlari' && <SistemAyarlariView />}
    </MainLayout>
  );
};

export default App;

