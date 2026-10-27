import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    Code2,
    Database,
    FileSpreadsheet,
    Globe,
    Layers,
    Play,
    PlusCircle,
    Send,
    Terminal,
    UploadCloud,
    Users,
} from 'lucide-react';
import React, { useState } from 'react';

interface Stats {
    total_entries: number;
    minute_records_count: number;
    hourly_records_count: number;
    cameras: string[];
}

interface ApiDocsProps {
    stats: Stats;
    recent_hourly?: Array<{ hour: string; entered: number; camera: string }>;
    recent_minutes?: Array<{
        time_str: string;
        entered: number;
        change_entered: number;
        camera: string;
    }>;
}

export default function ApiDocs({ stats }: ApiDocsProps) {
    const [activeTab, setActiveTab] = useState<
        'record' | 'hourly' | 'upload' | 'tester'
    >('record');

    // Form states
    const [camera, setCamera] = useState('Acceso 2');
    const [customCamera, setCustomCamera] = useState('');
    const [changeEntered, setChangeEntered] = useState(1);
    const [changeExited, setChangeExited] = useState(0);

    const [hourlyCamera, setHourlyCamera] = useState('Acceso 2');
    const [hourVal, setHourVal] = useState('20:00');
    const [hourlyEntered, setHourlyEntered] = useState(50);

    const [excelFile, setExcelFile] = useState<File | null>(null);

    // Submission & Response states
    const [loading, setLoading] = useState(false);
    const [responseMessage, setResponseMessage] = useState<string | null>(null);
    const [responseStatus, setResponseStatus] = useState<
        'success' | 'error' | null
    >(null);
    const [responseData, setResponseData] = useState<Record<
        string,
        unknown
    > | null>(null);

    // Live endpoint tester state
    const [testerEndpoint, setTesterEndpoint] = useState('/api/dashboard');
    const [testerOutput, setTesterOutput] = useState<string | null>(null);
    const [testerLoading, setTesterLoading] = useState(false);

    const getEffectiveCamera = (cam: string) =>
        cam === 'Otro' ? customCamera || 'Acceso Nuevo' : cam;

    // Submit minute record
    const handleRegisterEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResponseMessage(null);
        setResponseData(null);

        try {
            const res = await fetch('/api/conteo/registro', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    camera: getEffectiveCamera(camera),
                    change_entered: Number(changeEntered),
                    change_exited: Number(changeExited),
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setResponseStatus('success');
                setResponseMessage(
                    '¡Evento registrado exitosamente en la base de datos!',
                );
                setResponseData(data);
            } else {
                setResponseStatus('error');
                setResponseMessage(data.message || 'Error al registrar evento');
                setResponseData(data);
            }
        } catch (err: unknown) {
            setResponseStatus('error');
            setResponseMessage(
                err instanceof Error
                    ? err.message
                    : 'Error en la conexión con el servidor',
            );
        } finally {
            setLoading(false);
        }
    };

    // Submit hourly record
    const handleRegisterHourly = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResponseMessage(null);
        setResponseData(null);

        try {
            const res = await fetch('/api/conteo/hora', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    camera: getEffectiveCamera(hourlyCamera),
                    hour: hourVal,
                    entered: Number(hourlyEntered),
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setResponseStatus('success');
                setResponseMessage(
                    `¡Hora ${hourVal} registrada con ${hourlyEntered} entradas!`,
                );
                setResponseData(data);
            } else {
                setResponseStatus('error');
                setResponseMessage(data.message || 'Error al guardar hora');
                setResponseData(data);
            }
        } catch (err: unknown) {
            setResponseStatus('error');
            setResponseMessage(
                err instanceof Error ? err.message : 'Error en la conexión',
            );
        } finally {
            setLoading(false);
        }
    };

    // Upload Excel
    const handleUploadExcel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!excelFile) return;

        setLoading(true);
        setResponseMessage(null);
        setResponseData(null);

        const formData = new FormData();
        formData.append('file', excelFile);

        try {
            const res = await fetch('/api/conteo/import', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                },
                body: formData,
            });

            const data = await res.json();
            if (res.ok) {
                setResponseStatus('success');
                setResponseMessage(
                    '¡Archivo importado con éxito a la base de datos SQLite!',
                );
                setResponseData(data);
            } else {
                setResponseStatus('error');
                setResponseMessage(data.message || 'Error al importar archivo');
                setResponseData(data);
            }
        } catch (err: unknown) {
            setResponseStatus('error');
            setResponseMessage(
                err instanceof Error
                    ? err.message
                    : 'Error al subir el archivo',
            );
        } finally {
            setLoading(false);
        }
    };

    // Run tester
    const handleRunTester = async () => {
        setTesterLoading(true);
        setTesterOutput(null);
        try {
            const res = await fetch(testerEndpoint, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            setTesterOutput(JSON.stringify(data, null, 2));
        } catch (err: unknown) {
            setTesterOutput(
                JSON.stringify(
                    {
                        error:
                            err instanceof Error
                                ? err.message
                                : 'Error ejecutando prueba',
                    },
                    null,
                    2,
                ),
            );
        } finally {
            setTesterLoading(false);
        }
    };

    return (
        <>
            <Head title="Documentación de la API & Consola de Ingreso" />

            <div className="min-h-screen bg-[#030713] pb-16 font-sans text-white selection:bg-cyan-500 selection:text-black">
                {/* Background glow effects */}
                <div className="pointer-events-none fixed inset-0 overflow-hidden">
                    <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-cyan-600/15 blur-3xl" />
                    <div className="absolute top-10 right-0 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl" />
                    <div className="absolute bottom-10 left-1/3 h-[400px] w-[600px] rounded-full bg-sky-950/20 blur-[120px]" />
                </div>

                {/* Top Nav Bar */}
                <header className="relative z-10 flex items-center justify-between border-b border-cyan-500/20 bg-[#060e22]/80 px-4 py-3.5 backdrop-blur-md sm:px-8">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)] transition-all hover:bg-cyan-500/20 sm:text-sm"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Volver al Dashboard
                        </Link>
                        <span className="hidden text-slate-500 sm:inline">
                            |
                        </span>
                        <h1 className="flex items-center gap-2 text-sm font-bold tracking-wide text-white sm:text-base">
                            <Terminal className="h-4 w-4 text-cyan-400" />
                            API & Centro de Ingreso de Datos
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-1 text-xs text-emerald-400">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                            API Activa (SQLite)
                        </span>
                    </div>
                </header>

                <main className="relative z-10 mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-6 sm:px-6 sm:pt-8">
                    {/* Database Live Stats Bar */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-gradient-to-b from-[#0b1c38]/80 to-[#071329]/80 p-3.5 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                            <div className="rounded-lg bg-cyan-500/20 p-2 text-cyan-400">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-medium text-slate-400">
                                    Entradas Totales
                                </div>
                                <div className="text-lg font-black text-white sm:text-xl">
                                    {stats.total_entries}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-gradient-to-b from-[#0b1c38]/80 to-[#071329]/80 p-3.5 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                            <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
                                <Layers className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-medium text-slate-400">
                                    Reg. por Minuto
                                </div>
                                <div className="text-lg font-black text-white sm:text-xl">
                                    {stats.minute_records_count}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-gradient-to-b from-[#0b1c38]/80 to-[#071329]/80 p-3.5 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400">
                                <Code2 className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-medium text-slate-400">
                                    Horas Analizadas
                                </div>
                                <div className="text-lg font-black text-white sm:text-xl">
                                    {stats.hourly_records_count}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-gradient-to-b from-[#0b1c38]/80 to-[#071329]/80 p-3.5 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                            <div className="rounded-lg bg-purple-500/20 p-2 text-purple-400">
                                <Database className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-medium text-slate-400">
                                    Cámaras Activas
                                </div>
                                <div className="max-w-[120px] truncate text-sm font-bold text-white">
                                    {stats.cameras.length
                                        ? stats.cameras.join(', ')
                                        : 'Ninguna'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section: Interactive Console (Ingresar datos) */}
                    <section className="rounded-2xl border border-cyan-500/60 bg-gradient-to-b from-[#071329]/95 via-[#050f22]/95 to-[#030919]/98 p-5 shadow-[0_0_25px_rgba(6,182,212,0.2)] sm:p-6">
                        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-cyan-900/40 pb-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="flex items-center gap-2 text-lg font-black tracking-wide text-white sm:text-xl">
                                    <Send className="h-5 w-5 text-cyan-400" />
                                    Consola Interactiva de Ingreso de Datos
                                </h2>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Envía datos en tiempo real a la API. Los
                                    cambios impactan inmediatamente en el
                                    Dashboard.
                                </p>
                            </div>

                            {/* Tabs selector */}
                            <div className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-[#030713] p-1">
                                <button
                                    onClick={() => {
                                        setActiveTab('record');
                                        setResponseMessage(null);
                                    }}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                        activeTab === 'record'
                                            ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                >
                                    Evento en Vivo (+1)
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab('hourly');
                                        setResponseMessage(null);
                                    }}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                        activeTab === 'hourly'
                                            ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                >
                                    Por Hora
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab('upload');
                                        setResponseMessage(null);
                                    }}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                        activeTab === 'upload'
                                            ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                >
                                    Subir Excel
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab('tester');
                                        setResponseMessage(null);
                                    }}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                        activeTab === 'tester'
                                            ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                >
                                    Probador GET
                                </button>
                            </div>
                        </div>

                        {/* TAB 1: Live event registration (POST /api/conteo/registro) */}
                        {activeTab === 'record' && (
                            <form
                                onSubmit={handleRegisterEvent}
                                className="flex flex-col gap-4"
                            >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                                            Cámara / Acceso
                                        </label>
                                        <select
                                            value={camera}
                                            onChange={(e) =>
                                                setCamera(e.target.value)
                                            }
                                            className="w-full rounded-xl border border-cyan-500/40 bg-[#050b18] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                                        >
                                            <option value="Acceso 1">
                                                Acceso 1
                                            </option>
                                            <option value="Acceso 2">
                                                Acceso 2
                                            </option>
                                            <option value="Acceso 3">
                                                Acceso 3
                                            </option>
                                            <option value="Otro">
                                                Otro (personalizado)
                                            </option>
                                        </select>
                                    </div>

                                    {camera === 'Otro' && (
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                                                Nombre de Acceso
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej. Puerta Principal"
                                                value={customCamera}
                                                onChange={(e) =>
                                                    setCustomCamera(
                                                        e.target.value,
                                                    )
                                                }
                                                className="w-full rounded-xl border border-cyan-500/40 bg-[#050b18] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                                            Nuevas Entradas (Delta)
                                        </label>
                                        <input
                                            type="number"
                                            value={changeEntered}
                                            onChange={(e) =>
                                                setChangeEntered(
                                                    Number(e.target.value),
                                                )
                                            }
                                            className="w-full rounded-xl border border-cyan-500/40 bg-[#050b18] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                                            Salidas (Opcional)
                                        </label>
                                        <input
                                            type="number"
                                            value={changeExited}
                                            onChange={(e) =>
                                                setChangeExited(
                                                    Number(e.target.value),
                                                )
                                            }
                                            className="w-full rounded-xl border border-cyan-500/40 bg-[#050b18] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-bold text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                        {loading
                                            ? 'Enviando a API...'
                                            : 'Registrar Ingreso en Base de Datos'}
                                    </button>

                                    <Link
                                        href="/"
                                        className="flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                                    >
                                        Ver cambios en el Dashboard →
                                    </Link>
                                </div>
                            </form>
                        )}

                        {/* TAB 2: Hourly record registration (POST /api/conteo/hora) */}
                        {activeTab === 'hourly' && (
                            <form
                                onSubmit={handleRegisterHourly}
                                className="flex flex-col gap-4"
                            >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                                            Cámara / Acceso
                                        </label>
                                        <select
                                            value={hourlyCamera}
                                            onChange={(e) =>
                                                setHourlyCamera(e.target.value)
                                            }
                                            className="w-full rounded-xl border border-cyan-500/40 bg-[#050b18] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                                        >
                                            <option value="Acceso 1">
                                                Acceso 1
                                            </option>
                                            <option value="Acceso 2">
                                                Acceso 2
                                            </option>
                                            <option value="Acceso 3">
                                                Acceso 3
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                                            Hora (Formato HH:00)
                                        </label>
                                        <input
                                            type="text"
                                            value={hourVal}
                                            onChange={(e) =>
                                                setHourVal(e.target.value)
                                            }
                                            placeholder="20:00"
                                            className="w-full rounded-xl border border-cyan-500/40 bg-[#050b18] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                                            Cantidad de Entradas
                                        </label>
                                        <input
                                            type="number"
                                            value={hourlyEntered}
                                            onChange={(e) =>
                                                setHourlyEntered(
                                                    Number(e.target.value),
                                                )
                                            }
                                            className="w-full rounded-xl border border-cyan-500/40 bg-[#050b18] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-black shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                                    >
                                        <Code2 className="h-4 w-4" />
                                        {loading
                                            ? 'Guardando...'
                                            : 'Guardar / Actualizar Registro Horario'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* TAB 3: Upload Excel file */}
                        {activeTab === 'upload' && (
                            <form
                                onSubmit={handleUploadExcel}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-500/40 bg-cyan-950/10 p-6 text-center">
                                    <FileSpreadsheet className="mb-2 h-10 w-10 text-cyan-400" />
                                    <p className="mb-1 text-sm font-bold text-white">
                                        Selecciona o arrastra el archivo de
                                        conteo (.xls o .xlsx)
                                    </p>
                                    <p className="mb-3 text-xs text-slate-400">
                                        Soporta el formato XML Spreadsheet 2003
                                        de cámaras y accesos
                                    </p>

                                    <input
                                        type="file"
                                        accept=".xls,.xlsx,.xml"
                                        onChange={(e) =>
                                            setExcelFile(
                                                e.target.files
                                                    ? e.target.files[0]
                                                    : null,
                                            )
                                        }
                                        className="cursor-pointer text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-300 hover:file:bg-cyan-500/30"
                                    />
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="submit"
                                        disabled={loading || !excelFile}
                                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-bold text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                                    >
                                        <UploadCloud className="h-4 w-4" />
                                        {loading
                                            ? 'Procesando e Importando...'
                                            : 'Importar a Base de Datos'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* TAB 4: Live GET tester */}
                        {activeTab === 'tester' && (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-3 py-2 text-xs font-bold text-cyan-400">
                                        GET
                                    </span>
                                    <select
                                        value={testerEndpoint}
                                        onChange={(e) =>
                                            setTesterEndpoint(e.target.value)
                                        }
                                        className="flex-1 rounded-xl border border-cyan-500/40 bg-[#050b18] px-3 py-2 text-sm text-white focus:outline-none"
                                    >
                                        <option value="/api/dashboard">
                                            /api/dashboard (Métricas Completas)
                                        </option>
                                        <option value="/api/conteo/horas">
                                            /api/conteo/horas (Registros por
                                            Hora)
                                        </option>
                                        <option value="/api/conteo/minutos?limit=10">
                                            /api/conteo/minutos?limit=10
                                            (Últimos minutos)
                                        </option>
                                        <option value="/api/conteo/camaras">
                                            /api/conteo/camaras (Resumen
                                            Cámaras)
                                        </option>
                                    </select>
                                    <button
                                        onClick={handleRunTester}
                                        disabled={testerLoading}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-black hover:brightness-110"
                                    >
                                        <Play className="h-4 w-4 fill-current" />
                                        {testerLoading
                                            ? 'Cargando...'
                                            : 'Ejecutar'}
                                    </button>
                                </div>

                                {testerOutput && (
                                    <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-cyan-500/30 bg-[#02050e] p-3">
                                        <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-cyan-300">
                                            {testerOutput}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Server response alert */}
                        {responseMessage && (
                            <div
                                className={`mt-4 flex flex-col gap-2 rounded-xl border p-3.5 ${
                                    responseStatus === 'success'
                                        ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                                        : 'border-red-500/50 bg-red-950/40 text-red-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>{responseMessage}</span>
                                </div>

                                {responseData ? (
                                    <pre className="max-h-40 overflow-auto rounded-lg bg-black/50 p-2.5 font-mono text-[11px] text-slate-200">
                                        {JSON.stringify(responseData, null, 2)}
                                    </pre>
                                ) : null}
                            </div>
                        )}
                    </section>

                    {/* Section: Complete API Endpoints Documentation */}
                    <section className="flex flex-col gap-4">
                        <div>
                            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                                <Globe className="h-5 w-5 text-cyan-400" />
                                Catálogo de Endpoints de la API
                            </h2>
                            <p className="text-xs text-slate-400">
                                Puedes consumir estos endpoints desde cámaras,
                                microservicios, scripts Python o clientes web.
                            </p>
                        </div>

                        {/* Endpoint 1: POST /api/conteo/registro */}
                        <div className="rounded-xl border border-cyan-500/40 bg-[#060e22]/90 p-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="rounded border border-emerald-500/50 bg-emerald-950/80 px-2 py-0.5 text-xs font-black text-emerald-400">
                                        POST
                                    </span>
                                    <code className="font-mono text-sm font-bold text-cyan-300">
                                        /api/conteo/registro
                                    </code>
                                </div>
                                <span className="text-xs text-slate-400">
                                    Ingreso en tiempo real (Cámaras /
                                    Torniquetes)
                                </span>
                            </div>
                            <p className="mb-3 text-xs text-slate-300">
                                Registra un evento de entrada o salida.
                                Sincroniza automáticamente la tabla horaria y el
                                consolidado de cámaras en SQLite.
                            </p>
                            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#02050e] p-3 font-mono text-xs text-slate-300">
                                <p className="mb-1 text-slate-500">
                                    // Body JSON:
                                </p>
                                <pre>{`{
  "camera": "Acceso 2",
  "change_entered": 1,
  "change_exited": 0
}`}</pre>
                            </div>
                        </div>

                        {/* Endpoint 2: GET /api/dashboard */}
                        <div className="rounded-xl border border-cyan-500/40 bg-[#060e22]/90 p-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="rounded border border-cyan-500/50 bg-cyan-950/80 px-2 py-0.5 text-xs font-black text-cyan-400">
                                        GET
                                    </span>
                                    <code className="font-mono text-sm font-bold text-cyan-300">
                                        /api/dashboard
                                    </code>
                                </div>
                                <span className="text-xs text-slate-400">
                                    Resumen y métricas del Dashboard
                                </span>
                            </div>
                            <p className="mb-3 text-xs text-slate-300">
                                Retorna el total de entradas, hora pico, horas
                                analizadas, afluencia por hora, distribución
                                mañana/tarde y bloques de 2 horas.
                            </p>
                        </div>

                        {/* Endpoint 3: POST /api/conteo/hora */}
                        <div className="rounded-xl border border-cyan-500/40 bg-[#060e22]/90 p-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="rounded border border-emerald-500/50 bg-emerald-950/80 px-2 py-0.5 text-xs font-black text-emerald-400">
                                        POST
                                    </span>
                                    <code className="font-mono text-sm font-bold text-cyan-300">
                                        /api/conteo/hora
                                    </code>
                                </div>
                                <span className="text-xs text-slate-400">
                                    Guardar / Actualizar conteo por hora
                                </span>
                            </div>
                            <p className="mb-3 text-xs text-slate-300">
                                Guarda o sobreescribe directamente el conteo de
                                una hora específica (por ejemplo para corregir o
                                consolidar horas).
                            </p>
                            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#02050e] p-3 font-mono text-xs text-slate-300">
                                <pre>{`{
  "camera": "Acceso 2",
  "hour": "20:00",
  "entered": 85
}`}</pre>
                            </div>
                        </div>

                        {/* Endpoint 4: POST /api/conteo/import */}
                        <div className="rounded-xl border border-cyan-500/40 bg-[#060e22]/90 p-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="rounded border border-amber-500/50 bg-amber-950/80 px-2 py-0.5 text-xs font-black text-amber-400">
                                        POST
                                    </span>
                                    <code className="font-mono text-sm font-bold text-cyan-300">
                                        /api/conteo/import
                                    </code>
                                </div>
                                <span className="text-xs text-slate-400">
                                    Subir e importar archivo conteo.xls
                                </span>
                            </div>
                            <p className="text-xs text-slate-300">
                                Permite subir mediante{' '}
                                <code>multipart/form-data</code> un nuevo
                                archivo Excel y procesarlo directamente hacia
                                SQLite.
                            </p>
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}
