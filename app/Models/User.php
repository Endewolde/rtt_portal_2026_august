<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Support\Access\AccessScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Exceptions\PermissionDoesNotExist;
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
        'affiliation',
        'public_profile',
        'profile_slug',
        'bio',
        'orcid',
        'telegram_chat_id',
        'telegram_link_token',
        'telegram_link_token_expires_at',
        'phone',
        'gender',
        'locale',
        'avatar',
        'status',
        'registration_method',
        'last_login_at',
        'last_activity_at',
        'first_login_at',
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
            'last_activity_at' => 'datetime',
            'first_login_at' => 'datetime',
            'password' => 'hashed',
            'expertise' => 'array',
            'public_profile' => 'boolean',
            'two_factor_enabled' => 'boolean',
            'alert_preferences' => 'array',
            'locked_until' => 'datetime',
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

    /** @var array{key: string, scope: AccessScope}|null */
    private ?array $accessScopeMemo = null;

    /** Which records this user's permissions apply to (from their roles' data scopes). */
    public function accessScope(): AccessScope
    {
        $key = $this->getRoleNames()->sort()->implode(',').'|'.$this->college_id;
        if ($this->accessScopeMemo === null || $this->accessScopeMemo['key'] !== $key) {
            $this->accessScopeMemo = ['key' => $key, 'scope' => AccessScope::for($this)];
        }

        return $this->accessScopeMemo['scope'];
    }

    /**
     * Active users who hold a permission and whose data scope covers the given
     * college and category — the people a notification about that record is for.
     * Without a college or category, every active holder of the permission.
     *
     * @return Collection<int, User>
     */
    public static function whoCan(string $permission, ?string $collegeId = null, ?string $category = null): Collection
    {
        try {
            $holders = static::permission($permission)->where('status', 'active')->get();
        } catch (PermissionDoesNotExist) {
            return collect();
        }

        if ($collegeId === null && $category === null) {
            return $holders->values();
        }

        return $holders->filter(fn (User $u) => $u->accessScope()->covers($collegeId, $category))->values();
    }

    /**
     * Active users of custom (non built-in) roles that grant a permission and whose
     * scope covers the record. Notifications keep going to the built-in roles they
     * always went to, and also reach anyone given that responsibility through a
     * custom role.
     *
     * @return Collection<int, User>
     */
    public static function customRoleHolders(string $permission, ?string $collegeId = null, ?string $category = null): Collection
    {
        $builtIn = array_keys(config('access.roles'));

        try {
            $holders = static::permission($permission)
                ->where('status', 'active')
                ->whereHas('roles', fn ($q) => $q->whereNotIn('name', $builtIn))
                ->get();
        } catch (PermissionDoesNotExist) {
            return collect();
        }

        return $holders
            ->filter(fn (User $u) => ($collegeId === null && $category === null) || $u->accessScope()->covers($collegeId, $category))
            ->values();
    }
}
