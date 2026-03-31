import React, { useEffect } from 'react';
import { BASE_URL } from '../lib/siteConfig';

const ContactPage = ({ t, setView, showNotification }) => {
    useEffect(() => {
        document.title = 'Kontakt – KursNavi';

        let metaTag = document.querySelector('meta[name="description"]');
        if (!metaTag) {
            metaTag = document.createElement('meta');
            metaTag.name = 'description';
            document.head.appendChild(metaTag);
        }
        metaTag.content = 'Schreib uns – wir helfen dir bei Fragen zu Kursen, Buchungen oder deinem Anbieter-Account auf KursNavi.';

        let canonicalTag = document.querySelector('link[rel="canonical"]');
        if (!canonicalTag) {
            canonicalTag = document.createElement('link');
            canonicalTag.rel = 'canonical';
            document.head.appendChild(canonicalTag);
        }
        canonicalTag.href = `${BASE_URL}/contact`;
    }, []);
    
    // LOGIC: Handle Submit
    const handleContactSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        fetch("/api/contact", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'contact',
                name: formData.get('name'),
                email: formData.get('email'),
                subject: formData.get('subject'),
                message: formData.get('message'),
                _company: formData.get('_company') || ''
            })
        })
        .then(response => {
            if (!response.ok) return response.json().then(d => { throw new Error(d.error); });
            return response.json();
        })
        .then(data => {
              if (typeof showNotification === 'function') showNotification(t.success_msg || "Message sent!");
              window.history.pushState({ view: 'home' }, '', '/');
        })
        .catch(error => {
            console.error("Error:", error);
            if (typeof showNotification === 'function') showNotification("Error sending message. Please email us directly.");
        });
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-16 font-sans">
            <h1 className="text-4xl font-bold text-center text-dark font-heading mb-8">{t.contact_title}</h1>
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <form onSubmit={handleContactSubmit} className="space-y-6">
                    <input type="text" name="_company" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_name}</label><input type="text" name="name" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"/></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_email}</label><input type="email" name="email" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"/></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_subject}</label><input type="text" name="subject" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"/></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_msg}</label><textarea name="message" rows="5" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"></textarea></div>
                    <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition">{t.btn_send}</button>
                </form>
            </div>
        </div>
    );
};

export default ContactPage;