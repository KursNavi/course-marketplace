import React, { useEffect } from 'react';
import LandingPage from './components/LandingPage';

export default function KursNaviPro() {
  
  // Titel für SEO setzen
  useEffect(() => {
    document.title = "KursNavi - Die Schweizer Bildungsplattform";
  }, []);

  // Wir rendern NUR die statische Landing Page.
  // Keine Datenbank-Abfragen, kein Login, kein komplexes Routing hier auf Main.
  return (
    <div className="font-sans text-gray-900">
      <LandingPage />
    </div>
  );
}