import { Head } from '@inertiajs/react';
import {
    BarChart3,
    Calendar,
    CheckCircle2,
    ChevronDown,
    Clock,
    Database,
    Flame,
    Layers,
    Loader2,
    PieChart,
    Sparkles,
    TrendingUp,
    Trophy,
    Users,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

export interface HourlyData {
    hour: string;
    count: number;
    label?: string;
    range?: string;
    is_current?: boolean;
    is_future?: boolean;
}

export interface BlockData {
    label: string;
    count: number;
}

export interface DayComparison {
    date: string;
    day_number: number;
    day_name: string;
    short_label: string;
    total_entered: number;
    peak_hour: string;
    peak_entries: number;
    morning_percent: number;
    afternoon_percent: number;
    status: string;
}

export interface GeneralSummary {
    total_days_evaluated: number;
    total_accumulated_entries: number;
    daily_average: number;
    best_day: {
        label: string;
        entries: number;
    };
    historical_peak: {
        day: string;
        hour: string;
        entries: number;
    };
    overall_morning_percent: number;
    overall_afternoon_percent: number;
}

export interface DayDataset {
    has_data?: boolean;
    date_str?: string;
    date_title: string;
    year: string;
    kpis: {
        registered_entries: number;
        peak_hour: {
            hour: string;
            entries: number;
        };
        analyzed_hours: {
            count: number;
            range: string;
        };
    };
    hourly_attendance: HourlyData[];
    attendance_distribution: {
        morning: {
            label: string;
            range: string;
            count: number;
            percentage: number;
        };
        afternoon: {
            label: string;
            range: string;
            count: number;
            percentage: number;
        };
        main_badge: {
            percentage: string;
            label: string;
        };
    };
    two_hour_blocks: BlockData[];
}

export interface DashboardData extends DayDataset {
    today_date?: string;
    yesterday_date?: string;
    previous_date?: string;
    first_recorded_date?: string;
    active_date?: string;
    active_day_data?: DayDataset;
    today_data?: DayDataset;
    yesterday_data?: DayDataset;
    comparative?: DayComparison[];
    general_summary?: GeneralSummary;
    available_dates?: Array<{ date: string; label: string; entries: number }>;
}

interface WelcomeProps {
    dashboard?: DashboardData;
}

// Hook for smoothly animated numbers
function useAnimatedNumber(target: number, duration: number = 1000): number {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        if (target <= 0) {
            setCurrent(0);
            return;
        }

        let startTimestamp: number | null = null;
        const startValue = current;
        let animationFrameId: number;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const nextValue = Math.round(startValue + (target - startValue) * easeOut);
            setCurrent(nextValue);

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(step);
            }
        };

        animationFrameId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationFrameId);
    }, [target, duration]);

    return current;
}

// Hook for animated float percentage
function useAnimatedFloat(target: number, duration: number = 1000): string {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        if (target <= 0) {
            setCurrent(0);
            return;
        }

        let startTimestamp: number | null = null;
        const startValue = current;
        let animationFrameId: number;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const nextValue = startValue + (target - startValue) * easeOut;
            setCurrent(nextValue);

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(step);
            }
        };

        animationFrameId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationFrameId);
    }, [target, duration]);

    return current.toFixed(1);
}

