"""Patches Dashboard.jsx: restructures teacher overview into 3 tiles + new views."""
import sys

with open('src/components/Dashboard.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines are 1-indexed in editor but 0-indexed in Python
# Keep lines 1-2394 (0..2393) = everything through end of merkliste block
# Insert new sections
# Keep lines 2791-end (2790..) = student view and beyond

keep_before = lines[:2394]
keep_after  = lines[2790:]

NEW_CONTENT = """\
             ) :
             dashView === 'kursangebot' ? (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold font-heading text-dark">Meine Kurse</h2>
                        <button
                            onClick={() => handleEditCourse(null)}
                            className="px-5 py-2.5 rounded-xl font-bold flex items-center shadow-lg transition font-heading bg-primary text-white hover:bg-orange-600 hover:-translate-y-0.5"
                        >
                            <KursNaviLogo className="mr-2 w-5 h-5 text-white" />
                            {t.dash_new_course}
                        </button>
                    </div>

                    {currentPlan?.maxPrioCourses > 0 && myCourses.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5">
                            <div className="flex items-start gap-3">
                                <Star className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-dark">Prio-Kurse</p>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Markierte Kurse erscheinen weiter oben in den Suchergebnissen von KursNavi.{' '}
                                        {isEnterprisePlan
                                            ? 'Du hast unbegrenzte Prio-Slots (Enterprise).'
                                            : `Du hast bereits ${prioCourseIds.size} von ${currentPlan.maxPrioCourses} Prio-Slots vergeben.`
                                        }{' '}
                                        Klicke auf das Sternchen neben einem Kurs, um ihn zu priorisieren oder zu depriorisieren.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {myCourses.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-beige border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-gray-600">Kursname</th>
                                            <th className="px-6 py-4 font-semibold text-gray-600">Status</th>
                                            {currentPlan?.maxPrioCourses > 0 && !isEnterprisePlan && (
                                                <th className="px-4 py-4 font-semibold text-gray-600 text-center w-16">Prio</th>
                                            )}
                                            <th className="px-6 py-4 font-semibold text-gray-600">Aktionen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {myCourses.map(course => {
                                            const isPrio = prioCourseIds.has(course.id);
                                            const canEnablePrio = isPrio || prioCourseIds.size < (currentPlan?.maxPrioCourses || 0);
                                            const allPrio = currentPlan?.maxPrioCourses > 0 && (isEnterprisePlan || myCourses.length <= (currentPlan?.maxPrioCourses || 0));
                                            return (
                                                <React.Fragment key={course.id}>
                                                    <tr className={`hover:bg-gray-50 ${(allPrio || isPrio) ? 'bg-yellow-50/30' : ''}`}>
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-dark flex items-center gap-2">
                                                                {course.title}
                                                                {(allPrio || isPrio) && (
                                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-0.5">
                                                                        <Star className="w-3 h-3 fill-yellow-500" /> Prio
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {course.status === 'draft' ? (
                                                                <button
                                                                    onClick={() => handleUpdateCourseStatus(course.id, 'published')}
                                                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold bg-yellow-100 text-yellow-700 border border-yellow-200 hover:bg-green-100 hover:text-green-700 hover:border-green-200 transition"
                                                                    title="Klicken zum Veröffentlichen"
                                                                >
                                                                    <EyeOff className="w-3 h-3" /> Entwurf
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleUpdateCourseStatus(course.id, 'draft')}
                                                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold bg-green-100 text-green-700 border border-green-200 hover:bg-yellow-100 hover:text-yellow-700 hover:border-yellow-200 transition"
                                                                    title="Klicken für Entwurf"
                                                                >
                                                                    <Eye className="w-3 h-3" /> Veröffentlicht
                                                                </button>
                                                            )}
                                                        </td>
                                                        {currentPlan?.maxPrioCourses > 0 && !isEnterprisePlan && (
                                                            <td className="px-4 py-4 text-center">
                                                                <label className="relative inline-flex items-center cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isPrio}
                                                                        onChange={() => handleTogglePrio(course.id, isPrio)}
                                                                        disabled={!canEnablePrio && !isPrio}
                                                                        className="sr-only peer"
                                                                    />
                                                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${isPrio ? 'bg-yellow-400 border-yellow-500' : canEnablePrio ? 'bg-white border-gray-300 hover:border-yellow-400' : 'bg-gray-100 border-gray-200 cursor-not-allowed'}`}>
                                                                        {isPrio && <Star className="w-4 h-4 text-white fill-white" />}
                                                                    </div>
                                                                </label>
                                                            </td>
                                                        )}
                                                        <td className="px-6 py-4">
                                                            <div className="flex gap-2">
                                                                <button onClick={() => handleEditCourse(course)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full" title="Bearbeiten"><PenTool className="w-4 h-4" /></button>
                                                                <button onClick={() => handleDeleteCourse(course.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-full" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                                                                {course.booking_type === 'platform' && course.course_events?.length > 0 && (
                                                                    <button
                                                                        onClick={() => setExpandedCourseEvents(expandedCourseEvents === course.id ? null : course.id)}
                                                                        className={`text-gray-500 hover:text-gray-700 p-2 rounded-full ${expandedCourseEvents === course.id ? 'bg-gray-200' : 'bg-gray-50'}`}
                                                                        title="Termine anzeigen"
                                                                    >
                                                                        <Calendar className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {expandedCourseEvents === course.id && course.course_events?.length > 0 && (
                                                        <tr>
                                                            <td colSpan="99" className="px-6 py-3 bg-gray-50">
                                                                <div className="text-sm font-bold text-gray-600 mb-2">Termine für «{course.title}»</div>
                                                                <div className="space-y-2">
                                                                    {course.course_events
                                                                        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                                                                        .map(ev => {
                                                                            const isCancelled = !!ev.cancelled_at;
                                                                            const bookingCount = ev.bookings?.[0]?.count || 0;
                                                                            return (
                                                                                <div key={ev.id} className={`flex items-center justify-between p-3 rounded-lg border ${isCancelled ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                                                                                    <div className="flex items-center gap-3">
                                                                                        <Calendar className={`w-4 h-4 flex-shrink-0 ${isCancelled ? 'text-red-400' : 'text-gray-400'}`} />
                                                                                        <div>
                                                                                            <span className={`font-medium ${isCancelled ? 'text-red-600 line-through' : 'text-dark'}`}>
                                                                                                {ev.start_date ? new Date(ev.start_date).toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'}
                                                                                            </span>
                                                                                            {ev.location && <span className="text-gray-500 text-xs ml-2">{ev.location}</span>}
                                                                                            {bookingCount > 0 && <span className="text-xs text-blue-600 ml-2">({bookingCount} Buchung{bookingCount !== 1 ? 'en' : ''})</span>}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        {isCancelled ? (
                                                                                            <span className="text-xs px-2 py-1 rounded font-bold bg-red-100 text-red-700 border border-red-200">Abgesagt</span>
                                                                                        ) : (
                                                                                            <button
                                                                                                onClick={() => openCancelEventDialog(ev.id)}
                                                                                                disabled={cancellingEventId === ev.id}
                                                                                                className="text-xs px-3 py-1.5 rounded-lg font-medium text-red-600 hover:text-red-700 hover:bg-red-100 border border-red-200 transition disabled:opacity-50"
                                                                                            >
                                                                                                {cancellingEventId === ev.id ? 'Wird abgesagt...' : 'Termin absagen'}
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">Du hast noch keine Kurse erstellt.</div>
                        )}
                    </div>

                    <div className="bg-gradient-to-r from-orange-50 to-white p-6 rounded-xl border border-orange-100 shadow-sm mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-white p-3 rounded-full shadow-sm border border-orange-100 text-primary hidden md:block">
                                <PenTool className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-dark font-heading">Keine Zeit, Kurse zu erfassen?</h3>
                                <p className="text-sm text-gray-600 mt-1 max-w-lg">Wir übernehmen das für dich! Sende uns einfach deine Unterlagen (PDF/Link). Wir optimieren Texte &amp; Bilder.</p>
                                <div className="flex flex-wrap gap-4 mt-3 text-xs font-medium text-gray-500">
                                    <span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1 text-green-500"/> SEO-Optimierung</span>
                                    <span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1 text-green-500"/> Bild-Bearbeitung</span>
                                    <span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1 text-green-500"/> Qualitäts-Check</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <span className="text-xs text-gray-400 mb-1 bg-white px-2 py-0.5 rounded border">ab 4. Kurs günstiger</span>
                            <button
                                type="button"
                                onClick={() => setShowCaptureServiceModal(true)}
                                className="bg-white border-2 border-primary text-primary px-5 py-2 rounded-lg font-bold shadow-sm hover:bg-primary hover:text-white transition whitespace-nowrap flex items-center"
                            >
                                Service buchen (ab CHF 50.-) <ArrowRight className="w-4 h-4 ml-2"/>
                            </button>
                        </div>
                    </div>
                </div>
             ) :
             dashView === 'anderes' ? (
                <div>
                    <div className="bg-dark text-white rounded-xl p-6 mb-8 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 className="w-32 h-32" /></div>
                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                            <div>
                                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Dein Plan</h3>
                                <div className="flex items-center gap-2">
                                    {userTier === 'basic' ? <User className="w-6 h-6 text-gray-300" /> : <Crown className="w-6 h-6 text-yellow-400" />}
                                    <span className="text-2xl font-bold capitalize">{currentPlan.title}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    {isEnterprisePlan ? 'Unbegrenzte Prio-Kurse' : `${currentPlan.maxPrioCourses} Prio-Kurse`} • bis {currentPlan.maxCategoriesPerCourse} Kategorien/Kurs • {currentPlan.includedCaptureServices > 0 ? `${currentPlan.includedCaptureServices} Erfassungsservices inkl.` : 'keine Erfassungsservices inklusive'}
                                </p>
                                {packageExpiresAt && userTier !== 'basic' && (
                                    <p className="text-xs text-yellow-400 mt-1">Gültig bis: {new Date(packageExpiresAt).toLocaleDateString('de-CH')}</p>
                                )}
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-300">Aktive Kurse</span>
                                    <span className="text-green-400 font-bold">{courseCount}</span>
                                </div>
                                <div className="text-xs text-gray-400">Kursanzahl ist in allen Paketen unbegrenzt.</div>
                            </div>
                            <div className="text-right">
                                {userTier !== 'enterprise' && (
                                    <button type="button" onClick={() => setDashView('subscription')} className="bg-white text-dark px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition shadow-lg">
                                        Abo upgraden / verwalten
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4"><DollarSign className="text-green-600" /></div><div><p className="text-sm text-gray-500">Einnahmen (Platform)</p><p className="text-2xl font-bold text-dark">CHF {formatPriceCHF(totalPaidOut.toFixed(2))}</p></div></div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4"><User className="text-blue-600" /></div><div><p className="text-sm text-gray-500">Buchungen Total</p><p className="text-2xl font-bold text-dark">{teacherEarnings.length}</p></div></div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4"><Clock className="text-purple-600" /></div><div><p className="text-sm text-gray-500">Aktive Kurse</p><p className="text-2xl font-bold text-dark">{courseCount}</p></div></div>
                    </div>

                    <h2 className="text-xl font-bold mb-4 font-heading text-dark">Buchungs-Historie (Schüler)</h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                        {teacherEarnings.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-beige border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Datum</th><th className="px-6 py-4 font-semibold text-gray-600">Kurs</th><th className="px-6 py-4 font-semibold text-gray-600">Schüler</th><th className="px-6 py-4 font-semibold text-gray-600">Auszahlung (Netto)</th><th className="px-6 py-4 font-semibold text-gray-600">Status</th><th className="px-6 py-4 font-semibold text-gray-600">Aktion</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">{teacherEarnings.map(earning => {
                                        const isFlex = earning.bookingType === 'platform_flex';
                                        const isPartialGoodwillRefund = earning.goodwillStatus === 'approved' && earning.goodwillRefundPercent > 0 && earning.goodwillRefundPercent < 100;
                                        const canDeliver = isFlex && !earning.isPaidOut && !earning.deliveredAt && !earning.disputedAt && !earning.refundedAt && earning.goodwillStatus !== 'pending';
                                        const hasPendingGoodwill = earning.goodwillStatus === 'pending';
                                        const tooEarly = canDeliver && earning.paidAt && new Date() < new Date(new Date(earning.paidAt).getTime() + 48 * 60 * 60 * 1000);
                                        return (
                                            <tr key={earning.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-sm text-gray-500">{earning.date}</td>
                                                <td className="px-6 py-4 font-medium text-dark">{earning.courseTitle}{isFlex && <span className="ml-2 text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Flex</span>}</td>
                                                <td className="px-6 py-4 text-gray-700">{earning.studentName}</td>
                                                <td className="px-6 py-4 font-bold text-dark">CHF {formatPriceCHF(earning.payout.toFixed(2))}</td>
                                                <td className="px-6 py-4">{earning.isPaidOut
                                                    ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Bezahlt</span>
                                                    : isPartialGoodwillRefund ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Teilweise erstattet</span>
                                                    : earning.refundedAt ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Erstattet</span>
                                                    : hasPendingGoodwill ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Kulanzanfrage offen</span>
                                                    : earning.disputedAt ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Einspruch</span>
                                                    : isFlex && !earning.deliveredAt ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Warte auf Bestätigung</span>
                                                    : isFlex && earning.deliveredAt ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Auszahlung geplant</span>
                                                    : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Offen</span>
                                                }</td>
                                                <td className="px-6 py-4">
                                                    {hasPendingGoodwill && (
                                                        <button type="button" disabled={goodwillSubmittingId === earning.id} onClick={() => openGoodwillDecisionDialog(earning.id, earning.studentName, earning.goodwillRequestMessage)} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200">
                                                            {goodwillSubmittingId === earning.id ? <Loader className="w-3 h-3 mr-1 animate-spin" /> : <Info className="w-3 h-3 mr-1" />}
                                                            Kulanz entscheiden
                                                        </button>
                                                    )}
                                                    {!hasPendingGoodwill && canDeliver && (
                                                        <button type="button" disabled={tooEarly || deliveringBookingId === earning.id} onClick={() => openDeliveredDialog(earning.id)} className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition ${tooEarly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`} title={tooEarly ? 'Frühestens 48h nach Zahlung möglich' : 'Buchung als durchgeführt markieren'}>
                                                            {deliveringBookingId === earning.id ? <Loader className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                                                            {tooEarly ? '48h-Sperre' : 'Durchgeführt'}
                                                        </button>
                                                    )}
                                                    {!hasPendingGoodwill && isFlex && earning.deliveredAt && !earning.isPaidOut && (
                                                        <span className="inline-flex items-center text-xs text-green-600"><Check className="w-3 h-3 mr-1" />Bestätigt</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}</tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">Noch keine Buchungen über die Plattform.</div>
                        )}
                    </div>

                    <h2 className="text-xl font-bold mb-4 font-heading text-dark">Weitere Funktionen</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button onClick={() => setDashView('analytics')} className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-primary hover:shadow-md transition group">
                            <BarChart3 className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold text-dark">Analytics</h3>
                            <p className="text-sm text-gray-500 mt-1">Detaillierte Statistiken: Aufrufe, Buchungstrends und Umsatzentwicklung</p>
                        </button>
                        <button onClick={() => setDashView('subscription')} className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-primary hover:shadow-md transition group">
                            <Crown className="w-8 h-8 text-yellow-500 mb-3 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold text-dark">Abonnement</h3>
                            <p className="text-sm text-gray-500 mt-1">Dein aktuelles Paket verwalten, upgraden oder kündigen</p>
                        </button>
                        <button onClick={() => setDashView('merkliste')} className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-primary hover:shadow-md transition group">
                            <Eye className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold text-dark">Merkliste</h3>
                            <p className="text-sm text-gray-500 mt-1">Gemerkte Kurse anderer Anbieter – praktisch für die Wettbewerbsanalyse</p>
                        </button>
                    </div>
                </div>
             ) : (
                <>
                {user.role === 'teacher' ? (
                    <>
                        <p className="text-gray-500 mb-8">Wähle einen Bereich, um loszulegen.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <button
                                onClick={() => setDashView('kursangebot')}
                                className="bg-white border-2 border-gray-100 rounded-2xl p-8 text-left hover:border-primary hover:shadow-xl transition group cursor-pointer"
                            >
                                <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                                    <PenTool className="w-7 h-7 text-primary group-hover:text-white transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold text-dark font-heading mb-2">Kursangebot</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">Deine Kurse ansehen, neue einstellen oder bestehende bearbeiten und löschen.</p>
                            </button>
                            <button
                                onClick={() => setDashView('profile')}
                                className="bg-white border-2 border-gray-100 rounded-2xl p-8 text-left hover:border-primary hover:shadow-xl transition group cursor-pointer"
                            >
                                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                                    <User className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold text-dark font-heading mb-2">Profil</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">Dein öffentliches Profil: Name, Biografie, Fotos und Standort für die Kursseite.</p>
                            </button>
                            <button
                                onClick={() => setDashView('anderes')}
                                className="bg-white border-2 border-gray-100 rounded-2xl p-8 text-left hover:border-primary hover:shadow-xl transition group cursor-pointer"
                            >
                                <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                                    <Settings className="w-7 h-7 text-purple-600 group-hover:text-white transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold text-dark font-heading mb-2">Anderes</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">Statistiken, Buchungshistorie, Einnahmen und Abonnement verwalten.</p>
                            </button>
                        </div>
                    </>
"""

new_lines = NEW_CONTENT.splitlines(keepends=True)

result = keep_before + new_lines + keep_after

with open('src/components/Dashboard.jsx', 'w', encoding='utf-8') as f:
    f.writelines(result)

print(f"Done. New total lines: {len(result)}")
