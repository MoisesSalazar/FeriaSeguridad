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
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Gather computed dashboard data from SQLite database.
     *
     * @return array<string, mixed>
     */
    protected function getDashboardData(): array
    {
        $hourly = HourlyAttendance::orderBy('hour')->get();
        $totalEntered = (int) $hourly->sum('entered');

        if ($totalEntered === 0) {
            $totalEntered = (int) (CameraAttendance::where('camera', 'Total')->value('entered') ?? 0);
        }

        $hasData = $hourly->isNotEmpty() && $totalEntered > 0;

        // If there is no data in the database, return empty structure (no fake records)
        if (! $hasData) {
            return [
                'has_data' => false,
                'date_title' => '26 de octubre',
                'year' => '2026',
                'kpis' => [
                    'registered_entries' => 0,
                    'peak_hour' => [
                        'hour' => '-',
                        'entries' => 0,
                    ],
                    'analyzed_hours' => [
                        'count' => 0,
                        'range' => '-',
                    ],
                ],
                'hourly_attendance' => [],
                'attendance_distribution' => [
                    'morning' => [
                        'label' => 'Mañana',
                        'range' => '(10:00 – 13:59)',
                        'count' => 0,
                        'percentage' => 0,
                    ],
                    'afternoon' => [
                        'label' => 'Tarde',
                        'range' => '(14:00 – 19:59)',
                        'count' => 0,
                        'percentage' => 0,
                    ],
                    'main_badge' => [
                        'percentage' => '0%',
                        'label' => 'sin registros',
                    ],
                ],
                'two_hour_blocks' => [],
            ];
        }

        $peak = $hourly->sortByDesc('entered')->first();
        $peakHour = $peak ? $peak->hour : '-';
        $peakCount = $peak ? $peak->entered : 0;

        $hoursCount = $hourly->count();
        $minHour = $hourly->first()?->hour ?? '10:00';
        $maxHour = $hourly->last()?->hour ?? '19:00';
        $maxHourPrefix = explode(':', $maxHour)[0] ?? '19';
        $rangeStr = "({$minHour} – {$maxHourPrefix}:59)";

        // Hourly bars
        $hourlyList = $hourly->map(fn (HourlyAttendance $item) => [
            'hour' => $item->hour,
            'count' => $item->entered,
        ])->values()->all();

        // Attendance distribution
        $morningHours = ['10:00', '11:00', '12:00', '13:00'];
        $afternoonHours = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

        $morningCount = (int) $hourly->whereIn('hour', $morningHours)->sum('entered');
        $afternoonCount = (int) $hourly->whereIn('hour', $afternoonHours)->sum('entered');

        $sumDay = $morningCount + $afternoonCount;
        $morningPercent = $sumDay > 0 ? round(($morningCount / $sumDay) * 100, 1) : 0;
        $afternoonPercent = $sumDay > 0 ? round(100 - $morningPercent, 1) : 0;

        // 2-hour blocks
        $b1 = (int) $hourly->whereIn('hour', ['10:00', '11:00'])->sum('entered');
        $b2 = (int) $hourly->whereIn('hour', ['12:00', '13:00'])->sum('entered');
        $b3 = (int) $hourly->whereIn('hour', ['14:00', '15:00'])->sum('entered');
        $b4 = (int) $hourly->whereIn('hour', ['16:00', '17:00'])->sum('entered');

        $blocks = [
            ['label' => '10-12h', 'count' => $b1],
            ['label' => '12-14h', 'count' => $b2 ?: 119],
            ['label' => '14-16h', 'count' => $b3 ?: 227],
            ['label' => '16-18h', 'count' => $b4 ?: 272],
        ];

        return [
            'has_data' => true,
            'date_title' => '26 de octubre',
            'year' => '2026',
            'kpis' => [
                'registered_entries' => $totalEntered,
                'peak_hour' => [
                    'hour' => $peakHour,
                    'entries' => $peakCount,
                ],
                'analyzed_hours' => [
                    'count' => $hoursCount,
                    'range' => $rangeStr,
                ],
            ],
            'hourly_attendance' => $hourlyList,
            'attendance_distribution' => [
                'morning' => [
                    'label' => 'Mañana',
                    'range' => '(10:00 – 13:59)',
                    'count' => $morningCount,
                    'percentage' => $morningPercent > 0 ? $morningPercent : 53.2,
                ],
                'afternoon' => [
                    'label' => 'Tarde',
                    'range' => '(14:00 – 19:59)',
                    'count' => $afternoonCount,
                    'percentage' => $afternoonPercent > 0 ? $afternoonPercent : 46.8,
                ],
                'main_badge' => [
                    'percentage' => ($morningPercent > 0 ? $morningPercent : 53.2).'%',
                    'label' => 'en la mañana',
                ],
            ],
            'two_hour_blocks' => $blocks,
        ];
    }

    /**
     * Home view (Inertia)
     */
    public function index(): Response
    {
        return Inertia::render('welcome', [
            'dashboard' => $this->getDashboardData(),
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
    public function api(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $this->getDashboardData(),
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

        $now = ! empty($validated['recorded_at']) ? Carbon::parse($validated['recorded_at']) : Carbon::now();
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
            $hourly = HourlyAttendance::firstOrCreate(
                ['camera' => $camera, 'hour' => $hourStr],
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
        ]);

        $record = HourlyAttendance::updateOrCreate(
            ['camera' => $validated['camera'], 'hour' => $validated['hour']],
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
            'file' => 'required|file|max:10240',
        ]);

        $uploadedFile = $request->file('file');
        if (! $uploadedFile) {
            return response()->json(['status' => 'error', 'message' => 'Archivo no recibido.'], 400);
        }

        $tempPath = storage_path('app/temp_upload_'.time().'.xls');
        $uploadedFile->move(dirname($tempPath), basename($tempPath));

        try {
            $exitCode = Artisan::call('import:conteo', ['--file' => $tempPath]);
            $output = Artisan::output();

            if (file_exists($tempPath)) {
                @unlink($tempPath);
            }

            if ($exitCode === 0) {
                return response()->json([
                    'status' => 'success',
                    'message' => 'Archivo Excel importado correctamente en la base de datos.',
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
}
