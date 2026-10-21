<?php

namespace App\Support\Access;

use App\Models\User;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Which records a user's permissions apply to, from the data scope of their
 * roles: everything, their college, one or more categories, or only their own
 * records. With several roles, the widest scope wins.
 */
final class AccessScope
{
    public const ALL = 'all';

    public const COLLEGE = 'college';

    public const CATEGORY = 'category';

    public const OWN = 'own';

    /** @param list<string> $categories */
    private function __construct(
        public readonly string $type,
        public readonly ?string $collegeId,
        public readonly array $categories,
        public readonly string $userId,
    ) {}

    private static ?bool $rolesHaveScope = null;

    public static function for(User $user): self
    {
        self::$rolesHaveScope ??= DB::getSchemaBuilder()->hasColumn('roles', 'scope');
        $roles = self::$rolesHaveScope
            ? DB::table('roles')->whereIn('name', $user->getRoleNames())->get(['name', 'scope', 'scope_category'])
            : collect();

        $scopes = $roles->map(function ($role) {
            // A built-in role without stored metadata yet falls back to its catalogue default.
            $default = config("access.roles.{$role->name}");

            return [
                'scope' => $role->scope ?: ($default['scope'] ?? self::OWN),
                'category' => $role->scope_category ?: ($default['category'] ?? null),
            ];
        });

        $has = fn (string $s) => $scopes->contains('scope', $s);

        $type = match (true) {
            $has(self::ALL) => self::ALL,
            $has('college_if_set') && ! $user->college_id => self::ALL,
            $has(self::COLLEGE) || $has('college_if_set') => self::COLLEGE,
            $has(self::CATEGORY) => self::CATEGORY,
            default => self::OWN,
        };

        $categories = $type === self::CATEGORY
            ? $scopes->where('scope', self::CATEGORY)->pluck('category')->filter()->unique()->values()->all()
            : [];

        return new self($type, $type === self::COLLEGE ? $user->college_id : null, $categories, $user->id);
    }

    public function isAll(): bool
    {
        return $this->type === self::ALL;
    }

    public function isCollege(): bool
    {
        return $this->type === self::COLLEGE;
    }

    public function isCategory(): bool
    {
        return $this->type === self::CATEGORY;
    }

    public function isOwn(): bool
    {
        return $this->type === self::OWN;
    }

    /** The single category of a category-scoped user (the first, if several). */
    public function category(): ?string
    {
        return $this->categories[0] ?? null;
    }

    /**
     * Limit a query on proposals (or a table with college_id/category columns) to this scope.
     * $own decides what "own records" means for the query; without it nothing matches.
     */
    public function constrain(Builder $query, string $table = 'proposals', ?callable $own = null): Builder
    {
        return match ($this->type) {
            self::ALL => $query,
            self::COLLEGE => $query->where("{$table}.college_id", $this->collegeId),
            self::CATEGORY => $query->whereIn("{$table}.category", $this->categories),
            default => $own ? $own($query) : $query->whereRaw('1 = 0'),
        };
    }

    /** Limit a query on a model that belongs to a proposal, through its relation. */
    public function constrainThrough(Builder $query, string $relation = 'proposal', ?callable $own = null): Builder
    {
        if ($this->isAll()) {
            return $query;
        }
        if ($this->isOwn()) {
            return $own ? $own($query) : $query->whereRaw('1 = 0');
        }

        return $query->whereHas($relation, fn ($q) => $this->constrain($q, $q->getModel()->getTable()));
    }

    /** Does this scope cover a proposal (by its college and category)? */
    public function covers(?string $collegeId, ?string $category): bool
    {
        return match ($this->type) {
            self::ALL => true,
            self::COLLEGE => $collegeId !== null && $collegeId === $this->collegeId,
            self::CATEGORY => in_array($category, $this->categories, true),
            default => false,
        };
    }

    /** @return array{type: string, college_id: ?string, categories: list<string>} */
    public function toArray(): array
    {
        return ['type' => $this->type, 'college_id' => $this->collegeId, 'categories' => $this->categories];
    }
}
