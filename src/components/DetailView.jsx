import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, User, MapPin, Clock, CheckCircle, Calendar, Shield, Lock, ExternalLink, Mail, X, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

const DetailView = ({ course, courses, setView, t, setSelectedTeacher, user }) => {
    const [showLeadModal, setShowLeadModal] = useState(false);
    const [leadStatus, setLeadStatus] = useState('idle'); // idle, submitting, success

    // SEO: Dynamic Title & Meta + Schema.org Injection
    useEffect(() => {
    if (!course) return;

    // 1. Meta Title
    document.title = `${course.title} in ${course.canton} | KursNavi`;

    // 2. Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = `Buchen Sie "${course.title}" in ${course.canton}. ${course.description ? course.description.substring(0, 150) : ''}...`;

    // 3. Canonical Link (Twin-Sync Logic)
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
        linkCanonical = document.createElement('link');
        linkCanonical.rel = "canonical";
        document.head.appendChild(linkCanonical);
    }

    // Construct EXACT URL match (Slug Logic from App.jsx)
    const topicSlug = (course.category_area || 'kurs').toLowerCase().replace(/_/g, '-');
    const locSlug = (course.canton || 'schweiz').toLowerCase();
    const titleSlug = (course.title || 'detail')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const canonicalUrl = `https://kursnavi.ch/courses/${topicSlug}/${locSlug}/${course.id}-${titleSlug}`;
    linkCanonical.href = canonicalUrl;

    // 4. Open Graph
    const setOgTag = (property, content) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute('property', property);
            document.head.appendChild(tag);
        }
        tag.setAttribute('content', content || '');
    };

    setOgTag('og:title', `${course.title} | KursNavi`);
    setOgTag('og:description', course.description ? course.description.substring(0, 150) + '...' : 'Entdecke diesen Kurs auf KursNavi.');
    setOgTag('og:image', course.image_url);
    setOgTag('og:url', canonicalUrl);
    setOgTag('og:type', 'website');

}, [course]);
    
    // LOGIC: Smart Booking Handler (v2.1)
    const handleBookingAction = async (course, eventId = null) => {
        const type = course.booking_type || 'platform';

        // 1. EXTERNAL LINK
        if (type === 'external' && course.external_link) {
            window.open(course.external_link, '_blank');
            return;
        }

        // 2. LEAD GENERATION
        if (type === 'lead') {
            setShowLeadModal(true);
            return;
        }

        // 3. PLATFORM CHECKOUT (Stripe)
        if (!user) { 
            localStorage.setItem('pendingCourseId', course.id);
            if (eventId) localStorage.setItem('pendingEventId', eventId);
            setView('login'); 
            return; 
        }

        try {
            const response = await fetch('/api/create-checkout-session', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    courseId: course.id, 
                    courseTitle: course.title, 
                    coursePrice: course.price, 
                    courseImage: course.image_url, 
                    userId: user.id,
                    eventId: eventId 
                }) 
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            window.location.href = data.url; 
        } catch (error) { 
            console.warn("Backend error (expected in demo):", error);
        }
    };

    const handleLeadSubmit = async (e) => {
        e.preventDefault();
        setLeadStatus('submitting');
        // Simulation API Call
        await new Promise(r => setTimeout(r, 1000));
        setLeadStatus('success');
        setTimeout(() => { setShowLeadModal(false); setLeadStatus('idle'); }, 2500);
    };

    // Prepare events logic
    let displayEvents = [];
    if (course.course_events && course.course_events.length > 0) {
        displayEvents = course.course_events.map(ev => {
            const bookedCount = ev.bookings && ev.bookings[0] ? ev.bookings[0].count : 0;
            const max = ev.max_participants || 0; 
            const spotsLeft = max === 0 ? 999 : max - bookedCount;
            return { ...ev, spotsLeft, isFull: max > 0 && spotsLeft <= 0 };
        }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    } else {
        displayEvents = [{ 
            id: null, 
            start_date: course.start_date, 
            location: course.address, 
            spotsLeft: 999, 
            isFull: false 
        }];
    }

    // LOGIC: Related Courses (Liquidity)
    // Filter logic: Same category_area, excludes current course, limit 4
    const relatedCourses = (courses || [])
        .filter(c => c.id !== course.id && c.category_area === course.category_area)
        .slice(0, 4);

    return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans">
        <button onClick={() => setView('search')} className="flex items-center text-gray-500 hover:text-primary mb-6"><ArrowLeft className="w-4 h-4 mr-2"/> Back to Search</button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* CLS Fix: Added explicit aspect-ratio container or min-height */}
                <div className="w-full h-80 bg-gray-100 rounded-2xl overflow-hidden shadow-lg">
                    <img 
                        src={course.image_url} 
                        className="w-full h-full object-cover transition-opacity duration-500" 
                        alt={course.title} 
                        loading="eager" 
                        width="800" 
                        height="320"
                    />
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                    <div className="flex items-center gap-3 mb-4">
                        <h1 className="text-3xl font-bold font-heading text-dark">{course.title}</h1>
                        {course.is_pro && (
                            <div className="flex flex-col items-start gap-1">
                                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center shadow-sm">
                                    <CheckCircle className="w-3 h-3 mr-1" /> Professional
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
                        <button 
                            onClick={async () => {
                                const { data } = await supabase.from('profiles').select('*').eq('id', course.user_id).single();
                                if (data) { setSelectedTeacher(data); setView('teacher-profile'); window.scrollTo(0,0); }
                            }}
                            className="flex items-center bg-gray-50 px-3 py-1 rounded-full hover:bg-orange-50 hover:text-primary transition-colors cursor-pointer"
                        >
                            <User className="w-4 h-4 mr-2"/> {course.instructor_name} (Profil ansehen)
                        </button>
                        <span className="flex items-center bg-gray-50 px-3 py-1 rounded-full">
                            <MapPin className="w-4 h-4 mr-2 text-primary"/> 
                            {course.address || course.city || course.canton}
                        </span>
                        <span className="flex items-center bg-gray-50 px-3 py-1 rounded-full"><Clock className="w-4 h-4 mr-2"/> {course.session_count} x {course.session_length}</span>
                    </div>
                    <div className="prose max-w-none text-gray-600 custom-rich-text">
                        <h3 className="text-xl font-bold text-dark mb-4 border-b pb-2">{t.lbl_description}</h3>
                        <div className="space-y-4 mb-12">
                            {course.description ? course.description.split('\n').map((line, index) => {
                                // Bold: **text**
                                let formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-dark font-bold">$1</strong>');
                                // Italics: *text*
                                formattedLine = formattedLine.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
                                // Underline: __text__
                                formattedLine = formattedLine.replace(/__(.*?)__/g, '<u class="underline">$1</u>');
                                
                                // Bullet Points: Starts with "- " or "* "
                                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                                    return <li key={index} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^[-*]\s/, '') }} />;
                                }
                                // H2: Starts with "## "
                                if (line.startsWith('## ')) {
                                    return <h2 key={index} className="text-2xl font-bold text-dark mt-6 mb-2" dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^##\s/, '') }} />;
                                }
                                // H3: Starts with "### "
                                if (line.startsWith('### ')) {
                                    return <h3 key={index} className="text-xl font-bold text-dark mt-4 mb-2" dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^###\s/, '') }} />;
                                }
                                // Regular Paragraph
                                return formattedLine.trim() ? <p key={index} dangerouslySetInnerHTML={{ __html: formattedLine }} /> : <br key={index} />;
                            }) : <p>{t.lbl_no_description}</p>}
                        </div>

                        <h3 className="text-xl font-bold text-dark mb-2">{t.lbl_learn_goals}</h3>
                        <ul className="list-disc pl-5 space-y-1 mb-10">
                            {course.objectives && course.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                        </ul>

                        {/* NEU: Erweitere Anbieter-Informationen */}
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mt-12">
                            <h3 className="text-xl font-bold text-dark mb-6 flex items-center">
                                <User className="w-5 h-5 mr-2 text-primary" /> 
                                Über den Anbieter: {course.instructor_name}
                            </h3>
                            
                            {/* Dynamische Biografie des Lehrers */}
                            <div className="text-gray-600 mb-6 whitespace-pre-wrap italic">
                                {course.instructor_bio || "Erfahrener Kursanbieter auf KursNavi."}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Zertifikate */}
                                {course.instructor_certificates && course.instructor_certificates.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-sm uppercase tracking-wider text-gray-500 mb-3 flex items-center">
                                            <Shield className="w-4 h-4 mr-2 text-blue-500" /> Qualifikationen
                                        </h4>
                                        <ul className="space-y-2">
                                            {course.instructor_certificates.map((cert, i) => (
                                                <li key={i} className="text-sm flex items-start">
                                                    <CheckCircle className="w-4 h-4 mr-2 text-green-500 shrink-0 mt-0.5" />
                                                    {cert}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Standorte */}
                                <div>
                                    <h4 className="font-bold text-sm uppercase tracking-wider text-gray-500 mb-3 flex items-center">
                                        <MapPin className="w-4 h-4 mr-2 text-primary" /> Verfügbarkeit & Standorte
                                    </h4>
                                    <p className="text-sm font-bold text-dark">Hauptsitz: {course.city || course.canton}</p>
                                    {course.additional_locations && (
                                        <p className="text-sm text-gray-600 mt-1">
                                            Weitere Standorte: <span className="italic">{course.additional_locations}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-24">
                    <div className="text-3xl font-bold text-primary font-heading mb-2">CHF {course.price}</div>
                    <p className="text-gray-500 text-sm mb-6">per person</p>
                    
                    <h3 className="font-bold text-dark mb-3">Available Sessions</h3>
                    <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-1">
                        {displayEvents.map((ev, i) => (
                            <div key={i} className={`p-4 rounded-xl border transition ${ev.isFull ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-blue-100 hover:border-blue-300 hover:shadow-md'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <span className="flex items-center text-dark font-bold">
                                            <Calendar className="w-4 h-4 mr-2 text-primary"/>
                                            {ev.start_date ? new Date(ev.start_date).toLocaleDateString() : 'Flexible'}
                                        </span>
                                        {ev.schedule_description && (
                                            <span className="text-xs text-gray-500 ml-6 mt-0.5">{ev.schedule_description}</span>
                                        )}
                                    </div>
                                    {ev.isFull ? (
                                        <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded whitespace-nowrap">SOLD OUT</span>
                                    ) : (
                                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded whitespace-nowrap">{ev.spotsLeft > 50 ? 'Available' : `${ev.spotsLeft} left`}</span>
                                    )}
                                </div>
                                <div className="flex items-center text-gray-500 text-sm mb-3 ml-6">
                                    <MapPin className="w-3 h-3 mr-1"/> {ev.location || course.address}
                                </div>
                                <button 
                                onClick={() => !ev.isFull && handleBookingAction(course, ev.id)} 
                                disabled={ev.isFull && course.booking_type === 'platform'}
                                className={`w-full py-2 rounded-lg font-bold text-sm transition flex items-center justify-center 
                                    ${(ev.isFull && course.booking_type === 'platform') 
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                        : 'bg-primary text-white hover:bg-orange-600 shadow-sm'}`}
                            >
                                {course.booking_type === 'external' && <ExternalLink className="w-4 h-4 mr-2" />}
                                {course.booking_type === 'lead' && <Mail className="w-4 h-4 mr-2" />}

                                {(ev.isFull && course.booking_type === 'platform') ? 'Ausgebucht' : 
                                 (course.booking_type === 'external' ? 'Zur Anbieter-Webseite' : 
                                 (course.booking_type === 'lead' ? 'Kurs anfragen' : t.btn_book))}
                            </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 space-y-4 text-sm text-gray-600 border-t pt-4">
                        <div className="flex items-center"><Shield className="w-5 h-5 mr-3 text-green-500"/> Secure Payment</div>
                        <div className="flex items-center"><CheckCircle className="w-5 h-5 mr-3 text-blue-500"/> Instant Confirmation</div>
                    </div>
                </div>
            </div>
        </div>

        {/* RELATED COURSES (Liquidity Engine) */}
        {relatedCourses.length > 0 && (
            <div className="mt-16 pt-10 border-t border-gray-200">
                <h2 className="text-2xl font-bold font-heading text-dark mb-6">Das könnte dich auch interessieren</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {relatedCourses.map(rel => (
                         <div key={rel.id} 
                              onClick={() => { 
                                  // Use standard navigation to trigger URL update in App.jsx
                                  const topicSlug = (rel.category_area || 'kurs').toLowerCase().replace(/_/g, '-');
                                  const locSlug = (rel.canton || 'schweiz').toLowerCase();
                                  const titleSlug = (rel.title || 'detail').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                                  window.history.pushState({}, '', `/courses/${topicSlug}/${locSlug}/${rel.id}-${titleSlug}`);
                                  // Force reload of view since we are already in detail view (simple state update might not trigger useEffect correctly if logic relies on selectedCourse change alone)
                                  window.location.href = `/courses/${topicSlug}/${locSlug}/${rel.id}-${titleSlug}`;
                              }} 
                              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md cursor-pointer group"
                         >
                            <div className="h-40 overflow-hidden relative">
                                <img src={rel.image_url} alt={rel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                                <span className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 rounded text-xs font-bold text-gray-700 flex items-center shadow-sm">
                                    <MapPin className="w-3 h-3 mr-1 text-primary"/> {rel.canton}
                                </span>
                            </div>
                            <div className="p-4">
                                <h4 className="font-bold text-dark text-sm line-clamp-2 h-10 mb-2 font-heading">{rel.title}</h4>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>{rel.category_area?.replace('_', ' ')}</span>
                                    <span className="font-bold text-primary">CHF {rel.price}</span>
                                </div>
                            </div>
                         </div>
                    ))}
                </div>
            </div>
        )}
        
        {/* SEO: Structured Data (JSON-LD) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Course",
            "name": course.title,
            "description": course.description,
            "provider": {
                "@type": "Organization",
                "name": course.instructor_name,
                "sameAs": `https://kursnavi.ch/teacher/${course.user_id}`
            },
            "hasCourseInstance": (course.course_events || []).map(ev => ({
                "@type": "EducationEvent",
                "startDate": ev.start_date,
                "location": {
                    "@type": "Place",
                    "name": ev.location || course.address,
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": course.canton
                    }
                },
                "offers": {
                "@type": "Offer",
                "price": course.price,
                "priceCurrency": "CHF",
                "availability": (course.booking_type === 'platform' && ev.max_participants > 0 && (ev.max_participants - (ev.bookings?.[0]?.count || 0)) <= 0) 
                    ? "https://schema.org/SoldOut" 
                    : "https://schema.org/InStock",
                "url": course.booking_type === 'external' ? course.external_link : window.location.href
            }
        }))
    })}} />

    {/* LEAD FORM MODAL */}
    {showLeadModal && (
        <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in duration-200">
                <button onClick={() => setShowLeadModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-dark"><X className="w-6 h-6"/></button>

                {leadStatus === 'success' ? (
                    <div className="text-center py-8">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold font-heading mb-2">Anfrage gesendet!</h3>
                        <p className="text-gray-600">Der Anbieter wird sich in Kürze bei dir melden.</p>
                    </div>
                ) : (
                    <>
                        <h3 className="text-xl font-bold mb-2 font-heading">Kurs unverbindlich anfragen</h3>
                        <p className="text-sm text-gray-600 mb-6">Sende eine Nachricht direkt an {course.instructor_name}.</p>
                        <form onSubmit={handleLeadSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dein Name</label>
                                <input name="name" required defaultValue={user?.name || ''} className="w-full p-3 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-primary outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deine Email</label>
                                <input name="email" type="email" required defaultValue={user?.email || ''} className="w-full p-3 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-primary outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nachricht</label>
                                <textarea name="message" rows="3" defaultValue={`Ich interessiere mich für den Kurs "${course.title}". Ist noch ein Platz frei?`} className="w-full p-3 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-primary outline-none transition"></textarea>
                            </div>
                            <button type="submit" disabled={leadStatus === 'submitting'} className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition flex items-center justify-center disabled:opacity-50">
                                {leadStatus === 'submitting' ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : <><Send className="w-4 h-4 mr-2"/> Anfrage absenden</>}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )}

</div>
);
};

export default DetailView;