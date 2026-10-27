<?php

namespace App\Console\Commands;

use App\Models\CameraAttendance;
use App\Models\HourlyAttendance;
use App\Models\MinuteAttendance;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ImportConteoCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'import:conteo {--file= : Path to conteo.xls file}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Import attendance and access count data from conteo.xls into SQLite database';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $filePath = $this->option('file') ?? public_path('conteo.xls');

        if (! file_exists($filePath)) {
            $this->error("File not found at: {$filePath}");

            return self::FAILURE;
        }

        $this->info("Parsing XML Excel spreadsheet from: {$filePath}...");

        $dom = new DOMDocument;
        $dom->preserveWhiteSpace = false;
        if (! @$dom->load($filePath)) {
            $this->error('Failed to load XML spreadsheet.');

            return self::FAILURE;
        }

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('ss', 'urn:schemas-microsoft-com:office:spreadsheet');

        $worksheets = $xpath->query('//ss:Worksheet');

        if (! $worksheets || $worksheets->length === 0) {
            $this->error('No worksheets found in spreadsheet.');

            return self::FAILURE;
        }

        DB::beginTransaction();

        try {
            foreach ($worksheets as $worksheet) {
                if (! $worksheet instanceof DOMElement) {
                    continue;
                }

                $sheetName = $worksheet->getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Name');
                $this->info("Processing worksheet: {$sheetName}...");

                if ($sheetName === 'Por hora') {
                    $this->importHourly($xpath, $worksheet);
                } elseif ($sheetName === 'Por minuto') {
                    $this->importMinute($xpath, $worksheet);
                } elseif ($sheetName === 'Cámaras' || str_contains($sheetName, 'mara')) {
                    $this->importCameras($xpath, $worksheet);
                }
            }

            DB::commit();
            $this->info('Attendance data successfully imported into SQLite!');

            return self::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Import failed: '.$e->getMessage());

            return self::FAILURE;
        }
    }

    /**
     * Import 'Por hora' sheet.
     */
    protected function importHourly(DOMXPath $xpath, DOMElement $worksheet): void
    {
        HourlyAttendance::truncate();

        $rows = $xpath->query('.//ss:Table/ss:Row', $worksheet);
        $isFirst = true;
        $count = 0;

        foreach ($rows as $row) {
            if ($isFirst) {
                $isFirst = false;

                continue;
            }

            $cells = $this->extractRowCells($xpath, $row);
            if (count($cells) < 4 || empty($cells[2])) {
                continue;
            }

            // Headers: Cámara, Configuración, Hora, Entraron, Salieron, Aporte
            HourlyAttendance::create([
                'camera' => $cells[0] ?? 'Acceso 2',
                'configuration' => $cells[1] ?? 'Entrada',
                'hour' => (string) ($cells[2] ?? ''),
                'entered' => (int) ($cells[3] ?? 0),
                'exited' => (int) ($cells[4] ?? 0),
                'contribution' => (int) ($cells[5] ?? $cells[3] ?? 0),
            ]);
            $count++;
        }

        $this->info("Imported {$count} hourly records.");
    }

    /**
     * Import 'Por minuto' sheet.
     */
    protected function importMinute(DOMXPath $xpath, DOMElement $worksheet): void
    {
        MinuteAttendance::truncate();

        $rows = $xpath->query('.//ss:Table/ss:Row', $worksheet);
        $isFirst = true;
        $records = [];
        $batchSize = 250;

        foreach ($rows as $row) {
            if ($isFirst) {
                $isFirst = false;

                continue;
            }

            $cells = $this->extractRowCells($xpath, $row);
            if (count($cells) < 5 || empty($cells[0])) {
                continue;
            }

            // Headers: Fecha, Hora, Cámara, Configuración, Entraron, Salieron, Cambio de entradas, Cambio de salidas
            $rawDate = (string) $cells[0];
            try {
                $recordedAt = Carbon::parse($rawDate)->toDateTimeString();
            } catch (\Exception) {
                $recordedAt = $rawDate;
            }

            $records[] = [
                'recorded_at' => $recordedAt,
                'time_str' => (string) ($cells[1] ?? ''),
                'camera' => (string) ($cells[2] ?? 'Acceso 2'),
                'configuration' => (string) ($cells[3] ?? 'Entrada'),
                'entered' => (int) ($cells[4] ?? 0),
                'exited' => (int) ($cells[5] ?? 0),
                'change_entered' => (int) ($cells[6] ?? 0),
                'change_exited' => (int) ($cells[7] ?? 0),
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (count($records) >= $batchSize) {
                MinuteAttendance::insert($records);
                $records = [];
            }
        }

        if (! empty($records)) {
            MinuteAttendance::insert($records);
        }

        $total = MinuteAttendance::count();
        $this->info("Imported {$total} minute records.");
    }

    /**
     * Import 'Cámaras' sheet.
     */
    protected function importCameras(DOMXPath $xpath, DOMElement $worksheet): void
    {
        CameraAttendance::truncate();

        $rows = $xpath->query('.//ss:Table/ss:Row', $worksheet);
        $isFirst = true;
        $count = 0;

        foreach ($rows as $row) {
            if ($isFirst) {
                $isFirst = false;

                continue;
            }

            $cells = $this->extractRowCells($xpath, $row);
            if (empty($cells[0])) {
                continue;
            }

            // Headers: Cámara, Configuración, Lectura de imagen, Entraron, Salieron, Aporte al total
            CameraAttendance::create([
                'camera' => (string) $cells[0],
                'configuration' => (string) ($cells[1] ?? 'Entrada'),
                'reading_interval' => (string) ($cells[2] ?? 'Cada 5 segundos'),
                'entered' => (int) ($cells[3] ?? 0),
                'exited' => (int) ($cells[4] ?? 0),
                'total_contribution' => (int) ($cells[5] ?? $cells[3] ?? 0),
            ]);
            $count++;
        }

        $this->info("Imported {$count} camera summary records.");
    }

    /**
     * Extract cell text values for a given Row element.
     *
     * @return array<int, string|null>
     */
    protected function extractRowCells(DOMXPath $xpath, \DOMNode $row): array
    {
        $cells = [];
        $cellNodes = $xpath->query('.//ss:Cell', $row);

        foreach ($cellNodes as $cell) {
            $dataNode = $xpath->query('.//ss:Data', $cell)->item(0);
            $cells[] = $dataNode ? trim($dataNode->nodeValue) : '';
        }

        return $cells;
    }
}
