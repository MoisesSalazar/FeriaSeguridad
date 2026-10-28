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
        Schema::create('hourly_attendances', function (Blueprint $table) {
            $table->id();
            $table->date('date')->nullable()->index();
            $table->string('camera');
            $table->string('configuration')->default('Entrada');
            $table->string('hour')->index();
            $table->unsignedInteger('entered')->default(0);
            $table->unsignedInteger('exited')->default(0);
            $table->integer('contribution')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hourly_attendances');
    }
};
