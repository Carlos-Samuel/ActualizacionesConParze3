<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../vendor/autoload.php';
require_once 'ConnectionParametrizacion.php';
require_once 'Connection.php';
require_once 'bootstrap.php';

require_once 'functions/generacionReporte.php';

mysqli_report(MYSQLI_REPORT_OFF);

function respond_ok(array $data): void {
    echo json_encode([
        'ok'   => true,
        'data' => $data,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function respond_error(string $message, int $http = 500): void {
    http_response_code($http);
    echo json_encode([
        'ok'      => false,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $conParam = ConnectionParametrizacion::getInstance()->getConnection();
    $conParam->set_charset('utf8mb4');

    $conProd  = Connection::getInstance()->getConnection();
    $conProd->set_charset('utf8mb4');

    // 1) Parámetros (igual que generarReporteInventario)
    $pEmp = getValorVigenteParametro($conParam, "EMPRESA");
    $pBod = getValorVigenteParametro($conParam, "BODEGA");
    $pPre = getValorVigenteParametro($conParam, "PRECIOS");

    if (!$pEmp || !isset($pEmp['valor'])) throw new RuntimeException("No hay parámetro vigente para EMPRESA");
    if (!$pBod || !isset($pBod['valor'])) throw new RuntimeException("No hay parámetro vigente para BODEGA");
    if (!$pPre || !isset($pPre['valor'])) throw new RuntimeException("No hay parámetro vigente para PRECIOS");

    // Parsear como listas (valores separados por ;)
    $parseLista = static function(string $val): array {
        return array_values(array_filter(array_map('trim', explode(';', $val)), fn($v) => $v !== ''));
    };

    $empCodes = $parseLista((string)$pEmp['valor']);
    $bodCodes = $parseLista((string)$pBod['valor']);
    $preCodes = $parseLista((string)$pPre['valor']);

    if (empty($empCodes)) throw new RuntimeException("El parámetro EMPRESA no contiene ningún valor.");
    if (empty($bodCodes)) throw new RuntimeException("El parámetro BODEGA no contiene ningún valor.");
    if (empty($preCodes)) throw new RuntimeException("El parámetro PRECIOS no contiene ningún valor.");

    $empIds = array_map('intval', $empCodes);
    $preIds = array_map('intval', $preCodes);

    // 2) DBF filtrado para sacar codes (múltiples bodegas)
    $dbfData = leerDbfFiltrado($bodCodes);
    $codes   = $dbfData['codes'] ?? [];

    if (empty($codes)) {
        respond_ok([]); // tabla vacía
    }

    // 3) Obtener productos por código (múltiples empresas y listas de precios)
    $productosMap = obtenerProductosPorCodigo($conProd, $codes, $conParam, $empIds, $preIds);

    // 4) Armar salida para DataTable
    $rows = [];
    foreach ($productosMap as $procod => $p) {
        $rows[] = [
            'pronom'        => $p['pronom'] ?? null,
            'proprecio'        => $p['proprecio'] ?? null,
            'procod'        => $p['procod'] ?? null,
            'procod_env'    => $p['procod_env'] ?? null,
            'undequ'        => $p['undequ'] ?? null,
        ];
    }

    respond_ok($rows);

} catch (Throwable $e) {
    respond_error($e->getMessage(), 500);
}