export default function Welcome({ dashboard }: WelcomeProps) {
    const todayDateStr = dashboard?.today_date || new Date().toISOString().slice(0, 10);
    const previousDateStr =
        dashboard?.previous_date ||
        (() => {
            const comps = dashboard?.comparative ?? [];
            const priors = comps.filter((c) => c.date < todayDateStr);
            if (priors.length > 0) return priors[priors.length - 1].date;
            const d = new Date(todayDateStr);
            d.setDate(d.getDate() - 1);
            return d.toISOString().slice(0, 10);
        })();

    const initialSelectedDate =
        dashboard?.active_date && dashboard.active_date !== todayDateStr
            ? dashboard.active_date
            : previousDateStr;
    const initialTab: 'live' | 'date' | 'summary' =
        dashboard?.today_data?.has_data && (dashboard.today_data.kpis?.registered_entries ?? 0) > 0
            ? 'live'
            : 'date';

    // Mode: 'live' (Hoy en tiempo real) | 'date' (Selección por fecha/calendario) | 'summary' (Resumen Ejecutivo)
    const [activeTab, setActiveTab] = useState<'live' | 'date' | 'summary'>(initialTab);
    const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate);
    const [customDayData, setCustomDayData] = useState<DayDataset | null>(
        dashboard?.active_day_data || (dashboard?.has_data ? dashboard : null)
    );
    const [liveData, setLiveData] = useState<DayDataset | null>(dashboard?.today_data || null);
    const [liveDashboardMeta, setLiveDashboardMeta] = useState<DashboardData | undefined>(dashboard);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isLoadingDate, setIsLoadingDate] = useState(false);

    // Mount animation flag
    const [mounted, setMounted] = useState(false);
    const [hoveredSlice, setHoveredSlice] = useState<'morning' | 'afternoon' | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(timer);
    }, []);

    // 2-second background polling for real-time live synchronization
    useEffect(() => {
        const intervalId = setInterval(async () => {
            try {
                const queryParam = activeTab === 'date' ? `?date=${selectedDate}` : '';
                const response = await fetch(`/api/dashboard${queryParam}`);
                if (!response.ok) return;

                const result = await response.json();
                if (result.status === 'success' && result.data) {
                    const fetchedData: DashboardData = result.data;
                    setLiveDashboardMeta(fetchedData);

                    if (fetchedData.today_data) {
                        setLiveData(fetchedData.today_data);
                    }

                    if (activeTab === 'date' && fetchedData.active_day_data) {
                        setCustomDayData(fetchedData.active_day_data);
                    }
                }
            } catch {
                // Background silent polling
            }
        }, 2000);

        return () => clearInterval(intervalId);
    }, [activeTab, selectedDate]);

    // Function to handle date change from calendar picker or chips
    const handleSelectDate = async (dateStr: string) => {
        setIsCalendarOpen(false);

        const currentToday = dashboard?.today_date || liveDashboardMeta?.today_date || todayDateStr;
        if (dateStr === currentToday) {
            setActiveTab('live');
            return;
        }

        setSelectedDate(dateStr);
        setIsLoadingDate(true);
        setActiveTab('date');
        try {
            const res = await fetch(`/api/dashboard?date=${dateStr}`);
            const json = await res.json();
            if (json.status === 'success' && json.data) {
                setCustomDayData(json.data.active_day_data || json.data);
                setLiveDashboardMeta(json.data);
            }
        } catch (e) {
            console.error('Error al cargar fecha seleccionada:', dateStr, e);
        } finally {
            setIsLoadingDate(false);
        }
    };

    // Resolve current day dataset based on active tab & selected date
    const activeDataset: DayDataset = (() => {
        if (activeTab === 'live') {
            return liveData ?? dashboard?.today_data ?? ({} as DayDataset);
        }
        if (activeTab === 'date') {
            return customDayData ?? dashboard?.active_day_data ?? ({} as DayDataset);
        }
        return liveData ?? dashboard?.today_data ?? ({} as DayDataset);
    })();

    const DEFAULT_HOURS = [
        '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
        '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
    ];

    // Ensure hourly data always includes standard hours from 08:00 to 20:00 by default
    const hourlyData: HourlyData[] = (() => {
        const raw = activeDataset?.hourly_attendance ?? [];
        const isToday = (activeDataset?.date_str === todayDateStr) || activeTab === 'live';
        const now = new Date();
        const currentHStr = `${now.getHours().toString().padStart(2, '0')}:00`;

        const map = new Map<string, HourlyData>();
        raw.forEach((item) => map.set(item.hour, item));

        DEFAULT_HOURS.forEach((h) => {
            if (!map.has(h)) {
                map.set(h, {
                    hour: h,
                    label: h,
                    count: 0,
                    is_current: isToday && (h === currentHStr),
                    is_future: isToday && (h > currentHStr),
                });
            }
        });

        return Array.from(map.values()).sort((a, b) => a.hour.localeCompare(b.hour));
    })();

    const hourlyBarsSum = hourlyData.reduce((acc, curr) => acc + (curr.count || 0), 0);

    const hasData = Boolean(
        activeDataset?.has_data ??
            (hourlyBarsSum > 0 ||
                (activeDataset?.kpis && (activeDataset.kpis.registered_entries ?? 0) > 0))
    );

    const dateTitle = (() => {
        if (activeTab === 'summary') {
            return 'Resumen Ejecutivo';
        }
        if (activeTab === 'live') {
            return dashboard?.today_data?.date_title || liveData?.date_title || 'En Vivo';
        }
        return activeDataset?.date_title || selectedDate || 'Conteo';
    })();

    const year = activeDataset?.year || '2026';

    // The registered entries target is strictly matched with the sum of hourly graph bars
    const registeredTarget = hasData
        ? (hourlyBarsSum > 0 ? hourlyBarsSum : (activeDataset?.kpis?.registered_entries ?? 0))
        : 0;
    const peakHour = hasData ? (activeDataset?.kpis?.peak_hour?.hour ?? '-') : '-';
    const peakEntriesTarget = hasData ? (activeDataset?.kpis?.peak_hour?.entries ?? 0) : 0;
    const analyzedHoursTarget = hasData ? (activeDataset?.kpis?.analyzed_hours?.count ?? hourlyData.length) : hourlyData.length;
    const analyzedHoursRange = hasData ? (activeDataset?.kpis?.analyzed_hours?.range ?? '(08:00 – 20:59)') : '(08:00 – 20:59)';

    // Two-hour blocks covering 08:00 to 20:00
    const blockData: BlockData[] = (() => {
        const raw = activeDataset?.two_hour_blocks ?? [];
        if (raw.length >= 6) return raw;
        const getCount = (h1: string, h2: string) => {
            const c1 = hourlyData.find((d) => d.hour === h1)?.count ?? 0;
            const c2 = hourlyData.find((d) => d.hour === h2)?.count ?? 0;
            return c1 + c2;
        };
        return [
            { label: '08-10h', count: getCount('08:00', '09:00') },
            { label: '10-12h', count: getCount('10:00', '11:00') },
            { label: '12-14h', count: getCount('12:00', '13:00') },
            { label: '14-16h', count: getCount('14:00', '15:00') },
            { label: '16-18h', count: getCount('16:00', '17:00') },
            { label: '18-20h', count: getCount('18:00', '19:00') },
        ];
    })();

    const morningPercentTarget = hasData ? (activeDataset?.attendance_distribution?.morning?.percentage ?? 0) : 0;
    const afternoonPercentTarget = hasData ? (activeDataset?.attendance_distribution?.afternoon?.percentage ?? 0) : 0;
    const morningBadgeLabel = hasData
        ? (activeDataset?.attendance_distribution?.main_badge?.label ?? 'en la mañana')
        : 'sin registros';

    // Animated values
    const animatedEntries = useAnimatedNumber(registeredTarget, 1000);
    const animatedPeakEntries = useAnimatedNumber(peakEntriesTarget, 900);
    const animatedHoursCount = useAnimatedNumber(analyzedHoursTarget, 700);
    const animatedMorningPercent = useAnimatedFloat(morningPercentTarget, 1000);
    const animatedAfternoonPercent = useAnimatedFloat(afternoonPercentTarget, 1000);

    // Multi-day comparative and summary data (with live updates)
    const comparativeList: DayComparison[] = liveDashboardMeta?.comparative ?? dashboard?.comparative ?? [];
    const summaryData: GeneralSummary | undefined = liveDashboardMeta?.general_summary ?? dashboard?.general_summary;

    const totalAccumulatedTarget = summaryData?.total_accumulated_entries ?? 0;
    const animatedTotalAccumulated = useAnimatedNumber(totalAccumulatedTarget, 1100);
    const dailyAverageTarget = summaryData?.daily_average ?? 0;
    const animatedDailyAverage = useAnimatedNumber(dailyAverageTarget, 900);

    // Dynamic scale for hourly chart
    const maxDataCount = Math.max(...hourlyData.map((d) => d.count), 0);
    const maxHourlyValue = Math.max(10, Math.ceil((maxDataCount || 10) / 10) * 10);
    const yAxisTicks = [
        maxHourlyValue,
        Math.round(maxHourlyValue * 0.75),
        Math.round(maxHourlyValue * 0.5),
        Math.round(maxHourlyValue * 0.25),
        0,
    ];
    const maxBlockCount = Math.max(...blockData.map((b) => b.count), 0);
    const maxBlockValue = Math.max(10, Math.ceil((maxBlockCount || 10) / 10) * 10);

    // SVG donut calculations
    const radius = 38;
    const circumference = 2 * Math.PI * radius; // ~238.76
    const morningStrokeLength = (morningPercentTarget / 100) * circumference;
    const afternoonStrokeLength = Math.max(0, circumference - morningStrokeLength);

    return (
        <>
            <Head title="Semana de la Seguridad Toquepala 2026 - Dashboard" />

            <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0a0e17] font-sans text-slate-100 selection:bg-blue-600 selection:text-white">
                {/* Subtle calm ambient lighting */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 left-1/2 h-[350px] w-[500px] -translate-x-1/2 rounded-full bg-blue-900/10 blur-[140px]" />
                </div>

                {/* Main responsive container */}
                <main className="relative z-10 mx-auto flex w-full max-w-[780px] md:max-w-3xl lg:max-w-4xl flex-col gap-3.5 px-3 py-4 sm:gap-4 sm:px-5 sm:py-5">
                    {/* Header: S26 Logo + Date Title (Clickable with Calendar) */}
                    <header className="flex items-center justify-between gap-3 pt-1 pb-1">
                        <div className="flex flex-1 items-center">
                            <img
                                src="/logo.png"
                                alt="Semana de la Seguridad Toquepala 2026"
                                className="h-24 w-auto object-contain sm:h-32"
                            />
                        </div>

                        <div className="flex flex-col justify-center text-right">
                            <button
                                type="button"
                                onClick={() => setIsCalendarOpen(true)}
                                className="group flex flex-col items-end text-right transition-all focus:outline-none cursor-pointer"
                                title="Haz clic para seleccionar fecha en el calendario"
                            >
                                <h1 className="text-xl leading-tight font-black tracking-tight text-white transition-colors group-hover:text-blue-200 sm:text-2xl md:text-3xl">
                                    {dateTitle}
                                </h1>
                                <p className="text-xl leading-tight font-black tracking-tight text-white sm:text-2xl md:text-3xl">
                                    {activeTab === 'summary' ? 'Evento Completo' : 'del'}{' '}
                                    <span className="font-black text-[#f59e0b]">{year}</span>
                                </p>
                            </button>
                        </div>
                    </header>

                    {/* Top Segmented Tabs: [En Vivo] | [Por Fecha] | [Resumen Ejecutivo] */}
                    <nav className="flex w-full items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/80 p-1 shadow-sm backdrop-blur-sm">
                        {/* 1. En Vivo */}
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('live');
                            }}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all sm:text-xs ${
                                activeTab === 'live'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                            }`}
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            <span>En Vivo</span>
                        </button>

                        {/* 2. Por Fecha / Calendario (Día anterior a la fecha de hoy por defecto) */}
                        <button
                            type="button"
                            onClick={() => {
                                if (activeTab === 'date') {
                                    setIsCalendarOpen(true);
                                } else {
                                    const targetDate = (selectedDate && selectedDate !== todayDateStr) ? selectedDate : previousDateStr;
                                    if (selectedDate !== targetDate) {
                                        handleSelectDate(targetDate);
                                    } else {
                                        setActiveTab('date');
                                    }
                                }
                            }}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all sm:text-xs ${
                                activeTab === 'date'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                            }`}
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                                {(() => {
                                    const effectiveDate = (selectedDate && selectedDate !== todayDateStr) ? selectedDate : previousDateStr;
                                    const matchDay = comparativeList.find((c) => c.date === effectiveDate);
                                    if (matchDay) return matchDay.short_label;
                                    if (effectiveDate) {
                                        try {
                                            const parts = effectiveDate.split('-');
                                            const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                            const mIdx = parseInt(parts[1], 10) - 1;
                                            return `${parseInt(parts[2], 10)} ${monthNames[mIdx] || parts[1]}`;
                                        } catch {
                                            return effectiveDate.slice(5);
                                        }
                                    }
                                    return 'Día Anterior';
                                })()}
                            </span>
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>

                        {/* 3. Resumen Ejecutivo */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('summary')}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all sm:text-xs ${
                                activeTab === 'summary'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                            }`}
                        >
                            <Trophy className="h-3.5 w-3.5" />
                            <span>Resumen Ejecutivo</span>
                        </button>
                    </nav>

                    {/* VIEW 1 & 2: Daily View (En Vivo o Por Fecha) */}
                    {(activeTab === 'live' || activeTab === 'date') && (
                        <>
                            {/* Loading state indicator when fetching a date from API */}
                            {isLoadingDate && (
                                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 text-center">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                                    <span className="text-xs text-slate-300">Cargando métricas de fecha...</span>
                                </div>
                            )}

                            {/* Live day empty state notice if today has no records yet */}
                            {activeTab === 'live' && !hasData && !isLoadingDate && (
                                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 text-center sm:p-5">
                                    <div className="mb-1.5 flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                            Monitoreo en Vivo Activo • {dateTitle}
                                        </span>
                                    </div>
                                    <p className="max-w-md text-xs text-slate-400">
                                        Aún no se registran entradas para hoy. Las métricas se actualizarán en tiempo real.
                                    </p>
                                    {comparativeList.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectDate(comparativeList[0].date)}
                                            className="mt-3 flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/20"
                                        >
                                            <span>Consultar jornada anterior ({comparativeList[0].short_label} — {comparativeList[0].total_entered} personas)</span>
                                            <span>➜</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Date empty state notice if chosen date has no records */}
                            {activeTab === 'date' && !hasData && !isLoadingDate && (
                                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 text-center sm:p-5">
                                    <div className="mb-1.5 flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-300">
                                            Sin registros para el {dateTitle}
                                        </span>
                                    </div>
                                    <p className="max-w-md text-xs text-slate-400">
                                        No se encontraron registros de afluencia para esta fecha seleccionada.
                                    </p>
                                    {comparativeList.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectDate(comparativeList[0].date)}
                                            className="mt-3 flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/20"
                                        >
                                            <span>Ver jornada con datos ({comparativeList[0].day_name} — {comparativeList[0].total_entered} asistentes) ➜</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Top 3 KPI Cards */}
                            <section className="grid grid-cols-3 gap-2 sm:gap-3">
                                {/* Card 1: Entradas Registradas */}
                                <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/70 p-3 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-slate-700 sm:p-4">
                                    <div className="mb-1.5 flex items-center gap-1.5">
                                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-1.5 text-blue-400">
                                            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                        <span className="text-[10px] leading-tight font-medium text-slate-300 sm:text-xs">
                                            Entradas Registradas
                                        </span>
                                    </div>
                                    <div className="mt-auto">
                                        <div className="text-xl font-bold tracking-tight text-white sm:text-3xl">
                                            {animatedEntries}
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Hora Pico */}
                                <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/70 p-3 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-slate-700 sm:p-4">
                                    <div className="mb-1 flex items-center gap-1.5">
                                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-1.5 text-amber-400">
                                            <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                        <span className="text-[10px] leading-tight font-medium text-slate-300 sm:text-xs">
                                            Hora Pico
                                        </span>
                                    </div>
                                    <div className="mt-auto">
                                        <div className="flex items-baseline gap-1 text-xl font-bold tracking-tight text-white sm:text-3xl">
                                            {peakHour}
                                            {hasData && <Flame className="h-3.5 w-3.5 text-amber-400" />}
                                        </div>
                                        <div className="mt-0.5 text-[9px] font-medium text-amber-400/90 sm:text-xs">
                                            {hasData ? `${animatedPeakEntries} entradas` : '0 entradas'}
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: Horas Analizadas */}
                                <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/70 p-3 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-slate-700 sm:p-4">
                                    <div className="mb-1 flex items-center gap-1.5">
                                        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-1.5 text-indigo-400">
                                            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                        <span className="text-[10px] leading-tight font-medium text-slate-300 sm:text-xs">
                                            Horas Analizadas
                                        </span>
                                    </div>
                                    <div className="mt-auto">
                                        <div className="text-xl font-bold tracking-tight text-white sm:text-3xl">
                                            {animatedHoursCount}
                                        </div>
                                        <div className="mt-0.5 text-[9px] font-medium text-slate-400 sm:text-xs">
                                            {analyzedHoursRange}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Middle Section: Afluencia por Hora (08:00 a 20:00) */}
                            <section className="relative rounded-2xl border border-sky-500/35 bg-gradient-to-b from-[#091528]/95 via-[#070e1c]/95 to-[#050b14] p-4 shadow-[0_0_30px_rgba(2,132,199,0.12)] backdrop-blur-md sm:p-5">
                                {/* Futuristic Cyan Corner Notches matching reference design */}
                                <div className="pointer-events-none absolute -top-[1px] -left-[1px] h-3.5 w-3.5 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
                                <div className="pointer-events-none absolute -top-[1px] -right-[1px] h-3.5 w-3.5 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
                                <div className="pointer-events-none absolute -bottom-[1px] -left-[1px] h-3.5 w-3.5 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
                                <div className="pointer-events-none absolute -bottom-[1px] -right-[1px] h-3.5 w-3.5 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />

                                {/* Card Header */}
                                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2 text-blue-400">
                                            <BarChart3 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">
                                                Afluencia por Hora
                                            </h2>
                                            <p className="text-[11px] text-slate-400">
                                                Jornada continua (08:00 a 20:00)
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {peakHour !== '-' && peakEntriesTarget > 0 && (
                                            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                                                <Flame className="h-3.5 w-3.5 text-amber-400" />
                                                <span>Pico: {peakHour} ({peakEntriesTarget})</span>
                                            </div>
                                        )}
                                        {activeTab === 'live' && (
                                            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                                </span>
                                                <span>En Vivo</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Live waiting indicator banner if no data yet */}
                                {!hasData && (
                                    <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                                            <span>
                                                {activeTab === 'live'
                                                    ? 'Monitoreo activo para hoy • En espera de ingresos (08:00 a 20:00)'
                                                    : `Sin registros reportados para el ${dateTitle}`}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500">0 ingresos</span>
                                    </div>
                                )}

                                {/* Chart Area with Smooth Horizontal Scrolling Container on narrow screens */}
                                <div className="relative overflow-x-auto pb-2 pt-2 scrollbar-none sm:overflow-x-visible">
                                    <div className="min-w-[580px] sm:min-w-0">
                                        {/* Y-axis and Bars Canvas */}
                                        <div className="flex flex-row items-stretch">
                                            {/* Y-axis labels */}
                                            <div className="flex h-56 sm:h-64 md:h-72 w-8 sm:w-10 flex-col justify-between pr-2 text-right text-[10px] sm:text-xs font-semibold text-slate-400 select-none">
                                                {yAxisTicks.map((tick) => (
                                                    <span key={tick} className="leading-none">
                                                        {tick}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Bars Area with clean horizontal dashed grid lines */}
                                            <div className="relative flex h-56 sm:h-64 md:h-72 flex-1 items-end gap-1 sm:gap-2 border-l border-slate-800/90 px-1 sm:px-2">
                                                {/* Horizontal dashed grid lines */}
                                                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                                                    {yAxisTicks.map((tick) => (
                                                        <div
                                                            key={`grid-${tick}`}
                                                            className="w-full border-b border-dashed border-slate-800/70"
                                                        />
                                                    ))}
                                                </div>

                                                {/* Columns (each hour slot from 08:00 to 20:00) */}
                                                {hourlyData.map((item, index) => {
                                                    const isPeak = item.hour === peakHour && item.count > 0;
                                                    const targetHeight = maxHourlyValue > 0 && item.count > 0
                                                        ? Math.min(84, Math.max(8, (item.count / maxHourlyValue) * 84))
                                                        : 0;
                                                    const currentHeight = mounted ? targetHeight : 0;

                                                    return (
                                                        <div
                                                            key={item.hour}
                                                            className="group relative z-10 flex flex-1 flex-col items-center justify-end h-full px-0.5"
                                                        >
                                                            {/* Tooltip on Hover */}
                                                            <div className="pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-center shadow-xl whitespace-nowrap">
                                                                <span className="text-[10px] font-bold text-white block">
                                                                    {item.hour} {isPeak ? '🔥 Hora Pico' : item.is_current ? '🟢 En Vivo' : ''}
                                                                </span>
                                                                <span className="text-[10px] font-semibold text-blue-300 block">
                                                                    {item.count} ingresos
                                                                </span>
                                                            </div>

                                                            {/* Animated Colored Bar Wrapper - wider, flat-topped, comfortable */}
                                                            <div
                                                                style={{
                                                                    height: `${currentHeight}%`,
                                                                    transitionDelay: `${index * 20}ms`,
                                                                }}
                                                                className="relative flex w-full max-w-[32px] sm:max-w-[42px] flex-col items-center justify-end transition-all duration-700 ease-out"
                                                            >
                                                                {/* Value text placed directly 4px above the bar with comfortable typography */}
                                                                {item.count > 0 ? (
                                                                    <span
                                                                        className={`pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 text-[11px] sm:text-xs font-black tracking-tight whitespace-nowrap leading-none transition-transform group-hover:scale-110 ${
                                                                            isPeak
                                                                                ? 'text-[#facc15] drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]'
                                                                                : item.is_current
                                                                                  ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                                                                                  : 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]'
                                                                        }`}
                                                                    >
                                                                        {item.count}
                                                                    </span>
                                                                ) : item.is_current ? (
                                                                    <span className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-400 whitespace-nowrap leading-none">
                                                                        0
                                                                    </span>
                                                                ) : null}

                                                                {/* Colored Bar with subtle flat-topped curvature */}
                                                                <div
                                                                    className={`w-full h-full rounded-t-[4px] sm:rounded-t-md transition-all duration-300 ${
                                                                        isPeak
                                                                            ? 'bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-300 shadow-[0_0_16px_rgba(245,158,11,0.5)]'
                                                                            : item.is_current
                                                                              ? 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-300 ring-1 ring-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.5)]'
                                                                              : item.count > 0
                                                                                ? 'bg-gradient-to-t from-blue-700 via-sky-500 to-cyan-400 shadow-[0_0_12px_rgba(14,165,233,0.4)]'
                                                                                : 'bg-transparent'
                                                                    }`}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* X-axis labels */}
                                        <div className="mt-2.5 flex items-center border-t border-slate-800/90 pt-2">
                                            <div className="w-8 sm:w-10" /> {/* Spacer matching Y-axis */}
                                            <div className="flex flex-1 items-center gap-1 sm:gap-2 px-1 sm:px-2">
                                                {hourlyData.map((item) => {
                                                    const isPeak = item.hour === peakHour && item.count > 0;
                                                    return (
                                                        <div
                                                            key={`x-${item.hour}`}
                                                            className={`flex flex-1 flex-col items-center text-center transition-colors ${
                                                                item.is_current
                                                                    ? 'text-emerald-400 font-bold'
                                                                    : isPeak
                                                                      ? 'text-[#facc15] font-black'
                                                                      : 'text-slate-400 hover:text-slate-200'
                                                            }`}
                                                        >
                                                            <span className="text-[10px] sm:text-xs font-semibold tracking-tight">
                                                                {item.hour}
                                                            </span>
                                                            {item.is_current && (
                                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Bottom 2 Cards Grid */}
                            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
                                {/* Left Card: Distribución de Asistencia */}
                                <div className="relative flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/70 p-3.5 shadow-sm backdrop-blur-sm sm:p-4">
                                    <div className="mb-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <PieChart className="h-4 w-4 text-blue-400" />
                                            <h3 className="text-xs font-bold tracking-wide text-white sm:text-sm">
                                                Distribución de Asistencia
                                            </h3>
                                        </div>
                                        <span className="text-[10px] font-semibold text-slate-400">08:00 – 20:00</span>
                                    </div>

                                    <div className="flex flex-row items-center justify-around gap-2 py-1">
                                        {/* Donut graphic */}
                                        <div className="group relative flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
                                            <svg
                                                className="h-full w-full -rotate-90 transform"
                                                viewBox="0 0 100 100"
                                            >
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="38"
                                                    stroke="#1e293b"
                                                    strokeWidth="14"
                                                    fill="transparent"
                                                />
                                                {/* Blue Segment: Mañana */}
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="38"
                                                    stroke="#0284c7"
                                                    strokeWidth={hoveredSlice === 'morning' ? '16' : '14'}
                                                    fill="transparent"
                                                    strokeDasharray={`${morningStrokeLength} ${circumference}`}
                                                    strokeDashoffset={mounted ? '0' : `${circumference}`}
                                                    className="cursor-pointer transition-all duration-700 ease-out"
                                                    onMouseEnter={() => setHoveredSlice('morning')}
                                                    onMouseLeave={() => setHoveredSlice(null)}
                                                />
                                                {/* Orange Segment: Tarde */}
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="38"
                                                    stroke="#f97316"
                                                    strokeWidth={hoveredSlice === 'afternoon' ? '16' : '14'}
                                                    fill="transparent"
                                                    strokeDasharray={`${afternoonStrokeLength} ${circumference}`}
                                                    strokeDashoffset={mounted ? `-${morningStrokeLength}` : `${circumference}`}
                                                    className="cursor-pointer transition-all duration-700 ease-out"
                                                    onMouseEnter={() => setHoveredSlice('afternoon')}
                                                    onMouseLeave={() => setHoveredSlice(null)}
                                                />
                                            </svg>

                                            {/* Center badge */}
                                            <div className="absolute inset-0 m-auto flex h-12 w-12 flex-col items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/90 p-1 text-center shadow-sm sm:h-14 sm:w-14">
                                                <span className="text-[11px] font-bold leading-tight text-white sm:text-xs">
                                                    {morningBadgeLabel.includes('tarde')
                                                        ? animatedAfternoonPercent
                                                        : animatedMorningPercent}%
                                                </span>
                                                <span className="text-[7px] font-medium leading-tight text-slate-400 sm:text-[8px]">
                                                    {morningBadgeLabel}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Legend */}
                                        <div className="flex flex-col gap-2">
                                            {/* Mañana item */}
                                            <div
                                                onMouseEnter={() => setHoveredSlice('morning')}
                                                onMouseLeave={() => setHoveredSlice(null)}
                                                className={`flex cursor-pointer items-start gap-2 rounded-lg p-1.5 transition-colors ${
                                                    hoveredSlice === 'morning' ? 'bg-slate-800' : ''
                                                }`}
                                            >
                                                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#0284c7]" />
                                                <div className="flex flex-col text-[10px] sm:text-xs">
                                                    <span className="font-semibold text-slate-200">Mañana</span>
                                                    <span className="text-[9px] text-slate-400 sm:text-[10px]">
                                                        (08:00 – 13:59)
                                                    </span>
                                                    <span className="text-[11px] font-bold text-white sm:text-xs">
                                                        {animatedMorningPercent}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Tarde item */}
                                            <div
                                                onMouseEnter={() => setHoveredSlice('afternoon')}
                                                onMouseLeave={() => setHoveredSlice(null)}
                                                className={`flex cursor-pointer items-start gap-2 rounded-lg p-1.5 transition-colors ${
                                                    hoveredSlice === 'afternoon' ? 'bg-slate-800' : ''
                                                }`}
                                            >
                                                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#f97316]" />
                                                <div className="flex flex-col text-[10px] sm:text-xs">
                                                    <span className="font-semibold text-slate-200">Tarde</span>
                                                    <span className="text-[9px] text-slate-400 sm:text-[10px]">
                                                        (14:00 – 20:59)
                                                    </span>
                                                    <span className="text-[11px] font-bold text-white sm:text-xs">
                                                        {animatedAfternoonPercent}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Card: Afluencia por Bloques de 2 Horas */}
                                <div className="relative flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/70 p-3.5 shadow-sm backdrop-blur-sm sm:p-4">
                                    <div className="mb-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-blue-400" />
                                            <h3 className="text-xs font-bold tracking-wide text-white sm:text-sm">
                                                Afluencia por Bloques
                                            </h3>
                                        </div>
                                        <span className="text-[10px] font-semibold text-slate-400">08:00 – 20:00</span>
                                    </div>

                                    <div className="flex h-32 items-end justify-between gap-1.5 sm:gap-2 px-1 pt-1">
                                        {blockData.map((block, i) => {
                                            const targetHeight = maxBlockValue > 0 && block.count > 0
                                                ? Math.min(82, Math.max(8, (block.count / maxBlockValue) * 82))
                                                : 0;
                                            const currentHeight = mounted ? targetHeight : 0;

                                            return (
                                                <div
                                                    key={block.label}
                                                    className="group relative flex flex-1 flex-col items-center justify-end h-full px-0.5"
                                                >
                                                    {/* Animated Colored Bar Wrapper */}
                                                    <div
                                                        style={{
                                                            height: `${currentHeight}%`,
                                                            transitionDelay: `${i * 35}ms`,
                                                        }}
                                                        className="relative flex w-full max-w-[34px] sm:max-w-[44px] flex-col items-center justify-end transition-all duration-700 ease-out"
                                                    >
                                                        {/* Value text placed directly 4px above the colored bar */}
                                                        {block.count > 0 && (
                                                            <span className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-black tracking-tight text-white whitespace-nowrap leading-none drop-shadow-sm">
                                                                {block.count}
                                                            </span>
                                                        )}

                                                        {/* Colored Bar */}
                                                        <div
                                                            className={`w-full h-full rounded-t-[4px] sm:rounded-t-md transition-all duration-300 ${
                                                                block.count > 0
                                                                    ? 'bg-gradient-to-t from-blue-700 via-sky-500 to-cyan-400 shadow-[0_0_12px_rgba(14,165,233,0.35)]'
                                                                    : 'bg-transparent'
                                                            }`}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* X-axis labels */}
                                    <div className="mt-2 flex justify-between border-t border-slate-800/80 pt-1.5">
                                        {blockData.map((block) => (
                                            <span
                                                key={`bx-${block.label}`}
                                                className="flex-1 text-center text-[9px] sm:text-[10px] font-semibold text-slate-400"
                                            >
                                                {block.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </>
                    )}

                    {/* VIEW 3: Resumen Ejecutivo (Consolidado Global + Comparativo de Días) */}
                    {activeTab === 'summary' && (
                        <div className="flex flex-col gap-3.5">
                            {/* 4 Executive Summary KPIs */}
                            <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                                {/* Total Acumulado */}
                                <div className="rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
                                    <div className="mb-1 flex items-center gap-1.5">
                                        <Users className="h-4 w-4 text-blue-400" />
                                        <span className="text-[10px] font-medium text-slate-400">Total Acumulado</span>
                                    </div>
                                    <div className="text-xl font-extrabold text-white sm:text-2xl">
                                        {animatedTotalAccumulated}
                                    </div>
                                    <span className="text-[9px] text-slate-500">asistentes registrados</span>
                                </div>

                                {/* Promedio Diario */}
                                <div className="rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
                                    <div className="mb-1 flex items-center gap-1.5">
                                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                                        <span className="text-[10px] font-medium text-slate-400">Promedio Diario</span>
                                    </div>
                                    <div className="text-xl font-extrabold text-white sm:text-2xl">
                                        {animatedDailyAverage}
                                    </div>
                                    <span className="text-[9px] text-slate-500">personas / día</span>
                                </div>

                                {/* Mejor Día */}
                                <div className="rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
                                    <div className="mb-1 flex items-center gap-1.5">
                                        <Trophy className="h-4 w-4 text-amber-400" />
                                        <span className="text-[10px] font-medium text-slate-400">Día Récord</span>
                                    </div>
                                    <div className="text-sm font-bold text-white sm:text-base">
                                        {summaryData?.best_day?.label ?? '-'}
                                    </div>
                                    <span className="text-[9px] text-amber-400 font-semibold">
                                        {summaryData?.best_day?.entries ?? 0} asistentes
                                    </span>
                                </div>

                                {/* Pico Histórico */}
                                <div className="rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
                                    <div className="mb-1 flex items-center gap-1.5">
                                        <Flame className="h-4 w-4 text-orange-400" />
                                        <span className="text-[10px] font-medium text-slate-400">Pico Histórico</span>
                                    </div>
                                    <div className="text-sm font-bold text-white sm:text-base">
                                        {summaryData?.historical_peak?.hour ?? '-'}
                                    </div>
                                    <span className="text-[9px] text-orange-400 font-semibold">
                                        {summaryData?.historical_peak?.entries ?? 0} en 1 hora
                                    </span>
                                </div>
                            </section>

                            {/* Comparativo Multidiario de Asistencia */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/70 p-3.5 shadow-sm backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                        <Layers className="h-5 w-5 text-blue-400" />
                                        <div>
                                            <h3 className="text-sm font-bold text-white sm:text-base">
                                                Comparativo Multidiario de Asistencia
                                            </h3>
                                            <p className="text-[11px] text-slate-400">
                                                Comparación directa de asistencia entre los {comparativeList.length} días de evento
                                            </p>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300">
                                        {comparativeList.length} días evaluados
                                    </span>
                                </div>

                                {/* Side-by-Side Day Cards */}
                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                                    {comparativeList.map((day) => (
                                        <div
                                            key={day.date}
                                            className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/80 p-3.5 shadow-sm transition-all hover:border-slate-700"
                                        >
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-4 w-4 text-blue-400" />
                                                    <span className="text-xs font-bold text-white">
                                                        {day.day_name}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                        day.status === 'Concluido'
                                                            ? 'bg-slate-800 text-slate-300'
                                                            : 'bg-emerald-500/20 text-emerald-300'
                                                    }`}
                                                >
                                                    {day.status}
                                                </span>
                                            </div>

                                            <div className="mb-3 flex items-baseline justify-between border-b border-slate-800/80 pb-2">
                                                <span className="text-[11px] text-slate-400">Total Asistentes</span>
                                                <span className="text-xl font-extrabold text-white">
                                                    {day.total_entered.toLocaleString()}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                <div className="rounded-lg bg-slate-800/50 p-2">
                                                    <span className="text-[10px] text-slate-400 block">Hora Pico</span>
                                                    <span className="font-bold text-amber-400">{day.peak_hour}</span>
                                                    <span className="text-[9px] text-slate-500 block">({day.peak_entries} personas)</span>
                                                </div>
                                                <div className="rounded-lg bg-slate-800/50 p-2">
                                                    <span className="text-[10px] text-slate-400 block">Distribución</span>
                                                    <span className="font-bold text-blue-400">{day.morning_percent}%</span>
                                                    <span className="text-[9px] text-slate-500 block">Mañana / {day.afternoon_percent}% Tarde</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Comparative Volume Bar Chart */}
                                <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-sm backdrop-blur-sm">
                                    <h4 className="mb-3 text-xs font-bold text-slate-200">
                                        Comparativa Visual de Volumen de Asistencia
                                    </h4>
                                    <div className="flex h-36 items-end justify-around gap-4 px-2 pt-2">
                                        {comparativeList.map((day) => {
                                            const maxVol = Math.max(...comparativeList.map((d) => d.total_entered), 10);
                                            const heightPct = Math.min(82, Math.max(10, (day.total_entered / maxVol) * 82));

                                            return (
                                                <div
                                                    key={`comp-bar-${day.date}`}
                                                    className="group relative flex flex-1 h-full flex-col items-center justify-end"
                                                >
                                                    {/* Animated Bar Wrapper */}
                                                    <div
                                                        style={{ height: `${heightPct}%` }}
                                                        className="relative flex w-full max-w-[64px] flex-col items-center justify-end transition-all duration-700 ease-out p-1"
                                                    >
                                                        {/* Value directly 4px above the colored bar */}
                                                        <span className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 text-xs font-black tracking-tight text-white whitespace-nowrap leading-none group-hover:text-blue-300 transition-colors drop-shadow-sm">
                                                            {day.total_entered.toLocaleString()}
                                                        </span>

                                                        <div
                                                            className={`w-full h-full rounded-t-[6px] sm:rounded-t-md transition-all duration-300 ${
                                                                day.day_number % 2 === 1
                                                                    ? 'bg-gradient-to-t from-blue-700 via-sky-500 to-cyan-400 shadow-[0_0_12px_rgba(14,165,233,0.35)]'
                                                                    : 'bg-gradient-to-t from-teal-700 via-teal-600 to-emerald-400 shadow-[0_0_12px_rgba(20,184,166,0.35)]'
                                                            }`}
                                                        />
                                                    </div>

                                                    <span className="mt-2.5 text-center text-[10px] sm:text-xs font-semibold text-slate-300">
                                                        {day.short_label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Executive Detail Card: Balance General del Evento */}
                            <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-sm backdrop-blur-sm">
                                <h3 className="mb-3 text-sm font-bold text-white">
                                    Balance General del Evento
                                </h3>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
                                        <span className="text-xs font-semibold text-slate-300 block mb-1">
                                            Distribución Global de Asistencia
                                        </span>
                                        <div className="mt-2 flex items-center gap-3">
                                            <div className="flex-1">
                                                <div className="flex justify-between text-[11px] mb-1">
                                                    <span className="text-blue-400 font-semibold">
                                                        Mañana ({summaryData?.overall_morning_percent ?? 0}%)
                                                    </span>
                                                    <span className="text-orange-400 font-semibold">
                                                        Tarde ({summaryData?.overall_afternoon_percent ?? 0}%)
                                                    </span>
                                                </div>
                                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-700 flex">
                                                    <div style={{ width: `${summaryData?.overall_morning_percent ?? 0}%` }} className="bg-[#0284c7]" />
                                                    <div style={{ width: `${summaryData?.overall_afternoon_percent ?? 0}%` }} className="bg-[#f97316]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
                                        <span className="text-xs font-semibold text-slate-300 block mb-1">
                                            Cumplimiento de Metas y Seguridad
                                        </span>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-emerald-400">
                                            <CheckCircle2 className="h-4 w-4" />
                                            <span>Cobertura completa de accesos analizados</span>
                                        </div>
                                        <span className="mt-1 text-[10px] text-slate-400 block">
                                            Cámaras sincronizadas en tiempo real: Acceso 1 y Acceso 2.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Banner: Slogan + Mining Truck Graphic */}
                    <footer className="relative mt-1 flex min-h-[96px] items-center justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-sm sm:p-5">
                        {/* Left: Shield badge + Slogan */}
                        <div className="relative z-10 flex max-w-[65%] items-center gap-3.5">
                            <img
                                src="/images/shield_transparent.png"
                                alt="Seguridad"
                                className="h-12 w-12 object-contain sm:h-14 sm:w-14"
                            />
                            <div className="flex flex-col">
                                <span className="text-lg font-black italic tracking-wide text-white sm:text-xl md:text-2xl">
                                    La seguridad
                                </span>
                                <span className="text-lg font-black italic tracking-wide text-white sm:text-xl md:text-2xl">
                                    es tarea de{' '}
                                    <span className="text-[#f59e0b] font-black">
                                        todos
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Right: Giant Haul Truck Mining Image */}
                        <div className="pointer-events-none absolute top-0 right-0 bottom-0 flex w-[45%] items-center justify-end overflow-hidden opacity-90">
                            <img
                                src="/images/truck_blend.png"
                                alt="Mining Haul Truck"
                                className="h-full w-full object-cover object-left"
                            />
                        </div>

                        {/* Clean static bottom ribbons */}
                        <div className="pointer-events-none absolute -bottom-1 right-0 left-0 h-3 overflow-hidden">
                            <svg className="h-full w-full" viewBox="0 0 500 20" preserveAspectRatio="none">
                                <path
                                    d="M0,15 Q150,5 300,12 T500,8"
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="3"
                                    strokeOpacity="0.85"
                                />
                                <path
                                    d="M0,18 Q180,8 350,16 T500,10"
                                    fill="none"
                                    stroke="#0284c7"
                                    strokeWidth="2.5"
                                    strokeOpacity="0.85"
                                />
                            </svg>
                        </div>
                    </footer>

                    {/* Calendar Selection Modal Dialog */}
                    {isCalendarOpen && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
                            onClick={() => setIsCalendarOpen(false)}
                        >
                            <div
                                className="relative w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-900 p-5 shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-400 border border-blue-500/20">
                                            <Calendar className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Seleccionar Fecha</h3>
                                            <p className="text-[11px] text-slate-400">Ver estadísticas por día del evento</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsCalendarOpen(false)}
                                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Native Calendar Picker Input */}
                                <div className="mb-4">
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                                        Elegir fecha en el calendario:
                                    </label>
                                    <input
                                        type="date"
                                        value={(selectedDate && selectedDate !== todayDateStr) ? selectedDate : previousDateStr}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleSelectDate(e.target.value);
                                            }
                                        }}
                                        min="2026-10-01"
                                        max="2026-11-30"
                                        className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2.5 text-sm font-semibold text-white shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                                    />
                                </div>

                                {/* Quick Presets / Registered Days from First Recorded Date */}
                                <div className="space-y-2">
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Jornadas del evento ({comparativeList.length} registradas):
                                    </span>

                                    {comparativeList.length > 0 ? (
                                        comparativeList.map((day) => {
                                            const isSelected = selectedDate === day.date && activeTab === 'date';
                                            const isToday = day.date === (dashboard?.today_date || liveDashboardMeta?.today_date || todayDateStr);

                                            return (
                                                <button
                                                    key={day.date}
                                                    type="button"
                                                    onClick={() => handleSelectDate(day.date)}
                                                    className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all ${
                                                        isSelected
                                                            ? 'border-blue-500/80 bg-blue-500/15 text-white'
                                                            : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {isToday && (
                                                            <span className="relative flex h-2 w-2">
                                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                                            </span>
                                                        )}
                                                        <div>
                                                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                                                <span>{day.day_name}</span>
                                                                <span className="rounded bg-slate-700/60 px-1 py-0.2 text-[9px] text-slate-300">
                                                                    Día {day.day_number}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                                {isToday
                                                                    ? 'Jornada de Hoy • En Vivo'
                                                                    : `Hora Pico: ${day.peak_hour} (${day.peak_entries} ent.)`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`rounded-lg px-2 py-1 text-xs font-bold border ${
                                                            isSelected
                                                                ? 'bg-blue-500/30 text-blue-200 border-blue-400/50'
                                                                : 'bg-slate-700/40 text-slate-200 border-slate-600/40'
                                                        }`}
                                                    >
                                                        {day.total_entered} ing.
                                                    </span>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-400">
                                            No se han registrado jornadas previas todavía.
                                        </div>
                                    )}
                                </div>

                                {/* Quick Executive Summary Shortcut */}
                                <div className="mt-4 border-t border-slate-800 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCalendarOpen(false);
                                            setActiveTab('summary');
                                        }}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-800/60 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                                    >
                                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                                        <span>Ver Resumen Ejecutivo Global</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
