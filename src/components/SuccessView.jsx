import React from 'react';
import { CheckCircle, Info } from 'lucide-react';

const SuccessView = ({ setView, t = {} }) => (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-100 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-600" /></div>
            <h2 className="text-3xl font-bold text-dark mb-4 font-heading">{t.payment_successful || 'Zahlung erfolgreich!'}</h2>
            <p className="text-gray-600 mb-4 font-sans">{t.booking_thanks || 'Danke fuer deine Buchung. Du erhaeltst in Kuerze eine Bestaetigungs-E-Mail.'}</p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-left">
                <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-700">
                        {t.booking_success_note || 'Kostenlose Stornierung ist je nach Kursart und Termin bis zu 7 Tage nach Buchung bzw. gemaess den Stornobedingungen vor dem Termin moeglich. Details findest du im Dashboard.'}
                    </p>
                </div>
            </div>
            <button onClick={() => { window.history.replaceState({}, document.title, window.location.pathname); setView('dashboard'); }} className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition font-heading">{t.go_to_my_courses || 'Zu meinen Kursen'}</button>
        </div>
    </div>
);

export default SuccessView;
