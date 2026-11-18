import { parentPort, workerData } from 'node:worker_threads';

const REQUIRED_HEADERS = [
    'isuId',
    'fio',
    'stGroup',
    'dormitoryNumber',
    'room',
    'dateOfPlacement',
    'isNotRussian',
];

function detectDelimiter(text) {
    let inQuotes = false;
    let commas = 0;
    let semicolons = 0;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (!inQuotes) {
            if (ch === ',') commas++;
            else if (ch === ';') semicolons++;
            else if (ch === '\n' || ch === '\r') break;
        }
    }
    return semicolons > commas ? ';' : ',';
}

function parseCsvRows(rawText) {
    const text = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;
    const delimiter = detectDelimiter(text);

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let currentLine = 1;
    let rowStartLine = 1;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                currentField += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                if (ch === '\r' && next === '\n') {
                    currentField += '\n';
                    currentLine++;
                    i++;
                } else if (ch === '\n' || ch === '\r') {
                    currentField += '\n';
                    currentLine++;
                } else {
                    currentField += ch;
                }
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === delimiter) {
                currentRow.push(currentField);
                currentField = '';
            } else if (ch === '\r' && next === '\n') {
                currentRow.push(currentField);
                rows.push({ lineNumber: rowStartLine, values: currentRow });
                currentRow = [];
                currentField = '';
                currentLine++;
                rowStartLine = currentLine;
                i++;
            } else if (ch === '\n' || ch === '\r') {
                currentRow.push(currentField);
                rows.push({ lineNumber: rowStartLine, values: currentRow });
                currentRow = [];
                currentField = '';
                currentLine++;
                rowStartLine = currentLine;
            } else {
                currentField += ch;
            }
        }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push({ lineNumber: rowStartLine, values: currentRow });
    }

    return {
        unclosedQuote: inQuotes,
        rows: rows.filter((r) => !(r.values.length === 1 && r.values[0].trim() === '')),
    };
}

function parseBoolean(val) {
    const normalized = String(val ?? '').trim().toLowerCase();
    if (['true', '1', 'да', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'нет', 'no'].includes(normalized)) return false;
    return null;
}

function isValidIsoDate(val) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
    const date = new Date(`${val}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(val);
}

function validateAndMapRow(rawObj, lineNumber) {
    const rowErrors = [];

    const isuRaw = (rawObj.isuId ?? '').trim();
    const isuId = Number(isuRaw);
    if (!/^\d{6}$/.test(isuRaw) || !Number.isInteger(isuId)) {
        rowErrors.push('поле "isuId" должно быть 6-значным числом');
    }

    const fio = (rawObj.fio ?? '').trim();
    if (!fio) {
        rowErrors.push('поле "fio" не может быть пустым');
    }

    const stGroup = (rawObj.stGroup ?? '').trim();
    if (!stGroup) {
        rowErrors.push('поле "stGroup" не может быть пустым');
    }

    const dormRaw = (rawObj.dormitoryNumber ?? '').trim();
    const dormitoryNumber = Number(dormRaw);
    if (!dormRaw || !Number.isInteger(dormitoryNumber) || dormitoryNumber <= 0) {
        rowErrors.push('поле "dormitoryNumber" должно быть целым положительным числом');
    }

    const roomRaw = (rawObj.room ?? '').trim();
    const room = Number(roomRaw);
    if (!roomRaw || !Number.isInteger(room) || room <= 0) {
        rowErrors.push('поле "room" должно быть целым положительным числом');
    }

    const dateOfPlacement = (rawObj.dateOfPlacement ?? '').trim();
    if (!isValidIsoDate(dateOfPlacement)) {
        rowErrors.push('поле "dateOfPlacement" должно быть датой в формате ГГГГ-ММ-ДД');
    }

    const isNotRussian = parseBoolean(rawObj.isNotRussian);
    if (isNotRussian === null) {
        rowErrors.push('поле "isNotRussian" должно принимать значение true или false');
    }

    const notesRaw = (rawObj.notes ?? '').trim();
    const notes = notesRaw === '' ? null : notesRaw;

    if (rowErrors.length > 0) {
        return {
            ok: false,
            error: `Строка ${lineNumber}: ${rowErrors.join('; ')}`,
        };
    }

    return {
        ok: true,
        student: {
            isuId,
            fio,
            stGroup,
            dormitoryNumber,
            room,
            dateOfPlacement,
            isNotRussian,
            notes,
        },
    };
}

const { csvText } = workerData;
const { unclosedQuote, rows } = parseCsvRows(csvText);

if (rows.length === 0) {
    parentPort.postMessage({
        totalRows: 0,
        validRows: [],
        errors: ['Файл CSV пуст'],
    });
    process.exit(0);
}

const headerValues = rows[0].values.map((h) => h.trim());
const missingHeaders = REQUIRED_HEADERS.filter((reqH) => !headerValues.includes(reqH));

if (missingHeaders.length > 0) {
    parentPort.postMessage({
        totalRows: 0,
        validRows: [],
        errors: [`Строка 1 (заголовки): отсутствуют обязательные колонки: ${missingHeaders.join(', ')}`],
    });
    process.exit(0);
}

const validRows = [];
const errors = [];
const seenIsuInFile = new Map();

if (unclosedQuote) {
    errors.push('Ошибка формата файла: обнаружена незакрытая двойная кавычка');
}

for (let i = 1; i < rows.length; i++) {
    const { lineNumber, values } = rows[i];

    if (values.length > headerValues.length) {
        errors.push(`Строка ${lineNumber}: колонок больше, чем в заголовке (${values.length} вместо ${headerValues.length})`);
        continue;
    }

    const rawObj = {};
    for (let colIdx = 0; colIdx < headerValues.length; colIdx++) {
        rawObj[headerValues[colIdx]] = values[colIdx] ?? '';
    }

    const result = validateAndMapRow(rawObj, lineNumber);
    if (!result.ok) {
        errors.push(result.error);
        continue;
    }

    const { isuId } = result.student;
    if (seenIsuInFile.has(isuId)) {
        errors.push(`Строка ${lineNumber}: дубликат номера ИСУ ${isuId} внутри файла (первый раз в строке ${seenIsuInFile.get(isuId)})`);
        continue;
    }

    seenIsuInFile.set(isuId, lineNumber);
    validRows.push({ lineNumber, student: result.student });
}

parentPort.postMessage({
    totalRows: rows.length - 1,
    validRows,
    errors,
});
