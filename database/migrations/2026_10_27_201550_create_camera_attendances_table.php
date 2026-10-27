<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('camera_attendances', function (Blueprint $table) {
            $table->id();
            $table->string('camera');
            $table->string('configuration')->nullable()->default('Entrada');
            $table->string('reading_interval')->nullable()->default('Cada 5 segundos');
            $table->unsignedInteger('entered')->default(0);
            $table->unsignedInteger('exited')->default(0);
            $table->integer('total_contribution')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('camera_attendances');
    }
};
