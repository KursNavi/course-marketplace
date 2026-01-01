import React from 'react';
import { Search, Calendar, Smile, ArrowRight } from 'lucide-react';

const AboutPage = ({ t, setView }) => (
    <div className="font-sans">
        {/* HERO SECTION */}
        <div className="relative py-24 px-4 text-center text-white overflow-hidden" style={{ backgroundColor: '#2d2d2d' }}>
            <div className="absolute inset-0 z-0">
                <img src="https://images.unsplash.com/photo-1544928147-79a2dbc1f389?auto=format&fit=crop&q=80&w=2000" alt="Learning together" className="w-full h-full object-cover opacity-50" />
                <div className="absolute inset-0 bg-black/60"></div>
            </div>
            <div className="relative z-10 max-w-4xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6 drop-shadow-md">{t.about_hero_title}</h1>
                <p className="text-lg md:text-xl text-gray-100 max-w-2xl mx-auto drop-shadow-sm font-light leading-relaxed mb-8">{t.about_hero_teaser}</p>
            </div>
        </div>

        {/* STORY SECTION */}
        <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
                <h2 className="text-3xl font-bold text-dark font-heading mb-6">{t.about_story_title}</h2>
                <div className="space-y-4 text-gray-600 text-lg leading-relaxed">
                    <p>{t.about_story_text_1}</p>
                    <p>{t.about_story_text_2}</p>
                    <p>{t.about_story_text_3}</p>
                </div>
            </div>
            <div>
                <img src="https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&q=80&w=1200" alt="Team KursNavi" className="rounded-2xl shadow-xl w-full h-auto object-cover transform hover:scale-105 transition-transform duration-500" />
            </div>
        </div>

        {/* WHAT WE DO (ICONS) - REDESIGNED */}
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

        {/* FOR YOU - FIXED IMAGE */}
        <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
                <img src="https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&q=80&w=1200" alt="Hands on learning" className="rounded-2xl shadow-xl w-full h-auto object-cover" />
            </div>
            <div className="order-1 md:order-2">
                <h2 className="text-3xl font-bold text-dark font-heading mb-6">{t.about_you_title}</h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">{t.about_you_text}</p>
            </div>
        </div>

        {/* FOR KIDS - FIXED IMAGE */}
        <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center bg-white">
            <div>
                <h2 className="text-3xl font-bold text-dark font-heading mb-6">{t.about_kids_title}</h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">{t.about_kids_text}</p>
                <div className="bg-primaryLight/30 p-4 rounded-lg border border-primary/20">
                     <p className="text-primary font-medium">{t.about_kids_sub}</p>
                </div>
            </div>
            <div>
                <img src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&q=80&w=1200" alt="Kids learning" className="rounded-2xl shadow-xl w-full h-auto object-cover" />
            </div>
        </div>

        {/* FOR PROVIDERS */}
        <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
                <img src="https://images.unsplash.com/photo-1544531586-fde5298cdd40?auto=format&fit=crop&q=80&w=1200" alt="Teacher instructing" className="rounded-2xl shadow-xl w-full h-auto object-cover" />
            </div>
            <div className="order-1 md:order-2">
                <h2 className="text-3xl font-bold text-dark font-heading mb-6">{t.about_prov_title}</h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">{t.about_prov_text}</p>
            </div>
        </div>

        {/* CTA SECTION */}
        <div className="bg-dark text-white py-20 text-center">
            <div className="max-w-3xl mx-auto px-4">
                <h2 className="text-3xl font-bold font-heading mb-6">{t.about_promise_title}</h2>
                <p className="text-xl text-gray-300 mb-10">{t.about_promise_text}</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => setView('search')} className="bg-primary text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-orange-600 transition shadow-lg hover:scale-105">{t.about_cta_primary}</button>
                    <button onClick={() => setView('login')} className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white hover:text-dark transition shadow-lg">{t.about_cta_secondary}</button>
                </div>
            </div>
            <div className="mt-12 max-w-4xl mx-auto px-4">
                 <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=1200" alt="Happy group" className="rounded-2xl shadow-2xl w-full h-64 object-cover opacity-80" />
            </div>
        </div>
    </div>
);

export default AboutPage;