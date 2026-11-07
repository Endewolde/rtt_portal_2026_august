<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** What the university aims to achieve on one measure in one academic year. */
class StrategicTarget extends Model
{
    use HasUuids;

    protected $fillable = ['academic_year', 'metric', 'target', 'updated_by'];

    protected $casts = ['target' => 'float'];
}
