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
                        <p className="text-gray-500 text-sm mb-2">{teacher.city}, {teacher.canton}</p>
                        {teacher.additional_locations && (() => {
                            let locations = [];
                            try {
                                const parsed = JSON.parse(teacher.additional_locations);
                                if (Array.isArray(parsed)) locations = parsed;
                            } catch {
                                // Legacy comma string
                                locations = teacher.additional_locations.split(',').map(s => ({ city: s.trim(), canton: '' }));
                            }
                            const filtered = locations.filter(l => l.city);
                            if (filtered.length === 0) return null;
                            return (
                                <p className="text-gray-400 text-xs mb-4">
                                    Weitere Standorte: {filtered.map(l => l.canton ? `${l.city} (${l.canton})` : l.city).join(', ')}
                                </p>
                            );
                        })()}
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
                        <div className="text-gray-600 leading-relaxed space-y-4 custom-rich-text">
                            {teacher.bio_text ? teacher.bio_text.split('\n').map((line, index) => {
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
                            }) : <p>Dieser Lehrer hat noch keine Biografie hinterlegt.</p>}
                        </div>
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