<?php
/**
 * Idempotent V1 -> V2 migration for the deployed MIMOS Academy PMS.
 *
 * Required environment variables:
 * V1_DB_HOST, V1_DB_NAME, V1_DB_USER, V1_DB_PASS
 * V2_PB_URL, V2_PB_SUPERUSER_EMAIL, V2_PB_SUPERUSER_PASSWORD
 *
 * Run only after V2 PocketBase migrations have completed.
 */

function envv($name) {
    $v = getenv($name);
    if ($v === false || $v === '') throw new RuntimeException("Missing environment variable: {$name}");
    return $v;
}

$v1 = new PDO(
    'mysql:host=' . envv('V1_DB_HOST') . ';dbname=' . envv('V1_DB_NAME') . ';charset=utf8mb4',
    envv('V1_DB_USER'), envv('V1_DB_PASS'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);
$pbUrl = rtrim(envv('V2_PB_URL'), '/');
$pbToken = null;

function pb($method, $path, $body = null) {
    global $pbUrl, $pbToken;
    $ch = curl_init($pbUrl . $path);
    $headers = ['Content-Type: application/json'];
    if ($pbToken) $headers[] = 'Authorization: ' . $pbToken;
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 90]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    if ($raw === false) throw new RuntimeException(curl_error($ch));
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($raw, true);
    if ($status < 200 || $status >= 300) throw new RuntimeException("PocketBase {$status}: {$raw}");
    return $data;
}

function filterValue($value) {
    return str_replace(['\\', '"'], ['\\\\', '\\"'], trim((string)$value));
}
function findOne($collection, $filter) {
    $q = '?perPage=1&filter=' . rawurlencode($filter);
    $r = pb('GET', '/api/collections/' . $collection . '/records' . $q);
    return $r['items'][0] ?? null;
}
function dateOrEmpty($value) {
    if (!$value) return '';
    $ts = strtotime((string)$value);
    return $ts ? date('Y-m-d', $ts) : '';
}
function safeFloat($v) { return (float)($v ?? 0); }
function safeInt($v) { return (int)($v ?? 0); }

$auth = pb('POST', '/api/collections/_superusers/auth-with-password', [
    'identity' => envv('V2_PB_SUPERUSER_EMAIL'),
    'password' => envv('V2_PB_SUPERUSER_PASSWORD'),
]);
$pbToken = $auth['token'];
$users = pb('GET', '/api/collections/users/records?perPage=200');
$createdBy = $users['items'][0]['id'] ?? null;
if (!$createdBy) throw new RuntimeException('V2 has no application user. Create the bootstrap Super Admin first.');

$clientMap = [];
function clientId($name) {
    global $clientMap, $createdBy;
    $name = trim((string)$name);
    if ($name === '') return '';
    $key = mb_strtolower($name);
    if (isset($clientMap[$key])) return $clientMap[$key];
    $existing = findOne('clients', 'name="' . filterValue($name) . '"');
    if ($existing) return $clientMap[$key] = $existing['id'];
    $r = pb('POST', '/api/collections/clients/records', ['name' => $name, 'status' => 'Active', 'createdBy' => $createdBy]);
    return $clientMap[$key] = $r['id'];
}

function v2Programme($legacyId) { return findOne('programmes', 'v1LegacyId=' . (int)$legacyId); }
function opportunityStage($v1Status) {
    return match ($v1Status) {
        'Contract signed/PO issued' => 'Won',
        'Lost/No-go' => 'Lost',
        'Proposal/Tender submitted' => 'Proposal',
        'Negotiation stage', 'Verbal commitment' => 'Negotiation',
        'Qualified lead/Tender in progress' => 'Qualified',
        default => 'Lead',
    };
}
function supportedInvoiceMethod($value) {
    $allowed = ['HRDCorp Claimable','Self-Pay','ePerolehan','Bank Transfer','Cheque','Online Banking','Credit Card'];
    return in_array($value, $allowed, true) ? $value : 'Self-Pay';
}

