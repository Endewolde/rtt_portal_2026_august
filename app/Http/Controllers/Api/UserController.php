<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetRequest;
use App\Models\College;
use App\Models\Department;
use App\Models\NotificationPreference;
use App\Models\Proposal;
use App\Models\User;
use App\Services\User360Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserController extends Controller
{
    public function academicInfo(string $id): JsonResponse
    {
        $user = User::with(['college', 'department'])->findOrFail($id);

        return response()->json([
            'data' => [
                'college_id' => $user->college_id,
                'college_name' => $user->college?->name,
                'department_id' => $user->department_id,
                'department_name' => $user->department?->name,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $isAdmin = $request->user()?->can('users.view_any');
        $isSearch = (bool) $request->query('search');

        // Full listing requires admin; a search query is also allowed for
        // any authenticated user (co-investigator lookup from the wizard).
        if (! $isAdmin && ! $isSearch) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $allowedSorts = ['name', 'status', 'created_at', 'last_login_at', 'registration_method'];
        $sortBy = in_array($request->query('sort_by'), $allowedSorts, true)
            ? $request->query('sort_by')
            : 'name';
        $sortDir = $request->query('sort_dir') === 'desc' ? 'desc' : 'asc';

        $query = User::with(['roles:id,name', 'college:id,name', 'department:id,name'])->orderBy($sortBy, $sortDir);

        // College Admin scoped to own college
        if ($isAdmin && $request->user()->hasRole('college_officer') && $request->user()->college_id) {
            $query->where('college_id', $request->user()->college_id);
        }

        if ($search = $request->query('search')) {
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
            );
        }

        if ($role = $request->query('role')) {
            $requested = str_contains($role, ',') ? explode(',', $role) : [$role];
            // Filter to only roles that actually exist — prevents RoleDoesNotExist exceptions
            // for legacy names like 'pi' that were renamed.
            $existing = Role::whereIn('name', $requested)
                ->pluck('name')
                ->all();
            if (! empty($existing)) {
                $query->role($existing);
            }
        }

        // Non-admin searches (co-investigator lookup) must only see active users.
        if (! $isAdmin) {
            $query->where('status', 'active');
        } elseif ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($isAdmin && ($collegeId = $request->query('college_id'))) {
            $query->where('college_id', $collegeId);
        }

        if ($isAdmin && ($departmentId = $request->query('department_id'))) {
            $query->where('department_id', $departmentId);
        }

        if ($isAdmin && ($gender = $request->query('gender')) && in_array($gender, ['male', 'female', 'other'], true)) {
            $query->where('gender', $gender);
        }

        if ($isAdmin && ($regMethod = $request->query('registration_method'))) {
            $query->where('registration_method', $regMethod);
        }

        if ($isAdmin && $request->query('no_role') === '1') {
            $query->doesntHave('roles');
        }

        $perPage = $isAdmin ? 25 : 10;

        return response()->json([
            'data' => $query->paginate($perPage),
            'message' => 'Users retrieved.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function stats(Request $request): JsonResponse
    {
        if (! $request->user()?->can('users.view_any')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $base = User::query();

        // Same scoping as index() — a college officer's stats must reflect only
        // their own college, not the platform-wide totals.
        if ($request->user()->hasRole('college_officer') && $request->user()->college_id) {
            $base->where('college_id', $request->user()->college_id);
        }

        return response()->json([
            'data' => [
                'total' => (clone $base)->count(),
                'active' => (clone $base)->where('status', 'active')->count(),
                'inactive' => (clone $base)->whereIn('status', ['inactive', 'suspended'])->count(),
                'new_this_month' => (clone $base)->where('created_at', '>=', now()->startOfMonth())->count(),
            ],
        ]);
    }

    public function show(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('users.view_any')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $user = User::with(['roles:id,name', 'college:id,name', 'department:id,name'])->findOrFail($id);

        return response()->json([
            'data' => array_merge($user->toArray(), [
                'roles' => $user->getRoleNames()->values()->toArray(),
            ]),
            'message' => 'User retrieved.',
            'errors' => [],
        ]);
    }

    public function updateRole(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('roles.assign')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'role' => ['required', 'string', 'exists:roles,name'],
        ]);

        $target = User::findOrFail($id);
        $oldRole = $target->getRoleNames()->first() ?? 'none';

        // roles.assign (held by 'admin' too) is deliberately not enough on its own to
        // cross the super_admin boundary in either direction — see store()/update().
        if ($validated['role'] === 'super_admin' || $oldRole === 'super_admin') {
            return response()->json(['data' => null, 'message' => 'The super_admin role cannot be granted or removed here.', 'errors' => []], 403);
        }

        $target->syncRoles([$validated['role']]);

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => User::class,
            'auditable_id' => $target->id,
            'event' => 'user.role_changed',
            'actor_id' => $request->user()->id,
            'old_values' => json_encode(['role' => $oldRole]),
            'new_values' => json_encode(['role' => $validated['role']]),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ?? '',
            'created_at' => now(),
        ]);

        return response()->json([
            'data' => array_merge($target->fresh()->toArray(), [
                'roles' => $target->fresh()->getRoleNames()->values()->toArray(),
            ]),
            'message' => 'Role updated.',
            'errors' => [],
        ]);
    }

    public function updateStatus(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('users.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'status' => ['required', 'in:active,inactive,suspended'],
        ]);

        $actor = $request->user();
        $target = User::findOrFail($id);

        if ($target->id === $actor->id) {
            return response()->json(['message' => 'You cannot change your own account status.'], 422);
        }

        // Only super_admin can deactivate another super_admin or admin.
        if (! $actor->hasRole('super_admin') && $target->hasAnyRole(['super_admin', 'admin'])
            && in_array($validated['status'], ['inactive', 'suspended'])) {
            return response()->json(['message' => 'You do not have permission to deactivate this account.'], 403);
        }

        $oldStatus = $target->status;
        $target->update(['status' => $validated['status']]);

        // Immediately invalidate all active tokens so the user is kicked out right away.
        if (in_array($validated['status'], ['inactive', 'suspended'])) {
            $target->tokens()->delete();
        }

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => User::class,
            'auditable_id' => $target->id,
            'event' => 'user.status_changed',
            'actor_id' => $request->user()->id,
            'old_values' => json_encode(['status' => $oldStatus]),
            'new_values' => json_encode(['status' => $validated['status']]),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ?? '',
            'created_at' => now(),
        ]);

        return response()->json([
            'data' => $target->fresh(),
            'message' => 'Status updated.',
            'errors' => [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->can('users.create')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'title' => 'nullable|string|max:50',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|string|exists:roles,name',
            'college_id' => 'nullable|uuid|exists:colleges,id',
            'department_id' => 'nullable|uuid|exists:departments,id',
            'employee_id' => 'nullable|string|max:50',
            'phone' => 'nullable|string|max:30',
            'gender' => 'nullable|in:male,female,other',
            'expertise' => 'nullable|array',
            'expertise.*' => 'string|max:100',
        ]);

        // super_admin is never grantable through the general create-user form, even by an
        // existing super_admin — users.create alone (which 'admin' also holds) must never
        // be enough to mint a peer-or-higher account, and the frontend already hides this
        // option from the role dropdown unconditionally. Use createSuperAdmin() below,
        // which adds its own safeguards (password re-confirmation).
        if ($request->role === 'super_admin') {
            return response()->json(['message' => 'super_admin cannot be granted here — use the dedicated Create Super Admin action.'], 403);
        }

        $user = User::create([
            'name' => $request->name,
            'title' => $request->title,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'college_id' => $request->college_id,
            'department_id' => $request->department_id,
            'employee_id' => $request->employee_id,
            'phone' => $request->phone,
            'gender' => $request->gender,
            'expertise' => $request->expertise,
            'status' => 'active',
            'email_verified_at' => now(),
            'registration_method' => 'admin_created',
        ]);

        $user->assignRole($request->role);

        NotificationPreference::create(['user_id' => $user->id]);

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'event' => 'user.created',
            'actor_id' => $request->user()->id,
            'old_values' => null,
            'new_values' => json_encode(['email' => $user->email, 'role' => $request->role]),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ?? '',
            'created_at' => now(),
        ]);

        return response()->json([
            'data' => $user->load('roles'),
            'message' => 'User created successfully.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    /**
     * The only path that can ever grant the super_admin role — deliberately separate
     * from store()/update()/updateRole()/bulkAction(), all of which now hard-block it.
     * Requires the acting super_admin to re-enter their own password (step-up auth),
     * since this is the single highest-privilege action in the system.
     */
    public function createSuperAdmin(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'current_password' => 'required|string',
        ]);

        if (! Hash::check($request->current_password, $request->user()->password)) {
            return response()->json(['message' => 'Your password is incorrect.'], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'status' => 'active',
            'email_verified_at' => now(),
            'registration_method' => 'admin_created',
        ]);

        $user->assignRole('super_admin');

        NotificationPreference::create(['user_id' => $user->id]);

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'event' => 'user.super_admin_created',
            'actor_id' => $request->user()->id,
            'old_values' => null,
            'new_values' => json_encode(['email' => $user->email]),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ?? '',
            'created_at' => now(),
        ]);

        return response()->json([
            'data' => $user->load('roles'),
            'message' => 'Super admin account created.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('users.update')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $user = User::findOrFail($id);
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'title' => 'nullable|string|max:50',
            'email' => 'sometimes|email|unique:users,email,'.$id,
            'role' => 'nullable|string|exists:roles,name',
            'college_id' => 'nullable|uuid|exists:colleges,id',
            'department_id' => 'nullable|uuid|exists:departments,id',
            'employee_id' => 'nullable|string|max:50',
            'phone' => 'nullable|string|max:30',
            'gender' => 'nullable|in:male,female,other',
            'status' => 'sometimes|in:active,inactive,suspended',
            'expertise' => 'nullable|array',
            'expertise.*' => 'string|max:100',
        ]);

        // Neither direction of the super_admin boundary is editable here — not promoting
        // someone to it (must go through the dedicated, password-confirmed Create Super
        // Admin action) and not demoting an existing super_admin away from it (a plain
        // admin stripping the only other super_admin's access is the same class of
        // privilege manipulation as granting it, just in reverse). Only blocks an actual
        // change — resubmitting a super_admin's unchanged role while editing their other
        // fields (name, phone, etc.) still works fine.
        $roleChanging = $request->filled('role') && $request->role !== $user->getRoleNames()->first();
        if ($roleChanging && ($request->role === 'super_admin' || $user->hasRole('super_admin'))) {
            return response()->json(['message' => 'The super_admin role cannot be granted or removed here.'], 403);
        }

        $user->update($request->only('name', 'title', 'email', 'college_id', 'department_id', 'employee_id', 'phone', 'gender', 'status', 'expertise'));

        if ($request->filled('role')) {
            $user->syncRoles([$request->role]);
        }

        return response()->json(['data' => $user->fresh()->load('roles'), 'message' => 'User updated.', 'errors' => [], 'meta' => []]);
    }

    public function export(Request $request): StreamedResponse
    {
        if (! $request->user()?->can('users.view_any')) {
            abort(403, 'Forbidden.');
        }

        $query = User::with(['roles:id,name', 'college:id,name,code', 'department:id,name'])
            ->whereDoesntHave('roles', fn ($q) => $q->where('name', 'super_admin'))
            ->orderBy('name');

        if ($search = $request->query('search')) {
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
            );
        }

        if ($role = $request->query('role')) {
            $roles = str_contains($role, ',') ? explode(',', $role) : $role;
            $query->role($roles);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $users = $query->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="users_export_'.date('Y-m-d').'.csv"',
            'Cache-Control' => 'no-cache',
        ];

        return response()->stream(function () use ($users) {
            $handle = fopen('php://output', 'w');

            // UTF-8 BOM for Excel compatibility
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'Name', 'Email', 'Employee ID', 'Role', 'College', 'College Code',
                'Department', 'Phone', 'Gender', 'Status', 'Created At',
            ]);

            foreach ($users as $user) {
                $primaryRole = $user->roles->first()?->name ?? '';
                fputcsv($handle, [
                    $user->name,
                    $user->email,
                    $user->employee_id ?? '',
                    $primaryRole,
                    $user->college?->name ?? '',
                    $user->college?->code ?? '',
                    $user->department?->name ?? '',
                    $user->phone ?? '',
                    $user->gender ?? '',
                    $user->status,
                    $user->created_at?->format('Y-m-d'),
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }

    public function importTemplate(): StreamedResponse
    {
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="users_import_template.csv"',
            'Cache-Control' => 'no-cache',
        ];

        return response()->stream(function () {
            $handle = fopen('php://output', 'w');

            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'name', 'email', 'password', 'role',
                'college_code', 'department_code', 'employee_id', 'phone', 'gender',
            ]);

            // Example rows
            fputcsv($handle, [
                'John Doe', 'john.doe@example.com', 'Password123', 'staff',
                'CBE', 'CS', 'EMP-001', '+251911000001', 'male',
            ]);
            fputcsv($handle, [
                'Jane Smith', 'jane.smith@example.com', 'Password123', 'reviewer',
                'CSSH', 'PSYCH', 'EMP-002', '+251911000002', 'female',
            ]);

            fclose($handle);
        }, 200, $headers);
    }

    public function import(Request $request): JsonResponse
    {
        if (! $request->user()?->can('users.create')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:2048',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');

        // Read header row, stripping BOM if present
        $rawHeaders = fgetcsv($handle);
        if ($rawHeaders) {
            $rawHeaders[0] = ltrim($rawHeaders[0], "\xEF\xBB\xBF");
        }
        $headerMap = array_flip(array_map('trim', $rawHeaders ?? []));
        $col = fn (string $name) => $headerMap[$name] ?? null;

        // Pre-load all lookup tables once — avoids per-row queries
        $colleges = College::pluck('id', 'code')->toArray();
        $departments = Department::pluck('id', 'code')->toArray();
        $roleMap = DB::table('roles')->pluck('id', 'name')->toArray(); // name → id

        // ── Pass 1: parse & validate every row ────────────────────────────
        $rawRows = [];
        $errors = [];
        $rowIndex = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowIndex++;

            $name = trim($row[$col('name')] ?? '');
            $email = strtolower(trim($row[$col('email')] ?? ''));
            $password = trim($row[$col('password')] ?? '');
            $role = trim($row[$col('role')] ?? '');
            $collegeCode = strtoupper(trim($row[$col('college_code')] ?? ''));
            $departmentCode = strtoupper(trim($row[$col('department_code')] ?? ''));
            $employeeId = trim($row[$col('employee_id')] ?? '');
            $phone = trim($row[$col('phone')] ?? '');
            $gender = strtolower(trim($row[$col('gender')] ?? ''));

            $rowErrors = [];
            if (! $name) {
                $rowErrors[] = 'name is required';
            }
            if (! $email) {
                $rowErrors[] = 'email is required';
            }
            if ($email && ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $rowErrors[] = 'invalid email';
            }
            if (! $role) {
                $rowErrors[] = 'role is required';
            }
            if ($role && ! isset($roleMap[$role])) {
                $rowErrors[] = "unknown role \"{$role}\"";
            }
            if ($gender && ! in_array($gender, ['male', 'female', 'other'], true)) {
                $gender = '';
            }

            if ($rowErrors) {
                $errors[] = ['row' => $rowIndex, 'email' => $email ?: '—', 'error' => implode('; ', $rowErrors)];

                continue;
            }

            $rawRows[] = compact('rowIndex', 'name', 'email', 'password', 'role', 'collegeCode', 'departmentCode', 'employeeId', 'phone', 'gender');
        }

        fclose($handle);

        // ── Pass 2: resolve duplicates with a single query ─────────────────
        $csvEmails = array_column($rawRows, 'email');

        // Existing DB emails (one query)
        $existingEmails = User::whereIn('email', $csvEmails)->pluck('email')->flip()->toArray();

        // Also track emails seen within this CSV so intra-file dupes are caught
        $seenInFile = [];

        $skipped = 0;
        $toInsert = []; // valid, non-duplicate rows

        foreach ($rawRows as $r) {
            if (isset($existingEmails[$r['email']]) || isset($seenInFile[$r['email']])) {
                $skipped++;

                continue;
            }

            $seenInFile[$r['email']] = true;
            $toInsert[] = $r;
        }

        // ── Pass 3: bulk insert in chunks ──────────────────────────────────
        $now = now()->toDateTimeString();
        $created = 0;

        foreach (array_chunk($toInsert, 200) as $chunk) {
            $userRows = [];
            $roleRows = [];
            $notifRows = [];

            foreach ($chunk as $r) {
                $userId = Str::orderedUuid()->toString();

                // bcrypt cost=4 for import — rehash_on_login=true upgrades it on first sign-in
                $hashed = Hash::make($r['password'] ?: Str::random(16), ['rounds' => 4]);

                $userRows[] = [
                    'id' => $userId,
                    'name' => $r['name'],
                    'email' => $r['email'],
                    'password' => $hashed,
                    'college_id' => ($r['collegeCode'] && isset($colleges[$r['collegeCode']])) ? $colleges[$r['collegeCode']] : null,
                    'department_id' => ($r['departmentCode'] && isset($departments[$r['departmentCode']])) ? $departments[$r['departmentCode']] : null,
                    'employee_id' => $r['employeeId'] ?: null,
                    'phone' => $r['phone'] ?: null,
                    'gender' => $r['gender'] ?: null,
                    'status' => 'active',
                    'email_verified_at' => $now,
                    'registration_method' => 'imported',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $roleRows[] = [
                    'role_id' => $roleMap[$r['role']],
                    'model_type' => User::class,
                    'model_id' => $userId,
                ];

                $notifRows[] = [
                    'id' => Str::orderedUuid()->toString(),
                    'user_id' => $userId,
                    'email_enabled' => true,
                    'telegram_enabled' => true,
                    'inapp_enabled' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $created++;
            }

            DB::transaction(function () use ($userRows, $roleRows, $notifRows) {
                DB::table('users')->insert($userRows);
                DB::table('model_has_roles')->insert($roleRows);
                DB::table('notification_preferences')->insert($notifRows);
            });
        }

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => User::class,
            'auditable_id' => $request->user()->id,
            'event' => 'users.imported',
            'actor_id' => $request->user()->id,
            'old_values' => null,
            'new_values' => json_encode(['created' => $created, 'skipped' => $skipped, 'errors' => count($errors)]),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ?? '',
            'created_at' => $now,
        ]);

        return response()->json([
            'data' => [
                'summary' => [
                    'total' => $created + $skipped + count($errors),
                    'created' => $created,
                    'skipped' => $skipped,
                    'errors' => count($errors),
                ],
                'errors' => $errors,
            ],
            'message' => "Import complete. {$created} created, {$skipped} skipped, ".count($errors).' errors.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Admin — sign in as another user, to check or debug their account. */
    public function impersonate(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();

        if (! $actor->can('users.impersonate')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $target = User::with('roles')->findOrFail($id);

        if ($target->id === $actor->id) {
            return response()->json(['message' => 'You cannot impersonate your own account.'], 422);
        }

        if ($target->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Cannot impersonate an admin account.'], 422);
        }

        $token = $target->createToken('impersonation_token')->plainTextToken;

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => User::class,
            'auditable_id' => $target->id,
            'event' => 'user.impersonation_started',
            'actor_id' => $actor->id,
            'old_values' => null,
            'new_values' => json_encode(['impersonated_by' => $actor->id, 'impersonated_by_email' => $actor->email]),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ?? '',
            'created_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => array_merge($target->toArray(), [
                    'roles' => $target->getRoleNames()->values()->toArray(),
                    'permissions' => $target->getAllPermissions()->pluck('name')->values()->toArray(),
                ]),
            ],
            'message' => "You are now viewing as {$target->name}.",
            'errors' => [],
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $actor = $request->user();
        $user = User::findOrFail($id);

        if ($user->id === $actor->id) {
            return response()->json(['message' => 'Cannot delete your own account.'], 422);
        }

        if (! $actor->hasRole('super_admin') && $user->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'You do not have permission to delete this account.'], 403);
        }

        $uid = $user->id;

        // Detect NOT NULL FK violations grouped into human-readable categories.
        // Proposals are cascade-deleted below, so they are excluded from blockers.
        $blockers = array_filter([
            'review or evaluation records' => DB::table('review_assignments')->where('reviewer_id', $uid)->orWhere('assigned_by', $uid)->exists()
                || DB::table('defence_sessions')->where('scheduled_by', $uid)->exists()
                || DB::table('midterm_evaluations')->where('scheduled_by', $uid)->exists()
                || DB::table('completion_workshops')->where('scheduled_by', $uid)->exists(),

            'finance records' => DB::table('budget_requests')->where('requested_by', $uid)->exists()
                || DB::table('budget_allocations')->where('allocated_by', $uid)->exists()
                || DB::table('budget_approvals')->where('approved_by', $uid)->exists()
                || DB::table('budget_settlements')->where('submitted_by', $uid)->exists()
                || DB::table('budget_transactions')->where('transacted_by', $uid)->exists()
                || DB::table('disbursements')->where('disbursed_by', $uid)->exists()
                || DB::table('payment_proofs')->where('uploaded_by', $uid)->exists()
                || DB::table('awards')->where('approved_by', $uid)->exists(),

            'complaints' => DB::table('complaints')->where('complainant_id', $uid)->exists(),

            'activity logs or signed forms' => DB::table('workflow_logs')->where('actor_id', $uid)->exists()
                || DB::table('form_signatures')->where('user_id', $uid)->exists()
                || DB::table('form_templates')->where('created_by', $uid)->exists()
                || DB::table('report_snapshots')->where('requested_by', $uid)->exists()
                || DB::table('research_outputs')->where('recorded_by', $uid)->exists(),
        ]);

        if (! empty($blockers)) {
            return response()->json([
                'message' => 'Cannot delete this user — they have linked '.implode(', ', array_keys($blockers)).'. Remove or reassign this data first.',
                'errors' => [],
            ], 422);
        }

        DB::transaction(function () use ($user, $uid) {
            // Cascade-delete all proposals owned by this user and everything related to them.
            $proposalIds = DB::table('proposals')
                ->where('pi_user_id', $uid)
                ->orWhere('created_by', $uid)
                ->pluck('id')
                ->toArray();

            foreach ($proposalIds as $pid) {
                $brIds = DB::table('budget_requests')->where('proposal_id', $pid)->pluck('id')->toArray();

                if (! empty($brIds)) {
                    $disbIds = DB::table('disbursements')->whereIn('budget_request_id', $brIds)->pluck('id')->toArray();

                    if (! empty($disbIds)) {
                        DB::table('payment_proofs')->whereIn('disbursement_id', $disbIds)->delete();
                    }
                    DB::table('disbursements')->whereIn('budget_request_id', $brIds)->delete();
                    DB::table('form_signatures')->whereIn('budget_request_id', $brIds)->delete();
                    DB::table('budget_approvals')->whereIn('budget_request_id', $brIds)->delete();
                    DB::table('budget_transactions')->whereIn('budget_request_id', $brIds)->delete();
                    DB::table('budget_settlements')->whereIn('budget_request_id', $brIds)->delete();
                    DB::table('budget_request_items')->whereIn('budget_request_id', $brIds)->delete();
                }
                DB::table('budget_requests')->where('proposal_id', $pid)->delete();

                $raIds = DB::table('review_assignments')->where('proposal_id', $pid)->pluck('id')->toArray();
                if (! empty($raIds)) {
                    DB::table('review_scores')->whereIn('review_assignment_id', $raIds)->delete();
                }
                DB::table('review_assignments')->where('proposal_id', $pid)->delete();

                DB::table('workflow_logs')->where('proposal_id', $pid)->delete();
                DB::table('midterm_evaluations')->where('proposal_id', $pid)->delete();
                DB::table('defence_sessions')->where('proposal_id', $pid)->delete();
                DB::table('completion_workshops')->where('proposal_id', $pid)->delete();
                DB::table('research_outputs')->where('proposal_id', $pid)->delete();
                DB::table('repository_records')->where('proposal_id', $pid)->delete();
                DB::table('awards')->where('proposal_id', $pid)->delete();
                DB::table('budget_allocations')->where('proposal_id', $pid)->delete();
                DB::table('proposal_documents')->where('proposal_id', $pid)->delete();
                DB::table('proposal_budgets')->where('proposal_id', $pid)->delete();
                DB::table('proposal_members')->where('proposal_id', $pid)->delete();
                DB::table('proposals')->where('id', $pid)->delete();
            }

            // Nullify created_by on proposal_calls (keep the calls, just disown them).
            DB::table('proposal_calls')->where('created_by', $uid)->update(['created_by' => null]);

            // Delete any proposal documents the user uploaded outside the proposals above.
            DB::table('proposal_documents')->where('uploaded_by', $uid)->delete();

            // Delete user-owned records with NOT NULL FK
            DB::table('notification_preferences')->where('user_id', $uid)->delete();
            DB::table('proposal_members')->where('user_id', $uid)->delete();

            // Revoke tokens
            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $uid)
                ->delete();

            // Nullify nullable FK columns
            DB::table('budget_allocations')->where('approved_by', $uid)->update(['approved_by' => null]);
            DB::table('midterm_evaluations')->where('scored_by', $uid)->update(['scored_by' => null]);
            DB::table('resources')->where('created_by', $uid)->update(['created_by' => null]);

            // Detach Spatie roles & permissions
            $user->roles()->detach();
            $user->permissions()->detach();

            $user->forceDelete();
        });

        return response()->json(['message' => 'User deleted.', 'errors' => [], 'meta' => []]);
    }

    public function bulkAction(Request $request): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'action' => 'required|in:activate,deactivate,delete,assign_role',
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|string|uuid',
            'role' => 'required_if:action,assign_role|nullable|string|exists:roles,name',
        ]);

        $action = $request->action;
        $ids = $request->ids;
        $actorId = $request->user()->id;

        if ($action === 'assign_role') {
            if (! $request->user()->can('roles.assign')) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }

            // Bulk-granting super_admin to multiple accounts at once is never allowed
            // through this path — same boundary as store()/update()/updateRole().
            if ($request->role === 'super_admin') {
                return response()->json(['message' => 'The super_admin role cannot be bulk-assigned here.'], 403);
            }

            $role = $request->role;
            $users = User::whereIn('id', $ids)
                ->where('id', '!=', $actorId)
                ->get()
                // Existing super_admins are also protected from bulk demotion.
                ->reject(fn (User $u) => $u->hasRole('super_admin'));

            $now = now();
            foreach ($users as $u) {
                $oldRole = $u->getRoleNames()->first() ?? 'none';
                $u->syncRoles([$role]);
                DB::table('audit_logs')->insert([
                    'id' => Str::uuid()->toString(),
                    'auditable_type' => User::class,
                    'auditable_id' => $u->id,
                    'event' => 'user.role_changed',
                    'actor_id' => $actorId,
                    'old_values' => json_encode(['role' => $oldRole]),
                    'new_values' => json_encode(['role' => $role]),
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent() ?? '',
                    'created_at' => $now,
                ]);
            }

            return response()->json([
                'message' => "{$users->count()} user(s) assigned role \"{$role}\".",
                'errors' => [],
                'meta' => ['affected' => $users->count()],
            ]);
        }

        if (in_array($action, ['activate', 'deactivate'])) {
            $newStatus = $action === 'activate' ? 'active' : 'inactive';
            $users = User::whereIn('id', $ids)
                ->where('id', '!=', $actorId)
                ->get();

            foreach ($users as $u) {
                $u->update(['status' => $newStatus]);
            }

            return response()->json([
                'message' => "{$users->count()} user(s) {$newStatus}d.",
                'errors' => [],
                'meta' => ['affected' => $users->count()],
            ]);
        }

        // delete
        $deleted = 0;
        $skipped = [];

        $users = User::whereIn('id', $ids)->where('id', '!=', $actorId)->get();

        foreach ($users as $user) {
            $uid = $user->id;

            $hasLinked = DB::table('review_assignments')->where('reviewer_id', $uid)->orWhere('assigned_by', $uid)->exists()
                || DB::table('defence_sessions')->where('scheduled_by', $uid)->exists()
                || DB::table('midterm_evaluations')->where('scheduled_by', $uid)->exists()
                || DB::table('completion_workshops')->where('scheduled_by', $uid)->exists()
                || DB::table('budget_requests')->where('requested_by', $uid)->exists()
                || DB::table('budget_allocations')->where('allocated_by', $uid)->exists()
                || DB::table('budget_approvals')->where('approved_by', $uid)->exists()
                || DB::table('budget_settlements')->where('submitted_by', $uid)->exists()
                || DB::table('workflow_logs')->where('actor_id', $uid)->exists()
                || DB::table('research_outputs')->where('recorded_by', $uid)->exists();

            if ($hasLinked) {
                $skipped[] = $user->name;

                continue;
            }

            DB::transaction(function () use ($user, $uid) {
                $proposalIds = DB::table('proposals')
                    ->where('pi_user_id', $uid)
                    ->orWhere('created_by', $uid)
                    ->pluck('id')
                    ->toArray();

                foreach ($proposalIds as $pid) {
                    $brIds = DB::table('budget_requests')->where('proposal_id', $pid)->pluck('id')->toArray();

                    if (! empty($brIds)) {
                        $disbIds = DB::table('disbursements')->whereIn('budget_request_id', $brIds)->pluck('id')->toArray();

                        if (! empty($disbIds)) {
                            DB::table('payment_proofs')->whereIn('disbursement_id', $disbIds)->delete();
                        }
                        DB::table('disbursements')->whereIn('budget_request_id', $brIds)->delete();
                        DB::table('form_signatures')->whereIn('budget_request_id', $brIds)->delete();
                        DB::table('budget_approvals')->whereIn('budget_request_id', $brIds)->delete();
                        DB::table('budget_transactions')->whereIn('budget_request_id', $brIds)->delete();
                        DB::table('budget_settlements')->whereIn('budget_request_id', $brIds)->delete();
                        DB::table('budget_request_items')->whereIn('budget_request_id', $brIds)->delete();
                    }
                    DB::table('budget_requests')->where('proposal_id', $pid)->delete();
                    DB::table('review_assignments')->where('proposal_id', $pid)->delete();
                    DB::table('workflow_logs')->where('proposal_id', $pid)->delete();
                    DB::table('midterm_evaluations')->where('proposal_id', $pid)->delete();
                    DB::table('defence_sessions')->where('proposal_id', $pid)->delete();
                    DB::table('completion_workshops')->where('proposal_id', $pid)->delete();
                    DB::table('research_outputs')->where('proposal_id', $pid)->delete();
                    DB::table('repository_records')->where('proposal_id', $pid)->delete();
                    DB::table('awards')->where('proposal_id', $pid)->delete();
                    DB::table('budget_allocations')->where('proposal_id', $pid)->delete();
                    DB::table('proposal_documents')->where('proposal_id', $pid)->delete();
                    DB::table('proposal_budgets')->where('proposal_id', $pid)->delete();
                    DB::table('proposal_members')->where('proposal_id', $pid)->delete();
                    DB::table('proposals')->where('id', $pid)->delete();
                }

                DB::table('proposal_calls')->where('created_by', $uid)->update(['created_by' => null]);
                DB::table('proposal_documents')->where('uploaded_by', $uid)->delete();
                DB::table('notification_preferences')->where('user_id', $uid)->delete();
                DB::table('proposal_members')->where('user_id', $uid)->delete();
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', User::class)
                    ->where('tokenable_id', $uid)
                    ->delete();
                DB::table('budget_allocations')->where('approved_by', $uid)->update(['approved_by' => null]);
                DB::table('midterm_evaluations')->where('scored_by', $uid)->update(['scored_by' => null]);
                DB::table('resources')->where('created_by', $uid)->update(['created_by' => null]);

                $user->roles()->detach();
                $user->permissions()->detach();
                $user->forceDelete();
            });

            $deleted++;
        }

        $message = "{$deleted} user(s) deleted.";

        if (! empty($skipped)) {
            $message .= ' Skipped (linked records): '.implode(', ', array_slice($skipped, 0, 5));

            if (count($skipped) > 5) {
                $message .= ' and '.(count($skipped) - 5).' more.';
            }
        }

        return response()->json([
            'message' => $message,
            'errors' => [],
            'meta' => ['deleted' => $deleted, 'skipped' => count($skipped)],
        ]);
    }

    public function updateUserRoles(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'roles' => 'required|array',
            'roles.*' => 'string|exists:roles,name',
        ]);
        $user = User::findOrFail($id);
        $user->syncRoles($request->roles);

        return response()->json(['data' => $user->fresh()->load('roles'), 'message' => 'Roles updated.', 'errors' => [], 'meta' => []]);
    }

    public function userRoles(string $id): JsonResponse
    {
        $user = User::with('roles')->findOrFail($id);

        return response()->json(['data' => $user->roles->pluck('name'), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function colleges(): JsonResponse
    {
        $colleges = College::orderBy('name')->get(['id', 'name', 'code']);

        return response()->json([
            'data' => $colleges,
            'message' => 'Colleges retrieved.',
            'errors' => [],
        ]);
    }

    public function departments(string $collegeId): JsonResponse
    {
        $departments = Department::where('college_id', $collegeId)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json([
            'data' => $departments,
            'message' => 'Departments retrieved.',
            'errors' => [],
        ]);
    }

    /** Unified chronological activity timeline for a user. */
    public function activityTimeline(string $id, User360Service $service): JsonResponse
    {
        $user = User::findOrFail($id);

        return response()->json([
            'data' => $service->buildTimeline($user),
            'message' => '',
            'errors' => [],
        ]);
    }

    /** Daily audit-log activity counts for the last 365 days (heatmap). */
    public function activityHeatmap(string $id, User360Service $service): JsonResponse
    {
        $user = User::findOrFail($id);

        return response()->json([
            'data' => $service->buildHeatmap($user),
            'message' => '',
            'errors' => [],
        ]);
    }

    /** Complete 360° profile — aggregates every relationship this user has across the system. */
    public function profile360(string $id, User360Service $service): JsonResponse
    {
        $user = User::with(['college', 'department', 'roles'])->findOrFail($id);

        return response()->json([
            'data' => array_merge(
                ['user' => $user],
                $service->build($user),
            ),
            'message' => '',
            'errors' => [],
        ]);
    }

    /** Funding history for a PI — shows all proposals where user is PI, grouped for the funding page warning. */
    public function proposalHistory(string $id): JsonResponse
    {
        $pi = User::findOrFail($id);

        $proposals = Proposal::where('pi_user_id', $pi->id)
            ->with(['award:id,proposal_id,grant_reference,awarded_amount,approved_at'])
            ->select(['id', 'title', 'tracker_number', 'status', 'academic_year', 'submitted_at', 'pi_user_id'])
            ->orderByDesc('submitted_at')
            ->get();

        $funded = $proposals->whereIn('status', ['funded', 'midterm_evaluation', 'completed']);
        $pending = $proposals->whereIn('status', ['submitted', 'validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence', 'accepted']);
        $rejected = $proposals->where('status', 'rejected');
        $archived = $proposals->where('status', 'archived');

        // Check for unsettled budget requests across all PI proposals
        $proposalIds = $proposals->pluck('id');
        $pendingBudgets = BudgetRequest::whereIn('proposal_id', $proposalIds)
            ->whereIn('status', ['pending', 'approved'])
            ->count();
        $unsettledBudgets = BudgetRequest::whereIn('proposal_id', $proposalIds)
            ->where('status', 'approved')
            ->whereDoesntHave('settlement', fn ($q) => $q->where('status', 'finance_verified'))
            ->count();

        return response()->json([
            'data' => [
                'pi' => ['id' => $pi->id, 'name' => $pi->name, 'email' => $pi->email],
                'summary' => [
                    'total' => $proposals->count(),
                    'funded_active' => $funded->count(),
                    'pending_review' => $pending->count(),
                    'rejected' => $rejected->count(),
                    'archived' => $archived->count(),
                    'pending_budgets' => $pendingBudgets,
                    'unsettled_budgets' => $unsettledBudgets,
                ],
                'proposals' => $proposals->values(),
            ],
            'message' => 'PI proposal history retrieved.',
            'errors' => [],
        ]);
    }
}
