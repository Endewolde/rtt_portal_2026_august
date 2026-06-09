<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FormField extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['form_section_id', 'label', 'field_type', 'is_required', 'options', 'order_index'];
    protected $casts = ['is_required' => 'boolean', 'options' => 'array', 'order_index' => 'integer'];

    public function section(): BelongsTo { return $this->belongsTo(FormSection::class, 'form_section_id'); }
}
