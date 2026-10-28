<?php

namespace App\Console\Commands;

use App\Models\CameraAttendance;
use App\Models\HourlyAttendance;
use App\Models\MinuteAttendance;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Console\Command;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use XMLReader;
use ZipArchive;

class ImportConteoCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'import:conteo {--file= : Path to Excel file (.xlsx or .xls)} {--date= : Event date for the imported data (YYYY-MM-DD)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Import attendance data exclusively from the first sheet ("Por minuto") into SQLite database';

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

        $this->ensureDateColumnExists();

        $this->info("Analizando archivo Excel desde: {$filePath}...");

        try {
            $sheetData = $this->extractFirstSheetRows($filePath);
            $rows = $sheetData['rows'] ?? [];
            $sheetName = $sheetData['sheet_name'] ?? 'Por minuto';

            if (empty($rows)) {
                $this->error("La primera hoja '{$sheetName}' no contiene filas con datos.");

                return self::FAILURE;
            }

            $this->info("Primera hoja localizada: '{$sheetName}' con ".count($rows).' filas encontradas.');

            $parsedData = $this->parseFirstSheetRecords($rows);
            $minuteRecords = $parsedData['minutes'];
            $hourlyRecords = $parsedData['hourly'];
            $maxEntered = $parsedData['max_entered'];
            $maxExited = $parsedData['max_exited'];

            if (empty($minuteRecords) && empty($hourlyRecords)) {
                $sample = array_slice($rows, 0, 4);
                $this->error("No se encontraron registros válidos en la hoja '{$sheetName}'.");
                $this->line("Estructura de las primeras filas detectadas:");
                foreach ($sample as $sIdx => $sRow) {
                    $this->line("  [Fila ".($sIdx + 1).']: '.json_encode($sRow, JSON_UNESCAPED_UNICODE));
                }

                return self::FAILURE;
            }

            // Determine target date
            $optionDate = $this->option('date');
            $detectedDate = $minuteRecords[0]['date'] ?? ($hourlyRecords[0]['date'] ?? Carbon::now()->format('Y-m-d'));
            $targetDate = $optionDate ?: $detectedDate;

            DB::beginTransaction();

            $now = Carbon::now();

            // 1. Process Minute Records (MinuteAttendance)
            if (! empty($minuteRecords)) {
                $affectedMinuteDates = array_values(array_unique(array_column($minuteRecords, 'date')));
                if ($optionDate) {
                    $affectedMinuteDates = [$optionDate];
                }

                foreach ($affectedMinuteDates as $ad) {
                    MinuteAttendance::whereDate('recorded_at', $ad)->delete();
                }

                $insertBatch = [];
                foreach ($minuteRecords as $m) {
                    $recDate = $optionDate ?: $m['date'];
                    $recDateTime = $optionDate ? ($optionDate.' '.substr($m['recorded_at'], 11)) : $m['recorded_at'];

                    $insertBatch[] = [
                        'recorded_at' => $recDateTime,
                        'time_str' => $m['time_str'],
                        'camera' => $m['camera'],
                        'configuration' => $m['configuration'],
                        'entered' => $m['entered'],
                        'exited' => $m['exited'],
                        'change_entered' => $m['change_entered'],
                        'change_exited' => $m['change_exited'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                foreach (array_chunk($insertBatch, 200) as $chunk) {
                    MinuteAttendance::insert($chunk);
                }
            }

            // 2. Process Hourly Records (HourlyAttendance)
            if (! empty($hourlyRecords)) {
                $affectedHourlyDates = array_values(array_unique(array_column($hourlyRecords, 'date')));
                if ($optionDate) {
                    $affectedHourlyDates = [$optionDate];
                }

                HourlyAttendance::whereIn('date', $affectedHourlyDates)->delete();

                foreach ($hourlyRecords as $hRec) {
                    HourlyAttendance::create([
                        'date' => $optionDate ?: $hRec['date'],
                        'camera' => $hRec['camera'],
                        'configuration' => $hRec['configuration'],
                        'hour' => $hRec['hour'],
                        'entered' => $hRec['entered'],
                        'exited' => $hRec['exited'],
                        'contribution' => $hRec['contribution'],
                    ]);
                }
            }

            // 3. Consolidate CameraAttendance
            $totalEntered = max($maxEntered, (int) array_sum(array_column($hourlyRecords, 'entered')));
            $totalExited = max($maxExited, (int) array_sum(array_column($hourlyRecords, 'exited')));

            CameraAttendance::updateOrCreate(
                ['camera' => 'Total'],
                [
                    'configuration' => null,
                    'reading_interval' => null,
                    'entered' => $totalEntered,
                    'exited' => $totalExited,
                    'total_contribution' => $totalEntered,
                ]
            );

            $camName = $minuteRecords[0]['camera'] ?? ($hourlyRecords[0]['camera'] ?? 'Acceso 2');
            CameraAttendance::updateOrCreate(
                ['camera' => $camName],
                [
                    'configuration' => 'Entrada',
                    'reading_interval' => 'Cada 5 segundos',
                    'entered' => $totalEntered,
                    'exited' => $totalExited,
                    'total_contribution' => $totalEntered,
                ]
            );

            DB::commit();

            $this->info("Importación completada con éxito:");
            $this->info("- Hoja procesada: {$sheetName} (Únicamente la primera hoja)");
            $this->info("- Fecha asignada: {$targetDate}");
            $this->info("- Registros por minuto importados: ".count($minuteRecords));
            $this->info("- Franjas horarias consolidadas: ".count($hourlyRecords));
            $this->info("- Total de entradas registradas: {$totalEntered} personas");

            return self::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Error en la importación: '.$e->getMessage());

            return self::FAILURE;
        }
    }

    /**
     * Ensure the date column exists in hourly_attendances.
     */
    protected function ensureDateColumnExists(): void
    {
        if (! Schema::hasColumn('hourly_attendances', 'date')) {
            try {
                Schema::table('hourly_attendances', function (Blueprint $table) {
                    $table->date('date')->nullable()->index();
                });
            } catch (\Throwable) {
                // Table already updated or concurrent
            }
        }
    }

    /**
     * Detect file type and extract rows exclusively from the FIRST sheet ("Por minuto").
     *
     * @return array{sheet_name: string, rows: array<int, array<int, string>>}
     */
    protected function extractFirstSheetRows(string $filePath): array
    {
        $handle = fopen($filePath, 'rb');
        $headerBytes = fread($handle, 1024);
        fclose($handle);

        // 1. Check if Modern Excel (.xlsx - ZIP archive starting with PK\x03\x04)
        if (str_starts_with($headerBytes, "PK\x03\x04")) {
            return $this->parseXlsxSheet($filePath);
        }

        // 2. Check if XML Spreadsheet 2003 (starts with <?xml or contains <Workbook)
        if (str_contains($headerBytes, 'urn:schemas-microsoft-com:office:spreadsheet') ||
            str_contains($headerBytes, '<Workbook') ||
            str_contains($headerBytes, '<?xml')) {
            return $this->parseXmlSpreadsheet($filePath);
        }

        // 3. Fallback to CSV / Delimited
        return $this->parseCsvSheet($filePath);
    }

    /**
     * Parse modern .xlsx file via ZipArchive and XMLReader.
     * Selects ONLY the first sheet (or sheet named "Por minuto").
     *
     * @return array{sheet_name: string, rows: array<int, array<int, string>>}
     */
    protected function parseXlsxSheet(string $filePath): array
    {
        if (! class_exists(ZipArchive::class)) {
            throw new \RuntimeException('La extensión PHP ZipArchive no está habilitada en este servidor.');
        }

        $zip = new ZipArchive();
        if ($zip->open($filePath) !== true) {
            throw new \RuntimeException('No se pudo abrir el archivo Excel (.xlsx) como archivo ZIP.');
        }

        $wbContent = $zip->getFromName('xl/workbook.xml');
        if (! $wbContent) {
            $zip->close();
            throw new \RuntimeException('Estructura .xlsx inválida: falta xl/workbook.xml.');
        }

        $allSheets = [];
        $targetRId = null;
        $sheetNameFound = null;

        // Use XMLReader to navigate elements completely immune to namespace prefixes (like x:workbook)
        $reader = new XMLReader();
        $reader->XML($wbContent);

        while ($reader->read()) {
            if ($reader->nodeType === XMLReader::ELEMENT && $reader->localName === 'sheet') {
                $name = (string) $reader->getAttribute('name');
                $rId = (string) ($reader->getAttribute('id')
                    ?: $reader->getAttribute('r:id')
                    ?: $reader->getAttributeNs('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'));

                if (! $rId && $reader->hasAttributes) {
                    while ($reader->moveToNextAttribute()) {
                        if (str_ends_with(strtolower($reader->localName), 'id') && $reader->localName !== 'sheetId') {
                            $rId = (string) $reader->value;
                            break;
                        }
                    }
                }

                $allSheets[$name] = $rId;

                $lower = strtolower(trim($name));
                // Prefer sheet named "Por minuto"
                if (str_contains($lower, 'por minuto') || str_contains($lower, 'porminuto') || str_contains($lower, 'minuto') || str_contains($lower, 'minute')) {
                    if ($targetRId === null) {
                        $targetRId = $rId;
                        $sheetNameFound = $name;
                    }
                }
            }
        }
        $reader->close();

        // If not found by name, pick the FIRST sheet in the workbook
        if (! $targetRId && ! empty($allSheets)) {
            $sheetNameFound = array_key_first($allSheets);
            $targetRId = reset($allSheets);
        }

        if (! $targetRId) {
            $zip->close();
            throw new \RuntimeException('No se encontró ninguna hoja en el libro Excel.');
        }

        // Find sheet path from relationships (xl/_rels/workbook.xml.rels)
        $sheetFilePath = null;
        $relsContent = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if ($relsContent) {
            $reader = new XMLReader();
            $reader->XML($relsContent);
            while ($reader->read()) {
                if ($reader->nodeType === XMLReader::ELEMENT && $reader->localName === 'Relationship') {
                    $id = (string) $reader->getAttribute('Id');
                    if ($id === $targetRId) {
                        $target = (string) $reader->getAttribute('Target');
                        $sheetFilePath = str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/'.ltrim($target, '/');
                        break;
                    }
                }
            }
            $reader->close();
        }

        if (! $sheetFilePath || ! $zip->locateName($sheetFilePath)) {
            $num = preg_replace('/[^0-9]/', '', $targetRId) ?: '1';
            $sheetFilePath = "xl/worksheets/sheet{$num}.xml";
        }

        $sheetContent = $zip->getFromName($sheetFilePath);
        if (! $sheetContent) {
            $zip->close();
            throw new \RuntimeException("No se pudo leer la hoja en {$sheetFilePath}.");
        }

        // Shared strings (xl/sharedStrings.xml)
        $sharedStrings = [];
        $sstContent = $zip->getFromName('xl/sharedStrings.xml');
        if ($sstContent) {
            $domSst = new DOMDocument();
            @$domSst->loadXML($sstContent);
            $xpathSst = new DOMXPath($domSst);
            $xpathSst->registerNamespace('ns', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');

            $siNodes = $xpathSst->query('//ns:si') ?: $xpathSst->query('//*[local-name()="si"]') ?: [];
            foreach ($siNodes as $si) {
                $text = '';
                $tNodes = $xpathSst->query('.//ns:t', $si) ?: $xpathSst->query('.//*[local-name()="t"]', $si) ?: [];
                foreach ($tNodes as $t) {
                    $text .= $t->nodeValue;
                }
                $sharedStrings[] = $text;
            }
        }

        $zip->close();

        // Parse sheet rows
        $domSheet = new DOMDocument();
        @$domSheet->loadXML($sheetContent);
        $xpathSheet = new DOMXPath($domSheet);
        $xpathSheet->registerNamespace('ns', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');

        $rowNodes = $xpathSheet->query('//ns:sheetData/ns:row') ?: $xpathSheet->query('//*[local-name()="sheetData"]/*[local-name()="row"]') ?: [];
        $rows = [];

        foreach ($rowNodes as $rNode) {
            $cNodes = $xpathSheet->query('.//ns:c', $rNode) ?: $xpathSheet->query('.//*[local-name()="c"]', $rNode) ?: [];
            $rowCells = [];

            foreach ($cNodes as $c) {
                $rRef = (string) $c->getAttribute('r');
                $colIdx = $this->columnRefToIndex($rRef);
                $type = (string) $c->getAttribute('t');

                $vNode = $xpathSheet->query('.//ns:v', $c)->item(0) ?: $xpathSheet->query('.//*[local-name()="v"]', $c)->item(0);
                $rawVal = $vNode ? trim($vNode->nodeValue) : '';

                if ($type === 's' && is_numeric($rawVal) && isset($sharedStrings[(int) $rawVal])) {
                    $val = $sharedStrings[(int) $rawVal];
                } elseif ($type === 'inlineStr') {
                    $isNode = $xpathSheet->query('.//ns:t', $c)->item(0) ?: $xpathSheet->query('.//*[local-name()="t"]', $c)->item(0);
                    $val = $isNode ? trim($isNode->nodeValue) : $rawVal;
                } else {
                    $val = $rawVal;
                }

                $rowCells[$colIdx] = $val;
            }

            if (! empty($rowCells)) {
                $maxIdx = max(array_keys($rowCells));
                $denseRow = [];
                for ($i = 0; $i <= $maxIdx; $i++) {
                    $denseRow[$i] = $rowCells[$i] ?? '';
                }
                $rows[] = $denseRow;
            }
        }

        return [
            'sheet_name' => $sheetNameFound ?? 'Por minuto',
            'rows' => $rows,
        ];
    }

    /**
     * Convert Excel column reference (e.g. 'A1' -> 0, 'C2' -> 2).
     */
    protected function columnRefToIndex(string $ref): int
    {
        $col = preg_replace('/[0-9]/', '', strtoupper($ref));
        $idx = 0;
        for ($i = 0; $i < strlen($col); $i++) {
            $idx = $idx * 26 + (ord($col[$i]) - ord('A') + 1);
        }

        return $idx - 1;
    }

    /**
     * Parse XML Spreadsheet 2003 (.xls XML format).
     * Selects ONLY the first sheet (or sheet named "Por minuto").
     *
     * @return array{sheet_name: string, rows: array<int, array<int, string>>}
     */
    protected function parseXmlSpreadsheet(string $filePath): array
    {
        $dom = new DOMDocument();
        $dom->preserveWhiteSpace = false;
        if (! @$dom->load($filePath)) {
            throw new \RuntimeException('No se pudo cargar el archivo XML Spreadsheet 2003.');
        }

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('ss', 'urn:schemas-microsoft-com:office:spreadsheet');

        $worksheets = $xpath->query('//ss:Worksheet') ?: [];
        $targetWs = null;
        $sheetNameFound = null;
        $firstWs = null;
        $firstWsName = null;

        foreach ($worksheets as $ws) {
            if (! $ws instanceof DOMElement) {
                continue;
            }
            $name = $ws->getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Name');
            if ($firstWs === null) {
                $firstWs = $ws;
                $firstWsName = $name;
            }

            $lower = strtolower(trim($name));
            if (str_contains($lower, 'por minuto') || str_contains($lower, 'porminuto') || str_contains($lower, 'minuto') || str_contains($lower, 'minute')) {
                $targetWs = $ws;
                $sheetNameFound = $name;
                break;
            }
        }

        // If not found by name, select the FIRST worksheet
        if (! $targetWs && $firstWs !== null) {
            $targetWs = $firstWs;
            $sheetNameFound = $firstWsName;
        }

        if (! $targetWs) {
            throw new \RuntimeException('No se encontró ninguna hoja en el archivo XML.');
        }

        $rowNodes = $xpath->query('.//ss:Table/ss:Row', $targetWs) ?: [];
        $rows = [];

        foreach ($rowNodes as $rNode) {
            $rowCells = [];
            $currentCol = 0;
            $cellNodes = $xpath->query('.//ss:Cell', $rNode) ?: [];

            foreach ($cellNodes as $c) {
                if ($c instanceof DOMElement && $c->hasAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Index')) {
                    $idxAttr = (int) $c->getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Index');
                    if ($idxAttr > 0) {
                        $currentCol = $idxAttr - 1;
                    }
                }

                $dataNode = $xpath->query('.//ss:Data', $c)->item(0);
                $val = $dataNode ? trim($dataNode->nodeValue) : '';
                $rowCells[$currentCol] = $val;
                $currentCol++;
            }

            if (! empty($rowCells)) {
                $maxIdx = max(array_keys($rowCells));
                $denseRow = [];
                for ($i = 0; $i <= $maxIdx; $i++) {
                    $denseRow[$i] = $rowCells[$i] ?? '';
                }
                $rows[] = $denseRow;
            }
        }

        return [
            'sheet_name' => $sheetNameFound ?? 'Por minuto',
            'rows' => $rows,
        ];
    }

    /**
     * Parse CSV or TSV fallback.
     *
     * @return array{sheet_name: string, rows: array<int, array<int, string>>}
     */
    protected function parseCsvSheet(string $filePath): array
    {
        $rows = [];
        if (($handle = fopen($filePath, 'r')) !== false) {
            $firstLine = fgets($handle);
            rewind($handle);
            $delimiter = ',';
            if (substr_count($firstLine, ';') > substr_count($firstLine, ',')) {
                $delimiter = ';';
            } elseif (substr_count($firstLine, "\t") > substr_count($firstLine, ',')) {
                $delimiter = "\t";
            }

            while (($data = fgetcsv($handle, 1000, $delimiter)) !== false) {
                $rows[] = array_map('trim', $data);
            }
            fclose($handle);
        }

        return [
            'sheet_name' => 'Por minuto (CSV)',
            'rows' => $rows,
        ];
    }

    /**
     * Parse records from the first sheet ("Por minuto").
     * Extracts minute-level records and aggregates them into hourly buckets.
     *
     * @param  array<int, array<int, string>>  $rows
     * @return array{
     *     minutes: array<int, array<string, mixed>>,
     *     hourly: array<int, array<string, mixed>>,
     *     max_entered: int,
     *     max_exited: int
     * }
     */
    protected function parseFirstSheetRecords(array $rows): array
    {
        if (empty($rows)) {
            return ['minutes' => [], 'hourly' => [], 'max_entered' => 0, 'max_exited' => 0];
        }

        $dateCol = null;
        $timeCol = null;
        $cameraCol = null;
        $configCol = null;
        $enteredCol = null;
        $exitedCol = null;
        $changeEnteredCol = null;
        $changeExitedCol = null;
        $headerRowIdx = null;

        // 1. Identify columns from header row
        foreach ($rows as $rIdx => $r) {
            foreach ($r as $cIdx => $cellText) {
                $rawClean = mb_strtolower(trim((string) $cellText), 'UTF-8');
                $clean = str_replace(['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'], ['a', 'e', 'i', 'o', 'u', 'u', 'n'], $rawClean);

                // Cambio de entradas (must check before 'entra')
                if ($changeEnteredCol === null && (
                    str_contains($clean, 'cambio de entra') ||
                    str_contains($clean, 'cambio entra') ||
                    str_contains($clean, 'delta entra') ||
                    str_contains($clean, 'diff entra') ||
                    str_contains($clean, 'cambio_entra') ||
                    str_contains($clean, 'suma neta') ||
                    str_contains($clean, 'aporte')
                )) {
                    $changeEnteredCol = $cIdx;
                    $headerRowIdx = $rIdx;
                    continue;
                }

                // Cambio de salidas (must check before 'sali')
                if ($changeExitedCol === null && (
                    str_contains($clean, 'cambio de sali') ||
                    str_contains($clean, 'cambio sali') ||
                    str_contains($clean, 'delta sali') ||
                    str_contains($clean, 'diff sali') ||
                    str_contains($clean, 'cambio_sali')
                )) {
                    $changeExitedCol = $cIdx;
                    continue;
                }

                // Fecha / Timestamp
                if ($dateCol === null && (
                    str_contains($clean, 'fech') ||
                    str_contains($clean, 'date') ||
                    str_contains($clean, 'timestamp')
                )) {
                    $dateCol = $cIdx;
                    $headerRowIdx = $rIdx;
                }

                // Hora / Time
                if ($timeCol === null && (
                    str_contains($clean, 'hora') ||
                    str_contains($clean, 'hour') ||
                    str_contains($clean, 'tiempo') ||
                    str_contains($clean, 'time')
                )) {
                    $timeCol = $cIdx;
                }

                // Cámara / Camera
                if ($cameraCol === null && (
                    str_contains($clean, 'cám') ||
                    str_contains($clean, 'cam') ||
                    str_contains($clean, 'acceso') ||
                    str_contains($clean, 'dispositivo') ||
                    str_contains($clean, 'puerta')
                )) {
                    $cameraCol = $cIdx;
                }

                // Configuración
                if ($configCol === null && (
                    str_contains($clean, 'config') ||
                    str_contains($clean, 'rol') ||
                    str_contains($clean, 'tipo')
                )) {
                    $configCol = $cIdx;
                }

                // Entraron / Entered
                if ($enteredCol === null && (
                    str_contains($clean, 'entra') ||
                    str_contains($clean, 'ingres') ||
                    $clean === 'enter'
                )) {
                    $enteredCol = $cIdx;
                }

                // Salieron / Exited
                if ($exitedCol === null && (
                    str_contains($clean, 'sali') ||
                    str_contains($clean, 'exit')
                )) {
                    $exitedCol = $cIdx;
                }
            }

            if ($dateCol !== null && ($enteredCol !== null || $changeEnteredCol !== null)) {
                break;
            }
        }

        // Fallbacks if no header detected
        if ($dateCol === null) {
            $dateCol = 0;
        }
        if ($timeCol === null) {
            $timeCol = count($rows[0] ?? []) >= 2 ? 1 : 0;
        }
        if ($enteredCol === null) {
            $enteredCol = count($rows[0] ?? []) >= 5 ? 4 : (count($rows[0] ?? []) >= 4 ? 3 : 1);
        }

        $startIdx = ($headerRowIdx !== null) ? $headerRowIdx + 1 : 0;
        $minuteRecords = [];
        $lastEnteredByCam = [];
        $lastExitedByCam = [];
        $maxEntered = 0;
        $maxExited = 0;

        for ($i = $startIdx; $i < count($rows); $i++) {
            $row = $rows[$i];
            $rawDate = $row[$dateCol] ?? '';
            $rawTime = ($timeCol !== null) ? ($row[$timeCol] ?? '') : '';

            if ($rawDate === '' && $rawTime === '') {
                continue;
            }

            // Skip total/summary rows
            if (str_contains(strtolower($rawDate), 'total') ||
                str_contains(strtolower($rawTime), 'total') ||
                str_contains(strtolower($row[0] ?? ''), 'total') ||
                str_contains(strtolower($row[1] ?? ''), 'total')) {
                continue;
            }

            $parsed = $this->parseDateTimeComponents($rawDate, $rawTime);
            if (! $parsed) {
                continue;
            }

            $dateStr = $parsed['date'];
            $timeStr = $parsed['time'];
            $hourSlot = $parsed['hour'];
            $dateTimeStr = $parsed['datetime'];

            $camera = ($cameraCol !== null && ! empty($row[$cameraCol])) ? trim($row[$cameraCol]) : 'Acceso 2';
            $config = ($configCol !== null && ! empty($row[$configCol])) ? trim($row[$configCol]) : 'Entrada';

            $rawEntered = ($enteredCol !== null) ? ($row[$enteredCol] ?? '0') : '0';
            $entered = (int) preg_replace('/[^0-9]/', '', (string) $rawEntered);

            $rawExited = ($exitedCol !== null) ? ($row[$exitedCol] ?? '0') : '0';
            $exited = (int) preg_replace('/[^0-9]/', '', (string) $rawExited);

            // Change entered (delta)
            if ($changeEnteredCol !== null && isset($row[$changeEnteredCol]) && $row[$changeEnteredCol] !== '') {
                $changeEntered = (int) trim((string) $row[$changeEnteredCol]);
            } else {
                $prev = $lastEnteredByCam[$camera] ?? null;
                $changeEntered = ($prev !== null) ? max(0, $entered - $prev) : $entered;
            }
            $lastEnteredByCam[$camera] = $entered;

            // Change exited (delta)
            if ($changeExitedCol !== null && isset($row[$changeExitedCol]) && $row[$changeExitedCol] !== '') {
                $changeExited = (int) trim((string) $row[$changeExitedCol]);
            } else {
                $prevEx = $lastExitedByCam[$camera] ?? null;
                $changeExited = ($prevEx !== null) ? max(0, $exited - $prevEx) : $exited;
            }
            $lastExitedByCam[$camera] = $exited;

            if ($entered > $maxEntered) {
                $maxEntered = $entered;
            }
            if ($exited > $maxExited) {
                $maxExited = $exited;
            }

            $minuteRecords[] = [
                'recorded_at' => $dateTimeStr,
                'time_str' => $timeStr,
                'camera' => $camera,
                'configuration' => $config,
                'entered' => $entered,
                'exited' => $exited,
                'change_entered' => $changeEntered,
                'change_exited' => $changeExited,
                'date' => $dateStr,
                'hour' => $hourSlot,
            ];
        }

        // Aggregate into hourly attendance buckets
        $hourlyMap = [];
        foreach ($minuteRecords as $m) {
            $d = $m['date'];
            $cam = $m['camera'];
            $cfg = $m['configuration'];
            $h = $m['hour'];
            $key = "{$d}|{$cam}|{$cfg}|{$h}";

            if (! isset($hourlyMap[$key])) {
                $hourlyMap[$key] = [
                    'date' => $d,
                    'camera' => $cam,
                    'configuration' => $cfg,
                    'hour' => $h,
                    'entered' => 0,
                    'exited' => 0,
                    'contribution' => 0,
                ];
            }

            $hourlyMap[$key]['entered'] += $m['change_entered'];
            $hourlyMap[$key]['exited'] += $m['change_exited'];
        }

        $hourlyRecords = [];
        foreach ($hourlyMap as $hRow) {
            $hRow['entered'] = max(0, $hRow['entered']);
            $hRow['exited'] = max(0, $hRow['exited']);
            $hRow['contribution'] = $hRow['entered'];
            $hourlyRecords[] = $hRow;
        }

        usort($hourlyRecords, fn ($a, $b) => strcmp($a['hour'], $b['hour']));

        return [
            'minutes' => $minuteRecords,
            'hourly' => $hourlyRecords,
            'max_entered' => $maxEntered,
            'max_exited' => $maxExited,
        ];
    }

    /**
     * Parse date, time, and hour components from raw date and time strings.
     *
     * @return array{date: string, time: string, hour: string, datetime: string}|null
     */
    protected function parseDateTimeComponents(string $rawDate, string $rawTime): ?array
    {
        $rawDate = trim($rawDate);
        $rawTime = trim($rawTime);

        // 1. Excel serial date/time float (e.g. 46321.71583333333)
        if (is_numeric($rawDate)) {
            $num = (float) $rawDate;
            if ($num > 30000) {
                $excelDay = (int) floor($num);
                $fraction = $num - $excelDay;
                $dateStr = gmdate('Y-m-d', ($excelDay - 25569) * 86400);

                $totalSec = (int) round($fraction * 86400);
                $h = (int) floor($totalSec / 3600) % 24;
                $m = (int) floor(($totalSec % 3600) / 60);
                $s = $totalSec % 60;

                return [
                    'date' => $dateStr,
                    'time' => sprintf('%02d:%02d', $h, $m),
                    'hour' => sprintf('%02d:00', $h),
                    'datetime' => sprintf('%s %02d:%02d:%02d', $dateStr, $h, $m, $s),
                ];
            }
        }

        // 2. Full timestamp in rawDate: "2026-10-26 17:10:48" or "2026-10-26T17:10:48"
        if (preg_match('/^(\d{4}-\d{2}-\d{2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/', $rawDate, $matches)) {
            $dateStr = $matches[1];
            $h = (int) $matches[2];
            $m = (int) $matches[3];
            $s = isset($matches[4]) ? (int) $matches[4] : 0;

            return [
                'date' => $dateStr,
                'time' => sprintf('%02d:%02d', $h, $m),
                'hour' => sprintf('%02d:00', $h),
                'datetime' => sprintf('%s %02d:%02d:%02d', $dateStr, $h, $m, $s),
            ];
        }

        // 3. DD/MM/YYYY timestamp: "26/10/2026 17:10:48"
        if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/', $rawDate, $matches)) {
            $dateStr = sprintf('%04d-%02d-%02d', $matches[3], $matches[2], $matches[1]);
            $h = (int) $matches[4];
            $m = (int) $matches[5];
            $s = isset($matches[6]) ? (int) $matches[6] : 0;

            return [
                'date' => $dateStr,
                'time' => sprintf('%02d:%02d', $h, $m),
                'hour' => sprintf('%02d:00', $h),
                'datetime' => sprintf('%s %02d:%02d:%02d', $dateStr, $h, $m, $s),
            ];
        }

        // 4. Date only in rawDate, time in rawTime
        $dateStr = null;
        if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $rawDate, $dm)) {
            $dateStr = $dm[1];
        } elseif (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/', $rawDate, $dm)) {
            $dateStr = sprintf('%04d-%02d-%02d', $dm[3], $dm[2], $dm[1]);
        }

        $timeStr = null;
        $h = 0;
        $m = 0;
        $s = 0;

        if ($rawTime !== '') {
            if (is_numeric($rawTime)) {
                $numT = (float) $rawTime;
                $frac = $numT - floor($numT);
                $sec = (int) round(($frac > 0 ? $frac : $numT) * 86400);
                $h = (int) floor($sec / 3600) % 24;
                $m = (int) floor(($sec % 3600) / 60);
                $s = $sec % 60;
                $timeStr = sprintf('%02d:%02d', $h, $m);
            } elseif (preg_match('/(\d{1,2}):(\d{2})(?::(\d{2}))?/', $rawTime, $tm)) {
                $h = (int) $tm[1];
                $m = (int) $tm[2];
                $s = isset($tm[3]) ? (int) $tm[3] : 0;
                $timeStr = sprintf('%02d:%02d', $h, $m);
            }
        }

        if ($dateStr !== null) {
            $timeStr = $timeStr ?? '00:00';

            return [
                'date' => $dateStr,
                'time' => $timeStr,
                'hour' => sprintf('%02d:00', $h),
                'datetime' => sprintf('%s %02d:%02d:%02d', $dateStr, $h, $m, $s),
            ];
        }

        return null;
    }
}
