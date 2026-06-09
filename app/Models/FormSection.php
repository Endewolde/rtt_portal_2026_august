<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FormSection extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['form_template_id', 'title', 'description', 'order_index'];
    protected $casts = ['order_index' => 'integer'];

    public function template(): BelongsTo { return $this->belongsTo(FormTemplate::class, 'form_template_id'); }
    public function fields(): HasMany { return $this->hasMany(FormField::class); }
}
