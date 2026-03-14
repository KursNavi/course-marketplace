import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, MapPin, Clock, CheckCircle, Calendar, Shield, ExternalLink, Mail, X, Send, Map, Info, Loader, Bookmark, BookmarkCheck, ChevronRight, AlertCircle, Compass, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPriceCHF, getPriceLabel } from '../lib/formatPrice';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { SEGMENT_CONFIG } from '../lib/constants';
import { BASE_URL, buildCoursePath } from '../lib/siteConfig';
import { getBereichByAreaSlug, getBereichUrl } from '../lib/bereichLandingConfig';
import { DEFAULT_COURSE_IMAGE } from '../lib/imageUtils';
import { getCourseCategoryText, getPrimaryCategory, getPrimaryCategoryLabel, getPrimaryCategorySlug, isSyntheticCategory } from '../lib/courseMetadata';

const DetailView = ({ course, courses, setView, t, setSelectedTeacher, user, savedCourseIds, onToggleSaveCourse, showNotification, refreshBookings }) => {
    const [showLeadModal, setShowLeadModal] = useState(false);
    const [leadStatus, setLeadStatus] = useState('idle'); // idle, submitting, success

    const [showSavePrompt, setShowSavePrompt] = useState(false);
    const [pendingExternalUrl, setPendingExternalUrl] = useState(null);

    // Ticket availability state (for platform/platform_flex with ticket_limit_30d)
    const [ticketAvailable, setTicketAvailable] = useState(true);
    const [ticketRemaining, setTicketRemaining] = useState(null);
    const [ticketPeriodEnd, setTicketPeriodEnd] = useState(null);

    // Booking attestation state (for platform/platform_flex bookings)
    const [guardianAttested, setGuardianAttested] = useState(false);

    const { taxonomy, getTypeLabel, getAreaLabel } = useTaxonomy();

    const isSaved = (savedCourseIds || []).includes(course?.id);

    // Scroll to top when course changes
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [course?.id]);

    // Track detail view (session-deduplicated)
    useEffect(() => {
        if (!course?.id) return;
        const key = `det_${course.id}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');

        supabase.from('course_views').insert({
            course_id: course.id,
            view_type: 'detail',
            viewer_id: user?.id || null,
            source: sessionStorage.getItem('cv_source') || 'search'
        }).then(({ error }) => {
            if (error) console.warn('Detail view tracking failed:', error.message);
        });
    }, [course?.id]);

    // Load ticket availability for courses with ticket_limit_30d
    useEffect(() => {
        if (course?.ticket_limit_30d && (course.booking_type === 'platform' || course.booking_type === 'platform_flex')) {
            supabase.rpc('check_ticket_availability', { p_course_id: course.id })
                .then(({ data, error }) => {
                    if (!error && data?.[0]) {
                        setTicketAvailable(data[0].available);
                        setTicketRemaining(data[0].remaining);
                        setTicketPeriodEnd(data[0].period_end);
                    }
                });
        } else {
            setTicketAvailable(true);
            setTicketRemaining(null);
            setTicketPeriodEnd(null);
        }
    }, [course?.id, course?.ticket_limit_30d, course?.booking_type]);

    // Build category breadcrumb path from all_categories (primary) with flat-field fallback
    const getCategoryBreadcrumb = () => {
        if (!course) return [];
        const crumbs = [];
        const lang = 'de';

        // Prefer primary category from all_categories (sourced from taxonomy view)
        const primary = Array.isArray(course.all_categories)
            ? course.all_categories.find(c => c.is_primary) || course.all_categories[0]
            : null;

        if (primary) {
            const type = primary.category_type;
            const area = primary.category_area;
            const specialty = primary.category_specialty_label || primary.category_specialty;
            const focus = primary.category_focus_label || primary.category_focus;
            const hideLegacyAreaCrumb = isSyntheticCategory(primary) && !primary.category_area_label && (specialty || focus);

            if (type) crumbs.push({
                label: primary.category_type_label || getTypeLabel(type, lang),
                filter: { type },
                typeSlug: type
            });
            if (area && !hideLegacyAreaCrumb) crumbs.push({
                label: primary.category_area_label || getAreaLabel(type, area, lang),
                filter: { type, area }
            });
            if (specialty) crumbs.push({
                label: specialty,
                filter: { type, area, specialty: primary.category_specialty }
            });
            if (focus) crumbs.push({
                label: focus,
                filter: { type, area, specialty: primary.category_specialty, focus: primary.category_focus }
            });
        } else if (taxonomy) {
            // Fallback to flat fields on course
            if (course.category_type) crumbs.push({
                label: getTypeLabel(course.category_type, lang),
                filter: { type: course.category_type },
                typeSlug: course.category_type
            });
            if (course.category_type && course.category_area) crumbs.push({
                label: getAreaLabel(course.category_type, course.category_area, lang),
                filter: { type: course.category_type, area: course.category_area }
            });
            if (course.category_specialty) crumbs.push({
                label: course.category_specialty,
                filter: { type: course.category_type, area: course.category_area, specialty: course.category_specialty }
            });
            if (course.category_focus) crumbs.push({
                label: course.category_focus,
                filter: { type: course.category_type, area: course.category_area, specialty: course.category_specialty, focus: course.category_focus }
            });
        }

        return crumbs;
    };

    // getPriceLabel imported from '../lib/formatPrice'

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

        const topicSlug = getPrimaryCategorySlug(course).toLowerCase().replace(/_/g, '-');
        const locSlug = (course.canton || 'schweiz').toLowerCase();
        const titleSlug = (course.title || 'detail').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const canonicalUrl = `${BASE_URL}/courses/${topicSlug}/${locSlug}/${course.id}-${titleSlug}`;

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

        // Clean up stale hreflang tags from other pages
        document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(tag => tag.remove());

        // --- FIX 3: Open Graph Tags (Social Sharing) ---
        const ogTags = {
            'og:title': `${course.title} in ${locationLabel}`,
            'og:description': metaDescription,
            'og:url': canonicalUrl,
            'og:image': course.image_url || `${BASE_URL}/og-default.svg`,
            'og:type': 'website',
            'og:site_name': 'KursNavi',
            'twitter:card': 'summary_large_image',
            'twitter:title': `${course.title} in ${locationLabel}`,
            'twitter:description': metaDescription,
            'twitter:image': course.image_url || `${BASE_URL}/og-default.svg`
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

        // Calculate if ALL events are full (exclude cancelled events)
        const activeRawEvents = rawEvents.filter(ev => !ev.cancelled_at);
        const allEventsFull = activeRawEvents.length > 0 && activeRawEvents.every(ev => {
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
                "sameAs": `${BASE_URL}/teacher/${course.user_id}`
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
            schemaData.timeRequired = course.session_count
                ? `${course.session_count}x ${course.session_length}`
                : course.session_length;
        }

        const primaryCat = getPrimaryCategory(course);
        const areaLabel = getPrimaryCategoryLabel(course) || null;
        if (areaLabel) {
            schemaData.educationalLevel = areaLabel;
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
                    "item": BASE_URL
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": areaLabel || 'Kurse',
                    "item": `${BASE_URL}/courses/${topicSlug}/${locSlug}/`
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
    
    const getEventCutoffDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

        const normalizedValue = String(value).trim();
        if (!normalizedValue) return null;

        const parsed = normalizedValue.includes('T')
            ? new Date(normalizedValue)
            : new Date(`${normalizedValue}T23:59:59`);

        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const isUpcomingEventDate = (value) => {
        const cutoff = getEventCutoffDate(value);
        return cutoff ? cutoff >= new Date() : false;
    };

    // --- SMART BOOKING HANDLER ---
    const handleBookingAction = async (courseEvent = null) => {
        const type = effectiveBookingType || 'platform';

        if (type === 'lead') {
            setShowLeadModal(true);
            return;
        }

        // Booking attestation required for platform/platform_flex
        if (!guardianAttested) {
            showNotification && showNotification('Bitte bestätige die Buchungsbestätigung, um fortzufahren.');
            return;
        }

        // For platform: event is required
        if (type === 'platform' && !courseEvent) return;

        // For platform_flex: no event needed, but check ticket availability
        if (type === 'platform_flex' && !ticketAvailable) {
            showNotification && showNotification('Dieses Angebot ist derzeit ausgebucht. Bitte später erneut versuchen.');
            return;
        }

        if (!user) {
            localStorage.setItem('pendingCourseId', course.id);
            if (courseEvent?.id) localStorage.setItem('pendingEventId', courseEvent.id);
            localStorage.setItem('postLoginRedirectPath', `${window.location.pathname}${window.location.search}`);
            setView('login');
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Nicht authentifiziert. Bitte erneut anmelden.');
            }

            const authHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            };
            const bookingBody = {
                courseId: course.id,
                courseImage: course.image_url,
                eventId: courseEvent?.id || null,
                guardianAttestation: guardianAttested
            };

            // Try create-checkout-session first (handles credit check server-side)
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(bookingBody)
            });
            const data = await response.json();

            // Server says free booking or full credit is available — book directly
            if (data.free_booking || data.full_credit_available) {
                const creditResponse = await fetch('/api/book-with-credit', {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(bookingBody)
                });
                const creditData = await creditResponse.json();
                if (!creditResponse.ok) throw new Error(creditData.error || 'Buchung fehlgeschlagen');

                showNotification && showNotification(data.free_booking
                    ? 'Buchung erfolgreich! Dieser Kurs ist kostenlos.'
                    : 'Buchung erfolgreich! Bezahlt mit deinem Guthaben.');

                if (typeof refreshBookings === 'function' && user?.id) {
                    await refreshBookings(user.id);
                }

                window.history.replaceState({}, document.title, '/dashboard');
                setView('dashboard');
                return;
            }

            if (data.error) throw new Error(data.error);
            window.location.href = data.url;
        } catch (error) {
            console.warn("Checkout error:", error);
            showNotification && showNotification(error.message || 'Ein Fehler ist aufgetreten', 'error');
        }
    };

    const handleLeadSubmit = async (e) => {
        e.preventDefault();
        setLeadStatus('submitting');
        const fd = new FormData(e.target);
        try {
            const resp = await fetch('/api/send-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courseId: course.id,
                    name: fd.get('name'),
                    email: fd.get('email'),
                    message: fd.get('message')
                })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(data.error || 'Anfrage konnte nicht gesendet werden.');
            setLeadStatus('success');
            setTimeout(() => { setShowLeadModal(false); setLeadStatus('idle'); }, 2500);
        } catch (err) {
            console.error('Lead submit error:', err);
            setLeadStatus('idle');
            if (typeof showNotification === 'function') showNotification(err.message || 'Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.');
        }
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

    // Filter out cancelled events and hide past fixed dates from learners
    const activeEvents = rawEvents.filter(ev => !ev.cancelled_at);
    const visibleEvents = course.booking_type === 'platform'
        ? activeEvents.filter(ev => isUpcomingEventDate(ev.start_date))
        : activeEvents;

    const displayEvents = visibleEvents.map(ev => {
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
    const isPastEventFallback = course.booking_type === 'platform' && !hasEvents;
    const effectiveBookingType = isPastEventFallback ? 'platform_flex' : course.booking_type;

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
        const isBookable = candidate.booking_type === 'platform' || candidate.booking_type === 'platform_flex';
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
    const currentPrimaryCat = Array.isArray(course.all_categories) && (course.all_categories.find(c => c.is_primary) || course.all_categories[0]);
    const currentAreaSlug = currentPrimaryCat?.category_area || course.category_area;
    const sameCategory = candidates.filter(c => {
        const pCat = Array.isArray(c.all_categories) && (c.all_categories.find(x => x.is_primary) || c.all_categories[0]);
        return (pCat?.category_area || c.category_area) === currentAreaSlug;
    });
    const otherCategory = candidates.filter(c => {
        const pCat = Array.isArray(c.all_categories) && (c.all_categories.find(x => x.is_primary) || c.all_categories[0]);
        return (pCat?.category_area || c.category_area) !== currentAreaSlug;
    });

    const rankedSame = sameCategory.map(c => ({...c, score: getRankingScore(c)})).sort((a,b) => b.score - a.score);
    const rankedOther = otherCategory.map(c => ({...c, score: getRankingScore(c)})).sort((a,b) => b.score - a.score);

    // Take all from same category, then fill up to 5 with others
    const relatedCourses = [...rankedSame, ...rankedOther].slice(0, 5);

    const fallbackImage = DEFAULT_COURSE_IMAGE;

    return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans animate-in fade-in duration-500">
        <button onClick={() => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.history.pushState({ view: 'search' }, '', '/search');
            }
        }} className="flex items-center text-gray-500 hover:text-primary mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2"/> Zurück zur Suche</button>

        {/* Status Banner for Draft courses (only visible to owner) */}
        {user?.id && String(course.user_id) === String(user.id) && course.status === 'draft' && (
            <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-xl mb-6 flex items-center">
                <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                <div>
                    <span className="font-bold">Entwurf</span>
                    <span className="ml-2">– Dieser Kurs ist nur für dich sichtbar. Veröffentliche ihn im Dashboard.</span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h1 className="text-3xl font-bold font-heading text-dark">{course.title}</h1>
                        {course.is_pro && (
                            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center self-start md:self-auto border border-blue-100">
                                <CheckCircle className="w-3 h-3 mr-1" /> {t.lbl_professional_filter || 'Verifiziert'}
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

            <div className="lg:col-span-1 space-y-6 order-first lg:order-none">
                <div className="w-full aspect-video bg-gray-100 rounded-2xl overflow-hidden shadow-lg relative group">
                    <img
                        src={course.image_url || fallbackImage}
                        alt={`${course.title} in ${course.canton || 'Schweiz'}`}
                        loading="eager"
                        decoding="async"
                        width="600"
                        height="338"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-24">
                    <div className="text-3xl font-bold text-primary font-heading mb-1">{getPriceLabel(course)}</div>
                    <p className="text-gray-400 text-xs mb-4">
                        {(effectiveBookingType === 'platform' || effectiveBookingType === 'platform_flex')
                            ? (Number(course.price) === 0 ? (course.free_reason || '') : 'pro Person inkl. MwSt.')
                            : (Number(course.price) > 0 ? 'Unverbindliche Preisangabe' : '')}
                    </p>

                    <div className="border-t border-gray-100 pt-4 mb-4 space-y-3">
                        <button
                            onClick={async () => {
                                const { data } = await supabase.from('profiles').select('*').eq('id', course.user_id).single();
                                if (!data) return;
                                const tier = (data.package_tier || 'basic').toLowerCase();
                                const hasPublicProfile = ['pro','premium','enterprise'].includes(tier) && data.slug && data.profile_published_at;
                                if (hasPublicProfile) {
                                    window.history.pushState({}, '', `/anbieter/${data.slug}`);
                                    setView('provider-profile');
                                } else {
                                    setSelectedTeacher(data);
                                    setView('teacher-profile');
                                }
                                window.scrollTo(0,0);
                            }}
                            className="flex items-center text-gray-700 hover:text-primary transition-colors w-full group"
                        >
                            <User className="w-5 h-5 mr-3 text-gray-400 shrink-0"/>
                            <span className="font-medium group-hover:underline">{course.instructor_name}</span>
                        </button>
                        <div className="flex items-center text-gray-700">
                            <MapPin className="w-5 h-5 mr-3 text-gray-400 shrink-0"/>
                            <span>{course.address || course.city || course.canton}</span>
                        </div>
                        {course.session_length && (
                            <div className="flex items-center text-gray-700">
                                <Clock className="w-5 h-5 mr-3 text-gray-400 shrink-0"/>
                                <span>{course.session_count ? `${course.session_count}x ` : ''}{course.session_length}</span>
                            </div>
                        )}
                        {course.min_age && (
                            <div className="flex items-center text-gray-700">
                                <Info className="w-5 h-5 mr-3 text-gray-400 shrink-0"/>
                                <span>Ab {course.min_age} Jahren</span>
                            </div>
                        )}
                        {getCategoryBreadcrumb().length > 0 && (() => {
                            const crumbs = getCategoryBreadcrumb();
                            const firstCrumb = crumbs[0];
                            const segConfig = firstCrumb?.typeSlug ? SEGMENT_CONFIG[firstCrumb.typeSlug] : null;
                            const SegIcon = segConfig?.icon;
                            // Skip Level 1 in the text chain (it's now the row icon)
                            const textCrumbs = SegIcon ? crumbs.slice(1) : crumbs;
                            return (
                            <div className="flex items-start text-gray-700">
                                {SegIcon ? (
                                    <a
                                        href={`/search?${new URLSearchParams(firstCrumb.filter).toString()}`}
                                        onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) return;
                                            e.preventDefault();
                                            const params = new URLSearchParams(firstCrumb.filter).toString();
                                            window.history.pushState({ view: 'search', ...firstCrumb.filter }, '', `/search?${params}`);
                                            window.dispatchEvent(new PopStateEvent('popstate'));
                                        }}
                                        title={firstCrumb.label}
                                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${segConfig.bgSolid} hover:opacity-80 transition-opacity mr-3 shrink-0 mt-0.5`}
                                    >
                                        <SegIcon className="w-3 h-3 text-white" />
                                    </a>
                                ) : (
                                    <span className="w-5 h-5 mr-3 text-gray-400 shrink-0 flex items-center justify-center">📚</span>
                                )}
                                <div className="flex flex-wrap items-center gap-1">
                                    {textCrumbs.map((crumb, idx, arr) => (
                                        <span key={idx} className="flex items-center">
                                            <a
                                                href={`/search?${new URLSearchParams(crumb.filter).toString()}`}
                                                onClick={(e) => {
                                                    if (e.ctrlKey || e.metaKey) return;
                                                    e.preventDefault();
                                                    const params = new URLSearchParams(crumb.filter).toString();
                                                    window.history.pushState({ view: 'search', ...crumb.filter }, '', `/search?${params}`);
                                                    window.dispatchEvent(new PopStateEvent('popstate'));
                                                }}
                                                className="hover:text-primary hover:underline transition-colors"
                                            >
                                                {crumb.label}
                                            </a>
                                            {idx < arr.length - 1 && (
                                                <ChevronRight className="w-3 h-3 mx-1 text-gray-400" />
                                            )}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            );
                        })()}
                    </div>

                    <button
                        type="button"
                        onClick={() => onToggleSaveCourse && onToggleSaveCourse(course)}
                        className={`w-full font-bold py-3 rounded-lg transition shadow-sm flex items-center justify-center mb-6
                            ${isSaved ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-white border border-gray-200 text-dark hover:border-primary/40 hover:bg-orange-50'}`}
                    >
                        {isSaved ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
                        {isSaved ? 'Gemerkt' : 'Kurs merken'}
                    </button>

                    {/* Provider cannot book courses */}
                    {user?.role === 'teacher' ? (
                        <div className="mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50 text-center">
                            <Info className="w-5 h-5 text-amber-600 mx-auto mb-2" />
                            <p className="text-sm font-medium text-amber-800">Als Kursanbieter kannst du keine Kurse buchen.</p>
                            <p className="text-xs text-amber-600 mt-1">Melde dich mit einem Teilnehmer-Konto an, um Kurse zu buchen.</p>
                        </div>
                    ) : (<>
                    {/* Booking attestation checkbox for event-based bookings */}
                    {effectiveBookingType === 'platform' && (
                        <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
                            <label className="flex items-start cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={guardianAttested}
                                    onChange={(e) => setGuardianAttested(e.target.checked)}
                                    className="mt-0.5 mr-2.5 accent-primary shrink-0"
                                />
                                <span className="text-xs text-gray-700 leading-relaxed">
                                    {course.requires_guardian_booking
                                        ? 'Ich bestätige, dass ich mindestens 18 Jahre alt bin, diese Buchung als erziehungsberechtigte Person vornehme und als buchende Person Vertragspartner/in sowie zahlungspflichtig bin.'
                                        : 'Ich bestätige, dass ich mindestens 18 Jahre alt bin und diese Buchung für mich selbst oder mit Einverständnis der teilnehmenden Person vornehme. Mir ist bewusst, dass ich als buchende Person Vertragspartner/in und zahlungspflichtig bin.'}
                                </span>
                            </label>
                            {course.requires_guardian_booking && (
                                <p className="text-xs text-amber-700 mt-2 pl-5 font-medium">
                                    Hinweis: Dieser Kurs richtet sich an Minderjährige. Die Buchung muss durch eine erziehungsberechtigte Person erfolgen.
                                </p>
                            )}
                        </div>
                    )}

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
                                            {effectiveBookingType === 'platform' && (
                                                ev.isUnlimited 
                                                ? <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded">Unbegrenzt</span>
                                                : ev.isFull
                                                    ? <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded">VOLL</span>
                                                    : <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">{ev.spotsLeft} frei</span>
                                            )}
                                        </div>
                                        
                                        {!user && effectiveBookingType !== 'lead' ? (
                                            <div className="w-full">
                                                <button
                                                    onClick={() => {
                                                        localStorage.setItem('pendingCourseId', course.id);
                                                        if (ev?.id) localStorage.setItem('pendingEventId', ev.id);
                                                        localStorage.setItem('postLoginRedirectPath', `${window.location.pathname}${window.location.search}`);
                                                        setView('login');
                                                    }}
                                                    className="w-full py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center bg-primary text-white hover:bg-orange-600 shadow-sm hover:shadow active:scale-95"
                                                >
                                                    <LogIn className="w-4 h-4 mr-2" />
                                                    Anmelden & buchen
                                                </button>
                                                <p className="text-[11px] text-gray-500 text-center mt-1.5">Zum Buchen ist ein Konto erforderlich</p>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => !ev.isFull && handleBookingAction(ev)}
                                                disabled={(ev.isFull && effectiveBookingType === 'platform') || (effectiveBookingType !== 'lead' && !guardianAttested)}
                                                className={`w-full py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center
                                                    ${(ev.isFull && effectiveBookingType === 'platform') || (effectiveBookingType !== 'lead' && !guardianAttested)
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-primary text-white hover:bg-orange-600 shadow-sm hover:shadow active:scale-95'}`}
                                            >
                                                {effectiveBookingType === 'lead' && <Mail className="w-4 h-4 mr-2" />}
                                                {(ev.isFull && effectiveBookingType === 'platform') ? 'Ausgebucht' :
                                                 (effectiveBookingType === 'lead' ? 'Anfrage senden' : t.btn_book || 'Jetzt Buchen')}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 mb-6 text-center">
                            <Map className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                            <h3 className="font-bold text-dark text-sm mb-2">
                                {effectiveBookingType === 'platform_flex' ? 'Flexibler Termin' : 'Flexible Verfügbarkeit'}
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">
                                {effectiveBookingType === 'platform_flex'
                                    ? 'Bitte vereinbare den Termin direkt mit dem Anbieter.'
                                    : 'Dieser Kurs hat keine festen Termine oder findet an flexiblen Orten statt.'}
                            </p>
                            {isPastEventFallback && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                                    Alle früheren Termine sind bereits vorbei. Dieser Kurs wird deshalb automatisch als flexible Direktbuchung angezeigt.
                                </p>
                            )}
                            {course.address && course.address.length > 2 && (
                                <div className="text-xs font-medium text-gray-700 bg-white p-2 rounded border border-gray-200 mb-4">
                                    {effectiveBookingType === 'platform_flex' ? 'Ort: ' : 'Regionen: '}{course.address}
                                </div>
                            )}

                            {/* Ticket availability info for platform_flex */}
                            {effectiveBookingType === 'platform_flex' && course.ticket_limit_30d && (
                                <div className={`text-xs p-2 rounded border mb-4 ${ticketAvailable ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                    {ticketAvailable
                                        ? (ticketRemaining !== null ? `Noch ${ticketRemaining} Plätze verfügbar` : 'Plätze verfügbar')
                                        : 'Derzeit ausgebucht'}
                                    {ticketPeriodEnd && ticketAvailable && (
                                        <span className="block text-[10px] mt-1">
                                            Reset am {new Date(ticketPeriodEnd).toLocaleDateString('de-CH')}
                                        </span>
                                    )}
                                </div>
                            )}

                            {effectiveBookingType === 'platform_flex' && user && (
                                <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-white text-left">
                                    <label className="flex items-start cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={guardianAttested}
                                            onChange={(e) => setGuardianAttested(e.target.checked)}
                                            className="mt-0.5 mr-2.5 accent-primary shrink-0"
                                        />
                                        <span className="text-xs text-gray-700 leading-relaxed">
                                            {course.requires_guardian_booking
                                                ? 'Ich best\u00e4tige, dass ich mindestens 18 Jahre alt bin, diese Buchung als erziehungsberechtigte Person vornehme und als buchende Person Vertragspartner/in sowie zahlungspflichtig bin.'
                                                : 'Ich best\u00e4tige, dass ich mindestens 18 Jahre alt bin und diese Buchung f\u00fcr mich selbst oder mit Einverst\u00e4ndnis der teilnehmenden Person vornehme. Mir ist bewusst, dass ich als buchende Person Vertragspartner/in und zahlungspflichtig bin.'}
                                        </span>
                                    </label>
                                    {course.requires_guardian_booking && (
                                        <p className="text-xs text-amber-700 mt-2 pl-5 font-medium">
                                            Hinweis: Dieser Kurs richtet sich an Minderj\u00e4hrige. Die Buchung muss durch eine erziehungsberechtigte Person erfolgen.
                                        </p>
                                    )}
                                </div>
                            )}

                            {!user && effectiveBookingType !== 'lead' ? (
                                <div className="w-full">
                                    <button
                                        onClick={() => {
                                            localStorage.setItem('pendingCourseId', course.id);
                                            localStorage.setItem('postLoginRedirectPath', `${window.location.pathname}${window.location.search}`);
                                            setView('login');
                                        }}
                                        className="w-full font-bold py-3 rounded-lg transition shadow-sm flex items-center justify-center bg-primary text-white hover:bg-orange-600 active:scale-95"
                                    >
                                        <LogIn className="w-4 h-4 mr-2" />
                                        Anmelden & buchen
                                    </button>
                                    <p className="text-[11px] text-gray-500 text-center mt-1.5">Zum Buchen ist ein Konto erforderlich</p>
                            {effectiveBookingType === 'platform_flex' && user && (
                                <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-white text-left">
                                    <label className="flex items-start cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={guardianAttested}
                                            onChange={(e) => setGuardianAttested(e.target.checked)}
                                            className="mt-0.5 mr-2.5 accent-primary shrink-0"
                                        />
                                        <span className="text-xs text-gray-700 leading-relaxed">
                                            {course.requires_guardian_booking
                                                ? 'Ich best\u00e4tige, dass ich mindestens 18 Jahre alt bin, diese Buchung als erziehungsberechtigte Person vornehme und als buchende Person Vertragspartner/in sowie zahlungspflichtig bin.'
                                                : 'Ich best\u00e4tige, dass ich mindestens 18 Jahre alt bin und diese Buchung f\u00fcr mich selbst oder mit Einverst\u00e4ndnis der teilnehmenden Person vornehme. Mir ist bewusst, dass ich als buchende Person Vertragspartner/in und zahlungspflichtig bin.'}
                                        </span>
                                    </label>
                                    {course.requires_guardian_booking && (
                                        <p className="text-xs text-amber-700 mt-2 pl-5 font-medium">
                                            Hinweis: Dieser Kurs richtet sich an Minderj\u00e4hrige. Die Buchung muss durch eine erziehungsberechtigte Person erfolgen.
                                        </p>
                                    )}
                                </div>
                            )}

                                </div>
                            ) : (
                                <button
                                    onClick={() => (effectiveBookingType === 'platform_flex' || effectiveBookingType === 'lead') && handleBookingAction()}
                                    disabled={effectiveBookingType === 'platform' || (effectiveBookingType === 'platform_flex' && (!ticketAvailable || !guardianAttested))}
                                    className={`w-full font-bold py-3 rounded-lg transition shadow-sm flex items-center justify-center
                                        ${effectiveBookingType === 'platform' || (effectiveBookingType === 'platform_flex' && (!ticketAvailable || !guardianAttested))
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-primary text-white hover:bg-orange-600'}`}
                                >
                                    {effectiveBookingType === 'platform'
                                        ? 'Derzeit nicht buchbar'
                                        : effectiveBookingType === 'platform_flex'
                                            ? (ticketAvailable ? `Jetzt buchen (${getPriceLabel(course)})` : 'Ausgebucht')
                                            : <><Mail className="w-4 h-4 mr-2"/> Anfrage senden</>}
                                </button>
                            )}
                            {user?.credit_balance_cents > 0 && effectiveBookingType !== 'lead' && course.price > 0 && (() => {
                                const priceCents = Math.round(Number(course.price) * 100);
                                const credit = user.credit_balance_cents;
                                if (credit >= priceCents) {
                                    return <p className="text-xs text-green-700 text-center mt-2">Mit Guthaben bezahlbar (CHF {(credit / 100).toFixed(2)} verfügbar)</p>;
                                }
                                return <p className="text-xs text-green-700 text-center mt-2">CHF {(Math.min(credit, priceCents) / 100).toFixed(2)} Guthaben wird verrechnet</p>;
                            })()}
                        </div>
                    )}
                    </>)}

                    {course.instructor_verified && (
                        <div className="space-y-3 text-xs text-gray-500 border-t pt-4">
                            <div className="flex items-center"><Shield className="w-4 h-4 mr-3 text-green-600"/> Verifizierter Anbieter</div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {relatedCourses.length > 0 && (
            <div className="mt-16 pt-10 border-t border-gray-200">
                <h2 className="text-2xl font-bold font-heading text-dark mb-2">Nicht der richtige Kurs?</h2>
                <p className="text-gray-500 mb-6">Entdecke diese Alternativen aus {(() => {
                    return getPrimaryCategoryLabel(course) || 'unserem Angebot';
                })()}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {relatedCourses.map(rel => (
                         <a key={rel.id}
                              href={buildCoursePath(rel)}
                              onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                  window.location.href = buildCoursePath(rel);
                              }}
                              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md cursor-pointer group transition-all"
                              style={{textDecoration: 'none', color: 'inherit'}}
                         >
                            <div className="aspect-video overflow-hidden relative">
                                <img
                                    src={rel.image_url || fallbackImage}
                                    alt={`${rel.title} - Kurs in ${rel.canton}`}
                                    loading="lazy"
                                    decoding="async"
                                    width="400"
                                    height="225"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <span className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 rounded text-xs font-bold text-gray-700 flex items-center shadow-sm">
                                    <MapPin className="w-3 h-3 mr-1 text-primary"/> {rel.canton}
                                </span>
                            </div>
                            <div className="p-4">
                                <h4 className="font-bold text-dark text-sm line-clamp-2 h-10 mb-2 font-heading group-hover:text-primary transition-colors">{rel.title}</h4>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>{getCourseCategoryText(rel)}</span>
                                    <span className="font-bold text-primary">{getPriceLabel(rel)}</span>
                                </div>
                            </div>
                         </a>
                    ))}
                </div>
            </div>
        )}

        {/* Ratgeber hint banner — shown when a Bereichs-Landingpage exists for this course's area */}
        {(() => {
            const areaSlug = currentPrimaryCat?.category_area || course.category_area;
            const bereichConfig = areaSlug ? getBereichByAreaSlug(areaSlug) : null;
            if (!bereichConfig) return null;
            const segConfig = SEGMENT_CONFIG[bereichConfig.typeKey] || SEGMENT_CONFIG.beruflich;
            return (
                <div className={`max-w-4xl mx-auto mt-8 ${segConfig.bgLight} border ${segConfig.border} rounded-xl p-5 flex items-center gap-4`}>
                    <div className={`p-2.5 rounded-lg ${segConfig.bgLight}`}>
                        <Compass className={`w-6 h-6 ${segConfig.text}`} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-gray-800">Noch unsicher, ob dieser Kurs der richtige ist?</p>
                        <p className="text-xs text-gray-500 mt-0.5">Unser Ratgeber hilft dir bei der Orientierung im Bereich {bereichConfig.title?.de?.split('—')[0]?.trim() || 'diesem Bereich'}.</p>
                    </div>
                    <button
                        onClick={() => {
                            window.scrollTo(0, 0);
                            window.history.pushState({ view: 'bereich-landing' }, '', getBereichUrl(bereichConfig));
                        }}
                        className={`${segConfig.text} hover:underline text-sm font-bold whitespace-nowrap flex items-center gap-1`}
                    >
                        Zum Ratgeber
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            );
        })()}

        {showSavePrompt && (
            <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="save-prompt-title">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-2xl">
                    <button
                        onClick={() => { setShowSavePrompt(false); setPendingExternalUrl(null); }}
                        className="absolute top-4 right-4 text-gray-400 hover:text-dark transition-colors"
                        aria-label="Schliessen"
                    >
                        <X className="w-6 h-6" aria-hidden="true" />
                    </button>

                    <h3 id="save-prompt-title" className="text-xl font-bold mb-2 font-heading">Kurs merken?</h3>
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
            <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="lead-modal-title">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-2xl">
                    <button onClick={() => setShowLeadModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-dark transition-colors" aria-label="Schliessen"><X className="w-6 h-6" aria-hidden="true" /></button>
                    {leadStatus === 'success' ? (
                        <div className="text-center py-8 animate-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8" /></div>
                            <h3 id="lead-modal-title" className="text-xl font-bold font-heading mb-2">Anfrage gesendet!</h3>
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
                            <h3 id="lead-modal-title" className="text-xl font-bold mb-1 font-heading">Kurs unverbindlich anfragen</h3>
                            <p className="text-xs text-gray-500 mb-6">Deine Anfrage geht direkt an {course.instructor_name}.</p>
                            <form onSubmit={handleLeadSubmit} className="space-y-4">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dein Name</label><input name="name" required defaultValue={user?.user_metadata?.full_name || user?.user_metadata?.name || ''} placeholder="Vor- und Nachname" className="w-full p-3 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-primary outline-none transition" /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deine Email</label><input name="email" type="email" required defaultValue={user?.email || ''} placeholder="deine@email.ch" className="w-full p-3 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-primary outline-none transition" /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nachricht <span className="font-normal normal-case text-gray-400">– kann angepasst werden</span></label><textarea name="message" rows="3" defaultValue={`Guten Tag, ich interessiere mich für den Kurs "${course.title}".`} className="w-full p-3 bg-gray-50 rounded-lg border border-transparent focus:bg-white focus:border-primary outline-none transition"></textarea></div>
                                <button type="submit" disabled={leadStatus === 'submitting'} className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition flex items-center justify-center disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"><Send className="w-4 h-4 mr-2"/> Anfrage absenden</button>
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
