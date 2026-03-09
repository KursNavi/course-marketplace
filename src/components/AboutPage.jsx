import React, { useState } from 'react';
import { Search, Calendar, Smile, ArrowRight, Eye, Zap, Shield, Users, Rocket, ChevronDown, Heart, GraduationCap, Building2 } from 'lucide-react';

const AboutPage = ({ t, setView }) => {
    const [openSection, setOpenSection] = useState('you');

    const toggleSection = (key) => {
        setOpenSection(openSection === key ? null : key);
    };

    const missionCards = [
        { icon: Eye, titleKey: 'about_mission_1_title', textKey: 'about_mission_1_text' },
        { icon: Zap, titleKey: 'about_mission_2_title', textKey: 'about_mission_2_text' },
        { icon: Shield, titleKey: 'about_mission_3_title', textKey: 'about_mission_3_text' },
    ];

    const timelineSteps = [
        { icon: Eye, titleKey: 'about_timeline_1_title', textKey: 'about_timeline_1_text' },
        { icon: Users, titleKey: 'about_timeline_2_title', textKey: 'about_timeline_2_text' },
        { icon: Rocket, titleKey: 'about_timeline_3_title', textKey: 'about_timeline_3_text' },
    ];

    const audienceSections = [
        {
            key: 'you',
            icon: Heart,
            titleKey: 'about_you_title',
            textKey: 'about_you_text',
            image: '/images/platform/audience-you.svg',
            imageAlt: 'Hands on learning',
        },
        {
            key: 'kids',
            icon: GraduationCap,
            titleKey: 'about_kids_title',
            textKey: 'about_kids_text',
            subKey: 'about_kids_sub',
            image: '/images/platform/audience-kids.svg',
            imageAlt: 'Kids learning',
        },
        {
            key: 'providers',
            icon: Building2,
            titleKey: 'about_prov_title',
            textKey: 'about_prov_text',
            image: '/images/platform/audience-providers.svg',
            imageAlt: 'Teacher instructing',
        },
    ];

    return (
        <div className="font-sans">
            {/* HERO SECTION */}
            <div className="relative py-24 px-4 text-center text-white overflow-hidden" style={{ backgroundColor: '#2d2d2d' }}>
                <div className="absolute inset-0 z-0">
                    <img src="/images/platform/hero-community.svg" alt="Learning together" className="w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 bg-black/60"></div>
                </div>
                <div className="relative z-10 max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6 drop-shadow-md">{t.about_hero_title}</h1>
                    <p className="text-lg md:text-xl text-gray-100 max-w-2xl mx-auto drop-shadow-sm font-light leading-relaxed">{t.about_hero_teaser}</p>
                </div>
            </div>

            {/* MISSION AUF EINEN BLICK */}
            <div className="bg-beige py-16">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {missionCards.map(({ icon: Icon, titleKey, textKey }) => (
                            <div key={titleKey} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow duration-300">
                                <div className="w-14 h-14 bg-primaryLight text-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                                    <Icon className="w-7 h-7" />
                                </div>
                                <h3 className="font-bold text-lg text-dark font-heading mb-2">{t[titleKey]}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{t[textKey]}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* STORY TIMELINE */}
            <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 className="text-3xl font-bold text-dark font-heading mb-10">{t.about_story_title}</h2>
                    <div className="relative pl-8">
                        {/* Vertical connector line */}
                        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-primary/20"></div>
                        <div className="space-y-8">
                            {timelineSteps.map(({ icon: Icon, titleKey, textKey }) => (
                                <div key={titleKey} className="relative flex gap-5">
                                    {/* Timeline dot */}
                                    <div className="absolute -left-8 top-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm z-10">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-dark text-lg mb-1">{t[titleKey]}</h3>
                                        <p className="text-gray-600 leading-relaxed">{t[textKey]}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                    <img src="/images/platform/hero-professional.svg" alt="Team KursNavi" className="rounded-2xl shadow-xl w-full h-auto object-cover" />
                </div>
            </div>

            {/* WHAT WE DO (ICONS) */}
            <div className="bg-gray-50 py-20">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold text-dark font-heading mb-4">{t.about_what_title}</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto mb-16 text-lg">{t.about_what_intro}</p>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 relative">
                        {/* BOX 1 */}
                        <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex-1 flex flex-col items-center text-center z-10 relative">
                            <div className="w-20 h-20 bg-primaryLight text-primary rounded-2xl flex items-center justify-center mb-6 transform rotate-3 group-hover:rotate-6 transition-transform">
                                <Search className="w-10 h-10"/>
                            </div>
                            <h3 className="font-bold text-xl mb-2">{t.about_micro_1}</h3>
                            <p className="text-gray-500">{t.about_benefit_1}</p>
                        </div>

                        {/* CONNECTOR 1 */}
                        <div className="hidden md:block text-primary/30 z-0">
                            <ArrowRight className="w-12 h-12" />
                        </div>

                        {/* BOX 2 */}
                        <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex-1 flex flex-col items-center text-center z-10 relative">
                            <div className="w-20 h-20 bg-primaryLight text-primary rounded-2xl flex items-center justify-center mb-6 transform -rotate-3 group-hover:-rotate-6 transition-transform">
                                <Calendar className="w-10 h-10"/>
                            </div>
                            <h3 className="font-bold text-xl mb-2">{t.about_micro_2}</h3>
                            <p className="text-gray-500">{t.about_benefit_2}</p>
                        </div>

                        {/* CONNECTOR 2 */}
                        <div className="hidden md:block text-primary/30 z-0">
                            <ArrowRight className="w-12 h-12" />
                        </div>

                        {/* BOX 3 */}
                        <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex-1 flex flex-col items-center text-center z-10 relative">
                            <div className="w-20 h-20 bg-primaryLight text-primary rounded-2xl flex items-center justify-center mb-6 transform rotate-3 group-hover:rotate-6 transition-transform">
                                <Smile className="w-10 h-10"/>
                            </div>
                            <h3 className="font-bold text-xl mb-2">{t.about_micro_3}</h3>
                            <p className="text-gray-500">{t.about_benefit_4}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* AUDIENCE ACCORDION */}
            <div className="max-w-4xl mx-auto px-4 py-16">
                <div className="space-y-4">
                    {audienceSections.map(({ key, icon: Icon, titleKey, textKey, subKey, image, imageAlt }) => {
                        const isOpen = openSection === key;
                        return (
                            <div key={key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
                                <button
                                    id={`about-section-btn-${key}`}
                                    onClick={() => toggleSection(key)}
                                    aria-expanded={isOpen}
                                    aria-controls={`about-section-panel-${key}`}
                                    className="w-full flex items-center justify-between p-5 md:p-6 text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-primaryLight text-primary rounded-xl flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-5 h-5" aria-hidden="true" />
                                        </div>
                                        <span className="font-bold text-dark text-lg md:text-xl font-heading">{t[titleKey]}</span>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                </button>
                                <div id={`about-section-panel-${key}`} role="region" aria-labelledby={`about-section-btn-${key}`} className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="px-5 md:px-6 pb-6 border-t border-gray-100">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 items-center">
                                            <div>
                                                <p className="text-gray-600 text-lg leading-relaxed">{t[textKey]}</p>
                                                {subKey && (
                                                    <div className="mt-4 bg-primaryLight/30 p-4 rounded-lg border border-primary/20">
                                                        <p className="text-primary font-medium">{t[subKey]}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <img src={image} alt={imageAlt} className="rounded-xl shadow-lg w-full h-48 md:h-56 object-cover" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CTA SECTION */}
            <div className="bg-dark text-white py-20 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-bold font-heading mb-6">{t.about_promise_title}</h2>
                    <p className="text-xl text-gray-100 mb-10">{t.about_promise_text}</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={() => setView('search')} className="bg-primary text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-orange-600 transition shadow-lg hover:scale-105">{t.about_cta_primary}</button>
                        <button onClick={() => setView('login')} className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white hover:text-dark transition shadow-lg">{t.about_cta_secondary}</button>
                    </div>
                </div>
                <div className="mt-12 max-w-4xl mx-auto px-4">
                     <img src="/images/platform/hero-community.svg" alt="Happy group" className="rounded-2xl shadow-2xl w-full h-64 object-cover opacity-80" />
                </div>
            </div>
        </div>
    );
};

export default AboutPage;
