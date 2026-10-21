<?php

use App\Support\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Create the permissions in config/access.php that don't exist yet and grant
     * them to the built-in roles that pass those checks today, so moving access
     * checks from role names to permissions changes nothing for existing users.
     * Never revokes anything.
     */
    public function up(): void
    {
        PermissionCatalog::sync();

        // Permissions that existed but were never checked, and are now enforced:
        // match the built-in roles to who could actually do these things before.
        PermissionCatalog::alignBuiltInRoles(['reports.create', 'colleges.delete', 'features.manage', 'external_funds.delete', 'departments.create']);
    }

    public function down(): void
    {
        // Permissions are left in place: removing them could lock users out.
    }
};
