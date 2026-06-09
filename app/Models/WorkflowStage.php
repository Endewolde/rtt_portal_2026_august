<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WorkflowStage extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'label',
        'description',
        'is_terminal',
        'order_index',
    ];

    protected $casts = [
        'is_terminal' => 'boolean',
        'order_index' => 'integer',
    ];
}
