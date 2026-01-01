import React, { useState } from 'react';
import { Smile, Briefcase, HelpCircle, Plus, Minus } from 'lucide-react';

const HowItWorksPage = ({ t, setView }) => {
    // Accordion State inside the component
    const [openFaq, setOpenFaq] = useState(null);
    const toggleFaq = (index) => {
        setOpenFaq(openFaq === index ? null : index);
    };

    const faqs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    return (
        <div className="font-sans bg-beige min-h-screen">
            {/* HERO */}
            <div className="bg-dark text-white py-20 px-4 text-center">
                <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6">{t.how_it_works}</h1>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto">Einfach, sicher und transparent. So findest du deinen nächsten Kurs oder startest als Anbieter durch.</p>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-16">
                
                {/* DUAL PROCESS SECTION */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
                    {/* STUDENTS */}
                    <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition duration-300">
                        <div className="absolute top-0 right-0 bg-orange-100 w-32 h-32 rounded-bl-full -mr-8 -mt-8 z-0"></div>
                        <h2 className="text-2xl font-bold text-primary mb-10 flex items-center relative z-10">
                            <Smile className="mr-3 w-8 h-8"/> {t.for_students}
                        </h2>
                        <div className="space-y-10 relative z-10">
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-primaryLight text-primary rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">1</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.student_step_1}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.student_desc_1}</p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-primaryLight text-primary rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">2</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.student_step_2}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.student_desc_2}</p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-primaryLight text-primary rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">3</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.student_step_3}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.student_desc_3}</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-10 text-center">
                            <button onClick={() => setView('search')} className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-md w-full sm:w-auto">
                                {t.btn_explore}
                            </button>
                        </div>
                    </div>

                    {/* TUTORS */}
                    <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition duration-300">
                        <div className="absolute top-0 right-0 bg-blue-100 w-32 h-32 rounded-bl-full -mr-8 -mt-8 z-0"></div>
                        <h2 className="text-2xl font-bold text-blue-600 mb-10 flex items-center relative z-10">
                            <Briefcase className="mr-3 w-8 h-8"/> {t.for_tutors}
                        </h2>
                        <div className="space-y-10 relative z-10">
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">1</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.tutor_step_1}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.tutor_desc_1}</p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">2</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.tutor_step_2}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.tutor_desc_2}</p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">3</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.tutor_step_3}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.tutor_desc_3}</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-10 text-center">
                            <button onClick={() => setView('login')} className="bg-white border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition shadow-md w-full sm:w-auto">
                                {t.cta_btn}
                            </button>
                        </div>
                    </div>
                </div>

                {/* FAQ SECTION */}
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <HelpCircle className="w-8 h-8 text-gray-600"/>
                        </div>
                        <h2 className="text-3xl font-bold text-dark font-heading">{t.faq_title}</h2>
                    </div>

                    <div className="space-y-4">
                        {faqs.map((i) => (
                            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
                                <button 
                                    onClick={() => toggleFaq(i)}
                                    className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                                >
                                    <span className="font-bold text-dark text-lg pr-4">{t[`faq_q${i}`]}</span>
                                    {openFaq === i ? <Minus className="w-5 h-5 text-primary flex-shrink-0" /> : <Plus className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                                </button>
                                <div 
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                                >
                                    <div className="p-5 pt-0 text-gray-600 leading-relaxed border-t border-gray-100 mt-2">
                                        {t[`faq_a${i}`]}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* BOTTOM CTA */}
                <div className="mt-24 text-center bg-dark p-12 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold text-white mb-6 font-heading">{t.cta_title}</h2>
                        <p className="text-gray-300 mb-8 max-w-2xl mx-auto text-lg">{t.cta_subtitle}</p>
                        <button onClick={() => setView('login')} className="bg-primary text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-orange-600 transition shadow-lg hover:scale-105">
                            {t.cta_btn}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HowItWorksPage;