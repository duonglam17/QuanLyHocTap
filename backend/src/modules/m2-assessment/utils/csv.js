function escapeCsvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // Ignore leading control characters when checking for spreadsheet formulas.
  // eslint-disable-next-line no-control-regex
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

async function* toCsvStream(rows) {
  let firstRow = true;
  for await (const row of rows) {
    const line = row.map(escapeCsvCell).join(',');
    yield `${firstRow ? '\uFEFF' : ''}${line}\r\n`;
    firstRow = false;
  }
}

module.exports = { escapeCsvCell, toCsvStream };
