import React from 'react';

const ContactPage = ({ t, setView, showNotification }) => {
    
    // LOGIC: Handle Submit (Moved from App.jsx)
    const handleContactSubmit = (e) => { 
        e.preventDefault(); 
        fetch("https://formsubmit.co/ajax/995007a94ce934b7d8c8e7776670f9c4", {
            method: "POST",
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
        })
        .then(response => response.json())
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