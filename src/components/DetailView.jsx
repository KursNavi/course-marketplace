import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, User, MapPin, Clock, CheckCircle, Calendar, Shield, Lock } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const DetailView = ({ course, setView, t, setSelectedTeacher, user }) => {
    
    // LOGIC: Handle Booking (Moved from App.jsx)
    const handleBookCourse = async (course, eventId = null) => {
        if (!user) { setView('login'); return; }
        try {
            localStorage.setItem('pendingCourseId', course.id);
            if (eventId) localStorage.setItem('pendingEventId', eventId);

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
            // Optional: Hier könnte man eine Demo-Success-Weiterleitung einbauen
        }
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

    return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans">
        <button onClick={() => setView('search')} className="flex items-center text-gray-500 hover:text-primary mb-6"><ArrowLeft className="w-4 h-4 mr-2"/> Back to Search</button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <img src={course.image_url} className="w-full h-80 object-cover rounded-2xl shadow-lg" alt={course.title} />
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
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
                        <span className="flex items-center bg-gray-50 px-3 py-1 rounded-full"><MapPin className="w-4 h-4 mr-2"/> {course.canton}</span>
                        <span className="flex items-center bg-gray-50 px-3 py-1 rounded-full"><Clock className="w-4 h-4 mr-2"/> {course.session_count} x {course.session_length}</span>
                    </div>
                    <div className="prose max-w-none text-gray-600">
                        <h3 className="text-xl font-bold text-dark mb-2">{t.lbl_description}</h3>
                        <p className="whitespace-pre-wrap mb-6">{course.description}</p>
                        <h3 className="text-xl font-bold text-dark mb-2">{t.lbl_learn_goals}</h3>
                        <ul className="list-disc pl-5 space-y-1 mb-6">
                            {course.objectives && course.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                        </ul>
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
                                    onClick={() => !ev.isFull && handleBookCourse(course, ev.id)} 
                                    disabled={ev.isFull}
                                    className={`w-full py-2 rounded-lg font-bold text-sm transition ${ev.isFull ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-primary text-white hover:bg-orange-600 shadow-sm'}`}
                                >
                                    {ev.isFull ? 'Ausgebucht' : t.btn_book}
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
    </div>
    );
};

export default DetailView;