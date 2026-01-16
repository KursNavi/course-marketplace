import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import LegalPage from './components/LegalPage';

export default function App() {
  // State: 'home', 'impressum', 'datenschutz', 'agb'
  const [currentView, setCurrentView] = useState('home');

  // Titel für SEO setzen je nach View
  useEffect(() => {
    if (currentView === 'home') {
      document.title = "KursNavi - Die Schweizer Bildungsplattform";
    } else {
      // Capitalize first letter
      document.title = `KursNavi - ${currentView.charAt(0).toUpperCase() + currentView.slice(1)}`;
      window.scrollTo(0, 0); // Nach oben scrollen bei Wechsel
    }
  }, [currentView]);

  // Die Weiche
  if (currentView !== 'home') {
    return <LegalPage pageKey={currentView} setView={setCurrentView} />;
  }

  // Standard: Landing Page
  // Wir geben 'setView' nach unten weiter
  return (
    <div className="font-sans text-gray-900">
      <LandingPage setView={setCurrentView} />
    </div>
  );
}