$programmes = $v1->query('SELECT * FROM programs ORDER BY id')->fetchAll();
$programmeMap = [];
foreach ($programmes as $p) {
    $existing = v2Programme($p['id']);
    $client = clientId($p['r1_client_name']);
    $code = trim((string)$p['program_code']);
    if ($code === '') $code = 'V1-' . $p['id'];
    $title = trim((string)$p['r2_training_name']) ?: ('Programme ' . $code);
    $totalParticipants = array_sum(array_map('safeInt', [
        $p['r2_participants_wafer_workshop'], $p['r2_participants_wafer_training'],
        $p['r2_participants_fa_workshop'], $p['r2_participants_fa_training'],
        $p['r2_participants_ai_workshop'], $p['r2_participants_ai_training'],
        $p['r2_participants_others_workshop'], $p['r2_participants_others_training'],
    ]));
    $status = $p['overall_status'] === 'complete' ? 'Completed' : ($p['overall_status'] === 'in_progress' ? 'In Progress' : 'On Hold');
    $payload = [
        'client' => $client, 'code' => $code, 'title' => $title,
        'category' => $p['r2_type'] ?: 'In-House', 'trainingType' => $p['r2_type'] ?: '',
        'programmeCategory' => $p['r2_type'] === 'Public Training' ? 'Public' : ($p['r2_type'] === 'Workshop' ? 'Workshop' : 'In-House'),
        'startDate' => dateOrEmpty($p['r2_training_date']), 'endDate' => dateOrEmpty($p['r2_training_date']),
        'status' => $status, 'participants' => $totalParticipants,
        'progress' => $status === 'Completed' ? 100 : ($status === 'In Progress' ? 50 : 0),
        'contractValue' => safeFloat($p['r1_po_value']), 'accountManager' => trim((string)$p['r1_account_manager']),
        'durationDays' => safeInt($p['r2_duration']), 'totalRevenueExclSST' => safeFloat($p['r1_invoice_value']),
        'sstAmount' => safeFloat($p['r1_sst_amount']), 'totalRevenueInclSST' => safeFloat($p['r1_total_charges']),
        'totalCollection' => safeFloat($p['r1_collection_amount']),
        'outstandingAmount' => max(safeFloat($p['r1_total_charges']) - safeFloat($p['r1_collection_amount']), 0),
        'poNo' => trim((string)$p['r1_po_no']), 'v1LegacyId' => safeInt($p['id']),
        'quotationNo' => trim((string)$p['r1_quotation_no']), 'quotationDate' => dateOrEmpty($p['r1_quotation_date']),
        'poDate' => dateOrEmpty($p['r1_po_date']), 'invoiceNo' => trim((string)$p['r1_invoice_no']),
        'invoiceDate' => dateOrEmpty($p['r1_invoice_date']), 'paymentStatusLegacy' => trim((string)$p['r1_payment_status']),
        'paymentMethodLegacy' => trim((string)$p['r1_payment_method']), 'paymentDateLegacy' => dateOrEmpty($p['r1_payment_date']),
        'createdBy' => $createdBy,
    ];
    if ($existing) {
        $programme = pb('PATCH', '/api/collections/programmes/records/' . $existing['id'], $payload);
    } else {
        $programme = pb('POST', '/api/collections/programmes/records', $payload);
    }
    $programmeMap[$p['id']] = $programme['id'];

    // Preserve R2 participant demographics as a training statistics record.
    if (!findOne('training_statistics', 'programme="' . filterValue($programme['id']) . '"')) {
        pb('POST', '/api/collections/training_statistics/records', [
            'programme' => $programme['id'], 'trainingDate' => dateOrEmpty($p['r2_training_date']),
            'trainingName' => $title, 'trainingCategory' => $p['r2_type'] ?: '',
            'workshopCount' => safeInt($p['r2_participants_wafer_workshop']) + safeInt($p['r2_participants_fa_workshop']) + safeInt($p['r2_participants_ai_workshop']) + safeInt($p['r2_participants_others_workshop']),
            'trainingCount' => safeInt($p['r2_participants_wafer_training']) + safeInt($p['r2_participants_fa_training']) + safeInt($p['r2_participants_ai_training']) + safeInt($p['r2_participants_others_training']),
            'totalCount' => $totalParticipants, 'bumiputeraCount' => safeInt($p['r2_bumiputera']), 'nonBumiputeraCount' => safeInt($p['r2_non_bumiputera']),
            'sessionsPlanned' => 1, 'sessionsDelivered' => $status === 'Completed' ? 1 : 0,
            'createdBy' => $createdBy,
        ]);
    }

    if ($p['r1_quotation_no']) {
        $q = findOne('quotations', 'quoteNo="' . filterValue($p['r1_quotation_no']) . '"');
        if (!$q) $q = pb('POST', '/api/collections/quotations/records', [
            'client' => $client, 'programme' => $programme['id'], 'quoteNo' => $p['r1_quotation_no'],
            'programmeTitle' => $title, 'programmeCode' => $code, 'amount' => safeFloat($p['r1_po_value']),
            'status' => 'Accepted', 'issueDate' => dateOrEmpty($p['r1_quotation_date']), 'preparedBy' => $p['r1_account_manager'], 'createdBy' => $createdBy,
        ]);
        pb('PATCH', '/api/collections/programmes/records/' . $programme['id'], ['quotation' => $q['id']]);
    }

    if ($p['r1_po_no']) {
        $po = findOne('purchase_orders', 'poNo="' . filterValue($p['r1_po_no']) . '"');
        if (!$po) $po = pb('POST', '/api/collections/purchase_orders/records', [
            'client' => $client, 'programme' => $programme['id'], 'poNo' => $p['r1_po_no'], 'amount' => safeFloat($p['r1_po_value']),
            'status' => 'Confirmed', 'issueDate' => dateOrEmpty($p['r1_po_date']), 'receivedDate' => dateOrEmpty($p['r1_po_date']), 'createdBy' => $createdBy,
        ]);
        pb('PATCH', '/api/collections/programmes/records/' . $programme['id'], ['po' => $po['id']]);
    }

    if ($p['r1_invoice_no']) {
        $total = safeFloat($p['r1_total_charges']); $paid = safeFloat($p['r1_collection_amount']);
        $statusInv = $paid >= $total && $total > 0 ? 'Paid' : ($paid > 0 ? 'Partial' : 'Unpaid');
        $inv = findOne('invoices', 'invoiceNo="' . filterValue($p['r1_invoice_no']) . '"');
        $payloadInv = [
            'client' => $client, 'programme' => $programme['id'], 'invoiceNo' => $p['r1_invoice_no'], 'description' => $title,
            'amount' => safeFloat($p['r1_invoice_value']), 'paidAmount' => $paid, 'issueDate' => dateOrEmpty($p['r1_invoice_date']),
            'status' => $statusInv, 'amountExcludingSST' => safeFloat($p['r1_invoice_value']), 'sstAmount' => safeFloat($p['r1_sst_amount']),
            'totalAmount' => $total, 'collectionAmount' => $paid, 'outstandingAmount' => max($total - $paid, 0),
            'paymentStatus' => $p['r1_payment_status'] ?: ($paid >= $total && $total > 0 ? 'PAID' : ($paid > 0 ? 'PARTIAL' : 'UNPAID')),
            'paymentMethod' => supportedInvoiceMethod($p['r1_payment_method']), 'paymentDate' => dateOrEmpty($p['r1_payment_date']),
            'accountManager' => $p['r1_account_manager'], 'createdBy' => $createdBy,
        ];
        $inv = $inv ? pb('PATCH', '/api/collections/invoices/records/' . $inv['id'], $payloadInv) : pb('POST', '/api/collections/invoices/records', $payloadInv);
        if ($paid > 0 && !findOne('payments', 'invoice="' . filterValue($inv['id']) . '"')) {
            $method = $p['r1_payment_method'];
            $allowed = ['Bank Transfer','Cheque','Online Banking','Credit Card','HRDCorp Claimable','Self-Pay','ePerolehan'];
            pb('POST', '/api/collections/payments/records', [
                'invoice' => $inv['id'], 'programme' => $programme['id'], 'client' => $client, 'paymentNo' => 'V1-' . $p['id'],
                'amount' => $paid, 'method' => in_array($method, $allowed, true) ? $method : 'Bank Transfer', 'date' => dateOrEmpty($p['r1_payment_date']), 'status' => 'Completed', 'createdBy' => $createdBy,
            ]);
        }
    }
}

