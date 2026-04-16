const crypto = require("crypto");

// ── Connection-string parser ───────────────────────────────────────────
function parseConnectionString(connStr) {
  const parts = {};
  connStr.split(";").forEach((seg) => {
    const idx = seg.indexOf("=");
    if (idx > -1) parts[seg.substring(0, idx)] = seg.substring(idx + 1);
  });
  return {
    accountName: parts.AccountName,
    accountKey: parts.AccountKey,
    suffix: parts.EndpointSuffix || "core.windows.net",
    protocol: parts.DefaultEndpointsProtocol || "https",
  };
}

// ── Table Storage REST API (SharedKeyLite auth) ────────────────────────
async function getEntity(connStr, table, partitionKey, rowKey) {
  const { accountName, accountKey, suffix, protocol } =
    parseConnectionString(connStr);

  const resource = `${table}(PartitionKey='${partitionKey}',RowKey='${rowKey}')`;
  const url = `${protocol}://${accountName}.table.${suffix}/${resource}`;
  const date = new Date().toUTCString();

  // SharedKeyLite: sign  Date\n/account/resource
  const sig = crypto
    .createHmac("sha256", Buffer.from(accountKey, "base64"))
    .update(`${date}\n/${accountName}/${resource}`, "utf8")
    .digest("base64");

  const res = await fetch(url, {
    headers: {
      "x-ms-date": date,
      "x-ms-version": "2019-02-02",
      Accept: "application/json;odata=nometadata",
      Authorization: `SharedKeyLite ${accountName}:${sig}`,
    },
  });

  if (!res.ok) {
    const err = new Error(`Table Storage ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────
function normalizeDomain(raw) {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .split(":")[0];
}

function domainToRowKey(domain) {
  return domain.replace(/\./g, "|");
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  };
}

// ── Token verification ─────────────────────────────────────────────────
const { verify: verifyToken } = require("../token/index");

// ── Azure Function entry point ─────────────────────────────────────────
module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
    return;
  }

  // Validate token
  const t = req.query.t || "";
  const s = req.query.s || "";
  if (!verifyToken(t, s)) {
    context.res = {
      status: 403,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Forbidden" }),
    };
    return;
  }

  const rawDomain = req.query.domain || (req.body && req.body.domain) || "";
  const domain = normalizeDomain(rawDomain);

  if (!domain || domain.length < 3 || !domain.includes(".")) {
    context.res = {
      status: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Please enter a valid domain (e.g. yourcompany.com)" }),
    };
    return;
  }

  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.log.error("STORAGE_CONNECTION_STRING is not configured.");
    context.res = {
      status: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Service configuration error. Contact support." }),
    };
    return;
  }

  try {
    const entity = await getEntity(
      connectionString,
      "domaincodes",
      "domains",
      domainToRowKey(domain)
    );

    context.res = {
      status: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        domain: domain,
        code: entity.code,
        label: entity.label || null,
      }),
    };
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = {
        status: 404,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "Domain not found. Please verify your entry or contact your administrator.",
        }),
      };
    } else {
      context.log.error("Table Storage error:", err.message);
      context.res = {
        status: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      };
    }
  }
};
