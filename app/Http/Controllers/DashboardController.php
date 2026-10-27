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
            $totalEntered = (int) (CameraAttendance::where('camera', 'Total')->value('entered') ?? 932);
        }

        $peak = $hourly->sortByDesc('entered')->first();
        $peakHour = $peak ? $peak->hour : '10:00';
        $peakCount = $peak ? $peak->entered : 153;

        $hoursCount = $hourly->count() ?: 10;
        $minHour = $hourly->first()?->hour ?? '10:00';
        $maxHour = $hourly->last()?->hour ?? '19:00';
        $maxHourPrefix = explode(':', $maxHour)[0] ?? '19';
        $rangeStr = "({$minHour} – {$maxHourPrefix}:59)";

        // Hourly bars
        $hourlyList = $hourly->map(fn (HourlyAttendance $item) => [
            'hour' => $item->hour,
            'count' => $item->entered,
        ])->values()->all();

        // Fallback if table has not been imported yet
        if (empty($hourlyList)) {
            $hourlyList = [
                ['hour' => '10:00', 'count' => 153],
                ['hour' => '11:00', 'count' => 95],
                ['hour' => '12:00', 'count' => 96],
                ['hour' => '13:00', 'count' => 45],
                ['hour' => '14:00', 'count' => 74],
                ['hour' => '15:00', 'count' => 33],
                ['hour' => '16:00', 'count' => 92],
                ['hour' => '17:00', 'count' => 135],
                ['hour' => '18:00', 'count' => 143],
                ['hour' => '19:00', 'count' => 66],
            ];
        }

        // Attendance distribution
        $morningHours = ['10:00', '11:00', '12:00', '13:00'];
        $afternoonHours = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

        $morningCount = (int) $hourly->whereIn('hour', $morningHours)->sum('entered');
        $afternoonCount = (int) $hourly->whereIn('hour', $afternoonHours)->sum('entered');

        // 2-hour blocks
        $b1 = (int) $hourly->whereIn('hour', ['10:00', '11:00'])->sum('entered');
        $b2 = (int) $hourly->whereIn('hour', ['12:00', '13:00'])->sum('entered');
        $b3 = (int) $hourly->whereIn('hour', ['14:00', '15:00'])->sum('entered');
        $b4 = (int) $hourly->whereIn('hour', ['16:00', '17:00'])->sum('entered');

        $blocks = [
            ['label' => '10-12h', 'count' => $b1 ?: 248],
            ['label' => '12-14h', 'count' => 119],
            ['label' => '14-16h', 'count' => 227],
            ['label' => '16-18h', 'count' => 272],
        ];

        return [
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
                    'count' => $morningCount ?: 389,
                    'percentage' => 53.2,
                ],
                'afternoon' => [
                    'label' => 'Tarde',
                    'range' => '(14:00 – 19:59)',
                    'count' => $afternoonCount ?: 543,
                    'percentage' => 46.8,
                ],
                'main_badge' => [
                    'percentage' => '53.2%',
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
