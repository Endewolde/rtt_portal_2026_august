<?php

use App\Models\ConferenceRegistration;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conferences', function (Blueprint $table) {
            $table->json('registration_questions')->nullable()->after('max_capacity');
            $table->boolean('waitlist_enabled')->default(true)->after('registration_questions');
            $table->boolean('feedback_open')->default(false)->after('waitlist_enabled');
        });

        Schema::create('conference_registration_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained()->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('description', 500)->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('conference_registrations', function (Blueprint $table) {
            $table->foreignUuid('registration_type_id')->nullable()->after('conference_id')->constrained('conference_registration_types')->nullOnDelete();
            $table->json('answers')->nullable()->after('phone');
            $table->string('ticket_code', 16)->nullable()->unique()->after('answers');
            $table->timestamp('checked_in_at')->nullable()->after('registered_at');
            $table->foreignUuid('checked_in_by')->nullable()->after('checked_in_at')->constrained('users')->nullOnDelete();
        });
        // A full conference can keep a waiting list.
        DB::statement("ALTER TABLE conference_registrations MODIFY status ENUM('pending','confirmed','waitlisted','cancelled') NOT NULL DEFAULT 'confirmed'");

        // Registrations made before tickets existed get one now.
        DB::table('conference_registrations')->whereNull('ticket_code')->pluck('id')->each(
            fn ($id) => DB::table('conference_registrations')->where('id', $id)->update(['ticket_code' => ConferenceRegistration::newTicketCode()])
        );

        Schema::create('conference_certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 20);
            // What it was earned for, e.g. "registration:{uuid}" — one certificate of each kind per person.
            $table->string('source_key', 80);
            $table->string('recipient_name');
            $table->string('recipient_email')->nullable();
            $table->string('detail', 500)->nullable();
            $table->string('code', 20)->unique();
            $table->timestamp('issued_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->unique(['conference_id', 'kind', 'source_key']);
        });

        Schema::create('conference_feedback', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('registration_id')->unique()->constrained('conference_registrations')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->boolean('would_recommend')->nullable();
            $table->text('liked')->nullable();
            $table->text('improve')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        DB::table('conference_registrations')->where('status', 'waitlisted')->update(['status' => 'cancelled']);
        DB::statement("ALTER TABLE conference_registrations MODIFY status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'confirmed'");
        Schema::dropIfExists('conference_feedback');
        Schema::dropIfExists('conference_certificates');
        Schema::table('conference_registrations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('registration_type_id');
            $table->dropConstrainedForeignId('checked_in_by');
            $table->dropColumn(['answers', 'ticket_code', 'checked_in_at']);
        });
        Schema::dropIfExists('conference_registration_types');
        Schema::table('conferences', fn (Blueprint $table) => $table->dropColumn(['registration_questions', 'waitlist_enabled', 'feedback_open']));
    }
};
