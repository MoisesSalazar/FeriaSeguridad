<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MinuteAttendance extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'recorded_at',
        'time_str',
        'camera',
        'configuration',
        'entered',
        'exited',
        'change_entered',
        'change_exited',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'recorded_at' => 'datetime',
            'entered' => 'integer',
            'exited' => 'integer',
            'change_entered' => 'integer',
            'change_exited' => 'integer',
        ];
    }
}
