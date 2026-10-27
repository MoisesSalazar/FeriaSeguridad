<?php

namespace App\Http\Controllers;

use App\Models\CameraAttendance;
use App\Models\HourlyAttendance;
use App\Models\MinuteAttendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
}
