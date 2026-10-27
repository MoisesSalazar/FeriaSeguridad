<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HourlyAttendance extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'camera',
        'configuration',
        'hour',
        'entered',
        'exited',
        'contribution',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'entered' => 'integer',
            'exited' => 'integer',
            'contribution' => 'integer',
        ];
    }
}
