<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

use Illuminate\Database\Eloquent\Concerns\HasUuids;



#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{



use HasApiTokens, HasRoles, HasUuids, HasFactory, Notifiable, SoftDeletes;

    // Force Spatie to look up roles/permissions under 'web' guard
    // regardless of which guard (sanctum, api, etc.) authenticated the request.
    protected $guard_name = 'web';

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'email',
        'password',
        'employee_id',
        'college_id',
        'department_id',
        'telegram_chat_id',
        'telegram_link_token',
        'telegram_link_token_expires_at',
        'phone',
        'gender',
        'avatar',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'telegram_link_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'              => 'datetime',
            'telegram_link_token_expires_at' => 'datetime',
            'password'                       => 'hashed',
        ];
    }

    public function assignedComplaints(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Complaint::class, 'assigned_to');
    }

    public function college(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function department(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
