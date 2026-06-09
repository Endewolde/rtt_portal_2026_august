<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->string('type', 20)->default('string');
            $table->text('description')->nullable();
            $table->char('updated_by', 36)->nullable();
            $table->timestamps();
        });

        DB::table('app_settings')->insert([
            'id'          => Str::uuid()->toString(),
            'key'         => 'current_academic_year',
            'value'       => '2026-2027',
            'type'        => 'string',
            'description' => 'Default academic year shown when creating new proposal calls',
            'updated_by'  => null,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
