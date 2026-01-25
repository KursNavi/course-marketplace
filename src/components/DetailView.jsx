import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, MapPin, Clock, CheckCircle, Calendar, Shield, ExternalLink, Mail, X, Send, Map, Info, Loader, Bookmark, BookmarkCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

const DetailView = ({ course, courses, setView, t, setSelectedTeacher, user, savedCourseIds, onToggleSaveCourse, showNotification }) => {
    const [showLeadModal, setShowLeadModal] = useState(false);
    const [leadStatus, setLeadStatus] = useState('idle'); // idle, submitting, success

    const [showSavePrompt, setShowSavePrompt] = useState(false);
    const [pendingExternalUrl, setPendingExternalUrl] = useState(null);

    const isSaved = (savedCourseIds || []).includes(course?.id);

    // --- HELPER: Consistent Price Labeling ---
    const getPriceLabel = (c) => {
        if (!c) return '';
        const type = c.booking_type || 'platform';
        const price = Number(c.price) || 0; 

        if (type === 'lead' && price === 0) return 'Preis auf Anfrage';
        if (type === 'external' && price === 0) return 'Siehe Webseite';
        if (price === 0) return 'Kostenlos';
        return `CHF ${price}`;
    };

    // --- SECURITY: XSS Protection & Parsing ---
    const escapeHtml = (text) => {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const parseInlineStyles = (text) => {
        let html = escapeHtml(text);
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); 
        html = html.replace(/__(.+?)__/g, '<u>$1</u>'); 
        html = html.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
        return html;
    };

    // --- SEO & SCHEMA (v4.0: Critical SEO Audit Fixes) ---
    useEffect(() => {
        if (!course) return;

        const locationLabel = course.canton || 'Schweiz';
        document.title = `${course.title} in ${locationLabel} | KursNavi`;

        const topicSlug = (course.category_area || 'kurs').toLowerCase().replace(/_/g, '-');
        const locSlug = (course.canton || 'schweiz').toLowerCase();
        const titleSlug = (course.title || 'detail').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const canonicalUrl = `https://kursnavi.ch/courses/${topicSlug}/${locSlug}/${course.id}-${titleSlug}`;

        // --- FIX 1: Dynamic Meta Description ---
        const metaDescription = `${course.title} in ${locationLabel} - ${(course.description || '').substring(0, 155)}...`;
        let metaDescTag = document.querySelector('meta[name="description"]');
        if (!metaDescTag) {
            metaDescTag = document.createElement('meta');
            metaDescTag.name = 'description';
            document.head.appendChild(metaDescTag);
        }
        metaDescTag.content = metaDescription;

        // --- FIX 2: Canonical Link Tag (HTML) ---
        let canonicalTag = document.querySelector('link[rel="canonical"]');
        if (!canonicalTag) {
            canonicalTag = document.createElement('link');
            canonicalTag.rel = 'canonical';
            document.head.appendChild(canonicalTag);
        }
        canonicalTag.href = canonicalUrl;

        // --- FIX 2b: hreflang Tags (Multilingual) ---
        const languages = ['de', 'fr', 'it', 'en'];
        const baseHref = `/courses/${topicSlug}/${locSlug}/${course.id}-${titleSlug}`;

        // Remove existing hreflang tags
        document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(tag => tag.remove());

        // Add hreflang for each language
        languages.forEach(langCode => {
            const hreflangTag = document.createElement('link');
            hreflangTag.rel = 'alternate';
            hreflangTag.hreflang = langCode;
            hreflangTag.href = langCode === 'de'
                ? `https://kursnavi.ch${baseHref}`
                : `https://kursnavi.ch/${langCode}${baseHref}`;
            document.head.appendChild(hreflangTag);
        });

        // Add x-default
        const xDefaultTag = document.createElement('link');
        xDefaultTag.rel = 'alternate';
        xDefaultTag.hreflang = 'x-default';
        xDefaultTag.href = `https://kursnavi.ch${baseHref}`;
        document.head.appendChild(xDefaultTag);

        // --- FIX 3: Open Graph Tags (Social Sharing) ---
        const ogTags = {
            'og:title': `${course.title} in ${locationLabel}`,
            'og:description': metaDescription,
            'og:url': canonicalUrl,
            'og:image': course.image_url || 'https://kursnavi.ch/og-default.jpg',
            'og:type': 'website',
            'og:site_name': 'KursNavi',
            'twitter:card': 'summary_large_image',
            'twitter:title': `${course.title} in ${locationLabel}`,
            'twitter:description': metaDescription,
            'twitter:image': course.image_url || 'https://kursnavi.ch/og-default.jpg'
        };

        Object.entries(ogTags).forEach(([property, content]) => {
            let tag = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
            if (!tag) {
                tag = document.createElement('meta');
                if (property.startsWith('twitter:')) {
                    tag.name = property;
                } else {
                    tag.setAttribute('property', property);
                }
                document.head.appendChild(tag);
            }
            tag.content = content;
        });

        // --- FIX 4: SEO-Smart Price Logic ---
        const priceVal = Number(course.price);
        const isPlatform = course.booking_type === 'platform';
        const hasValidPrice = !isNaN(priceVal) && (priceVal > 0 || isPlatform);

        // --- FIX 5: Dynamic Availability Status ---
        let availability = "https://schema.org/InStock"; // Default

        // Check course_events for sold-out status
        let rawEvents = [];
        if (course.course_events && course.course_events.length > 0) {
            rawEvents = course.course_events;
        } else if (course.start_date) {
            rawEvents = [{
                start_date: course.start_date,
                max_participants: 0,
                bookings: []
            }];
        }

        // Calculate if ALL events are full
        const allEventsFull = rawEvents.length > 0 && rawEvents.every(ev => {
            const max = ev.max_participants || 0;
            if (max === 0) return false; // Unlimited
            const bookedCount = Array.isArray(ev.bookings)
                ? (ev.bookings[0]?.count || ev.bookings.length)
                : (ev.bookings?.count || 0);
            return bookedCount >= max;
        });

        if (allEventsFull) {
            availability = "https://schema.org/SoldOut";
        }

        // --- FIX 6: Hybrid Schema (Course + EducationEvent) ---
        const schemaData = {
            "@context": "https://schema.org",
            "@type": ["Course", "EducationEvent"], // Hybrid!
            "name": course.title,
            "description": course.description,
            "provider": {
                "@type": "Organization",
                "name": course.instructor_name,
                "sameAs": `https://kursnavi.ch/teacher/${course.user_id}`
            },
            "location": {
                "@type": "Place",
                "name": course.address || course.city || locationLabel,
                "address": {
                    "@type": "PostalAddress",
                    "addressRegion": locationLabel,
                    "addressCountry": "CH"
                }
            },
            "offers": {
                "@type": "Offer",
                "priceCurrency": "CHF",
                "availability": availability,
                "url": canonicalUrl
            }
        };

        if (hasValidPrice) {
            schemaData.offers.price = priceVal;
        }

        // Add Event-specific fields if we have course_events
        if (rawEvents.length > 0 && rawEvents[0].start_date) {
            const nextEvent = rawEvents.find(e => new Date(e.start_date) > new Date()) || rawEvents[0];
            schemaData.startDate = nextEvent.start_date;

            // Add eventSchedule for recurring courses
            if (rawEvents.length > 1) {
                schemaData.eventSchedule = rawEvents.map(ev => ({
                    "@type": "Schedule",
                    "startDate": ev.start_date,
                    "scheduleTimezone": "Europe/Zurich"
                }));
            }
        }

        // Add course-specific fields
        if (course.session_length) {
            schemaData.timeRequired = `${course.session_count}x ${course.session_length}`;
        }

        if (course.category_area) {
            schemaData.educationalLevel = course.category_area.replace(/_/g, ' ');
        }

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.text = JSON.stringify(schemaData);
        document.head.appendChild(script);

        // --- FIX 7: BreadcrumbList Schema ---
        const breadcrumbData = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://kursnavi.ch"
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": course.category_area ? course.category_area.replace(/_/g, ' ') : 'Kurse',
                    "item": `https://kursnavi.ch/courses/${topicSlug}/${locSlug}/`
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": course.title
                }
            ]
        };

        const breadcrumbScript = document.createElement('script');
        breadcrumbScript.type = 'application/ld+json';
        breadcrumbScript.text = JSON.stringify(breadcrumbData);
        document.head.appendChild(breadcrumbScript);

        return () => {
            // Cleanup
            if (script.parentNode) script.parentNode.removeChild(script);
            if (breadcrumbScript.parentNode) breadcrumbScript.parentNode.removeChild(breadcrumbScript);
        }
    }, [course]);
    
    // --- SMART BOOKING HANDLER ---
    const handleBookingAction = async (courseEvent = null) => {
        const type = course.booking_type || 'platform';

        if (type === 'external') {
            if (course.external_link) {
                if (isSaved) {
                    window.open(course.external_link, '_blank');
                } else {
                    setPendingExternalUrl(course.external_link);
                    setShowSavePrompt(true);
                }
            }
            return; 
        }

        if (type === 'lead') {
            setShowLeadModal(true);
            return;
        }

        if (type === 'platform' && !courseEvent) return; 

        if (!user) { 
            localStorage.setItem('pendingCourseId', course.id);
            if (courseEvent?.id) localStorage.setItem('pendingEventId', courseEvent.id);
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
                    coursePrice: Number(course.price) || 0, 
                    courseImage: course.image_url, 
                    userId: user.id,
                    eventId: courseEvent?.id 
                }) 
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            window.location.href = data.url; 
        } catch (error) { 
            console.warn("Backend error (Simulated):", error);
            alert("Checkout Simulation (Dev Mode)");
        }
    };

    const handleLeadSubmit = async (e) => {
        e.preventDefault();
        setLeadStatus('submitting');
        await new Promise(r => setTimeout(r, 1000));
        setLeadStatus('success');
        setTimeout(() => { setShowLeadModal(false); setLeadStatus('idle'); }, 2500);
    };

    // Fix 2: Safety Guard (Render Check)
    if (!course) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Loader className="w-8 h-8 text-primary animate-spin"/></div>;
    }

    // --- DATA PREPARATION ---
    let rawEvents = [];
    if (course.course_events && course.course_events.length > 0) {
        rawEvents = course.course_events;
    } else if (course.start_date) {
        rawEvents = [{
            id: null, 
            start_date: course.start_date,
            location: course.address || course.canton || '',
            canton: course.canton,
            schedule_description: '',
            max_participants: 0,
            bookings: [] 
        }];
    }

    const displayEvents = rawEvents.map(ev => {
        let bookedCount = 0;
        if (Array.isArray(ev.bookings)) {
            if (ev.bookings[0] && typeof ev.bookings[0].count === 'number') {
                bookedCount = ev.bookings[0].count; 
            } else {
                bookedCount = ev.bookings.length; 
            }
        } else if (typeof ev.bookings === 'object' && ev.bookings !== null && typeof ev.bookings.count === 'number') {
            bookedCount = ev.bookings.count; 
        } else if (typeof ev.bookings === 'number') {
            bookedCount = ev.bookings; 
        }

        const max = ev.max_participants || 0; 
        const isUnlimited = max === 0;
        const spotsLeft = isUnlimited ? null : (max - bookedCount);
        const isFull = !isUnlimited && spotsLeft <= 0;

        return { ...ev, spotsLeft, isFull, isUnlimited };
    }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    const hasEvents = displayEvents.length > 0;

    // --- RENDER HELPERS ---
    const renderDescription = (text) => {
        if (!text) return <p>{t.lbl_no_description}</p>;
        
        const lines = text.split('\n');
        const out = [];
        let listItems = []; 

        const flushList = () => {
            if (listItems.length > 0) {
                out.push(
                    <ul key={`ul-${out.length}`} className="list-disc pl-5 space-y-1 mb-4">
                        {listItems}
                    </ul>
                );
                listItems = [];
            }
        };

        lines.forEach((line, index) => {
            const content = line.trim();

            if (content.startsWith('- ') || content.startsWith('* ')) {
                const itemText = content.replace(/^[-*]\s/, '');
                listItems.push(
                    <li key={`li-${index}`} dangerouslySetInnerHTML={{ __html: parseInlineStyles(itemText) }} />
                );
                return; 
            }

            flushList();

            if (!content) {
                out.push(<br key={`br-${index}`} />);
                return;
            }

            if (content.startsWith('## ')) {
                out.push(<h2 key={`h2-${index}`} className="text-2xl font-bold text-dark mt-6 mb-2">{content.replace(/^##\s/, '')}</h2>);
                return;
            }
            if (content.startsWith('### ')) {
                out.push(<h3 key={`h3-${index}`} className="text-xl font-bold text-dark mt-4 mb-2">{content.replace(/^###\s/, '')}</h3>);
                return;
            }

            out.push(
                <p key={`p-${index}`} className="mb-2" dangerouslySetInnerHTML={{ __html: parseInlineStyles(content) }} />
            );
        });

        flushList(); 
        return out;
    };

    // --- RANKING ENGINE (V3.0) ---
    const getRankingScore = (candidate) => {
        // 1. Plan Factor (Basic=1.0, Pro=1.2)
        const isPro = candidate.is_pro || false;
        const planFactor = isPro ? 1.2 : 1.0;

        // 2. Booking Factor
        // Lead/External: 1.0 | Basic+Booking: 1.3 | Pro+Booking: 1.2
        const isBookable = candidate.booking_type === 'platform';
        let bookingFactor = 1.0;
        if (isBookable) {
            bookingFactor = isPro ? 1.2 : 1.3;
        }

        // 3. Relevance (Word Match Boost)
        let relevanceScore = 1.0; // Basis
        const currentWords = (course.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const candidateWords = (candidate.title || '').toLowerCase().split(/\s+/);
        const overlap = candidateWords.filter(w => currentWords.includes(w)).length;
        relevanceScore += Math.min(0.5, overlap * 0.1); // Max +0.5 Bonus für Text-Matches

        // 4. Freshness (Newer = Better)
        const dateCreated = candidate.created_at ? new Date(candidate.created_at) : new Date('2024-01-01');
        const daysOld = (new Date() - dateCreated) / (1000 * 60 * 60 * 24);
        const freshnessScore = Math.max(0, 1 - (daysOld / 365)); // 1.0 = brand new

        // 5. Time Score (Next Event proximity)
        let timeScore = 0.5; // Neutral default
        if (candidate.course_events && candidate.course_events.length > 0) {
            const nextEvent = candidate.course_events.find(e => new Date(e.start_date) > new Date());
            if (nextEvent) {
                const daysToEvent = (new Date(nextEvent.start_date) - new Date()) / (1000 * 60 * 60 * 24);
                if (daysToEvent < 14) timeScore = 1.0;      // < 2 Weeks
                else if (daysToEvent < 60) timeScore = 0.8; // < 2 Months
            }
        }

        // 6. Epsilon Randomness (-0.03 to +0.03)
        const epsilon = (Math.random() * 0.06) - 0.03;

        // Final Score Calculation
        return relevanceScore 
            * planFactor 
            * bookingFactor 
            * (0.5 + 0.5 * timeScore) 
            * (0.6 + 0.4 * freshnessScore) 
            * (1 + epsilon);
    };

    // Filter & Sort Logic: Priority same Category -> then fill with others
    const candidates = (courses || []).filter(c => c.id !== course.id);
    const sameCategory = candidates.filter(c => c.category_area === course.category_area);
    const otherCategory = candidates.filter(c => c.category_area !== course.category_area);

    const rankedSame = sameCategory.map(c => ({...c, score: getRankingScore(c)})).sort((a,b) => b.score - a.score);
    const rankedOther = otherCategory.map(c => ({...c, score: getRankingScore(c)})).sort((a,b) => b.score - a.score);

    // Take all from same category, then fill up to 5 with others
    const relatedCourses = [...rankedSame, ...rankedOther].slice(0, 5);

    const fallbackImage = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1200";

    return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans animate-in fade-in duration-500">
        <button onClick={() => window.location.href = '/search'} className="flex items-center text-gray-500 hover:text-primary mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2"/> Zurück zur Suche</button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="w-full h-80 bg-gray-100 rounded-2xl overflow-hidden shadow-lg relative group">
                    <img
                        src={course.image_url || fallbackImage}
                        alt={`${course.title} in ${course.canton || 'Schweiz'}`}
                        loading="eager"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                    <div className="absolute top-4 left-4 flex gap-2">
                        <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center">
                            <MapPin className="w-3 h-3 mr-1 text-primary"/> {course.canton}
                        </span>
                        {course.booking_type === 'lead' && (
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">Preis auf Anfrage</span>
                        )}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h1 className="text-3xl font-bold font-heading text-dark">{course.title}</h1>
                        {course.is_pro && (
                            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center self-start md:self-auto border border-blue-100">
                                <CheckCircle className="w-3 h-3 mr-1" /> Professional
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-8 pb-8 border-b border-gray-100">
                        <button 
                            onClick={async () => {
                                const { data } = await supabase.from('profiles').select('*').eq('id', course.user_id).single();
                                if (data) { setSelectedTeacher(data); setView('teacher-profile'); window.scrollTo(0,0); }
                            }}
                            className="flex items-center hover:bg-orange-50 px-3 py-1.5 rounded-lg -ml-3 transition-colors cursor-pointer"
                        >
                            <User className="w-4 h-4 mr-2 text-gray-400"/> 
                            <span className="underline decoration-gray-300 hover:decoration-primary">{course.instructor_name}</span>
                        </button>
                        <span className="flex items-center px-3 py-1.5">
                            <MapPin className="w-4 h-4 mr-2 text-gray-400"/> 
                            {course.address || course.city || course.canton}
                        </span>
                        {course.session_length && (
                            <span className="flex items-center px-3 py-1.5">
                                <Clock className="w-4 h-4 mr-2 text-gray-400"/> 
                                {course.session_count}x {course.session_length}
                            </span>
                        )}
                    </div>

                    <div className="prose max-w-none text-gray-600 custom-rich-text">
                        <h3 className="text-xl font-bold text-dark mb-4">{t.lbl_description}</h3>
                        {renderDescription(course.description)}

                        <h3 className="text-xl font-bold text-dark mb-4">{t.lbl_learn_goals}</h3>
                        <ul className="list-disc pl-5 space-y-2 mb-8">
                            {course.objectives && course.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                        </ul>
                        
                        {course.prerequisites && (
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-sm text-orange-900 flex items-start gap-3">
                                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold block mb-1">{t.lbl_prereq}</span>
                                    {course.prerequisites}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-24">
                    <div className="text-3xl font-bold text-primary font-heading mb-1">{getPriceLabel(course)}</div>
                    <p className="text-gray-400 text-xs mb-4">
                        {course.booking_type === 'platform' ? 'pro Person inkl. MwSt.' : 'Unverbindliche Preisangabe'}
                    </p>

                    <button
                        type="button"
                        onClick={() => onToggleSaveCourse && onToggleSaveCourse(course)}
                        className={`w-full font-bold py-3 rounded-lg transition shadow-sm flex items-center justify-center mb-6
                            ${isSaved ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-white border border-gray-200 text-dark hover:border-primary/40 hover:bg-orange-50'}`}
                    >
                        {isSaved ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
                        {isSaved ? 'Gemerkt' : 'Kurs merken'}
                    </button>
                    
                    {hasEvents ? (
                        <>
                            <h3 className="font-bold text-dark mb-3 flex items-center"><Calendar className="w-4 h-4 mr-2"/> Termine</h3>
                            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                                {displayEvents.map((ev, i) => (
                                    <div key={i} className={`p-4 rounded-xl border transition ${ev.isFull ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-primary/30 hover:shadow-md'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="font-bold text-dark">
                                                    {ev.start_date ? new Date(ev.start_date).toLocaleDateString('de-CH') : 'Termin nach Absprache'}
                                                </div>
                                                {ev.schedule_description && <div className="text-xs text-gray-500 mt-1">{ev.schedule_description}</div>}
                                            </div>
                                            {course.booking_type === 'platform' && (
                                                ev.isUnlimited 
                                                ? <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded">Unbegrenzt</span>
                                                : ev.isFull
                                                    ? <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded">VOLL</span>
                                                    : <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">{ev.spotsLeft} frei</span>
                                            )}
                                        </div>
                                        
                                        <button 
                                            onClick={() => !ev.isFull && handleBookingAction(ev)} 
                                            disabled={ev.isFull && course.booking_type === 'platform'}
                                            className={`w-full py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center 
                                                ${(ev.isFull && course.booking_type === 'platform') 
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                                    : 'bg-primary text-white hover:bg-orange-600 shadow-sm hover:shadow active:scale-95'}`}
                                        >
                                            {course.booking_type === 'external' && <ExternalLink className="w-4 h-4 mr-2" />}
                                            {course.booking_type === 'lead' && <Mail className="w-4 h-4 mr-2" />}
                                            {(ev.isFull && course.booking_type === 'platform') ? 'Ausgebucht' : 
                                             (course.booking_type === 'external' ? 'Zur Anbieter-Webseite' : 
                                             (course.booking_type === 'lead' ? 'Anfrage senden' : t.btn_book || 'Jetzt Buchen'))}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 mb-6 text-center">
                            <Map className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                            <h3 className="font-bold text-dark text-sm mb-2">Flexible Verfügbarkeit</h3>
                            <p className="text-xs text-gray-500 mb-4">Dieser Kurs hat keine festen Termine oder findet an flexiblen Orten statt.</p>
                            {course.address && course.address.length > 2 && (
                                <div className="text-xs font-medium text-gray-700 bg-white p-2 rounded border border-gray-200 mb-4">Regionen: {course.address}</div>
                            )}
                            
                            <button 
                                onClick={() => course.booking_type !== 'platform' && handleBookingAction()}
                                disabled={course.booking_type === 'platform'}
                                className={`w-full font-bold py-3 rounded-lg transition shadow-sm flex items-center justify-center
                                    ${course.booking_type === 'platform' 
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                        : 'bg-primary text-white hover:bg-orange-600'}`}
                            >
                                {course.booking_type === 'external' ? <><ExternalLink className="w-4 h-4 mr-2"/> Zur Anbieter-Webseite</> : 
                                 (course.booking_type === 'platform' ? 'Derzeit nicht buchbar' : <><Mail className="w-4 h-4 mr-2"/> Anfrage senden</>)}
                            </button>
                        </div>
                    )}

                    <div className="space-y-3 text-xs text-gray-500 border-t pt-4">
                        <div className="flex items-center"><Shield className="w-4 h-4 mr-3 text-green-600"/> Verifizierter Anbieter</div>
                        <div className="flex items-center"><CheckCircle className="w-4 h-4 mr-3 text-blue-600"/> Sichere Abwicklung</div>
                    </div>
                </div>
            </div>
        </div>

        {relatedCourses.length > 0 && (
            <div className="mt-16 pt-10 border-t border-gray-200">
                <h2 className="text-2xl font-bold font-heading text-dark mb-2">Nicht der richtige Kurs?</h2>
                <p className="text-gray-500 mb-6">Entdecke diese Alternativen aus {course.category_area ? course.category_area.replace('_', ' ') : 'unserem Angebot'}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {relatedCourses.map(rel => (
                         <div key={rel.id} 
                              onClick={() => { 
                                  const topicSlug = (rel.category_area || 'kurs').toLowerCase().replace(/_/g, '-');
                                  const locSlug = (rel.canton || 'schweiz').toLowerCase();
                                  const titleSlug = (rel.title || 'detail').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                                  window.location.href = `/courses/${topicSlug}/${locSlug}/${rel.id}-${titleSlug}`;
                              }} 
                              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md cursor-pointer group transition-all"
                         >
                            <div className="h-40 overflow-hidden relative">
                                <img
                                    src={rel.image_url || fallbackImage}
                                    alt={`${rel.title} - Kurs in ${rel.canton}`}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <span className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 rounded text-xs font-bold text-gray-700 flex items-center shadow-sm">
                                    <MapPin className="w-3 h-3 mr-1 text-primary"/> {rel.canton}
                                </span>
                            </div>
                            <div className="p-4">
                                <h4 className="font-bold text-dark text-sm line-clamp-2 h-10 mb-2 font-heading group-hover:text-primary transition-colors">{rel.title}</h4>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>{rel.category_area?.replace('_', ' ')}</span>
                                    <span className="font-bold text-primary">{getPriceLabel(rel)}</span>
                                </div>
                            </div>
                         </div>
                    ))}
                </div>
            </div>
        )}

        {showSavePrompt && (
            <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-2xl">
                    <button
                        onClick={() => { setShowSavePrompt(false); setPendingExternalUrl(null); }}
                        className="absolute top-4 right-4 text-gray-400 hover:text-dark transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <h3 className="text-xl font-bold mb-2 font-heading">Kurs merken?</h3>
                    <p className="text-sm text-gray-600">
                        Möchtest du <span className="font-bold">„{course.title}“</span> in deine Merkliste aufnehmen?
                    </p>

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={async () => {
                                // Wenn eingeloggt: direkt speichern
                                if (user && onToggleSaveCourse) {
                                    await onToggleSaveCourse(course);
                                } else {
                                    // Wenn ausgeloggt: für später merken, aber User nicht blockieren
                                    localStorage.setItem('pendingSavedCourseId', String(course.id));
                                    if (showNotification) showNotification("Kurs wird nach Login gemerkt.");
                                }

                                setShowSavePrompt(false);

                                if (pendingExternalUrl) {
                                    window.open(pendingExternalUrl, '_blank');
                                }
                                setPendingExternalUrl(null);
                            }}
                            className="flex-1 bg-primary text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition flex items-center justify-center"
                        >
                            <Bookmark className="w-4 h-4 mr-2" /> Ja, merken
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setShowSavePrompt(false);
                                if (pendingExternalUrl) window.open(pendingExternalUrl, '_blank');
                                setPendingExternalUrl(null);
                            }}
                            className="flex-1 bg-white border border-gray-200 text-dark font-bold py-3 rounded-lg hover:bg-gray-50 transition"
                        >
                            Nein, weiter
                        </button>
                    </div>
                </div>
            </div>
        )}
        {showLeadModal && (
            <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-2xl">
                    <button onClick={() => setShowLeadModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-dark transition-colors"><X className="w-6 h-6"/></button>
                    {leadStatus === 'success' ? (
                        <div className="text-center py-8 animate-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8" /></div>
                            <h3 className="text-xl font-bold font-heading mb-2">Anfrage gesendet!</h3>
                            <p className="text-gray-600">Der Anbieter wird sich bald bei dir melden.</p>

                            {!isSaved && (
                                <div className="mt-6">
                                    <p className="text-sm text-gray-600 mb-3">Möchtest du den Kurs für später merken?</p>
                                    <button
                                        type="button"
                                        onClick={() => onToggleSaveCourse && onToggleSaveCourse(course)}
                                        className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition flex items-center justify-center"
                                    >
                                        <Bookmark className="w-4 h-4 mr-2" /> Kurs merken
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <h3 className="text-xl font-bold mb-1 font-heading">Kurs unverbindlich anfragen</h3>
                            <p className="text-xs text-gray-500 mb-6">Deine Anfrage geht direkt an {course.instructor_name}.</p>
                            <form onSubmit={handleLeadSubmit} className="space-y-4">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dein Name</label><input name="name" required defaultValue={user?.name || ''} className="w-full p-3 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-primary outline-none transition" /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deine Email</label><input name="email" type="email" required defaultValue={user?.email || ''} className="w-full p-3 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-primary outline-none transition" /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nachricht</label><textarea name="message" rows="3" defaultValue={`Guten Tag, ich interessiere mich für den Kurs "${course.title}".`} className="w-full p-3 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-primary outline-none transition"></textarea></div>
                                <button type="submit" disabled={leadStatus === 'submitting'} className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition flex items-center justify-center disabled:opacity-50"><Send className="w-4 h-4 mr-2"/> Anfrage absenden</button>
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