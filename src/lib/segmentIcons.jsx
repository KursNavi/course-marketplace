// Linien-Icons fuer die drei Bereiche (Beruflich/Privat & Hobby/Kinder & Jugend), siehe
// public/images/brand/kursnavi/README-icons.md. Als <img>-Wrapper bereitgestellt, damit sie sich
// wie gewohnte Icon-Komponenten (<Icon className="w-4 h-4" />) einsetzen lassen — genutzt im
// Header (Layout.jsx/MegaMenu.jsx) und auf der Startseite (Home.jsx).
// Hinweis: die SVGs nutzen feste Strichfarben (kein currentColor), reagieren also NICHT auf
// Text-Farbklassen wie text-blue-600 — nur className fuer Groesse/Abstand wirkt.
export const CareerIcon = ({ className }) => (
  <img src="/images/brand/kursnavi/career.svg" alt="" aria-hidden="true" className={className} />
);

export const PrivateHobbyIcon = ({ className }) => (
  <img src="/images/brand/kursnavi/private-hobby.svg" alt="" aria-hidden="true" className={className} />
);

export const ChildrenYouthIcon = ({ className }) => (
  <img src="/images/brand/kursnavi/children-youth.svg" alt="" aria-hidden="true" className={className} />
);
