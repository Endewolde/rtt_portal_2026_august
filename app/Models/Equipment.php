<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A piece of research equipment researchers can book, looked after by its custodian. */
class Equipment extends Model
{
    use HasUuids;

    protected $table = 'equipment';

    public const STATUSES = ['available', 'maintenance', 'retired'];

    protected $fillable = ['name', 'category', 'asset_tag', 'description', 'college_id', 'location', 'custodian_id', 'status', 'requires_approval', 'max_booking_hours', 'created_by'];

    protected $casts = ['requires_approval' => 'boolean', 'max_booking_hours' => 'integer'];

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function custodian(): BelongsTo
    {
        return $this->belongsTo(User::class, 'custodian_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(EquipmentBooking::class);
    }
}
