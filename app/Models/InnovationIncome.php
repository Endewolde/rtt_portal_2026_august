<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Money an innovation brought in: a licence fee, royalty, equity, sale. */
class InnovationIncome extends Model
{
    use HasUuids;

    protected $fillable = ['innovation_id', 'amount', 'currency', 'received_on', 'source', 'note', 'recorded_by'];

    protected $casts = ['amount' => 'decimal:2', 'received_on' => 'date'];

    public function innovation(): BelongsTo
    {
        return $this->belongsTo(Innovation::class);
    }
}
