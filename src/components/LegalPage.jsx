import React from 'react';
import { ArrowLeft, ShieldCheck, Scale, FileText, Undo2, BadgeCheck } from 'lucide-react';
import { LEGAL_CONTENT } from '../lib/legalText';

const LegalPage = ({ pageKey, lang = 'de', setView }) => {
  const langData = LEGAL_CONTENT[lang] || LEGAL_CONTENT['de'];
  const content = langData[pageKey];

  if (!content) {
    return (
      <div className="min-h-screen bg-[#FAF5F0] flex items-center justify-center p-10">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">Content not found</h2>
          <button onClick={() => {
            setView('home');
            window.history.pushState({ view: 'home' }, '', '/');
          }} className="mt-4 text-[#FA6E28] font-bold">Back to Home</button>
        </div>
      </div>
    );
  }

  const getIcon = () => {
    switch (pageKey) {
      case 'agb': return <Scale className="w-8 h-8 text-[#FA6E28]" />;
      case 'datenschutz': return <ShieldCheck className="w-8 h-8 text-[#FA6E28]" />;
      case 'impressum': return <FileText className="w-8 h-8 text-[#FA6E28]" />;
      case 'widerruf': return <Undo2 className="w-8 h-8 text-[#FA6E28]" />;
      case 'trust': return <BadgeCheck className="w-8 h-8 text-[#FA6E28]" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF5F0] py-12 px-4 font-['Hind_Madurai']">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="px-8 py-8 border-b border-gray-100 bg-white sticky top-0 z-10">
          <button onClick={() => {
            setView('home');
            window.history.pushState({ view: 'home' }, '', '/');
          }} className="inline-flex items-center text-gray-400 hover:text-[#FA6E28] mb-6 transition-colors text-sm font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" /> {langData.back_btn}
          </button>
          <div className="flex items-center gap-4">
            {getIcon()}
            <div>
              <h1 className="text-3xl font-extrabold text-[#333333] font-['Open_Sans']">{content.title}</h1>
              <p className="mt-1 text-sm text-gray-500 font-medium">{content.company}</p>
            </div>
          </div>
          {content.intro && <p className="mt-4 text-gray-600 italic border-l-4 border-orange-100 pl-3">{content.intro}</p>}
        </div>

        {/* Content */}
        <div className="px-8 py-10 space-y-12">
          {content.sections.map((section, index) => (
            <div key={index} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
              <h2 className="text-lg font-bold text-[#333333] mb-4 font-['Open_Sans'] flex items-center bg-gray-50 p-2 rounded-lg">
                <span className="w-2 h-2 bg-[#FA6E28] mr-3 rounded-full"></span>
                {section.heading}
              </h2>
              <div className="text-gray-600 leading-relaxed text-base pl-2 md:pl-5 space-y-2">
                {section.text.split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('•') || line.startsWith('-') ? "pl-4 text-gray-800 font-medium" : ""}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-gray-400 text-xs font-medium">{langData.updated_at}</span>
          <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">{content.company}</span>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;