import { Head, Link } from '@inertiajs/react';
import {
    Users,
    Trophy,
    Clock,
    BarChart3,
    PieChart,
    Database,
    Terminal,
} from 'lucide-react';

interface HourlyData {
    hour: string;
    count: number;
}

interface BlockData {
    label: string;
    count: number;
}

export interface DashboardData {
    has_data?: boolean;
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

interface WelcomeProps {
    dashboard?: DashboardData;
}

export default function Welcome({ dashboard }: WelcomeProps) {
    const hasData = Boolean(
        dashboard?.has_data ??
        (dashboard &&
            dashboard.kpis &&
            dashboard.kpis.registered_entries > 0 &&
            dashboard.hourly_attendance &&
            dashboard.hourly_attendance.length > 0),
    );

    const dateTitle = dashboard?.date_title || '26 de octubre';
    const year = dashboard?.year || '2026';

    const registeredEntries = hasData
        ? (dashboard?.kpis?.registered_entries ?? 0)
        : 0;
    const peakHour = hasData ? (dashboard?.kpis?.peak_hour?.hour ?? '-') : '-';
    const peakEntries = hasData
        ? (dashboard?.kpis?.peak_hour?.entries ?? 0)
        : 0;
    const analyzedHoursCount = hasData
        ? (dashboard?.kpis?.analyzed_hours?.count ?? 0)
        : 0;
    const analyzedHoursRange = hasData
        ? (dashboard?.kpis?.analyzed_hours?.range ?? '-')
        : '-';

    const hourlyData: HourlyData[] = hasData
        ? (dashboard?.hourly_attendance ?? [])
        : [];
    const blockData: BlockData[] = hasData
        ? (dashboard?.two_hour_blocks ?? [])
        : [];

    const morningPercent = hasData
        ? (dashboard?.attendance_distribution?.morning?.percentage ?? 0)
        : 0;
    const afternoonPercent = hasData
        ? (dashboard?.attendance_distribution?.afternoon?.percentage ?? 0)
        : 0;
    const morningBadgeText = hasData
        ? (dashboard?.attendance_distribution?.main_badge?.percentage ?? '0%')
        : '0%';
    const morningBadgeLabel = hasData
        ? (dashboard?.attendance_distribution?.main_badge?.label ??
          'sin registros')
        : 'sin registros';

    const yAxisTicks = [180, 150, 120, 90, 60, 30, 0];
    const maxHourlyValue = 180;
    const maxBlockValue = 280;

    // SVG donut calculations
    const radius = 38;
    const circumference = 2 * Math.PI * radius; // 238.761
    const orangeStrokeLength = (morningPercent / 100) * circumference;
    const blueStrokeLength = Math.max(0, circumference - orangeStrokeLength);

    return (
        <>
            <Head title="Semana de la Seguridad Toquepala 2026 - Dashboard" />

            <div className="relative min-h-screen w-full overflow-x-hidden bg-[#030713] font-sans text-white selection:bg-cyan-500 selection:text-black">
                {/* Background futuristic glow elements */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-cyan-600/15 blur-3xl" />
                    <div className="absolute top-10 right-0 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl" />
                    <div className="absolute top-1/2 left-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-950/20 blur-[120px]" />
                    {/* Diagonal light rays */}
                    <div className="absolute top-0 right-1/4 h-72 w-[2px] rotate-45 bg-gradient-to-b from-cyan-400/30 via-transparent to-transparent" />
                    <div className="absolute top-12 left-1/3 h-96 w-[1px] -rotate-12 bg-gradient-to-b from-blue-400/20 via-transparent to-transparent" />
                </div>

                {/* Main responsive container */}
                <main className="relative z-10 mx-auto flex w-full max-w-[620px] flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-5 sm:py-6">
                    {/* Top utility link to API documentation & data entry */}
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold tracking-wider text-cyan-500/70 uppercase sm:text-xs">
                            Semana de la Seguridad 2026
                        </span>
                        <Link
                            href="/api-docs"
                            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/50 bg-[#08152e]/80 px-3 py-1 text-xs font-bold text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-white"
                        >
                            <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                            API & Ingreso de Datos →
                        </Link>
                    </div>

                    {/* Header: S26 Logo + Date Title */}
                    <header className="flex items-center justify-between gap-3 pt-1 pb-1">
                        <div className="flex flex-1 items-center">
                            <img
                                src="/logo.png"
                                alt="Semana de la Seguridad Toquepala 2026"
                                className="h-28 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,210,255,0.3)] filter transition-transform duration-300 hover:scale-105 sm:h-36"
                            />
                        </div>

                        <div className="flex flex-col justify-center text-right">
                            <h1 className="text-2xl leading-tight font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-3xl md:text-4xl">
                                {dateTitle}
                            </h1>
                            <p className="text-2xl leading-tight font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-3xl md:text-4xl">
                                del{' '}
                                <span className="text-[#f59e0b] drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]">
                                    {year}
                                </span>
                            </p>
                        </div>
                    </header>

                    {/* Top 3 KPI Cards */}
                    <section className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                        {/* Card 1: Entradas Registradas (Cyan) */}
                        <div className="group relative flex flex-col justify-between rounded-2xl border border-cyan-500/60 bg-gradient-to-b from-[#0b1c38]/90 via-[#071329]/90 to-[#040b1c]/95 p-3 shadow-[0_0_18px_rgba(6,182,212,0.25)] transition-all duration-300 hover:shadow-[0_0_24px_rgba(6,182,212,0.45)] sm:p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <div className="rounded-lg bg-cyan-500/20 p-1.5 text-cyan-400">
                                    <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <span className="text-[11px] leading-tight font-semibold text-slate-100 sm:text-xs">
                                    Entradas Registradas
                                </span>
                            </div>
                            <div className="mt-auto">
                                <div className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                                    {registeredEntries}
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Hora Pico (Orange/Gold) */}
                        <div className="group relative flex flex-col justify-between rounded-2xl border border-amber-500/70 bg-gradient-to-b from-[#221708]/90 via-[#161009]/90 to-[#0c0a0a]/95 p-3 shadow-[0_0_18px_rgba(245,158,11,0.25)] transition-all duration-300 hover:shadow-[0_0_24px_rgba(245,158,11,0.45)] sm:p-4">
                            <div className="mb-1 flex items-center gap-2">
                                <div className="rounded-lg bg-amber-500/20 p-1.5 text-amber-400">
                                    <Trophy className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <span className="text-[11px] leading-tight font-semibold text-slate-100 sm:text-xs">
                                    Hora Pico
                                </span>
                            </div>
                            <div className="mt-auto">
                                <div className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                                    {peakHour}
                                </div>
                                <div className="mt-0.5 text-[10px] font-bold text-amber-400/90 sm:text-xs">
                                    {hasData
                                        ? `${peakEntries} entradas`
                                        : '0 entradas'}
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Horas Analizadas (Purple) */}
                        <div className="group relative flex flex-col justify-between rounded-2xl border border-purple-500/60 bg-gradient-to-b from-[#1c0f33]/90 via-[#120a24]/90 to-[#090717]/95 p-3 shadow-[0_0_18px_rgba(168,85,247,0.25)] transition-all duration-300 hover:shadow-[0_0_24px_rgba(168,85,247,0.45)] sm:p-4">
                            <div className="mb-1 flex items-center gap-2">
                                <div className="rounded-lg bg-purple-500/20 p-1.5 text-purple-400">
                                    <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <span className="text-[11px] leading-tight font-semibold text-slate-100 sm:text-xs">
                                    Horas Analizadas
                                </span>
                            </div>
                            <div className="mt-auto">
                                <div className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                                    {analyzedHoursCount}
                                </div>
                                <div className="mt-0.5 text-[10px] font-medium text-purple-300/90 sm:text-xs">
                                    {analyzedHoursRange}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Middle Section: Afluencia por Hora (Bar Chart) */}
                    <section className="relative rounded-2xl border border-cyan-500/60 bg-gradient-to-b from-[#071329]/95 via-[#050f22]/95 to-[#030919]/98 p-3.5 shadow-[0_0_22px_rgba(6,182,212,0.2)] sm:p-5">
                        {/* Futuristic Corner Tech Accents */}
                        <div className="absolute top-0 left-0 h-3 w-3 border-t-2 border-l-2 border-cyan-400" />
                        <div className="absolute top-0 right-0 h-3 w-3 border-t-2 border-r-2 border-cyan-400" />
                        <div className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-cyan-400" />
                        <div className="absolute right-0 bottom-0 h-3 w-3 border-r-2 border-b-2 border-cyan-400" />

                        {/* Card Header */}
                        <div className="mb-4 flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-cyan-400 sm:h-6 sm:w-6" />
                            <h2 className="text-base font-bold tracking-wide text-white sm:text-lg">
                                Afluencia por Hora
                            </h2>
                        </div>

                        {/* Chart Area */}
                        {hasData && hourlyData.length > 0 ? (
                            <div className="relative pt-2 pb-1">
                                {/* Y-axis and Gridlines */}
                                <div className="flex flex-row">
                                    {/* Y-axis labels */}
                                    <div className="flex h-44 flex-col items-end justify-between pr-2.5 text-[10px] font-medium text-slate-400 select-none sm:text-xs">
                                        {yAxisTicks.map((tick) => (
                                            <span
                                                key={tick}
                                                className="leading-none"
                                            >
                                                {tick}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Bars Canvas */}
                                    <div className="relative flex h-44 flex-1 items-end justify-between border-l border-slate-700/60 px-1 sm:px-2">
                                        {/* Horizontal grid lines */}
                                        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                                            {yAxisTicks.map((tick) => (
                                                <div
                                                    key={`grid-${tick}`}
                                                    className="w-full border-b border-dashed border-cyan-900/30"
                                                />
                                            ))}
                                        </div>

                                        {/* Bars */}
                                        {hourlyData.map((item) => {
                                            const heightPercent = Math.min(
                                                100,
                                                Math.max(
                                                    4,
                                                    (item.count /
                                                        maxHourlyValue) *
                                                        100,
                                                ),
                                            );
                                            return (
                                                <div
                                                    key={item.hour}
                                                    className="group relative z-10 flex h-full w-[8%] cursor-pointer flex-col items-center justify-end"
                                                >
                                                    {/* Value text above bar */}
                                                    <span className="mb-1 text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-xs">
                                                        {item.count}
                                                    </span>

                                                    {/* Bar element */}
                                                    <div
                                                        style={{
                                                            height: `${heightPercent}%`,
                                                        }}
                                                        className="w-full rounded-t-sm bg-gradient-to-t from-[#0284c7] via-[#0284c7] to-[#00d2ff] shadow-[0_0_10px_rgba(0,210,255,0.4)] transition-all duration-300 group-hover:brightness-125 sm:rounded-t-md"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* X-axis labels */}
                                <div className="mt-2 flex justify-between border-t border-slate-700/60 pt-1 pr-1 pl-7 sm:pr-2 sm:pl-9">
                                    {hourlyData.map((item) => (
                                        <div
                                            key={`x-${item.hour}`}
                                            className="w-[8%] text-center text-[9px] font-medium text-slate-300 sm:text-[11px]"
                                        >
                                            {item.hour}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Empty state when there is no data */
                            <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-cyan-900/40 bg-cyan-950/10 py-8 text-center">
                                <Database className="mb-2 h-10 w-10 stroke-1 text-cyan-500/40" />
                                <p className="text-sm font-semibold text-slate-200">
                                    No hay registros de afluencia
                                </p>
                                <p className="mt-1 max-w-xs text-xs text-slate-400">
                                    La base de datos aún no contiene registros.
                                    Ejecuta la importación para cargar los
                                    datos.
                                </p>
                            </div>
                        )}
                    </section>

                    {/* Bottom 2 Cards Grid */}
                    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                        {/* Left Card: Distribución de Asistencia */}
                        <div className="relative flex flex-col justify-between rounded-2xl border border-cyan-500/60 bg-gradient-to-b from-[#071329]/95 via-[#050f22]/95 to-[#030919]/98 p-3.5 shadow-[0_0_20px_rgba(6,182,212,0.18)] sm:p-4">
                            {/* Header */}
                            <div className="mb-3 flex items-center gap-2">
                                <PieChart className="h-5 w-5 text-cyan-400" />
                                <h3 className="text-sm font-bold tracking-wide text-white sm:text-base">
                                    Distribución de Asistencia
                                </h3>
                            </div>

                            {/* Donut Chart + Legend */}
                            {hasData ? (
                                <div className="my-auto flex items-center justify-around gap-2 py-2">
                                    {/* SVG Donut Chart */}
                                    <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
                                        <svg
                                            className="h-full w-full -rotate-90"
                                            viewBox="0 0 100 100"
                                        >
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r="38"
                                                className="stroke-transparent"
                                                strokeWidth="16"
                                                fill="transparent"
                                            />
                                            {/* Orange Segment: morning */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r="38"
                                                stroke="#f97316"
                                                strokeWidth="16"
                                                fill="transparent"
                                                strokeDasharray={`${orangeStrokeLength} ${circumference}`}
                                                strokeDashoffset="0"
                                                className="transition-all duration-500"
                                            />
                                            {/* Blue Segment: afternoon */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r="38"
                                                stroke="#0284c7"
                                                strokeWidth="16"
                                                fill="transparent"
                                                strokeDasharray={`${blueStrokeLength} ${circumference}`}
                                                strokeDashoffset={`-${orangeStrokeLength}`}
                                                className="transition-all duration-500"
                                            />
                                        </svg>

                                        {/* Center badge */}
                                        <div className="absolute inset-0 m-auto flex h-16 w-16 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#ea580c] to-[#c2410c] p-1 text-center shadow-[inset_0_2px_6px_rgba(255,255,255,0.3),0_0_12px_rgba(234,88,12,0.5)] sm:h-18 sm:w-18">
                                            <span className="text-xs leading-tight font-black text-white drop-shadow-sm sm:text-sm">
                                                {morningBadgeText}
                                            </span>
                                            <span className="text-[8px] leading-tight font-medium text-white/90 sm:text-[9px]">
                                                {morningBadgeLabel}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex flex-col gap-3">
                                        {/* Mañana item */}
                                        <div className="flex items-start gap-2">
                                            <span className="mt-0.5 h-3 w-3 rounded-full bg-[#0284c7] shadow-[0_0_6px_#0284c7]" />
                                            <div className="flex flex-col text-[11px] sm:text-xs">
                                                <span className="font-semibold text-slate-100">
                                                    Mañana
                                                </span>
                                                <span className="text-[10px] text-slate-400 sm:text-[11px]">
                                                    (10:00 – 13:59)
                                                </span>
                                                <span className="text-xs font-bold text-white sm:text-sm">
                                                    {morningPercent}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Tarde item */}
                                        <div className="flex items-start gap-2">
                                            <span className="mt-0.5 h-3 w-3 rounded-full bg-[#f97316] shadow-[0_0_6px_#f97316]" />
                                            <div className="flex flex-col text-[11px] sm:text-xs">
                                                <span className="font-semibold text-slate-100">
                                                    Tarde
                                                </span>
                                                <span className="text-[10px] text-slate-400 sm:text-[11px]">
                                                    (14:00 – 19:59)
                                                </span>
                                                <span className="text-xs font-bold text-white sm:text-sm">
                                                    {afternoonPercent}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-cyan-900/40 bg-cyan-950/10 p-3 text-center">
                                    <PieChart className="mb-1 h-8 w-8 stroke-1 text-cyan-500/40" />
                                    <p className="text-xs font-semibold text-slate-300">
                                        Sin datos de distribución
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Right Card: Afluencia por Bloques de 2 Horas */}
                        <div className="relative flex flex-col justify-between rounded-2xl border border-cyan-500/60 bg-gradient-to-b from-[#071329]/95 via-[#050f22]/95 to-[#030919]/98 p-3.5 shadow-[0_0_20px_rgba(6,182,212,0.18)] sm:p-4">
                            {/* Header */}
                            <div className="mb-3 flex items-center gap-2">
                                <Clock className="h-5 w-5 text-cyan-400" />
                                <h3 className="text-sm font-bold tracking-wide text-white sm:text-base">
                                    Afluencia por Bloques de 2 Horas
                                </h3>
                            </div>

                            {hasData && blockData.length > 0 ? (
                                <>
                                    {/* 4 Bars Chart */}
                                    <div className="flex h-32 items-end justify-around px-1 pt-2">
                                        {blockData.map((block) => {
                                            const heightPercent = Math.min(
                                                100,
                                                Math.max(
                                                    5,
                                                    (block.count /
                                                        maxBlockValue) *
                                                        100,
                                                ),
                                            );
                                            return (
                                                <div
                                                    key={block.label}
                                                    className="group flex h-full w-1/5 cursor-pointer flex-col items-center justify-end"
                                                >
                                                    <span className="mb-1.5 text-xs font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-sm">
                                                        {block.count}
                                                    </span>
                                                    <div
                                                        style={{
                                                            height: `${heightPercent}%`,
                                                        }}
                                                        className="w-full rounded-t-md bg-gradient-to-t from-[#0284c7] via-[#0284c7] to-[#00d2ff] shadow-[0_0_10px_rgba(0,210,255,0.4)] transition-all duration-300 group-hover:brightness-125"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* X-axis labels */}
                                    <div className="mt-1 flex justify-around border-t border-slate-700/60 pt-2">
                                        {blockData.map((block) => (
                                            <div
                                                key={`label-${block.label}`}
                                                className="w-1/5 text-center text-[10px] font-medium text-slate-300 sm:text-xs"
                                            >
                                                {block.label}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-cyan-900/40 bg-cyan-950/10 p-3 text-center">
                                    <Clock className="mb-1 h-8 w-8 stroke-1 text-cyan-500/40" />
                                    <p className="text-xs font-semibold text-slate-300">
                                        Sin bloques registrados
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Bottom Banner: Slogan + Mining Truck Graphic */}
                    <footer className="relative mt-1 flex min-h-[105px] items-center justify-between overflow-hidden rounded-2xl border-t-2 border-cyan-500/50 bg-gradient-to-r from-[#030919] via-[#051433] to-[#081a3d] p-4 shadow-[0_4px_25px_rgba(0,0,0,0.7)] sm:p-5">
                        {/* Left: Shield badge + Slogan */}
                        <div className="relative z-10 flex max-w-[65%] items-center gap-3.5">
                            <img
                                src="/images/shield_transparent.png"
                                alt="Seguridad"
                                className="h-14 w-12 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] filter sm:h-16 sm:w-14"
                            />
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-wide text-white italic drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-2xl">
                                    La seguridad
                                </span>
                                <span className="text-xl font-black tracking-wide text-white italic drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-2xl">
                                    es tarea de{' '}
                                    <span className="text-[#f59e0b] drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]">
                                        todos
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Right: Giant Haul Truck Mining Image */}
                        <div className="pointer-events-none absolute top-0 right-0 bottom-0 flex w-[45%] items-center justify-end overflow-hidden">
                            <img
                                src="/images/truck_blend.png"
                                alt="Mining Haul Truck"
                                className="h-full w-full object-cover object-left"
                            />
                        </div>

                        {/* Flowing bottom decorative curves (Blue & Gold neon swooshes) */}
                        <div className="pointer-events-none absolute right-0 -bottom-1 left-0 h-4 overflow-hidden">
                            <svg
                                className="h-full w-full"
                                viewBox="0 0 500 20"
                                preserveAspectRatio="none"
                            >
                                <path
                                    d="M0,15 Q150,5 300,12 T500,8"
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="3.5"
                                    strokeOpacity="0.85"
                                />
                                <path
                                    d="M0,18 Q180,8 350,16 T500,10"
                                    fill="none"
                                    stroke="#00d2ff"
                                    strokeWidth="3"
                                    strokeOpacity="0.9"
                                />
                            </svg>
                        </div>
                    </footer>
                </main>
            </div>
        </>
    );
}
