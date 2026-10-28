<?php

namespace App\Http\Controllers;

use App\Models\CameraAttendance;
use App\Models\HourlyAttendance;
use App\Models\MinuteAttendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Gather computed dashboard data from SQLite database.
     *
     * @return array<string, mixed>
     */
    /**
     * Compute full dashboard metrics for a specific date (YYYY-MM-DD).
     *
     * @return array<string, mixed>
     */
    protected function getDayMetrics(string $dateStr): array
    {
        $tz = config('app.timezone', 'America/Lima');
        $now = Carbon::now($tz);
        $isToday = ($dateStr === $now->format('Y-m-d'));
        $currentHourStr = $now->format('H').':00';

        try {
            $carbon = Carbon::parse($dateStr);
            $day = $carbon->format('j');
            $months = [
                1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril',
                5 => 'mayo', 6 => 'junio', 7 => 'julio', 8 => 'agosto',
                9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre',
            ];
            $monthName = $months[(int) $carbon->format('n')] ?? 'octubre';
            $dateTitle = "{$day} de {$monthName}";
            $year = $carbon->format('Y');
        } catch (\Throwable) {
            $dateTitle = $dateStr;
            $year = '2026';
        }

        $standardHours = [
            '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
            '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
        ];

        // 1. Check minute_attendances for this date
        $byHour = [];
        $minutes = MinuteAttendance::whereDate('recorded_at', $dateStr)->get();
        if ($minutes->isNotEmpty()) {
            foreach ($minutes as $m) {
                $h = substr($m->time_str, 0, 2).':00';
                $byHour[$h] = ($byHour[$h] ?? 0) + (int) $m->change_entered;
            }
        }

        // 2. If minute_attendances was empty, check hourly_attendances
        if (empty($byHour)) {
            $hasDateCol = Schema::hasColumn('hourly_attendances', 'date');
            $hourly = $hasDateCol
                ? HourlyAttendance::where('date', $dateStr)->orderBy('hour')->get()
                : HourlyAttendance::orderBy('hour')->get();

            if ($hourly->isNotEmpty()) {
                foreach ($hourly as $item) {
                    $byHour[$item->hour] = ($byHour[$item->hour] ?? 0) + (int) $item->entered;
                }
            }
        }

        $totalEntered = (int) array_sum($byHour);
        $hasData = ($totalEntered > 0);

        // Always ensure standard hours from 08:00 to 20:00 exist by default, plus any extra recorded hours
        $allHours = array_values(array_unique(array_merge($standardHours, array_keys($byHour))));
        sort($allHours);

        $peakHour = '-';
        $peakCount = 0;
        foreach ($byHour as $h => $cnt) {
            if ($cnt > $peakCount) {
                $peakCount = $cnt;
                $peakHour = $h;
            }
        }

        $hourlyList = [];
        foreach ($allHours as $h) {
            $cnt = (int) ($byHour[$h] ?? 0);
            $hourlyList[] = [
                'hour' => $h,
                'label' => $h,
                'count' => max(0, $cnt),
                'is_current' => $isToday && ($h === $currentHourStr),
                'is_future' => $isToday && ($h > $currentHourStr),
            ];
        }

        $morningCount = 0;
        $afternoonCount = 0;
        foreach ($byHour as $h => $cnt) {
            $intH = (int) substr($h, 0, 2);
            if ($intH < 14) {
                $morningCount += max(0, $cnt);
            } else {
                $afternoonCount += max(0, $cnt);
            }
        }
        $sum = max(1, $morningCount + $afternoonCount);
        $mPct = ($totalEntered > 0) ? round(($morningCount / $sum) * 100, 1) : 0;
        $aPct = ($totalEntered > 0) ? round(100 - $mPct, 1) : 0;

        $blocks = [
            ['label' => '08-10h', 'count' => (int) ($byHour['08:00'] ?? 0) + (int) ($byHour['09:00'] ?? 0)],
            ['label' => '10-12h', 'count' => (int) ($byHour['10:00'] ?? 0) + (int) ($byHour['11:00'] ?? 0)],
            ['label' => '12-14h', 'count' => (int) ($byHour['12:00'] ?? 0) + (int) ($byHour['13:00'] ?? 0)],
            ['label' => '14-16h', 'count' => (int) ($byHour['14:00'] ?? 0) + (int) ($byHour['15:00'] ?? 0)],
            ['label' => '16-18h', 'count' => (int) ($byHour['16:00'] ?? 0) + (int) ($byHour['17:00'] ?? 0)],
            ['label' => '18-20h', 'count' => (int) ($byHour['18:00'] ?? 0) + (int) ($byHour['19:00'] ?? 0)],
        ];

        $firstHour = $allHours[0] ?? '08:00';
        $lastHour = end($allHours) ?: '20:00';
        $lastPrefix = explode(':', $lastHour)[0];

        return [
            'has_data' => $hasData,
            'date_str' => $dateStr,
            'date_title' => $dateTitle,
            'year' => $year,
            'kpis' => [
                'registered_entries' => max(0, $totalEntered),
                'peak_hour' => ['hour' => $peakHour, 'entries' => max(0, $peakCount)],
                'analyzed_hours' => ['count' => count($allHours), 'range' => "({$firstHour} – {$lastPrefix}:59)"],
            ],
            'hourly_attendance' => $hourlyList,
            'attendance_distribution' => [
                'morning' => ['label' => 'Mañana', 'range' => '(08:00 – 13:59)', 'count' => $morningCount, 'percentage' => $mPct],
                'afternoon' => ['label' => 'Tarde', 'range' => '(14:00 – 20:59)', 'count' => $afternoonCount, 'percentage' => $aPct],
                'main_badge' => [
                    'percentage' => ($totalEntered > 0 ? ($mPct >= $aPct ? $mPct.'%' : $aPct.'%') : '0%'),
                    'label' => ($totalEntered > 0 ? ($mPct >= $aPct ? 'en la mañana' : 'en la tarde') : 'sin registros'),
                ],
            ],
            'two_hour_blocks' => $blocks,
        ];
    }

    /**
     * Gather computed dashboard data from SQLite database.
     *
     * @return array<string, mixed>
     */
    protected function getDashboardData(?string $requestedDate = null): array
    {
        $tz = config('app.timezone', 'America/Lima');
        $now = Carbon::now($tz);
        $todayStr = $now->format('Y-m-d');

        // Find all distinct dates with records
        $hourlyDates = [];
        if (Schema::hasTable('hourly_attendances') && Schema::hasColumn('hourly_attendances', 'date')) {
            $hourlyDates = HourlyAttendance::whereNotNull('date')->distinct()->pluck('date')->toArray();
        }

        $minuteDates = [];
        if (Schema::hasTable('minute_attendances')) {
            $minuteDates = MinuteAttendance::selectRaw('DATE(recorded_at) as dt')->distinct()->pluck('dt')->toArray();
        }

        $allRecordedDates = array_values(array_unique(array_filter(array_merge($hourlyDates, $minuteDates))));
        sort($allRecordedDates);

        // Compute metrics for all recorded dates that have real data
        $todayData = $this->getDayMetrics($todayStr);
        $datesWithMetrics = [];

        foreach ($allRecordedDates as $dt) {
            $metric = ($dt === $todayStr) ? $todayData : $this->getDayMetrics($dt);
            if ($metric['has_data'] && ($metric['kpis']['registered_entries'] ?? 0) > 0) {
                $datesWithMetrics[$dt] = $metric;
            }
        }

        // Find previous recorded date before today, or calendar yesterday
        $priorDatesWithData = array_values(array_filter(array_keys($datesWithMetrics), fn ($d) => $d < $todayStr));
        $previousDate = ! empty($priorDatesWithData)
            ? end($priorDatesWithData)
            : Carbon::parse($todayStr)->subDay()->format('Y-m-d');

        // Determine active date
        if ($requestedDate && (in_array($requestedDate, $allRecordedDates, true) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $requestedDate))) {
            $activeDate = $requestedDate;
        } elseif (! empty($priorDatesWithData)) {
            // Default active date for date view: the day prior to today with data
            $activeDate = end($priorDatesWithData);
        } elseif (! empty($datesWithMetrics)) {
            $activeDate = array_key_first($datesWithMetrics);
        } else {
            $activeDate = $previousDate;
        }

        $activeDayData = ($activeDate === $todayStr)
            ? $todayData
            : ($datesWithMetrics[$activeDate] ?? $this->getDayMetrics($activeDate));

        // Build comparative list strictly from the first recorded date in chronological order
        $comparative = [];
        $dayNum = 1;
        $bestDayLabel = '-';
        $bestDayCount = 0;
        $histPeakHour = '-';
        $histPeakCount = 0;
        $histPeakDay = '-';
        $accumulatedEntries = 0;
        $allMorningEntries = 0;
        $allAfternoonEntries = 0;

        foreach ($datesWithMetrics as $dt => $dayMetric) {
            $entries = (int) ($dayMetric['kpis']['registered_entries'] ?? 0);

            try {
                $dtCarbon = Carbon::parse($dt)->locale('es');
                $full = ucfirst($dtCarbon->isoFormat('dddd D [de] MMMM'));
                $short = $dtCarbon->isoFormat('D MMM')." (Día {$dayNum})";
            } catch (\Throwable) {
                $short = "{$dt} (Día {$dayNum})";
                $full = $dt;
            }

            $status = ($dt < $todayStr) ? 'Concluido' : (($dt === $todayStr) ? 'En vivo' : 'Programado');
            $pEntries = (int) ($dayMetric['kpis']['peak_hour']['entries'] ?? 0);
            $pHour = (string) ($dayMetric['kpis']['peak_hour']['hour'] ?? '-');

            $morningCount = (int) ($dayMetric['attendance_distribution']['morning']['count'] ?? 0);
            $afternoonCount = (int) ($dayMetric['attendance_distribution']['afternoon']['count'] ?? 0);
            $allMorningEntries += $morningCount;
            $allAfternoonEntries += $afternoonCount;

            $comparative[] = [
                'date' => $dt,
                'day_number' => $dayNum,
                'day_name' => $full,
                'short_label' => $short,
                'total_entered' => $entries,
                'peak_hour' => $pHour,
                'peak_entries' => $pEntries,
                'morning_percent' => $dayMetric['attendance_distribution']['morning']['percentage'] ?? 0,
                'afternoon_percent' => $dayMetric['attendance_distribution']['afternoon']['percentage'] ?? 0,
                'status' => $status,
            ];

            $accumulatedEntries += $entries;

            if ($entries > $bestDayCount) {
                $bestDayCount = $entries;
                $bestDayLabel = $full;
            }

            if ($pEntries > $histPeakCount) {
                $histPeakCount = $pEntries;
                $histPeakHour = $pHour;
                $histPeakDay = $full;
            }

            $dayNum++;
        }

        $daysCount = max(1, count($comparative));
        $totalDist = max(1, $allMorningEntries + $allAfternoonEntries);
        $overallMorningPct = ($allMorningEntries + $allAfternoonEntries > 0)
            ? round(($allMorningEntries / $totalDist) * 100, 1)
            : 0;
        $overallAfternoonPct = ($allMorningEntries + $allAfternoonEntries > 0)
            ? round(($allAfternoonEntries / $totalDist) * 100, 1)
            : 0;

        $generalSummary = [
            'total_days_evaluated' => count($comparative),
            'total_accumulated_entries' => $accumulatedEntries,
            'daily_average' => (int) round($accumulatedEntries / $daysCount),
            'best_day' => [
                'label' => $bestDayLabel,
                'entries' => $bestDayCount,
            ],
            'historical_peak' => [
                'day' => $histPeakDay,
                'hour' => $histPeakHour,
                'entries' => $histPeakCount,
            ],
            'overall_morning_percent' => $overallMorningPct,
            'overall_afternoon_percent' => $overallAfternoonPct,
        ];

        // Available dates list for calendar selector
        $availableDates = [];
        foreach ($comparative as $cDay) {
            $availableDates[] = [
                'date' => $cDay['date'],
                'label' => $cDay['day_name'].' (Día '.$cDay['day_number'].')',
                'entries' => $cDay['total_entered'],
            ];
        }

        if (! in_array($todayStr, array_column($comparative, 'date'), true)) {
            $availableDates[] = [
                'date' => $todayStr,
                'label' => 'Hoy ('.Carbon::parse($todayStr)->locale('es')->isoFormat('D MMM').')',
                'entries' => (int) ($todayData['kpis']['registered_entries'] ?? 0),
            ];
        }

        $firstRecordedDate = ! empty($comparative) ? $comparative[0]['date'] : $todayStr;

        return array_merge($activeDayData, [
            'today_date' => $todayStr,
            'previous_date' => $previousDate,
            'first_recorded_date' => $firstRecordedDate,
            'active_date' => $activeDate,
            'active_day_data' => $activeDayData,
            'today_data' => $todayData,
            'comparative' => $comparative,
            'general_summary' => $generalSummary,
            'available_dates' => $availableDates,
        ]);
    }

    /**
     * Home view (Inertia)
     */
    public function index(Request $request): Response
    {
        return Inertia::render('welcome', [
            'dashboard' => $this->getDashboardData($request->query('date')),
        ]);
    }

    /**
     * API documentation and live playground page
     */
    public function apiDocs(): Response
    {
        return Inertia::render('api-docs', [
            'stats' => [
                'total_entries' => (int) HourlyAttendance::sum('entered'),
                'minute_records_count' => MinuteAttendance::count(),
                'hourly_records_count' => HourlyAttendance::count(),
                'cameras' => CameraAttendance::pluck('camera')->unique()->values(),
            ],
            'recent_hourly' => HourlyAttendance::orderBy('hour')->get(),
            'recent_minutes' => MinuteAttendance::orderByDesc('id')->take(10)->get(),
        ]);
    }

    /**
     * API JSON endpoint for dashboard metrics
     */
    public function api(Request $request): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $this->getDashboardData($request->query('date')),
        ]);
    }

    /**
     * API JSON endpoint for hourly records
     */
    public function hourlyApi(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => HourlyAttendance::orderBy('hour')->get(),
        ]);
    }

    /**
     * API JSON endpoint for minute records
     */
    public function minutesApi(Request $request): JsonResponse
    {
        $limit = min(500, max(1, (int) $request->query('limit', 100)));
        $records = MinuteAttendance::orderBy('recorded_at')->paginate($limit);

        return response()->json([
            'status' => 'success',
            'data' => $records,
        ]);
    }

    /**
     * API JSON endpoint for camera summaries
     */
    public function camerasApi(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => CameraAttendance::all(),
        ]);
    }

    /**
     * API POST endpoint: Register an attendance event (minute record)
     */
    public function storeRecord(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'camera' => 'required|string|max:100',
            'recorded_at' => 'nullable|date',
            'change_entered' => 'nullable|integer',
            'change_exited' => 'nullable|integer',
            'configuration' => 'nullable|string|max:50',
        ]);

        $camera = $validated['camera'];
        $configuration = $validated['configuration'] ?? 'Entrada';
        $changeEntered = (int) ($validated['change_entered'] ?? 1);
        $changeExited = (int) ($validated['change_exited'] ?? 0);

        $tz = config('app.timezone', 'America/Lima');
        $now = ! empty($validated['recorded_at'])
            ? Carbon::parse($validated['recorded_at'])->setTimezone($tz)
            : Carbon::now($tz);
        $timeStr = $now->format('H:i');
        $hourStr = $now->format('H').':00';

        DB::beginTransaction();

        try {
            // Find current cumulative totals
            $lastMinute = MinuteAttendance::where('camera', $camera)->orderByDesc('id')->first();
            $currentEntered = $lastMinute ? $lastMinute->entered + $changeEntered : $changeEntered;
            $currentExited = $lastMinute ? $lastMinute->exited + $changeExited : $changeExited;

            $minute = MinuteAttendance::create([
                'recorded_at' => $now->toDateTimeString(),
                'time_str' => $timeStr,
                'camera' => $camera,
                'configuration' => $configuration,
                'entered' => max(0, $currentEntered),
                'exited' => max(0, $currentExited),
                'change_entered' => $changeEntered,
                'change_exited' => $changeExited,
            ]);

            // Synchronize Hourly bucket
            $todayDate = $now->format('Y-m-d');
            $hasDateCol = Schema::hasColumn('hourly_attendances', 'date');
            $hourlyCondition = ['camera' => $camera, 'hour' => $hourStr];
            if ($hasDateCol) {
                $hourlyCondition['date'] = $todayDate;
            }

            $hourly = HourlyAttendance::firstOrCreate(
                $hourlyCondition,
                ['configuration' => $configuration, 'entered' => 0, 'exited' => 0, 'contribution' => 0]
            );

            if ($changeEntered > 0) {
                $hourly->increment('entered', $changeEntered);
                $hourly->increment('contribution', $changeEntered);
            }
            if ($changeExited > 0) {
                $hourly->increment('exited', $changeExited);
            }

            // Synchronize Camera summaries
            $cameraEntry = CameraAttendance::firstOrCreate(
                ['camera' => $camera],
                ['configuration' => $configuration, 'reading_interval' => 'Cada 5 segundos', 'entered' => 0, 'exited' => 0, 'total_contribution' => 0]
            );
            if ($changeEntered > 0) {
                $cameraEntry->increment('entered', $changeEntered);
                $cameraEntry->increment('total_contribution', $changeEntered);
            }

            // Synchronize Total camera summary
            $totalCamera = CameraAttendance::firstOrCreate(
                ['camera' => 'Total'],
                ['configuration' => null, 'reading_interval' => null, 'entered' => 0, 'exited' => 0, 'total_contribution' => 0]
            );
            if ($changeEntered > 0) {
                $totalCamera->increment('entered', $changeEntered);
                $totalCamera->increment('total_contribution', $changeEntered);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Evento de afluencia registrado correctamente.',
                'data' => [
                    'minute_record' => $minute,
                    'hourly_bucket' => $hourly->fresh(),
                    'total_entries' => HourlyAttendance::sum('entered'),
                ],
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 'error',
                'message' => 'Error al guardar el registro: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * API POST endpoint: Set or update hourly count directly
     */
    public function storeHourly(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'camera' => 'required|string|max:100',
            'hour' => ['required', 'string', 'regex:/^(?:2[0-3]|[01][0-9]):[0-5][0-9]$/'],
            'entered' => 'required|integer|min:0',
            'exited' => 'nullable|integer|min:0',
            'configuration' => 'nullable|string|max:50',
            'date' => 'nullable|string',
        ]);

        $condition = ['camera' => $validated['camera'], 'hour' => $validated['hour']];
        if (Schema::hasColumn('hourly_attendances', 'date')) {
            $condition['date'] = $validated['date'] ?? Carbon::now()->format('Y-m-d');
        }

        $record = HourlyAttendance::updateOrCreate(
            $condition,
            [
                'configuration' => $validated['configuration'] ?? 'Entrada',
                'entered' => $validated['entered'],
                'exited' => $validated['exited'] ?? 0,
                'contribution' => $validated['entered'],
            ]
        );

        // Update CameraAttendance Total
        $totalSum = (int) HourlyAttendance::sum('entered');
        CameraAttendance::updateOrCreate(
            ['camera' => 'Total'],
            ['entered' => $totalSum, 'total_contribution' => $totalSum]
        );

        return response()->json([
            'status' => 'success',
            'message' => "Registro horario para {$record->hour} guardado correctamente.",
            'data' => $record,
        ]);
    }

    /**
     * API POST endpoint: Upload and import Excel file (.xls / .xlsx)
     */
    public function uploadExcel(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:20480',
            'date' => 'nullable|string',
        ]);

        $uploadedFile = $request->file('file');
        if (! $uploadedFile) {
            return response()->json(['status' => 'error', 'message' => 'Archivo no recibido.'], 400);
        }

        $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'xlsx');
        $tempPath = storage_path('app/temp_upload_'.time().'.'.$extension);
        $uploadedFile->move(dirname($tempPath), basename($tempPath));

        $params = ['--file' => $tempPath];
        if ($request->filled('date')) {
            $params['--date'] = (string) $request->input('date');
        }

        try {
            $exitCode = Artisan::call('import:conteo', $params);
            $output = Artisan::output();

            if (file_exists($tempPath)) {
                @unlink($tempPath);
            }

            if ($exitCode === 0) {
                return response()->json([
                    'status' => 'success',
                    'message' => 'Archivo Excel importado correctamente (Primera hoja "Por minuto").',
                    'output' => $output,
                    'total_entries' => HourlyAttendance::sum('entered'),
                ]);
            }

            return response()->json([
                'status' => 'error',
                'message' => 'Hubo un error durante la importación.',
                'output' => $output,
            ], 500);
        } catch (\Throwable $e) {
            if (file_exists($tempPath)) {
                @unlink($tempPath);
            }

            return response()->json([
                'status' => 'error',
                'message' => 'Excepción durante la importación: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * API POST endpoint: Full Payload Sync & Registration
     * Accepts the complete JSON structure from cameras/monitoring systems.
     */
    public function storeFullPayload(Request $request): JsonResponse
    {
        $payload = $request->all();

        // 1. Extract report date
        $reportDate = $payload['date']
            ?? $payload['fechaReporte']
            ?? ($payload['deteccion']['fecha'] ?? null);

        if ($reportDate) {
            try {
                $cleanDate = Carbon::parse($reportDate)->format('Y-m-d');
                cache()->forever('active_report_date', $cleanDate);
            } catch (\Throwable) {
                // Keep existing
            }
        }

        DB::beginTransaction();

        try {
            $hourlyProcessed = 0;
            $minutesProcessed = 0;
            $camerasProcessed = 0;

            // 2. Process Hourly Records (hojas.porHora, totals, or cameras[].hours)
            $porHora = $payload['hojas']['porHora'] ?? [];
            if (! empty($porHora) && is_array($porHora)) {
                foreach ($porHora as $h) {
                    $hourStr = (string) ($h['Hora'] ?? '');
                    if (is_numeric($hourStr)) {
                        $hourStr = sprintf('%02d:00', (int) $hourStr);
                    } elseif (strlen($hourStr) === 5 && ! str_ends_with($hourStr, ':00')) {
                        $hourStr = substr($hourStr, 0, 2).':00';
                    }

                    if (! empty($hourStr)) {
                        HourlyAttendance::updateOrCreate(
                            [
                                'camera' => $h['Cámara'] ?? $h['Camara'] ?? 'Acceso 2',
                                'hour' => $hourStr,
                            ],
                            [
                                'configuration' => $h['Configuración'] ?? $h['Configuracion'] ?? 'Entrada',
                                'entered' => (int) ($h['Entraron'] ?? 0),
                                'exited' => (int) ($h['Salieron'] ?? 0),
                                'contribution' => (int) ($h['Aporte'] ?? $h['Entraron'] ?? 0),
                            ]
                        );
                        $hourlyProcessed++;
                    }
                }
            } elseif (! empty($payload['totals']) && is_array($payload['totals'])) {
                foreach ($payload['totals'] as $t) {
                    $hourStr = sprintf('%02d:00', (int) ($t['hour'] ?? 0));
                    HourlyAttendance::updateOrCreate(
                        ['camera' => 'Acceso 2', 'hour' => $hourStr],
                        [
                            'configuration' => 'Entrada',
                            'entered' => (int) ($t['enter'] ?? 0),
                            'exited' => (int) ($t['exit'] ?? 0),
                            'contribution' => (int) ($t['enter'] ?? 0),
                        ]
                    );
                    $hourlyProcessed++;
                }
            } elseif (! empty($payload['cameras']) && is_array($payload['cameras'])) {
                foreach ($payload['cameras'] as $cam) {
                    $camName = $cam['name'] ?? 'Acceso '.($cam['id'] ?? '2');
                    foreach ($cam['hours'] ?? [] as $h) {
                        $hourStr = sprintf('%02d:00', (int) ($h['hour'] ?? 0));
                        HourlyAttendance::updateOrCreate(
                            ['camera' => $camName, 'hour' => $hourStr],
                            [
                                'configuration' => $cam['countRole'] ?? 'Entrada',
                                'entered' => (int) ($h['enter'] ?? 0),
                                'exited' => (int) ($h['exit'] ?? 0),
                                'contribution' => (int) ($h['enter'] ?? 0),
                            ]
                        );
                        $hourlyProcessed++;
                    }
                }
            }

            // 3. Process Minute Records (hojas.porMinuto, changes, or deteccion)
            $tz = config('app.timezone', 'America/Lima');
            $porMinuto = $payload['hojas']['porMinuto'] ?? [];
            if (! empty($porMinuto) && is_array($porMinuto)) {
                foreach ($porMinuto as $m) {
                    $rawDate = $m['Fecha'] ?? now($tz)->toDateTimeString();
                    try {
                        $parsedDate = Carbon::parse($rawDate)->setTimezone($tz)->toDateTimeString();
                    } catch (\Throwable) {
                        $parsedDate = now($tz)->toDateTimeString();
                    }

                    MinuteAttendance::create([
                        'recorded_at' => $parsedDate,
                        'time_str' => (string) ($m['Hora'] ?? Carbon::parse($parsedDate)->setTimezone($tz)->format('H:i')),
                        'camera' => (string) ($m['Cámara'] ?? $m['Camara'] ?? 'Acceso 2'),
                        'configuration' => (string) ($m['Configuración'] ?? $m['Configuracion'] ?? 'Entrada'),
                        'entered' => (int) ($m['Entraron'] ?? 0),
                        'exited' => (int) ($m['Salieron'] ?? 0),
                        'change_entered' => (int) ($m['Cambio de entradas'] ?? 0),
                        'change_exited' => (int) ($m['Cambio de salidas'] ?? 0),
                    ]);
                    $minutesProcessed++;
                }
            } elseif (! empty($payload['changes']) && is_array($payload['changes'])) {
                foreach ($payload['changes'] as $c) {
                    $rawAt = $c['at'] ?? now($tz)->toDateTimeString();
                    $timeStr = sprintf('%02d:%02d', (int) ($c['hour'] ?? 0), (int) ($c['minute'] ?? 0));

                    MinuteAttendance::create([
                        'recorded_at' => Carbon::parse($rawAt)->setTimezone($tz)->toDateTimeString(),
                        'time_str' => $timeStr,
                        'camera' => (string) ($c['cameraName'] ?? 'Acceso '.($c['cameraId'] ?? '2')),
                        'configuration' => (string) ($c['countRole'] ?? 'Entrada'),
                        'entered' => (int) ($c['enter'] ?? 0),
                        'exited' => (int) ($c['exit'] ?? 0),
                        'change_entered' => (int) ($c['enterDelta'] ?? 0),
                        'change_exited' => (int) ($c['exitDelta'] ?? 0),
                    ]);
                    $minutesProcessed++;
                }
            } elseif (! empty($payload['deteccion']) && is_array($payload['deteccion'])) {
                $det = $payload['deteccion'];
                $rawDate = $det['fecha'] ?? now($tz)->toDateTimeString();
                $parsedDate = Carbon::parse($rawDate)->setTimezone($tz)->toDateTimeString();

                MinuteAttendance::create([
                    'recorded_at' => $parsedDate,
                    'time_str' => (string) ($det['hora'] ?? Carbon::parse($parsedDate)->setTimezone($tz)->format('H:i')),
                    'camera' => (string) ($det['camara'] ?? 'Acceso '.($det['camaraId'] ?? '2')),
                    'configuration' => (string) ($det['configuracion'] ?? 'Entrada'),
                    'entered' => (int) ($det['entraron'] ?? 0),
                    'exited' => (int) ($det['salieron'] ?? 0),
                    'change_entered' => (int) ($det['cambioEntradas'] ?? 0),
                    'change_exited' => (int) ($det['cambioSalidas'] ?? 0),
                ]);
                $minutesProcessed++;
            }

            // 4. Process Camera Summaries (hojas.camaras or cameras)
            $camaras = $payload['hojas']['camaras'] ?? [];
            if (! empty($camaras) && is_array($camaras)) {
                foreach ($camaras as $c) {
                    CameraAttendance::updateOrCreate(
                        ['camera' => (string) ($c['Cámara'] ?? $c['Camara'] ?? 'Total')],
                        [
                            'configuration' => $c['Configuración'] ?? $c['Configuracion'] ?? 'Entrada',
                            'reading_interval' => $c['Lectura de imagen'] ?? 'Cada 5 segundos',
                            'entered' => (int) ($c['Entraron'] ?? 0),
                            'exited' => (int) ($c['Salieron'] ?? 0),
                            'total_contribution' => (int) ($c['Aporte al total'] ?? $c['Entraron'] ?? 0),
                        ]
                    );
                    $camerasProcessed++;
                }
            } elseif (! empty($payload['cameras']) && is_array($payload['cameras'])) {
                foreach ($payload['cameras'] as $cam) {
                    CameraAttendance::updateOrCreate(
                        ['camera' => (string) ($cam['name'] ?? 'Acceso '.($cam['id'] ?? '1'))],
                        [
                            'configuration' => $cam['countRole'] ?? 'Entrada',
                            'reading_interval' => 'Cada '.($cam['imageMode'] ?? '5').' segundos',
                            'entered' => (int) ($cam['enter'] ?? 0),
                            'exited' => (int) ($cam['exit'] ?? 0),
                            'total_contribution' => (int) ($cam['share'] ?? $cam['enter'] ?? 0),
                        ]
                    );
                    $camerasProcessed++;
                }
            }

            // Consolidate Total in CameraAttendance
            $totalEntered = (int) ($payload['enter'] ?? ($payload['resumen']['entraron'] ?? HourlyAttendance::sum('entered')));
            $totalExited = (int) ($payload['exit'] ?? ($payload['resumen']['salieron'] ?? 0));

            CameraAttendance::updateOrCreate(
                ['camera' => 'Total'],
                [
                    'configuration' => null,
                    'reading_interval' => null,
                    'entered' => $totalEntered,
                    'exited' => $totalExited,
                    'total_contribution' => $totalEntered,
                ]
            );

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Estructura completa de monitoreo registrada con éxito.',
                'processed' => [
                    'hourly_records' => $hourlyProcessed,
                    'minute_records' => $minutesProcessed,
                    'camera_summaries' => $camerasProcessed,
                    'total_entries' => $totalEntered,
                    'report_date' => cache('active_report_date'),
                ],
                'dashboard_metrics' => $this->getDashboardData(),
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 'error',
                'message' => 'Error al procesar la estructura completa: '.$e->getMessage(),
            ], 500);
        }
    }
}
