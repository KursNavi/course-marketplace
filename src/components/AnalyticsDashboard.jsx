import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart3, TrendingUp, Eye, Target, Lock, DollarSign, User, Loader,
    AlertCircle, ChevronUp, ChevronDown, ArrowUpRight, ArrowDownRight,
    Lightbulb, Image, Star, Crown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPriceCHF } from '../lib/formatPrice';
import { hasAnalyticsCharts, hasAnalyticsInsights } from '../lib/entitlements';

// --- MONTH LABELS (German) ---
const MONTH_LABELS = {
    '01': 'Jan', '02': 'Feb', '03': 'Mrz', '04': 'Apr',
    '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aug',
    '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez'
};

// --- DEMO DATA for blurred locked sections ---
const DEMO_MONTHLY = Array.from({ length: 12 }, (_, i) => ({
    month: `2025-${String(i + 1).padStart(2, '0')}`,
    total_bookings: Math.floor(Math.random() * 20) + 2,
    total_revenue_cents: Math.floor(Math.random() * 50000) + 5000,
    total_net_cents: Math.floor(Math.random() * 40000) + 4000,
    total_views: Math.floor(Math.random() * 500) + 50,
    total_detail_views: Math.floor(Math.random() * 200) + 20
}));

// --- BAR CHART (Pure CSS) ---
const BarChart = ({ data, valueKey, color = 'bg-primary', formatValue }) => {
    const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);

    return (
        <div className="flex items-end gap-1 h-40">
            {data.map((item, i) => {
                const val = item[valueKey] || 0;
                const pct = (val / maxVal) * 100;
                const monthNum = item.month?.split('-')[1];
                return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative min-w-0">
                        <div className="hidden group-hover:block absolute -top-8 bg-dark text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                            {formatValue ? formatValue(val) : val}
                        </div>
                        <div
                            className={`w-full ${color} rounded-t transition-all duration-300 group-hover:opacity-80`}
                            style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                        <span className="text-[10px] text-gray-400 mt-1 truncate w-full text-center">
                            {MONTH_LABELS[monthNum] || monthNum}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// --- LINE CHART (SVG) ---
const LineChart = ({ data, valueKey, color = '#FA6E28', formatValue }) => {
    const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
    const w = 600, h = 160, pad = 24;
    const stepX = data.length > 1 ? (w - 2 * pad) / (data.length - 1) : 0;

    const points = data.map((d, i) => ({
        x: pad + i * stepX,
        y: h - pad - ((d[valueKey] || 0) / maxVal) * (h - 2 * pad),
        value: d[valueKey] || 0,
        month: d.month
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = points.length > 0
        ? linePath + ` L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`
        : '';

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40" preserveAspectRatio="xMidYMid meet">
                {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                    <line key={pct} x1={pad} x2={w - pad}
                        y1={h - pad - pct * (h - 2 * pad)}
                        y2={h - pad - pct * (h - 2 * pad)}
                        stroke="#e5e7eb" strokeWidth="0.5" />
                ))}
                {areaPath && <path d={areaPath} fill={color} fillOpacity="0.08" />}
                {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2" className="cursor-pointer">
                        <title>{formatValue ? formatValue(p.value) : p.value} ({MONTH_LABELS[p.month?.split('-')[1]] || p.month})</title>
                    </circle>
                ))}
            </svg>
            {/* X-axis labels */}
            <div className="flex justify-between px-6">
                {data.map((item, i) => (
                    <span key={i} className="text-[10px] text-gray-400">
                        {MONTH_LABELS[item.month?.split('-')[1]] || ''}
                    </span>
                ))}
            </div>
        </div>
    );
};

// --- LOCKED OVERLAY ---
const LockedOverlay = ({ title, minTier, setDashView }) => (
    <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-white/95 p-6 rounded-xl shadow-lg text-center max-w-xs">
            <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="font-bold text-dark mb-1">{title}</p>
            <p className="text-sm text-gray-500 mb-3">
                Verfügbar ab {minTier === 'pro' ? 'Pro' : 'Premium'}
            </p>
            <button
                onClick={() => setDashView('subscription')}
                className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-orange-600 transition"
            >
                Jetzt upgraden
            </button>
        </div>
    </div>
);

// --- INSIGHT GENERATOR ---
const generateInsights = (coursePerformance, monthlyData, myCourses) => {
    const insights = [];

    if (!coursePerformance.length && !monthlyData.length) return insights;

    // Best performer
    if (coursePerformance.length > 0) {
        const best = coursePerformance[0]; // already sorted by bookings desc
        if (best.total_bookings > 0) {
            insights.push({
                icon: <Star className="w-5 h-5 text-yellow-500" />,
                text: `Dein bestperformender Kurs ist "${best.course_title}" mit ${best.total_bookings} Buchungen.`,
                type: 'success'
            });
        }
    }

    // Low conversion courses
    const lowConversion = coursePerformance.filter(
        c => c.total_detail_views > 10 && c.total_bookings === 0
    );
    if (lowConversion.length > 0) {
        insights.push({
            icon: <Target className="w-5 h-5 text-orange-500" />,
            text: `"${lowConversion[0].course_title}" hat ${lowConversion[0].total_detail_views} Detail-Aufrufe aber keine Buchungen. Preis oder Beschreibung optimieren?`,
            type: 'warning'
        });
    }

    // Courses without images
    const noImage = (myCourses || []).filter(c => !c.image_url);
    if (noImage.length > 0) {
        insights.push({
            icon: <Image className="w-5 h-5 text-blue-500" />,
            text: `${noImage.length} deiner Kurse ${noImage.length === 1 ? 'hat' : 'haben'} kein Bild. Kurse mit Bildern erhalten mehr Klicks.`,
            type: 'info'
        });
    }

    // Month-over-month growth
    if (monthlyData.length >= 2) {
        const last = monthlyData[monthlyData.length - 1];
        const prev = monthlyData[monthlyData.length - 2];
        if (prev.total_bookings > 0 && last.total_bookings > 0) {
            const growth = ((last.total_bookings - prev.total_bookings) / prev.total_bookings * 100).toFixed(0);
            if (growth > 0) {
                insights.push({
                    icon: <ArrowUpRight className="w-5 h-5 text-green-500" />,
                    text: `Deine Buchungen sind im Vergleich zum Vormonat um ${growth}% gestiegen.`,
                    type: 'success'
                });
            } else if (growth < 0) {
                insights.push({
                    icon: <ArrowDownRight className="w-5 h-5 text-red-500" />,
                    text: `Deine Buchungen sind im Vergleich zum Vormonat um ${Math.abs(growth)}% gesunken.`,
                    type: 'warning'
                });
            }
        }
    }

    return insights;
};

// --- MAIN COMPONENT ---
const AnalyticsDashboard = ({ user, userTier, courses, teacherEarnings, setDashView }) => {
    const [monthlyData, setMonthlyData] = useState([]);
    const [coursePerformance, setCoursePerformance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState(12);
    const [sortColumn, setSortColumn] = useState('total_bookings');
    const [sortDirection, setSortDirection] = useState('desc');
    const [compareIds, setCompareIds] = useState([]);

    const myCourses = useMemo(() =>
        (courses || []).filter(c => c.user_id === user?.id),
        [courses, user?.id]
    );

    const canCharts = hasAnalyticsCharts(userTier);
    const canInsights = hasAnalyticsInsights(userTier);

    // Load analytics data
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const { data: monthly, error: monthlyErr } = await supabase.rpc('get_provider_analytics', {
                    provider_id: user.id,
                    months_back: period
                });
                if (monthlyErr) throw monthlyErr;

                let coursePerf = [];
                if (canCharts) {
                    const { data, error: perfErr } = await supabase.rpc('get_course_performance', {
                        provider_id: user.id,
                        months_back: period
                    });
                    if (perfErr) throw perfErr;
                    coursePerf = data || [];
                }

                if (!cancelled) {
                    setMonthlyData(monthly || []);
                    setCoursePerformance(coursePerf);
                    setLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Analytics load error:', err);
                    setError(err.message);
                    setLoading(false);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [user?.id, userTier, period, canCharts]);

    // Computed totals
    const totals = useMemo(() => {
        const sum = (key) => monthlyData.reduce((acc, m) => acc + (Number(m[key]) || 0), 0);
        const totalBookings = sum('total_bookings');
        const totalDetailViews = sum('total_detail_views');
        return {
            bookings: totalBookings,
            revenueCents: sum('total_revenue_cents'),
            netCents: sum('total_net_cents'),
            views: sum('total_views'),
            detailViews: totalDetailViews,
            conversionRate: totalDetailViews > 0 ? (totalBookings / totalDetailViews * 100).toFixed(1) : '0.0'
        };
    }, [monthlyData]);

    // Sorted course performance
    const sortedCourses = useMemo(() => {
        return [...coursePerformance].sort((a, b) => {
            const aVal = Number(a[sortColumn]) || 0;
            const bVal = Number(b[sortColumn]) || 0;
            return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }, [coursePerformance, sortColumn, sortDirection]);

    // Comparison data
    const comparisonCourses = useMemo(() =>
        coursePerformance.filter(c => compareIds.includes(c.course_id)),
        [coursePerformance, compareIds]
    );

    // Insights
    const insights = useMemo(() =>
        canInsights ? generateInsights(coursePerformance, monthlyData, myCourses) : [],
        [coursePerformance, monthlyData, myCourses, canInsights]
    );

    const handleSort = (col) => {
        if (sortColumn === col) {
            setSortDirection(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortColumn(col);
            setSortDirection('desc');
        }
    };

    const toggleCompare = (courseId) => {
        setCompareIds(prev =>
            prev.includes(courseId)
                ? prev.filter(id => id !== courseId)
                : prev.length < 3 ? [...prev, courseId] : prev
        );
    };

    const SortIcon = ({ col }) => {
        if (sortColumn !== col) return <ChevronDown className="w-3 h-3 text-gray-300 ml-1 inline" />;
        return sortDirection === 'desc'
            ? <ChevronDown className="w-3 h-3 text-primary ml-1 inline" />
            : <ChevronUp className="w-3 h-3 text-primary ml-1 inline" />;
    };

    // --- LOADING STATE ---
    if (loading) {
        return (
            <div className="text-center py-20">
                <Loader className="animate-spin w-10 h-10 text-primary mx-auto" />
                <p className="text-gray-500 mt-3">Analytics werden geladen...</p>
            </div>
        );
    }

    // --- ERROR STATE ---
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="font-bold text-red-800">Fehler beim Laden der Analytics</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
        );
    }

    const hasData = totals.bookings > 0 || totals.views > 0;

    return (
        <div className="space-y-8">
            {/* --- HEADER --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold font-heading text-dark flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        Analytics
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Überblick über deine Kurs-Performance
                    </p>
                </div>
                {canCharts && (
                    <select
                        value={period}
                        onChange={e => setPeriod(Number(e.target.value))}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
                    >
                        <option value={3}>Letzte 3 Monate</option>
                        <option value={6}>Letzte 6 Monate</option>
                        <option value={12}>Letzte 12 Monate</option>
                    </select>
                )}
            </div>

            {/* --- SUMMARY CARDS (ALL TIERS) --- */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-sm text-gray-500">Buchungen</span>
                    </div>
                    <p className="text-2xl font-bold text-dark">{totals.bookings}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-sm text-gray-500">Einnahmen Brutto</span>
                    </div>
                    <p className="text-2xl font-bold text-dark">CHF {formatPriceCHF((totals.revenueCents / 100).toFixed(2))}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <span className="text-sm text-gray-500">Einnahmen Netto</span>
                    </div>
                    <p className="text-2xl font-bold text-dark">CHF {formatPriceCHF((totals.netCents / 100).toFixed(2))}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <Eye className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-sm text-gray-500">Kursaufrufe</span>
                    </div>
                    <p className="text-2xl font-bold text-dark">{totals.views}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <Target className="w-5 h-5 text-orange-600" />
                        </div>
                        <span className="text-sm text-gray-500">Conversion Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-dark">{totals.conversionRate}%</p>
                </div>
            </div>

            {/* --- EMPTY STATE --- */}
            {!hasData && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
                    <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="font-bold text-dark mb-1">Noch keine Daten</p>
                    <p className="text-sm text-gray-500">
                        Sobald du Buchungen oder Kursaufrufe erhältst, erscheinen hier deine Analytics.
                    </p>
                </div>
            )}

            {/* --- TIME SERIES CHARTS (PRO+) --- */}
            {hasData && (
                <div className="relative">
                    <div className={!canCharts ? 'filter blur-sm pointer-events-none opacity-50' : ''}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                <h3 className="font-bold text-dark mb-4 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-primary" />
                                    Buchungen pro Monat
                                </h3>
                                <BarChart
                                    data={canCharts ? monthlyData : DEMO_MONTHLY}
                                    valueKey="total_bookings"
                                    color="bg-primary"
                                />
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                <h3 className="font-bold text-dark mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-green-600" />
                                    Einnahmen pro Monat (CHF)
                                </h3>
                                <LineChart
                                    data={canCharts ? monthlyData : DEMO_MONTHLY}
                                    valueKey="total_revenue_cents"
                                    color="#16a34a"
                                    formatValue={v => `CHF ${formatPriceCHF((v / 100).toFixed(0))}`}
                                />
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2">
                                <h3 className="font-bold text-dark mb-4 flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-purple-600" />
                                    Kursaufrufe pro Monat
                                </h3>
                                <LineChart
                                    data={canCharts ? monthlyData : DEMO_MONTHLY}
                                    valueKey="total_views"
                                    color="#9333ea"
                                />
                            </div>
                        </div>
                    </div>
                    {!canCharts && <LockedOverlay title="Zeitverläufe" minTier="pro" setDashView={setDashView} />}
                </div>
            )}

            {/* --- COURSE PERFORMANCE TABLE (PRO+) --- */}
            {hasData && (
                <div className="relative">
                    <div className={!canCharts ? 'filter blur-sm pointer-events-none opacity-50' : ''}>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-bold text-dark flex items-center gap-2">
                                    <Target className="w-4 h-4 text-primary" />
                                    Kurs-Performance
                                </h3>
                                {canInsights && coursePerformance.length > 1 && (
                                    <span className="text-xs text-gray-400">
                                        Klicke auf ☐ um Kurse zu vergleichen (max. 3)
                                    </span>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-beige border-b border-gray-200">
                                        <tr>
                                            {canInsights && <th className="px-4 py-3 w-8"></th>}
                                            <th className="px-6 py-3 font-semibold text-gray-600 text-sm">Kurs</th>
                                            <th className="px-4 py-3 font-semibold text-gray-600 text-sm cursor-pointer whitespace-nowrap" onClick={() => handleSort('total_views')}>
                                                Views <SortIcon col="total_views" />
                                            </th>
                                            <th className="px-4 py-3 font-semibold text-gray-600 text-sm cursor-pointer whitespace-nowrap" onClick={() => handleSort('total_detail_views')}>
                                                Detail-Views <SortIcon col="total_detail_views" />
                                            </th>
                                            <th className="px-4 py-3 font-semibold text-gray-600 text-sm cursor-pointer whitespace-nowrap" onClick={() => handleSort('total_bookings')}>
                                                Buchungen <SortIcon col="total_bookings" />
                                            </th>
                                            <th className="px-4 py-3 font-semibold text-gray-600 text-sm cursor-pointer whitespace-nowrap" onClick={() => handleSort('total_revenue_cents')}>
                                                Umsatz <SortIcon col="total_revenue_cents" />
                                            </th>
                                            <th className="px-4 py-3 font-semibold text-gray-600 text-sm cursor-pointer whitespace-nowrap" onClick={() => handleSort('conversion_rate')}>
                                                Conv. Rate <SortIcon col="conversion_rate" />
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(canCharts ? sortedCourses : [
                                            { course_title: 'Beispielkurs A', total_views: 120, total_detail_views: 45, total_bookings: 8, total_revenue_cents: 32000, conversion_rate: 17.8 },
                                            { course_title: 'Beispielkurs B', total_views: 85, total_detail_views: 30, total_bookings: 3, total_revenue_cents: 12000, conversion_rate: 10.0 },
                                            { course_title: 'Beispielkurs C', total_views: 200, total_detail_views: 60, total_bookings: 12, total_revenue_cents: 48000, conversion_rate: 20.0 },
                                        ]).map((course, i) => (
                                            <tr key={course.course_id || i} className="hover:bg-gray-50">
                                                {canInsights && (
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={compareIds.includes(course.course_id)}
                                                            onChange={() => toggleCompare(course.course_id)}
                                                            className="rounded border-gray-300"
                                                            disabled={!compareIds.includes(course.course_id) && compareIds.length >= 3}
                                                        />
                                                    </td>
                                                )}
                                                <td className="px-6 py-3 font-medium text-dark max-w-[200px] truncate">{course.course_title}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{course.total_views}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{course.total_detail_views}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-dark">{course.total_bookings}</td>
                                                <td className="px-4 py-3 text-sm text-dark">CHF {formatPriceCHF(((course.total_revenue_cents || 0) / 100).toFixed(2))}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className={`font-medium ${Number(course.conversion_rate) >= 10 ? 'text-green-600' : Number(course.conversion_rate) >= 5 ? 'text-yellow-600' : 'text-gray-500'}`}>
                                                        {Number(course.conversion_rate).toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {canCharts && sortedCourses.length === 0 && (
                                            <tr>
                                                <td colSpan={canInsights ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                                                    Noch keine Kurs-Daten vorhanden.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    {!canCharts && <LockedOverlay title="Kurs-Performance" minTier="pro" setDashView={setDashView} />}
                </div>
            )}

            {/* --- COURSE COMPARISON (PREMIUM+) --- */}
            {canCharts && coursePerformance.length > 1 && (
                <div className="relative">
                    <div className={!canInsights ? 'filter blur-sm pointer-events-none opacity-50' : ''}>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                            <h3 className="font-bold text-dark mb-4 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-primary" />
                                Kurs-Vergleich
                            </h3>
                            {canInsights && comparisonCourses.length === 0 && (
                                <p className="text-sm text-gray-500">
                                    Wähle oben in der Tabelle bis zu 3 Kurse aus, um sie zu vergleichen.
                                </p>
                            )}
                            {comparisonCourses.length > 0 && (
                                <div className={`grid grid-cols-1 ${comparisonCourses.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
                                    {comparisonCourses.map(course => (
                                        <div key={course.course_id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                            <h4 className="font-bold text-dark text-sm mb-3 truncate">{course.course_title}</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between"><span className="text-gray-500">Views</span><span className="font-medium">{course.total_views}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Detail-Views</span><span className="font-medium">{course.total_detail_views}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Buchungen</span><span className="font-bold text-dark">{course.total_bookings}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Umsatz</span><span className="font-bold text-dark">CHF {formatPriceCHF(((course.total_revenue_cents || 0) / 100).toFixed(2))}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Conversion</span><span className={`font-bold ${Number(course.conversion_rate) >= 10 ? 'text-green-600' : 'text-orange-500'}`}>{Number(course.conversion_rate).toFixed(1)}%</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    {!canInsights && <LockedOverlay title="Kurs-Vergleich" minTier="premium" setDashView={setDashView} />}
                </div>
            )}

            {/* --- INSIGHTS & RECOMMENDATIONS (PREMIUM+) --- */}
            {hasData && (
                <div className="relative">
                    <div className={!canInsights ? 'filter blur-sm pointer-events-none opacity-50' : ''}>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                            <h3 className="font-bold text-dark mb-4 flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-yellow-500" />
                                Insights & Empfehlungen
                            </h3>
                            {canInsights && insights.length > 0 ? (
                                <div className="space-y-3">
                                    {insights.map((insight, i) => (
                                        <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                                            insight.type === 'success' ? 'bg-green-50' :
                                            insight.type === 'warning' ? 'bg-yellow-50' :
                                            'bg-blue-50'
                                        }`}>
                                            {insight.icon}
                                            <p className="text-sm text-dark">{insight.text}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : canInsights ? (
                                <p className="text-sm text-gray-500">
                                    Sobald mehr Daten vorhanden sind, erscheinen hier personalisierte Empfehlungen.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50">
                                        <Star className="w-5 h-5 text-yellow-500" />
                                        <p className="text-sm text-dark">Dein bestperformender Kurs ist "Beispielkurs" mit 12 Buchungen.</p>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50">
                                        <Target className="w-5 h-5 text-orange-500" />
                                        <p className="text-sm text-dark">Ein Kurs hat viele Views aber wenige Buchungen. Preis anpassen?</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {!canInsights && <LockedOverlay title="Insights & Empfehlungen" minTier="premium" setDashView={setDashView} />}
                </div>
            )}

            {/* --- UPGRADE TEASER (if not Premium+) --- */}
            {!canInsights && (
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-6 text-center">
                    <Crown className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="font-bold text-dark mb-1">Erweiterte Analytics freischalten</p>
                    <p className="text-sm text-gray-600 mb-4">
                        {!canCharts
                            ? 'Mit Pro erhältst du Zeitverläufe und Kurs-Performance. Mit Premium zusätzlich Insights und Kurs-Vergleich.'
                            : 'Upgrade auf Premium für Kurs-Vergleich, Insights und personalisierte Empfehlungen.'
                        }
                    </p>
                    <button
                        onClick={() => setDashView('subscription')}
                        className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-600 transition shadow-lg"
                    >
                        Jetzt upgraden
                    </button>
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;
