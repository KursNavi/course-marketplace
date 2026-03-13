import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, CheckCircle, Shield, Globe, Mail, MapPin, Search, SortAsc } from 'lucide-react';
import { getPriceLabel } from '../lib/formatPrice';
import { DEFAULT_COURSE_IMAGE } from '../lib/imageUtils';

const fallbackImage = DEFAULT_COURSE_IMAGE;

const SORT_OPTIONS = [
    { value: 'newest', label: 'Neueste zuerst' },
    { value: 'alpha', label: 'Alphabetisch' },
    { value: 'price_asc', label: 'Preis aufsteigend' },
    { value: 'price_desc', label: 'Preis absteigend' },
];

const TeacherProfileView = ({ teacher, courses, setView, setSelectedCourse, t }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [teacher?.id]);

    const teacherCourses = useMemo(() => courses.filter(c => c.user_id === teacher.id), [courses, teacher.id]);

    // Filter + sort
    const filteredCourses = useMemo(() => {
        let result = teacherCourses;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c =>
                (c.title || '').toLowerCase().includes(q) ||
                (c.category_specialty || '').toLowerCase().includes(q) ||
                (c.canton || '').toLowerCase().includes(q)
            );
        }

        switch (sortBy) {
            case 'alpha':
                result = [...result].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
                break;
            case 'price_asc':
                result = [...result].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
                break;
            case 'price_desc':
                result = [...result].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
                break;
            case 'newest':
            default:
                result = [...result].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                break;
        }
        return result;
    }, [teacherCourses, searchQuery, sortBy]);

    // Parse additional locations
    const additionalLocations = useMemo(() => {
        if (!teacher.additional_locations) return [];
        try {
            const parsed = JSON.parse(teacher.additional_locations);
            if (Array.isArray(parsed)) return parsed.filter(l => l.city);
        } catch {
            return teacher.additional_locations.split(',').map(s => ({ city: s.trim(), canton: '' })).filter(l => l.city);
        }
        return [];
    }, [teacher.additional_locations]);

    const locationStr = [teacher.city, teacher.canton].filter(Boolean).join(', ');

    return (
        <div className="max-w-5xl mx-auto px-4 py-12 font-sans">
            <button onClick={() => window.history.back()} className="flex items-center text-gray-500 hover:text-primary mb-8">
                <ArrowLeft className="w-4 h-4 mr-2"/> {t.btn_back}
            </button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                        {/* Logo or Initial Fallback */}
                        {teacher.logo_url ? (
                            <img
                                src={teacher.logo_url}
                                alt={`${teacher.full_name} Logo`}
                                className="w-32 h-32 rounded-2xl object-contain bg-white border border-gray-100 p-1 mx-auto mb-4"
                            />
                        ) : (
                            <div className="w-32 h-32 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-primary text-4xl font-bold">
                                    {teacher.full_name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                            </div>
                        )}
                        <h1 className="text-2xl font-bold text-dark">{teacher.full_name}</h1>
                        {locationStr && (
                            <p className="text-gray-500 text-sm mb-2 flex items-center justify-center">
                                <MapPin className="w-3.5 h-3.5 mr-1" />{locationStr}
                            </p>
                        )}
                        {additionalLocations.length > 0 && (
                            <p className="text-gray-400 text-xs mb-4">
                                Weitere Standorte: {additionalLocations.map(l => l.canton ? `${l.city} (${l.canton})` : l.city).join(', ')}
                            </p>
                        )}
                        {(teacher.is_professional || teacher.verification_status === 'verified') && (
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" /> {t.lbl_professional_filter || 'Verifiziert'}
                            </span>
                        )}
                    </div>

                    {/* Contact Info */}
                    {(teacher.website_url || teacher.phone || teacher.email) && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                            <h3 className="font-bold text-dark text-sm mb-2">Kontakt</h3>
                            {teacher.website_url && (
                                <a href={teacher.website_url} target="_blank" rel="nofollow noopener" className="flex items-center text-sm text-gray-600 hover:text-primary transition-colors">
                                    <Globe className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                                    <span className="truncate">{teacher.website_url.replace(/^https?:\/\//, '')}</span>
                                </a>
                            )}
                            {teacher.show_email_publicly && teacher.email && (
                                <a href={`mailto:${teacher.email}`} className="flex items-center text-sm text-gray-600 hover:text-primary transition-colors">
                                    <Mail className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                                    <span className="truncate">{teacher.email}</span>
                                </a>
                            )}
                        </div>
                    )}
                </div>

                <div className="md:col-span-2 space-y-8">
                    {/* Bio */}
                    {teacher.bio_text && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">{t.lbl_bio || "Über mich"}</h2>
                            <div className="text-gray-600 leading-relaxed space-y-4 custom-rich-text">
                                {teacher.bio_text.split('\n').map((line, index) => {
                                    const escaped = line
                                        .replace(/&/g, '&amp;')
                                        .replace(/</g, '&lt;')
                                        .replace(/>/g, '&gt;')
                                        .replace(/"/g, '&quot;')
                                        .replace(/'/g, '&#039;');
                                    let formattedLine = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="text-dark font-bold">$1</strong>');
                                    formattedLine = formattedLine.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
                                    formattedLine = formattedLine.replace(/__(.*?)__/g, '<u class="underline">$1</u>');

                                    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                                        return <li key={index} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^[-*]\s/, '') }} />;
                                    }
                                    if (line.startsWith('## ')) {
                                        return <h2 key={index} className="text-2xl font-bold text-dark mt-6 mb-2" dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^##\s/, '') }} />;
                                    }
                                    if (line.startsWith('### ')) {
                                        return <h3 key={index} className="text-xl font-bold text-dark mt-4 mb-2" dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^###\s/, '') }} />;
                                    }
                                    return formattedLine.trim() ? <p key={index} dangerouslySetInnerHTML={{ __html: formattedLine }} /> : <br key={index} />;
                                })}
                            </div>
                        </section>
                    )}

                    {/* Certificates */}
                    {teacher.certificates && teacher.certificates.length > 0 && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">Zertifizierungen</h2>
                            <ul className="space-y-2">
                                {teacher.certificates.map((cert, i) => (
                                    <li key={i} className="flex items-center text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <Shield className="w-4 h-4 mr-3 text-green-500" /> {cert}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Courses */}
                    <section>
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">
                            Kurse von {teacher.full_name}
                            <span className="text-gray-400 font-normal text-base ml-2">({teacherCourses.length})</span>
                        </h2>

                        {/* Filter Bar */}
                        {teacherCourses.length > 3 && (
                            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Kurs suchen..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                    />
                                </div>
                                <div className="relative">
                                    <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <select
                                        value={sortBy}
                                        onChange={e => setSortBy(e.target.value)}
                                        className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                    >
                                        {SORT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {filteredCourses.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">
                                {searchQuery ? 'Keine Kurse gefunden.' : 'Momentan sind keine Kurse verfügbar.'}
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {filteredCourses.map(course => (
                                    <div key={course.id} onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md cursor-pointer transition">
                                        <img src={course.image_url || fallbackImage} className="w-full aspect-video object-cover" alt={course.title} />
                                        <div className="p-4">
                                            <h3 className="font-bold text-sm line-clamp-1">{course.title}</h3>
                                            {(course.canton || course.category_specialty) && (
                                                <p className="text-gray-400 text-xs mt-1 line-clamp-1">
                                                    {[course.category_specialty, course.canton].filter(Boolean).join(' · ')}
                                                </p>
                                            )}
                                            <p className="text-primary font-bold text-sm mt-2">{getPriceLabel(course)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TeacherProfileView;
