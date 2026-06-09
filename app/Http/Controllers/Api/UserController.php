<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\Department;
use App\Models\NotificationPreference;
use App\Models\User;
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

        $query = User::with(['roles:id,name', 'college:id,name', 'department:id,name'])->orderBy('name');

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

        if ($isAdmin && ($status = $request->query('status'))) {
            $query->where('status', $status);
        }

        $perPage = $isAdmin ? 25 : 10;

        return response()->json([
            'data' => $query->paginate($perPage),
            'message' => 'Users retrieved.',
            'errors' => [],
            'meta' => [],
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

        $target = User::findOrFail($id);
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
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|string|exists:roles,name',
            'college_id' => 'nullable|uuid|exists:colleges,id',
            'department_id' => 'nullable|uuid|exists:departments,id',
            'employee_id' => 'nullable|string|max:50',
            'phone' => 'nullable|string|max:30',
            'gender' => 'nullable|in:male,female,other',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'college_id' => $request->college_id,
            'department_id' => $request->department_id,
            'employee_id' => $request->employee_id,
            'phone' => $request->phone,
            'gender' => $request->gender,
            'status' => 'active',
            'email_verified_at' => now(),
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

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('users.update')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $user = User::findOrFail($id);
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$id,
            'college_id' => 'nullable|uuid|exists:colleges,id',
            'department_id' => 'nullable|uuid|exists:departments,id',
            'employee_id' => 'nullable|string|max:50',
            'phone' => 'nullable|string|max:30',
            'gender' => 'nullable|in:male,female,other',
            'status' => 'sometimes|in:active,inactive,suspended',
        ]);

        $user->update($request->only('name', 'email', 'college_id', 'department_id', 'employee_id', 'phone', 'gender', 'status'));

        return response()->json(['data' => $user->fresh()->load('roles'), 'message' => 'User updated.', 'errors' => [], 'meta' => []]);
    }

    public function export(Request $request): StreamedResponse
    {
        if (! $request->user()?->can('users.view_any')) {
            abort(403, 'Forbidden.');
        }

        $query = User::with(['roles:id,name', 'college:id,name,code', 'department:id,name'])
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
                'college_code', 'employee_id', 'phone', 'gender',
            ]);

            // Example rows
            fputcsv($handle, [
                'John Doe', 'john.doe@example.com', 'Password123', 'staff',
                'CBE', 'EMP-001', '+251911000001', 'male',
            ]);
            fputcsv($handle, [
                'Jane Smith', 'jane.smith@example.com', 'Password123', 'reviewer',
                'CSSH', 'EMP-002', '+251911000002', 'female',
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

        $colleges = College::pluck('id', 'code')->toArray();
        $validRoles = DB::table('roles')->pluck('name')->toArray();

        $created = 0;
        $skipped = 0;
        $errors = [];
        $rowIndex = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowIndex++;

            $name = trim($row[$col('name')] ?? '');
            $email = strtolower(trim($row[$col('email')] ?? ''));
            $password = trim($row[$col('password')] ?? '');
            $role = trim($row[$col('role')] ?? '');
            $collegeCode = strtoupper(trim($row[$col('college_code')] ?? ''));
            $employeeId = trim($row[$col('employee_id')] ?? '');
            $phone = trim($row[$col('phone')] ?? '');
            $gender = strtolower(trim($row[$col('gender')] ?? ''));

            // Row-level validation
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
            if ($role && ! in_array($role, $validRoles, true)) {
                $rowErrors[] = "unknown role \"{$role}\"";
            }
            if ($gender && ! in_array($gender, ['male', 'female', 'other'], true)) {
                $gender = '';
            }

            if ($rowErrors) {
                $errors[] = ['row' => $rowIndex, 'email' => $email ?: '—', 'error' => implode('; ', $rowErrors)];

                continue;
            }

            if (User::where('email', $email)->exists()) {
                $skipped++;

                continue;
            }

            $collegeId = $collegeCode && isset($colleges[$collegeCode]) ? $colleges[$collegeCode] : null;

            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password ?: Str::random(16)),
                'college_id' => $collegeId,
                'employee_id' => $employeeId ?: null,
                'phone' => $phone ?: null,
                'gender' => $gender ?: null,
                'status' => 'active',
                'email_verified_at' => now(),
            ]);

            $user->assignRole($role);
            NotificationPreference::create(['user_id' => $user->id]);

            $created++;
        }

        fclose($handle);

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
            'created_at' => now(),
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

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $user = User::findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot delete your own account.'], 422);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted.', 'errors' => [], 'meta' => []]);
    }

    public function updateUserRoles(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate(['roles' => 'required|array']);
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
}
