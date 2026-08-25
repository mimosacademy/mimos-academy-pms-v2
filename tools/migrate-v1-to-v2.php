<?php
/**
 * Optional V1 -> V2 data migration.
 *
 * Run on the Hostinger server where V1 MySQL is accessible:
 *
 *   V1_DB_HOST=localhost \
 *   V1_DB_NAME=your_db \
 *   V1_DB_USER=your_user \
 *   V1_DB_PASS='your_password' \
 *   V2_PB_URL=https://api-pms.example.com \
 *   V2_PB_SUPERUSER_EMAIL=... \
 *   V2_PB_SUPERUSER_PASSWORD=... \
 *   php tools/migrate-v1-to-v2.php
 *
 * This migrates business records only. It intentionally does NOT copy V1
 * password hashes. Create/reprovision V2 staff accounts through Super Admin.
 */

function envv($name, $required = true) {
    $v = getenv($name);
    if ($required && ($v === false || $v === '')) {
        fwrite(STDERR, "Missing environment variable: {$name}\n");
        exit(1);
    }
    return $v ?: '';
}

$v1Host = envv('V1_DB_HOST');
$v1Name = envv('V1_DB_NAME');
$v1User = envv('V1_DB_USER');
$v1Pass = envv('V1_DB_PASS');
$pbUrl = rtrim(envv('V2_PB_URL'), '/');
$pbEmail = envv('V2_PB_SUPERUSER_EMAIL');
$pbPassword = envv('V2_PB_SUPERUSER_PASSWORD');

