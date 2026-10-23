<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Researcher profile pages on the public site. Private until the researcher
     * switches them on; the slug is the page's address (/researchers/{slug}).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('public_profile')->default(false)->after('expertise');
            $table->string('profile_slug', 120)->nullable()->unique()->after('public_profile');
            $table->text('bio')->nullable()->after('profile_slug');
            $table->string('orcid', 19)->nullable()->after('bio');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['profile_slug']);
            $table->dropColumn(['public_profile', 'profile_slug', 'bio', 'orcid']);
        });
    }
};
