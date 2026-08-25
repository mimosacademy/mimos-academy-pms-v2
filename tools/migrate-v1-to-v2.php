<?php
/**
 * V1 -> V2 business-data migration.
 *
 * Required environment:
 *   V1_DB_HOST, V1_DB_NAME, V1_DB_USER, V1_DB_PASS
 *   V2_PB_URL, V2_PB_SUPERUSER_EMAIL, V2_PB_SUPERUSER_PASSWORD
 *
 * This script is intentionally idempotent for the business identifiers that
 * are unique in V2. It does not migrate V1 password hashes.
 */

function envv($name) {
    $value = getenv($name);
    if ($value === false || $value === '') {
        throw new RuntimeException("Missing environment variable: {$name}");
    }
    return $value;
}

$v1Host = envv('V1_DB_HOST');
$v1Name = envv('V1_DB_NAME');
$v1User = envv('V1_DB_USER');
$v1Pass = envv('V1_DB_PASS');
$pbUrl = rtrim(envv('V2_PB_URL'), '/');
$pbEmail = envv('V2_PB_SUPERUSER_EMAIL');
$pbPassword = envv('V2_PB_SUPERUSER_PASSWORD');
$pbToken = '';

function pbRequest($method, $path, $body = null) {
    global $pbUrl, $pbToken;
    $ch = curl_init($pbUrl . $path);
    $headers = ['Content-Type: application/json'];
    if ($pbToken !== '') $headers[] = 'Authorization: ' . $pbToken;
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 60,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES));
    $raw = curl_exec($ch);
    if ($raw === false) throw new RuntimeException(curl_error($ch));
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($raw, true);
    if ($status < 200 || $status >= 300) throw new RuntimeException("PocketBase {$status}: {$raw}");
    return $data;
}

function pbFilterValue($value) {
    return str_replace(['\\', '"'], ['\\\\', '\\"'], trim((string)$value));
}

function pbFindFirst($collection, $filter) {
    $query = http_build_query([
        'perPage' => 1,
        'filter' => $filter,
    ]);
    $result = pbRequest('GET', "/api/collections/{$collection}/records?{$query}");
    return $result['items'][0] ?? null;
}

function pbCreateIfMissing($collection, $filter, array $payload) {
    $existing = pbFindFirst($collection, $filter);
    if ($existing) return $existing;
    return pbRequest('POST', "/api/collections/{$collection}/records", $payload);
}

function stageForV2($v1Stage) {
    return match ($v1Stage) {
        'Early engagement' => 'Lead',
        'Qualified lead/Tender in progress' => 'Qualified',
        'Proposal/Tender submitted' => 'Proposal',
        'Negotiation stage' => 'Negotiation',
        'Verbal commitment', 'Contract signed/PO issued' => 'Won',
        'Lost/No-go' => 'Lost',
        default => 'Lead',
    };
}

