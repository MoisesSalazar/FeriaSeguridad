<?php

use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'api'])->name('api.dashboard.v1');
    Route::get('/conteo', [DashboardController::class, 'api'])->name('api.conteo.v1');
    Route::get('/conteo/horas', [DashboardController::class, 'hourlyApi'])->name('api.conteo.hours.v1');
    Route::get('/conteo/minutos', [DashboardController::class, 'minutesApi'])->name('api.conteo.minutes.v1');
    Route::get('/conteo/camaras', [DashboardController::class, 'camerasApi'])->name('api.conteo.cameras.v1');
    Route::post('/conteo/registro', [DashboardController::class, 'storeRecord'])->name('api.conteo.store-record.v1');
    Route::post('/conteo/hora', [DashboardController::class, 'storeHourly'])->name('api.conteo.store-hourly.v1');
    Route::post('/conteo/import', [DashboardController::class, 'uploadExcel'])->name('api.conteo.import.v1');
});

Route::get('/dashboard', [DashboardController::class, 'api'])->name('api.dashboard');
Route::get('/conteo', [DashboardController::class, 'api'])->name('api.conteo');
Route::get('/conteo/horas', [DashboardController::class, 'hourlyApi'])->name('api.conteo.hours');
Route::get('/conteo/minutos', [DashboardController::class, 'minutesApi'])->name('api.conteo.minutes');
Route::get('/conteo/camaras', [DashboardController::class, 'camerasApi'])->name('api.conteo.cameras');
Route::post('/conteo/registro', [DashboardController::class, 'storeRecord'])->name('api.conteo.store-record');
Route::post('/conteo/hora', [DashboardController::class, 'storeHourly'])->name('api.conteo.store-hourly');
Route::post('/conteo/import', [DashboardController::class, 'uploadExcel'])->name('api.conteo.import');
