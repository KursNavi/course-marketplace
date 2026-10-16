import { CareerIcon, PrivateHobbyIcon, ChildrenYouthIcon } from './segmentIcons';

// Pro Segment: Anzeigefarbe (Beruflich=blau, Privat & Hobby=orange, Kinder & Jugend=gruen) und
// Icon. Rein praesentational — gemeinsam genutzt von Home.jsx und SearchPageView.jsx, damit
// Startseite und Suchseite exakt dieselben Bereichs-Akzente zeigen.
export const SEGMENT_VISUALS = {
  beruflich: { icon: CareerIcon, bg: 'bg-segBeruflich', text: 'text-segBeruflich', border: 'border-segBeruflich' },
  privat_hobby: { icon: PrivateHobbyIcon, bg: 'bg-primary', text: 'text-primary', border: 'border-primary' },
  kinder_jugend: { icon: ChildrenYouthIcon, bg: 'bg-segKinder', text: 'text-segKinder', border: 'border-segKinder' },
};

// Vorgeschriebene Klassen-Kombinationen (nicht per Template-String aus SEGMENT_VISUALS
// zusammengesetzt!) fuer "Alle Kurse in X anzeigen"-Buttons im Kategorie-Browser. Tailwind
// generiert Opacity-Varianten (z.B. /15, /40) nur fuer Klassen, die irgendwo im Quelltext
// woertlich vorkommen — ${segAccent.bg}/15 wuerde vom Scanner nicht erkannt.
export const SEG_SHOW_ALL_STYLES = {
  beruflich: { card: 'bg-segBeruflich/15 border-segBeruflich/40 hover:bg-segBeruflich/25', arrow: 'text-segBeruflich' },
  privat_hobby: { card: 'bg-primary/15 border-primary/40 hover:bg-primary/25', arrow: 'text-primary' },
  kinder_jugend: { card: 'bg-segKinder/15 border-segKinder/40 hover:bg-segKinder/25', arrow: 'text-segKinder' },
};

// Dieselbe Einschraenkung gilt fuer 30%/60%-Rahmenfarben an weiteren Stellen (z.B. Home.jsx
// renderRatgeberPanel, SearchPageView Breadcrumb-Akzente).
export const SEG_BORDER_30 = {
  beruflich: 'border-segBeruflich/30',
  privat_hobby: 'border-primary/30',
  kinder_jugend: 'border-segKinder/30',
};
export const SEG_BORDER_60 = {
  beruflich: 'border-segBeruflich/60',
  privat_hobby: 'border-primary/60',
  kinder_jugend: 'border-segKinder/60',
};
