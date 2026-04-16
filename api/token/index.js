const crypto = require("crypto");

const SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");
const TTL_MS = 30_000; // 30 seconds

module.exports = async function (context, req) {
  const timestamp = Date.now().toString();
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(timestamp)
    .digest("hex");

  context.res = {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    },
    body: JSON.stringify({ t: timestamp, s: sig }),
  };
};

// Shared verification used by lookup
module.exports.verify = function (t, s) {
  if (!t || !s) return false;
  const age = Date.now() - parseInt(t, 10);
  if (isNaN(age) || age < 0 || age > TTL_MS) return false;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(t)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected));
};
