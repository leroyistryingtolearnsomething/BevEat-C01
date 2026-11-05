// NETS QR sandbox API: the same request/query calls as the NETS QR coursework,
// done on the server so the API key never reaches the browser
const BASE_URL = "https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr";

async function callNets(path, body) {
  if (!process.env.NETS_API_KEY || !process.env.NETS_PROJECT_ID || !process.env.NETS_TXN_ID)
    throw new Error("NETS_API_KEY, NETS_PROJECT_ID and NETS_TXN_ID must be set in backend/.env");

  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.NETS_API_KEY,
      "project-id": process.env.NETS_PROJECT_ID,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`NETS ${path} failed with HTTP ${res.status}`);
  return (await res.json()).result.data;
}

// returns { response_code, txn_status, qr_code (base64 png), txn_retrieval_ref, instruction, ... }
function requestQr(amountInDollars) {
  return callNets("request", {
    txn_id: process.env.NETS_TXN_ID,
    amt_in_dollars: amountInDollars,
    notify_mobile: 0,
  });
}

// timedOut: true once the 5 minute QR window has passed
function queryQr(txnRetrievalRef, timedOut) {
  return callNets("query", {
    txn_retrieval_ref: txnRetrievalRef,
    frontend_timeout_status: timedOut ? 1 : 0,
  });
}

// loose == like the coursework: NETS may send "00"/1 as strings or numbers
const isOk = (data) => data.response_code == "00" && data.txn_status == 1;

module.exports = { requestQr, queryQr, isOk };
