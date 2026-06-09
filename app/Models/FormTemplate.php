<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FormTemplate extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['name', 'description', 'is_active', 'created_by'];
    protected $casts = ['is_active' => 'boolean'];

    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function sections(): HasMany { return $this->hasMany(FormSection::class); }
}
