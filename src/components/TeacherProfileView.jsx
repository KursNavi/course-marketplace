import React from 'react';
import { ArrowLeft, CheckCircle, Shield } from 'lucide-react';

const TeacherProfileView = ({ teacher, courses, setView, setSelectedCourse, t }) => {
    const teacherCourses = courses.filter(c => c.user_id === teacher.id);

    return (
        <div className="max-w-5xl mx-auto px-4 py-12 font-sans">
            <button onClick={() => window.history.back()} className="flex items-center text-gray-500 hover:text-primary mb-8">
                <ArrowLeft className="w-4 h-4 mr-2"/> {t.btn_back}
            </button>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="w-32 h-32 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-primary text-4xl font-bold">
                            {teacher.full_name?.charAt(0)}
                        </div>
                        <h1 className="text-2xl font-bold text-dark">{teacher.full_name}</h1>
                        <p className="text-gray-500 text-sm mb-4">{teacher.city}, {teacher.canton}</p>
                        {teacher.is_professional && (
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" /> Professional
                            </span>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 space-y-8">
                    <section>
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">{t.lbl_bio || "Über mich"}</h2>
                        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {teacher.bio_text || "Dieser Lehrer hat noch keine Biografie hinterlegt."}
                        </p>
                    </section>

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

                    <section>
                        <h2 className="text-xl font-bold mb-6 border-b pb-2">Kurse von {teacher.full_name}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {teacherCourses.map(course => (
                                <div key={course.id} onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md cursor-pointer transition">
                                    <img src={course.image_url} className="w-full h-32 object-cover" />
                                    <div className="p-4">
                                        <h3 className="font-bold text-sm line-clamp-1">{course.title}</h3>
                                        <p className="text-primary font-bold text-sm mt-2">CHF {course.price}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TeacherProfileView;