<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A read-only key another system uses to call the integration API. Only its hash is stored. */
class ApiKey extends Model
{
    use HasUuids;

    public const SCOPES = ['proposals', 'awards', 'outputs', 'reports'];

    protected $fillable = ['name', 'prefix', 'key_hash', 'scopes', 'created_by', 'last_used_at', 'revoked_at'];

    protected $hidden = ['key_hash'];

    protected function casts(): array
    {
        return ['scopes' => 'array', 'last_used_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    public function allows(string $scope): bool
    {
        return in_array($scope, $this->scopes ?? [], true);
    }
}