$pdo = new PDO(
    "mysql:host={$v1Host};dbname={$v1Name};charset=utf8mb4",
    $v1User,
    $v1Pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

function pbRequest($method, $path, $body = null) {
    global $pbUrl, $pbToken;
    $ch = curl_init($pbUrl . $path);
    $headers = ['Content-Type: application/json'];
    if (!empty($pbToken)) $headers[] = 'Authorization: ' . $pbToken;
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 60,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    if ($raw === false) throw new RuntimeException(curl_error($ch));
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($raw, true);
    if ($status < 200 || $status >= 300) throw new RuntimeException("PocketBase {$status}: " . $raw);
    return $data;
}

$auth = pbRequest('POST', '/api/collections/_superusers/auth-with-password', [
    'identity' => $pbEmail, 'password' => $pbPassword
]);
$pbToken = $auth['token'];

$users = pbRequest('GET', '/api/collections/users/records?perPage=200');
$createdBy = $users['items'][0]['id'] ?? null;
if (!$createdBy) throw new RuntimeException('No V2 application user exists.');

$clientMap = [];
function clientId($name) {
    global $clientMap, $createdBy;
    $name = trim((string)$name);
    if ($name === '') return '';
    if (isset($clientMap[$name])) return $clientMap[$name];
    $existing = pbRequest('GET', '/api/collections/clients/records?perPage=1&filter=' . rawurlencode('name="' . str_replace('"','\"',$name) . '"'));
    if (!empty($existing['items'])) {
        $clientMap[$name] = $existing['items'][0]['id'];
        return $clientMap[$name];
    }
    $r = pbRequest('POST', '/api/collections/clients/records', [
        'name' => $name, 'status' => 'Active', 'createdBy' => $createdBy
    ]);
    return $clientMap[$name] = $r['id'];
}

echo "Migrating V1 programs...\n";
$programs = $pdo->query("SELECT * FROM programs ORDER BY id")->fetchAll();
$programmeMap = [];

foreach ($programs as $p) {
    $client = clientId($p['r1_client_name']);
    $programme = pbRequest('POST', '/api/collections/programmes/records', [
        'client' => $client,
        'code' => $p['program_code'] ?: ('V1-' . $p['id']),
        'title' => $p['r2_training_name'] ?: ('Programme ' . ($p['program_code'] ?: $p['id'])),
        'category' => $p['r2_type'] ?: 'In-House',
        'startDate' => $p['r2_training_date'] ?: '',
        'endDate' => $p['r2_training_date'] ?: '',
        'status' => 'Completed',
        'participants' => (int)$p['r2_participants_wafer_workshop'] + (int)$p['r2_participants_wafer_training'] +
                          (int)$p['r2_participants_fa_workshop'] + (int)$p['r2_participants_fa_training'] +
                          (int)$p['r2_participants_ai_workshop'] + (int)$p['r2_participants_ai_training'] +
                          (int)$p['r2_participants_others_workshop'] + (int)$p['r2_participants_others_training'],
        'progress' => $p['overall_status'] === 'complete' ? 100 : ($p['overall_status'] === 'in_progress' ? 50 : 0),
        'contractValue' => (float)$p['r1_po_value'],
        'trainingType' => $p['r2_type'] ?: '',
        'programmeCategory' => in_array($p['r2_type'], ['In-House','Public Training','Workshop']) ? ($p['r2_type'] === 'Public Training' ? 'Public' : $p['r2_type']) : 'In-House',
        'accountManager' => $p['r1_account_manager'] ?: '',
        'durationDays' => (int)($p['r2_duration'] ?: 0),
        'totalRevenueExclSST' => (float)$p['r1_invoice_value'],
        'sstAmount' => (float)$p['r1_sst_amount'],
        'totalRevenueInclSST' => (float)$p['r1_total_charges'],
        'totalCollection' => (float)$p['r1_collection_amount'],
        'outstandingAmount' => max((float)$p['r1_total_charges'] - (float)$p['r1_collection_amount'], 0),
        'poNo' => $p['r1_po_no'] ?: '',
        'createdBy' => $createdBy,
    ]);
    $programmeMap[$p['id']] = $programme['id'];

    if (!empty($p['r1_quotation_no'])) {
        $q = pbRequest('POST', '/api/collections/quotations/records', [
            'client' => $client, 'programme' => $programme['id'],
            'quoteNo' => $p['r1_quotation_no'], 'programmeTitle' => $p['r2_training_name'] ?: '',
            'programmeCode' => $programme['code'], 'amount' => (float)$p['r1_po_value'],
            'status' => 'Accepted', 'issueDate' => $p['r1_quotation_date'] ?: '',
            'preparedBy' => $p['r1_account_manager'] ?: '', 'createdBy' => $createdBy
        ]);
        pbRequest('PATCH', '/api/collections/programmes/records/' . $programme['id'], ['quotation' => $q['id']]);
    }

    if (!empty($p['r1_po_no'])) {
        $po = pbRequest('POST', '/api/collections/purchase_orders/records', [
            'client' => $client, 'programme' => $programme['id'],
            'poNo' => $p['r1_po_no'], 'amount' => (float)$p['r1_po_value'],
            'status' => 'Confirmed', 'issueDate' => $p['r1_po_date'] ?: '',
            'receivedDate' => $p['r1_po_date'] ?: '', 'createdBy' => $createdBy
        ]);
        pbRequest('PATCH', '/api/collections/programmes/records/' . $programme['id'], ['po' => $po['id']]);
    }

    if (!empty($p['r1_invoice_no'])) {
        $total = (float)$p['r1_total_charges'];
        $paid = (float)$p['r1_collection_amount'];
        $status = $paid >= $total && $total > 0 ? 'Paid' : ($paid > 0 ? 'Partial' : 'Unpaid');
        $inv = pbRequest('POST', '/api/collections/invoices/records', [
            'client' => $client, 'programme' => $programme['id'],
            'invoiceNo' => $p['r1_invoice_no'], 'description' => $p['r2_training_name'] ?: '',
            'amount' => (float)$p['r1_invoice_value'], 'paidAmount' => $paid,
            'issueDate' => $p['r1_invoice_date'] ?: '', 'dueDate' => '',
            'status' => $status, 'amountExcludingSST' => (float)$p['r1_invoice_value'],
            'sstAmount' => (float)$p['r1_sst_amount'], 'totalAmount' => $total,
            'collectionAmount' => $paid, 'outstandingAmount' => max($total - $paid, 0),
            'paymentStatus' => $p['r1_payment_status'] === 'PAID' ? 'PAID' : 'UNPAID',
            'paymentMethod' => in_array($p['r1_payment_method'], ['HRDCorp Claimable','Self-Pay','ePerolehan']) ? $p['r1_payment_method'] : 'Self-Pay',
            'paymentDate' => $p['r1_payment_date'] ?: '', 'accountManager' => $p['r1_account_manager'] ?: '',
            'createdBy' => $createdBy
        ]);
        if ($paid > 0) {
            pbRequest('POST', '/api/collections/payments/records', [
                'invoice' => $inv['id'], 'programme' => $programme['id'], 'client' => $client,
                'paymentNo' => 'V1-' . $p['id'], 'amount' => $paid,
                'method' => in_array($p['r1_payment_method'], ['Bank Transfer','Cheque','Online Banking','Credit Card']) ? $p['r1_payment_method'] : 'Bank Transfer',
                'date' => $p['r1_payment_date'] ?: '', 'status' => 'Completed', 'createdBy' => $createdBy
            ]);
        }
    }
}

echo "Migrating V1 sales funnel...\n";
$funnel = $pdo->query("SELECT * FROM funnel ORDER BY id")->fetchAll();
foreach ($funnel as $f) {
    $client = clientId($f['client']);
    $weighted = (float)$f['weighted_value'];
    $forecast = (float)$f['forecast_value'];
    $prob = (int)$f['probability'];
    $status = $f['status'];
    $stage = $status;
    if (!in_array($stage, ['Early engagement','Qualified lead/Tender in progress','Proposal/Tender submitted','Negotiation stage','Verbal commitment','Contract signed/PO issued','Lost/No-go'])) {
        $stage = 'Early engagement';
    }
    pbRequest('POST', '/api/collections/opportunities/records', [
        'client' => $client, 'title' => $f['project'], 'value' => $forecast,
        'stage' => $stage, 'probability' => $prob, 'expectedClose' => '',
        'owner' => '', 'source' => 'V1 Funnel', 'opportunityStatus' => $stage,
        'forecastValue' => $forecast, 'weightedForecast' => $weighted,
        'securedOrderBookValue' => (float)$f['po_secured'],
        'sector' => in_array($f['sector'], ['Government','Private']) ? $f['sector'] : 'Private',
        'accountManager' => '', 'salesman' => '', 'year' => (int)date('Y'),
        'createdBy' => $createdBy
    ]);
}

echo "V1 -> V2 migration completed. Review records in V2 before switching users over.\n";
?>
