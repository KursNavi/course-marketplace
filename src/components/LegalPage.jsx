import React from 'react';
import { ArrowLeft, ShieldCheck, Scale, FileText, Undo2, BadgeCheck } from 'lucide-react';
import { LEGAL_CONTENT } from '../lib/legalText';

const LegalPage = ({ pageKey, lang = 'de', setView }) => {
  const langData = LEGAL_CONTENT[lang] || LEGAL_CONTENT['de'];
  const content = langData[pageKey];

  // Fallback, falls key nicht gefunden
  if (!content) {
    return (
      <div className="min-h-screen bg-[#FAF5F0] flex items-center justify-center p-10">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">Inhalt nicht gefunden</h2>
          <button onClick={() => setView('home')} className="mt-4 text-blue-600 font-bold hover:underline">Zurück zur Startseite</button>
        </div>
      </div>
    );
  }

  const getIcon = () => {
    switch (pageKey) {
      case 'agb': return <Scale className="w-8 h-8 text-blue-600" />;
      case 'datenschutz': return <ShieldCheck className="w-8 h-8 text-blue-600" />;
      case 'impressum': return <FileText className="w-8 h-8 text-blue-600" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-12 px-4 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="px-8 py-8 border-b border-gray-100 bg-white sticky top-0 z-10">
          <button 
            onClick={() => setView('home')} 
            className="inline-flex items-center text-gray-400 hover:text-blue-600 mb-6 transition-colors text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> {langData.back_btn}
          </button>
          <div className="flex items-center gap-4">
            {getIcon()}
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">{content.title}</h1>
              <p className="mt-1 text-sm text-gray-500 font-medium">{content.company}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-10 space-y-12">
          {content.sections.map((section, index) => (
            <div key={index}>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center bg-gray-50 p-2 rounded-lg">
                <span className="w-2 h-2 bg-blue-600 mr-3 rounded-full"></span>
                {section.heading}
              </h2>
              <div className="text-gray-600 leading-relaxed text-base pl-2 md:pl-5 space-y-2 whitespace-pre-line">
                {section.text}
              </div>
            </div>
          ))}
        </div>

        {/* Footer in Legal Page */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-gray-400 text-xs font-medium">{langData.updated_at}</span>
          <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">{content.company}</span>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;