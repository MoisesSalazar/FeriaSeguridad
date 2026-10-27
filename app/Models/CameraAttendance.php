<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CameraAttendance extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'camera',
        'configuration',
        'reading_interval',
        'entered',
        'exited',
        'total_contribution',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'entered' => 'integer',
            'exited' => 'integer',
            'total_contribution' => 'integer',
        ];
    }
}