$funnel = $v1->query('SELECT * FROM funnel ORDER BY id')->fetchAll();
foreach ($funnel as $f) {
    $client = clientId($f['client']);
    $status = trim((string)$f['status']) ?: 'Early engagement';
    $existing = findOne('opportunities', 'title="' . filterValue($f['project']) . '" && client="' . filterValue($client) . '"');
    $payload = [
        'client' => $client, 'title' => $f['project'], 'value' => safeFloat($f['forecast_value']), 'forecastValue' => safeFloat($f['forecast_value']),
        'stage' => opportunityStage($status), 'opportunityStatus' => $status, 'probability' => safeInt($f['probability']),
        'owner' => '', 'source' => 'V1 Funnel', 'weightedForecast' => safeFloat($f['weighted_value']), 'securedOrderBookValue' => safeFloat($f['po_secured']),
        'sector' => in_array($f['sector'], ['Government','Private','Intercompany'], true) ? $f['sector'] : 'Private',
        'speedToMarket' => $f['speed_to_market'] ?: '', 'remarks' => $f['remarks'] ?: '', 'year' => (int)date('Y'), 'createdBy' => $createdBy,
    ];
    if ($existing) pb('PATCH', '/api/collections/opportunities/records/' . $existing['id'], $payload);
    else pb('POST', '/api/collections/opportunities/records', $payload);
}

echo "V1 -> V2 migration completed successfully.\n";
