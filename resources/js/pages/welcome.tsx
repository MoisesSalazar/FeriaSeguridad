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
    // Mode: 'live' (Hoy en tiempo real) | 'date' (Selección por fecha/calendario) | 'summary' (Resumen Ejecutivo)
    const [activeTab, setActiveTab] = useState<'live' | 'date' | 'summary'>('date');
    const [selectedDate, setSelectedDate] = useState<string>(dashboard?.yesterday_date || '2026-10-26');
    const [customDayData, setCustomDayData] = useState<DayDataset | null>(dashboard?.yesterday_data || null);
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

                    if (activeTab === 'live' && fetchedData.today_data) {
                        setLiveData(fetchedData.today_data);
                    } else if (activeTab === 'date') {
                        if (fetchedData.active_day_data) {
                            setCustomDayData(fetchedData.active_day_data);
                        } else if (selectedDate === '2026-10-26' && fetchedData.yesterday_data) {
                            setCustomDayData(fetchedData.yesterday_data);
                        }
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
        setSelectedDate(dateStr);
        setIsCalendarOpen(false);

        if (dateStr === dashboard?.today_date) {
            setActiveTab('live');
            return;
        }

        if (dateStr === dashboard?.yesterday_date && dashboard?.yesterday_data) {
            setCustomDayData(dashboard.yesterday_data);
            setActiveTab('date');
            return;
        }

        setIsLoadingDate(true);
        try {
            const res = await fetch(`/api/dashboard?date=${dateStr}`);
            const json = await res.json();
            if (json.status === 'success' && json.data) {
                setCustomDayData(json.data.active_day_data || json.data);
                setActiveTab('date');
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
            if (selectedDate === '2026-10-26') {
                return customDayData ?? dashboard?.yesterday_data ?? ({} as DayDataset);
            }
            if (selectedDate === dashboard?.today_date) {
                return liveData ?? dashboard?.today_data ?? ({} as DayDataset);
            }
            return customDayData ?? ({} as DayDataset);
        }
        return liveData ?? dashboard?.today_data ?? ({} as DayDataset);
    })();

    const hasData = Boolean(
        activeDataset?.has_data ??
            (activeDataset?.kpis &&
                activeDataset.kpis.registered_entries > 0 &&
                activeDataset.hourly_attendance &&
                activeDataset.hourly_attendance.length > 0)
    );

    const dateTitle = (() => {
        if (activeTab === 'summary') {
            return 'Resumen Ejecutivo';
        }
        if (activeTab === 'live') {
            return dashboard?.today_data?.date_title || '27 de octubre';
        }
        return activeDataset?.date_title || (selectedDate === '2026-10-26' ? '26 de octubre' : selectedDate);
    })();

    const year = activeDataset?.year || '2026';

    const registeredTarget = hasData ? (activeDataset?.kpis?.registered_entries ?? 0) : 0;
    const peakHour = hasData ? (activeDataset?.kpis?.peak_hour?.hour ?? '-') : '-';
    const peakEntriesTarget = hasData ? (activeDataset?.kpis?.peak_hour?.entries ?? 0) : 0;
    const analyzedHoursTarget = hasData ? (activeDataset?.kpis?.analyzed_hours?.count ?? 0) : 0;
    const analyzedHoursRange = hasData ? (activeDataset?.kpis?.analyzed_hours?.range ?? '-') : '-';

    const hourlyData: HourlyData[] = hasData ? (activeDataset?.hourly_attendance ?? []) : [];
    const blockData: BlockData[] = hasData ? (activeDataset?.two_hour_blocks ?? []) : [];

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

    const totalAccumulatedTarget = summaryData?.total_accumulated_entries ?? 932;
    const animatedTotalAccumulated = useAnimatedNumber(totalAccumulatedTarget, 1100);
    const dailyAverageTarget = summaryData?.daily_average ?? 466;
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
    const maxBlockValue = 280;

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
                <main className="relative z-10 mx-auto flex w-full max-w-[620px] flex-col gap-3.5 px-3 py-4 sm:gap-4 sm:px-5 sm:py-5">
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
                                className="group flex flex-col items-end text-right transition-all focus:outline-none"
                                title="Haz clic para seleccionar fecha en el calendario"
                            >
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-4 w-4 text-blue-400 transition-colors group-hover:text-blue-300" />
                                    <h1 className="text-xl leading-tight font-black tracking-tight text-white transition-colors group-hover:text-blue-200 sm:text-2xl md:text-3xl">
                                        {dateTitle}
                                    </h1>
                                </div>
                                <p className="text-xl leading-tight font-black tracking-tight text-white sm:text-2xl md:text-3xl">
                                    {activeTab === 'summary' ? 'Evento Completo' : 'del'}{' '}
                                    <span className="font-black text-[#f59e0b]">{year}</span>
                                </p>
                                {activeTab !== 'summary' && (
                                    <span className="mt-1 flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition-all group-hover:border-blue-500/60 group-hover:bg-slate-800 group-hover:text-white">
                                        <span>📅 Cambiar fecha</span>
                                        <span className="text-slate-400 group-hover:text-blue-300">▾</span>
                                    </span>
                                )}
                            </button>
                        </div>
                    </header>

                    {/* Top Segmented Tabs: [En Vivo] | [Por Fecha] | [Resumen Ejecutivo] */}
                    <nav className="flex w-full items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/80 p-1 shadow-sm backdrop-blur-sm">
                        {/* 1. En Vivo */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('live')}
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

                        {/* 2. Por Fecha / Calendario */}
                        <button
                            type="button"
                            onClick={() => {
                                if (activeTab === 'date') {
                                    setIsCalendarOpen(true);
                                } else {
                                    setActiveTab('date');
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
                                {selectedDate === '2026-10-26'
                                    ? '26 Oct'
                                    : selectedDate === '2026-10-27'
                                      ? '27 Oct'
                                      : selectedDate
                                        ? selectedDate.slice(5)
                                        : 'Calendario'}
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
                                    <button
                                        type="button"
                                        onClick={() => handleSelectDate('2026-10-26')}
                                        className="mt-3 flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/20"
                                    >
                                        <span>Consultar asistencia de ayer (26 Octubre — 932 personas)</span>
                                        <span>➜</span>
                                    </button>
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
                                    <button
                                        type="button"
                                        onClick={() => handleSelectDate('2026-10-26')}
                                        className="mt-3 flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/20"
                                    >
                                        <span>Ver jornada de ayer (26 de Octubre — 932 asistentes) ➜</span>
                                    </button>
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

                            {/* Middle Section: Afluencia en el Tiempo */}
                            <section className="relative rounded-xl border border-slate-800/90 bg-slate-900/70 p-3.5 shadow-sm backdrop-blur-sm sm:p-4">
                                {/* Card Header (without extra badges) */}
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-blue-400" />
                                        <h2 className="text-sm font-bold tracking-wide text-white sm:text-base">
                                            Afluencia en el Tiempo
                                        </h2>
                                    </div>
                                    {activeTab === 'date' && (
                                        <button
                                            type="button"
                                            onClick={() => setIsCalendarOpen(true)}
                                            className="flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition-colors hover:text-white"
                                        >
                                            <Calendar className="h-3 w-3 text-blue-400" />
                                            <span>{dateTitle} • Cambiar</span>
                                        </button>
                                    )}
                                    {activeTab === 'live' && (
                                        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <span>En vivo (2s)</span>
                                        </span>
                                    )}
                                </div>

                                {/* Chart Area */}
                                {hasData && hourlyData.length > 0 ? (
                                    <div className="relative pt-1 pb-1">
                                        {/* Y-axis and Gridlines */}
                                        <div className="flex flex-row">
                                            {/* Y-axis labels */}
                                            <div className="flex h-40 flex-col items-end justify-between pr-2 text-[10px] font-medium text-slate-400 select-none sm:text-xs">
                                                {yAxisTicks.map((tick) => (
                                                    <span key={tick} className="leading-none">
                                                        {tick}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Bars Canvas */}
                                            <div className="relative flex h-40 flex-1 items-end justify-between border-l border-slate-800 px-1 sm:px-2">
                                                {/* Horizontal grid lines */}
                                                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                                                    {yAxisTicks.map((tick) => (
                                                        <div
                                                            key={`grid-${tick}`}
                                                            className="w-full border-b border-slate-800/60"
                                                        />
                                                    ))}
                                                </div>

                                                {/* Bars */}
                                                {hourlyData.map((item, index) => {
                                                    const isPeak = item.hour === peakHour;
                                                    const targetHeight = Math.min(
                                                        100,
                                                        Math.max(item.count > 0 ? 8 : 4, (item.count / maxHourlyValue) * 100)
                                                    );
                                                    const currentHeight = mounted ? targetHeight : 0;

                                                    return (
                                                        <div
                                                            key={item.hour}
                                                            className={`relative z-10 flex h-full w-[9%] flex-col items-center justify-end ${
                                                                item.is_current ? 'scale-105' : ''
                                                            }`}
                                                        >
                                                            {/* Value text above bar */}
                                                            <span
                                                                className={`mb-1 text-[9px] font-semibold sm:text-xs ${
                                                                    item.is_current
                                                                        ? 'font-bold text-teal-300'
                                                                        : isPeak
                                                                          ? 'font-bold text-amber-300'
                                                                          : 'text-slate-200'
                                                                }`}
                                                            >
                                                                {item.count}
                                                            </span>

                                                            {/* Clean Modern Bar element */}
                                                            <div
                                                                style={{
                                                                    height: `${currentHeight}%`,
                                                                    transitionDelay: `${index * 25}ms`,
                                                                }}
                                                                className={`relative w-full overflow-hidden rounded-t-sm transition-all duration-500 ease-out sm:rounded-t ${
                                                                    item.is_current
                                                                        ? 'bg-gradient-to-t from-teal-600 to-teal-400 ring-1 ring-teal-400/40'
                                                                        : isPeak
                                                                          ? 'bg-gradient-to-t from-amber-600 to-amber-500'
                                                                          : item.is_future
                                                                            ? 'bg-slate-800/40 border-t border-dashed border-slate-700/60'
                                                                            : 'bg-gradient-to-t from-blue-700 to-blue-500'
                                                                }`}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* X-axis labels */}
                                        <div className="mt-2 flex justify-between border-t border-slate-800 pt-1.5 pr-1 pl-6 sm:pr-2 sm:pl-8">
                                            {hourlyData.map((item) => (
                                                <div
                                                    key={`x-${item.hour}`}
                                                    className={`flex w-[9%] flex-col items-center text-center text-[9px] font-medium transition-colors sm:text-[11px] ${
                                                        item.is_current
                                                            ? 'font-bold text-teal-300'
                                                            : 'text-slate-400'
                                                    }`}
                                                >
                                                    <span>{item.hour}</span>
                                                    {item.is_current && (
                                                        <span className="mt-0.5 h-1 w-1 rounded-full bg-teal-400" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 py-6 text-center">
                                        <Database className="mb-2 h-8 w-8 text-slate-600 stroke-1" />
                                        <p className="text-xs font-medium text-slate-300">No hay registros de afluencia</p>
                                        <p className="mt-0.5 max-w-xs text-[11px] text-slate-500">
                                            Los datos se visualizarán en cuanto se registren ingresos para este día.
                                        </p>
                                    </div>
                                )}
                            </section>

                            {/* Bottom 2 Cards Grid */}
                            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
                                {/* Left Card: Distribución de Asistencia */}
                                <div className="relative flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/70 p-3.5 shadow-sm backdrop-blur-sm sm:p-4">
                                    <div className="mb-2.5 flex items-center gap-2">
                                        <PieChart className="h-4 w-4 text-blue-400" />
                                        <h3 className="text-xs font-bold tracking-wide text-white sm:text-sm">
                                            Distribución de Asistencia
                                        </h3>
                                    </div>

                                    {hasData ? (
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
                                                            (10:00 – 13:59)
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
                                                            (14:00 – 19:59)
                                                        </span>
                                                        <span className="text-[11px] font-bold text-white sm:text-xs">
                                                            {animatedAfternoonPercent}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-2 text-center">
                                            <PieChart className="mb-1 h-6 w-6 text-slate-600 stroke-1" />
                                            <p className="text-[11px] font-medium text-slate-400">Sin datos de distribución</p>
                                        </div>
                                    )}
                                </div>

                                {/* Right Card: Afluencia por Bloques de 2 Horas */}
                                <div className="relative flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/70 p-3.5 shadow-sm backdrop-blur-sm sm:p-4">
                                    <div className="mb-2.5 flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-blue-400" />
                                        <h3 className="text-xs font-bold tracking-wide text-white sm:text-sm">
                                            Afluencia por Bloques de 2 Horas
                                        </h3>
                                    </div>

                                    {hasData && blockData.length > 0 ? (
                                        <>
                                            <div className="flex h-28 items-end justify-around px-1 pt-1">
                                                {blockData.map((block, i) => {
                                                    const targetHeight = Math.min(
                                                        100,
                                                        Math.max(5, (block.count / maxBlockValue) * 100)
                                                    );
                                                    const currentHeight = mounted ? targetHeight : 0;

                                                    return (
                                                        <div
                                                            key={block.label}
                                                            className="group flex h-full w-1/5 flex-col items-center justify-end"
                                                        >
                                                            <span className="mb-1 text-[11px] font-bold text-slate-200 sm:text-xs">
                                                                {block.count}
                                                            </span>
                                                            <div
                                                                style={{
                                                                    height: `${currentHeight}%`,
                                                                    transitionDelay: `${i * 60}ms`,
                                                                }}
                                                                className="relative w-full overflow-hidden rounded-t-md bg-gradient-to-t from-blue-700 to-blue-500 transition-all duration-500 ease-out"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* X-axis labels */}
                                            <div className="mt-1 flex justify-around border-t border-slate-800 pt-1.5">
                                                {blockData.map((block) => (
                                                    <span
                                                        key={`bx-${block.label}`}
                                                        className="w-1/5 text-center text-[9px] font-medium text-slate-400 sm:text-[10px]"
                                                    >
                                                        {block.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-2 text-center">
                                            <Clock className="mb-1 h-6 w-6 text-slate-600 stroke-1" />
                                            <p className="text-[11px] font-medium text-slate-400">Sin bloques registrados</p>
                                        </div>
                                    )}
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
                                        {summaryData?.best_day?.label ?? '26 de Octubre'}
                                    </div>
                                    <span className="text-[9px] text-amber-400 font-semibold">
                                        {summaryData?.best_day?.entries ?? 932} asistentes
                                    </span>
                                </div>

                                {/* Pico Histórico */}
                                <div className="rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
                                    <div className="mb-1 flex items-center gap-1.5">
                                        <Flame className="h-4 w-4 text-orange-400" />
                                        <span className="text-[10px] font-medium text-slate-400">Pico Histórico</span>
                                    </div>
                                    <div className="text-sm font-bold text-white sm:text-base">
                                        {summaryData?.historical_peak?.hour ?? '10:00'}
                                    </div>
                                    <span className="text-[9px] text-orange-400 font-semibold">
                                        {summaryData?.historical_peak?.entries ?? 153} en 1 hora
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
                                            const heightPct = Math.max(10, (day.total_entered / maxVol) * 100);

                                            return (
                                                <div
                                                    key={`comp-bar-${day.date}`}
                                                    className="flex flex-1 h-full flex-col items-center justify-end"
                                                >
                                                    <span className="mb-1.5 text-xs font-bold text-white">
                                                        {day.total_entered}
                                                    </span>
                                                    <div
                                                        style={{ height: `${heightPct}%` }}
                                                        className={`w-full max-w-[80px] rounded-t-lg transition-all duration-700 ${
                                                            day.date === '2026-10-26'
                                                                ? 'bg-gradient-to-t from-blue-700 to-blue-500'
                                                                : 'bg-gradient-to-t from-teal-700 to-teal-500'
                                                        }`}
                                                    />
                                                    <span className="mt-2 text-center text-[10px] font-semibold text-slate-300">
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
                                                    <span className="text-blue-400 font-semibold">Mañana (53.2%)</span>
                                                    <span className="text-orange-400 font-semibold">Tarde (46.8%)</span>
                                                </div>
                                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-700 flex">
                                                    <div style={{ width: '53.2%' }} className="bg-[#0284c7]" />
                                                    <div style={{ width: '46.8%' }} className="bg-[#f97316]" />
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
                                        value={selectedDate}
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

                                {/* Quick Presets / Registered Days */}
                                <div className="space-y-2">
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Jornadas del evento:
                                    </span>

                                    {/* 26 Octubre */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectDate('2026-10-26')}
                                        className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all ${
                                            selectedDate === '2026-10-26' && activeTab === 'date'
                                                ? 'border-blue-500/80 bg-blue-500/15 text-white'
                                                : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                                        }`}
                                    >
                                        <div>
                                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                                <span>Lunes 26 de Octubre</span>
                                                <span className="rounded bg-slate-700/60 px-1 py-0.2 text-[9px] text-slate-300">Día 1</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">10 horas registradas (10:00 – 19:00)</div>
                                        </div>
                                        <span className="rounded-lg bg-blue-500/20 px-2 py-1 text-xs font-bold text-blue-300 border border-blue-500/30">
                                            932 ing.
                                        </span>
                                    </button>

                                    {/* 27 Octubre */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectDate('2026-10-27')}
                                        className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all ${
                                            (selectedDate === '2026-10-27' || activeTab === 'live')
                                                ? 'border-emerald-500/80 bg-emerald-500/15 text-white'
                                                : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex h-2 w-2">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                            </span>
                                            <div>
                                                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                                    <span>Martes 27 de Octubre</span>
                                                    <span className="rounded bg-slate-700/60 px-1 py-0.2 text-[9px] text-emerald-300">Día 2</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">Jornada de Hoy • Tiempo Real</div>
                                            </div>
                                        </div>
                                        <span className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                                            En vivo
                                        </span>
                                    </button>
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
