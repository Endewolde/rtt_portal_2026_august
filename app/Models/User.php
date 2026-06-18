<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasRoles, HasUuids, Notifiable, SoftDeletes;

    // Force Spatie to look up roles/permissions under 'web' guard
    // regardless of which guard (sanctum, api, etc.) authenticated the request.
    protected $guard_name = 'web';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'title',
        'email',
        'password',
        'employee_id',
        'college_id',
        'department_id',
        'expertise',
        'telegram_chat_id',
        'telegram_link_token',
        'telegram_link_token_expires_at',
        'phone',
        'gender',
        'avatar',
        'status',
        'registration_method',
        'last_login_at',
        'oauth_provider',
        'oauth_id',
        'email_verified_at',
        'email_verification_token',
        'email_verification_expires_at',
        'two_factor_enabled',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'telegram_link_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'telegram_link_token_expires_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'expertise' => 'array',
            'two_factor_enabled' => 'boolean',
            'alert_preferences' => 'array',
        ];
    }

    public function assignedComplaints(): HasMany
    {
        return $this->hasMany(Complaint::class, 'assigned_to');
    }

    public function reviewAssignments(): HasMany
    {
        return $this->hasMany(ReviewAssignment::class, 'reviewer_id');
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
