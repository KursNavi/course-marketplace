import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_CONTENT } from '../lib/legalData';

// This component expects a prop called "pageKey" (e.g., 'agb', 'impressum')
const LegalPage = ({ pageKey }) => {
  const content = LEGAL_CONTENT[pageKey];

  if (!content) {
    return <div className="p-10 text-center">Inhalt nicht gefunden.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white shadow sm:rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-white px-4 py-5 border-b border-gray-200 sm:px-6">
          <h1 className="text-2xl font-bold leading-6 text-gray-900">
            {content.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {content.company}
          </p>
        </div>

        {/* Content Body */}
        <div className="px-4 py-5 sm:p-6 space-y-8">
          {content.sections.map((section, index) => (
            <div key={index}>
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                {section.heading}
              </h2>
              <div className="prose prose-sm text-gray-500 whitespace-pre-line">
                {section.text}
              </div>
            </div>
          ))}
        </div>

        {/* Footer of the card */}
        <div className="px-4 py-4 sm:px-6 bg-gray-50 border-t border-gray-200 flex justify-between">
          <Link to="/" className="text-indigo-600 hover:text-indigo-900 font-medium">
            &larr; Zurück zur Startseite
          </Link>
          <span className="text-gray-400 text-sm">LifeSkills360 GmbH</span>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;