try {
    $pdo = new PDO(
        "mysql:host={$v1Host};dbname={$v1Name};charset=utf8mb4",
        $v1User,
        $v1Pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );

    $auth = pbRequest('POST', '/api/collections/_superusers/auth-with-password', [
        'identity' => $pbEmail,
        'password' => $pbPassword,
    ]);
    $pbToken = $auth['token'] ?? '';
    if ($pbToken === '') throw new RuntimeException('PocketBase superuser authentication returned no token.');

    $users = pbRequest('GET', '/api/collections/users/records?perPage=1');
    $createdBy = $users['items'][0]['id'] ?? null;
    if (!$createdBy) throw new RuntimeException('No V2 application user exists.');

    $clientMap = [];
    $clientId = function ($name) use (&$clientMap, $createdBy) {
        $name = trim((string)$name);
        if ($name === '') return '';
        if (isset($clientMap[$name])) return $clientMap[$name];
        $escaped = pbFilterValue($name);
        $existing = pbFindFirst('clients', 'name="' . $escaped . '"');
        if ($existing) return $clientMap[$name] = $existing['id'];
        $record = pbRequest('POST', '/api/collections/clients/records', [
            'name' => $name,
            'status' => 'Active',
            'createdBy' => $createdBy,
        ]);
        return $clientMap[$name] = $record['id'];
    };

    echo "Migrating V1 programmes...\n";
    $programmes = $pdo->query('SELECT * FROM programs ORDER BY id')->fetchAll();

    foreach ($programmes as $p) {
        $code = trim((string)($p['program_code'] ?: ('V1-' . $p['id'])));
        $client = $clientId($p['r1_client_name'] ?? '');
        $participants =
            (int)($p['r2_participants_wafer_workshop'] ?? 0) +
            (int)($p['r2_participants_wafer_training'] ?? 0) +
            (int)($p['r2_participants_fa_workshop'] ?? 0) +
            (int)($p['r2_participants_fa_training'] ?? 0) +
            (int)($p['r2_participants_ai_workshop'] ?? 0) +
            (int)($p['r2_participants_ai_training'] ?? 0) +
            (int)($p['r2_participants_others_workshop'] ?? 0) +
            (int)($p['r2_participants_others_training'] ?? 0);

        $programme = pbCreateIfMissing(
            'programmes',
            'code="' . pbFilterValue($code) . '"',
            [
                'client' => $client,
                'code' => $code,
                'title' => $p['r2_training_name'] ?: ('Programme ' . $code),
                'category' => $p['r2_type'] ?: 'In-House',
                'startDate' => $p['r2_training_date'] ?: '',
                'endDate' => $p['r2_training_date'] ?: '',
                'status' => 'Completed',
                'participants' => $participants,
                'progress' => ($p['overall_status'] ?? '') === 'complete' ? 100 : (($p['overall_status'] ?? '') === 'in_progress' ? 50 : 0),
                'contractValue' => (float)($p['r1_po_value'] ?? 0),
                'trainingType' => $p['r2_type'] ?: '',
                'programmeCategory' => in_array($p['r2_type'] ?? '', ['In-House', 'Public Training', 'Workshop'], true)
                    ? (($p['r2_type'] ?? '') === 'Public Training' ? 'Public' : $p['r2_type'])
                    : 'In-House',
                'accountManager' => $p['r1_account_manager'] ?: '',
                'durationDays' => (int)($p['r2_duration'] ?? 0),
                'totalRevenueExclSST' => (float)($p['r1_invoice_value'] ?? 0),
                'sstAmount' => (float)($p['r1_sst_amount'] ?? 0),
                'totalRevenueInclSST' => (float)($p['r1_total_charges'] ?? 0),
                'totalCollection' => (float)($p['r1_collection_amount'] ?? 0),
                'outstandingAmount' => max((float)($p['r1_total_charges'] ?? 0) - (float)($p['r1_collection_amount'] ?? 0), 0),
                'poNo' => $p['r1_po_no'] ?: '',
                'createdBy' => $createdBy,
            ]
        );

        if (!empty($p['r1_quotation_no'])) {
            $quote = pbCreateIfMissing(
                'quotations',
                'quoteNo="' . pbFilterValue($p['r1_quotation_no']) . '"',
                [
                    'client' => $client,
                    'programme' => $programme['id'],
                    'quoteNo' => $p['r1_quotation_no'],
                    'programmeTitle' => $p['r2_training_name'] ?: '',
                    'programmeCode' => $programme['code'],
                    'amount' => (float)($p['r1_po_value'] ?? 0),
                    'status' => 'Accepted',
                    'issueDate' => $p['r1_quotation_date'] ?: '',
                    'preparedBy' => $p['r1_account_manager'] ?: '',
                    'createdBy' => $createdBy,
                ]
            );
            if (($programme['quotation'] ?? '') !== $quote['id']) {
                $programme = pbRequest('PATCH', '/api/collections/programmes/records/' . $programme['id'], ['quotation' => $quote['id']]);
            }
        }

        if (!empty($p['r1_po_no'])) {
            $po = pbCreateIfMissing(
                'purchase_orders',
                'poNo="' . pbFilterValue($p['r1_po_no']) . '"',
                [
                    'client' => $client,
                    'programme' => $programme['id'],
                    'poNo' => $p['r1_po_no'],
                    'amount' => (float)($p['r1_po_value'] ?? 0),
                    'status' => 'Confirmed',
                    'issueDate' => $p['r1_po_date'] ?: '',
                    'receivedDate' => $p['r1_po_date'] ?: '',
                    'createdBy' => $createdBy,
                ]
            );
            if (($programme['po'] ?? '') !== $po['id']) {
                $programme = pbRequest('PATCH', '/api/collections/programmes/records/' . $programme['id'], ['po' => $po['id']]);
            }
        }

        if (!empty($p['r1_invoice_no'])) {
            $total = (float)($p['r1_total_charges'] ?? 0);
            $paid = (float)($p['r1_collection_amount'] ?? 0);
            $invoice = pbCreateIfMissing(
                'invoices',
                'invoiceNo="' . pbFilterValue($p['r1_invoice_no']) . '"',
                [
                    'client' => $client,
                    'programme' => $programme['id'],
                    'invoiceNo' => $p['r1_invoice_no'],
                    'description' => $p['r2_training_name'] ?: '',
                    'amount' => (float)($p['r1_invoice_value'] ?? 0),
                    'paidAmount' => min(max($paid, 0), max($total, 0)),
                    'issueDate' => $p['r1_invoice_date'] ?: '',
                    'dueDate' => '',
                    'status' => $paid >= $total && $total > 0 ? 'Paid' : ($paid > 0 ? 'Partial' : 'Unpaid'),
                    'amountExcludingSST' => (float)($p['r1_invoice_value'] ?? 0),
                    'sstAmount' => (float)($p['r1_sst_amount'] ?? 0),
                    'totalAmount' => $total,
                    'collectionAmount' => min(max($paid, 0), max($total, 0)),
                    'outstandingAmount' => max($total - $paid, 0),
                    'paymentStatus' => ($p['r1_payment_status'] ?? '') === 'PAID' ? 'PAID' : 'UNPAID',
                    'paymentMethod' => in_array($p['r1_payment_method'] ?? '', ['HRDCorp Claimable', 'Self-Pay', 'ePerolehan'], true) ? $p['r1_payment_method'] : 'Self-Pay',
                    'paymentDate' => $p['r1_payment_date'] ?: '',
                    'accountManager' => $p['r1_account_manager'] ?: '',
                    'createdBy' => $createdBy,
                ]
            );

            if ($paid > 0) {
                pbCreateIfMissing(
                    'payments',
                    'paymentNo="V1-' . pbFilterValue($p['id']) . '"',
                    [
                        'invoice' => $invoice['id'],
                        'programme' => $programme['id'],
                        'client' => $client,
                        'paymentNo' => 'V1-' . $p['id'],
                        'amount' => min(max($paid, 0), max($total, 0)),
                        'method' => in_array($p['r1_payment_method'] ?? '', ['Bank Transfer', 'Cheque', 'Online Banking', 'Credit Card'], true) ? $p['r1_payment_method'] : 'Bank Transfer',
                        'date' => $p['r1_payment_date'] ?: '',
                        'status' => 'Completed',
                        'createdBy' => $createdBy,
                    ]
                );
            }
        }
    }

    echo "Migrating V1 sales funnel...\n";
    $funnel = $pdo->query('SELECT * FROM funnel ORDER BY id')->fetchAll();
    foreach ($funnel as $f) {
        $client = $clientId($f['client'] ?? '');
        $title = trim((string)($f['project'] ?? 'Untitled opportunity'));
        $source = 'V1 Funnel';
        $stage = stageForV2($f['status'] ?? '');
        $forecast = (float)($f['forecast_value'] ?? 0);
        $probability = min(max((int)($f['probability'] ?? 0), 0), 100);
        $weighted = (float)($f['weighted_value'] ?? ($forecast * $probability / 100));

        pbCreateIfMissing(
            'opportunities',
            'title="' . pbFilterValue($title) . '" && source="' . $source . '"',
            [
                'client' => $client,
                'title' => $title,
                'value' => $forecast,
                'stage' => $stage,
                'probability' => $probability,
                'expectedClose' => '',
                'owner' => '',
                'source' => $source,
                'opportunityStatus' => $stage,
                'forecastValue' => $forecast,
                'weightedForecast' => $weighted,
                'securedOrderBookValue' => (float)($f['po_secured'] ?? 0),
                'sector' => in_array($f['sector'] ?? '', ['Government', 'Private'], true) ? $f['sector'] : 'Private',
                'accountManager' => '',
                'salesman' => '',
                'year' => (int)date('Y'),
                'createdBy' => $createdBy,
            ]
        );
    }

    echo "V1 -> V2 migration completed. Review migrated records before switching users over.\n";
} catch (Throwable $error) {
    fwrite(STDERR, "Migration failed: {$error->getMessage()}\n");
    exit(1);
}
?>
