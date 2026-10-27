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
        Schema::create('minute_attendances', function (Blueprint $table) {
            $table->id();
            $table->dateTime('recorded_at')->index();
            $table->string('time_str')->index();
            $table->string('camera');
            $table->string('configuration')->default('Entrada');
            $table->unsignedInteger('entered')->default(0);
            $table->unsignedInteger('exited')->default(0);
            $table->integer('change_entered')->default(0);
            $table->integer('change_exited')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('minute_attendances');
    }
};
