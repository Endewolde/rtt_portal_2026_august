<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_fields', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('form_section_id', 36);
            $table->string('label', 200);
            $table->string('field_type', 50);
            $table->boolean('is_required')->default(true);
            $table->json('options')->nullable();
            $table->smallInteger('order_index')->default(0);
            $table->timestamps();

            $table->index('form_section_id');
            $table->foreign('form_section_id')->references('id')->on('form_sections');
        });

        DB::statement("ALTER TABLE form_fields ADD CONSTRAINT chk_field_type CHECK (field_type IN ('text','textarea','number','date','select','checkbox','file_upload','currency'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('form_fields');
    }
};
