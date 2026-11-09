import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { checkout, quoteTray } from "../api.js";
import { getSession } from "../session.js";
import {
  loadTray, saveTray, toQuoteItems, setQuantity, removeLine, restoreLine,
  linesInStallOrder, lineKey, problemsByKey, formatSgd, toCents,
} from "../tray.js";
import BackCircle from "../components/menu/BackCircle.jsx";
import TrayRow from "../components/menu/TrayRow.jsx";
import MoneyCheck from "../components/menu/MoneyCheck.jsx";
import baoHappy from "../assets/figma/menu/bao-happy.svg";
import blobTray from "../assets/figma/menu/blob-tray.svg";
import "./kidMenu.css";

const QUOTE_DELAY_MS = 300; // wait until the kid stops tapping + / - before asking the server
const UNDO_MS = 5000;

const sgd = (amount) => formatSgd(toCents(amount));

// Kids Figma 06 My tray. The tray itself lives in this browser (tray.js), but every price,
// total and "can I pay?" comes from the server (POST /api/tray/quote), which re-checks
// allergies, Mum's rules and today's money from the database each time the tray changes.
export default function Tray() {
  const { token } = getSession();
  const navigate = useNavigate();
  const [lines, setLines] = useState(() => loadTray(token));
  const [quote, setQuote] = useState(null); // { key, data }: the last good quote, and which tray it priced
  const [problems, setProblems] = useState(null); // Map lineKey -> problem, from a 409
  const [status, setStatus] = useState("loading"); // loading | ready | locked | invalid | error
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [undo, setUndo] = useState(null); // the line just removed, so it can come back
  const [paying, setPaying] = useState(false);
  const [payMessage, setPayMessage] = useState("");

  // The tray as the server sees it. A new key = the tray changed = ask for a new quote.
  const trayKey = JSON.stringify(toQuoteItems(lines));

  useEffect(() => {
    if (lines.length === 0) return undefined;
    let current = true; // ignore an answer for a tray the kid has already changed
    setStatus("loading");
    const timer = setTimeout(() => {
      quoteTray(token, toQuoteItems(lines))
        .then((data) => {
          if (!current) return;
          setQuote({ key: trayKey, data });
          setProblems(null);
          setStatus("ready");
        })
        .catch((err) => {
          if (!current) return;
          if (err.status === 409) {
            // the problems name LINE NUMBERS of the tray we sent, so match them to these lines
            setProblems(problemsByKey(lines, err.body.problems || []));
            setQuote(null); // a price for a tray that can't be ordered would only confuse
            setStatus("locked");
          } else {
            setError(err.message);
            setStatus(err.status === 400 ? "invalid" : "error");
          }
        });
    }, QUOTE_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // trayKey covers every change to `lines` that matters to the server
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, trayKey, retry]);

  // "Undo" disappears by itself after a few seconds
  useEffect(() => {
    if (!undo) return undefined;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  function update(next) {
    setLines(next);
    saveTray(token, next);
    setPayMessage("");
  }

  function removeAt(index) {
    const { lines: next, removed } = removeLine(lines, index);
    update(next);
    setUndo(removed);
  }

  function changeQuantity(index, quantity) {
    if (quantity <= 0) removeAt(index);
    else update(setQuantity(lines, index, quantity));
  }

  function undoRemove() {
    update(restoreLine(lines, undo));
    setUndo(null);
  }

  async function pay() {
    setPaying(true);
    setPayMessage("");
    try {
      // Leroy's checkout prices the tray again on the server (the same priceTray as the quote)
      await checkout(token, toQuoteItems(lines));
      saveTray(token, []);
      navigate("/kid/home"); // 07 Pickup number isn't built yet, so go Home for now
    } catch (err) {
      setPayMessage(err.message);
    } finally {
      setPaying(false);
    }
  }

  const undoToast = undo && (
    <div className="km-undo" role="status">
      <span className="km-undo__text">Removed {undo.line.name}</span>
      <button type="button" className="km-undo__btn" onClick={undoRemove}>Undo</button>
    </div>
  );

  const header = (
    <>
      <img className="blob km-blob km-blob--tray" src={blobTray} width="180" height="180" alt="" aria-hidden="true" />
      <header className="km-row">
        <BackCircle to="/kid/home" back />
        <h1 className="km-tray-title">My tray</h1>
      </header>
    </>
  );

  if (lines.length === 0) {
    return (
      <main className="screen kid km-screen">
        {header}
        <div className="km-empty km-tray-empty">
          <img src={baoHappy} width="72" height="72" alt="" />
          <h2 className="km-h2">Your tray is empty</h2>
          <p>Pick something yummy from a stall!</p>
          <Link to="/kid/home" className="km-big km-big--sun">Find food</Link>
        </div>
        {undoToast}
      </main>
    );
  }

  if (status === "invalid") {
    // e.g. a tray saved by an older version of the app. Nothing the kid can fix row by row.
    return (
      <main className="screen kid km-screen">
        {header}
        <div className="km-empty km-tray-empty">
          <p className="km-lead" role="alert">Something's wrong with your tray. ({error})</p>
          <button type="button" className="km-big km-big--white" onClick={() => update([])}>Empty my tray</button>
        </div>
      </main>
    );
  }

  const fresh = status === "ready" && quote && quote.key === trayKey;
  const busy = status === "loading";
  // the price on each row: the last server quote for that exact dish + extras
  const priced = new Map(
    (quote ? quote.data.stalls.flatMap((s) => s.lines) : []).map((l) => [lineKey(l), sgd(l.lineTotal)])
  );
  const canPay = fresh && quote.data.canPay && !paying;

  return (
    <main className="screen kid km-screen" aria-busy={busy}>
      {header}

      <ul className={`km-tray${busy ? " km-tray--busy" : ""}`} aria-label="Food in my tray">
        {linesInStallOrder(lines).map(({ line, index }) => (
          <TrayRow
            key={lineKey(line)}
            line={line}
            // "…" only while a quote is on its way; after a 409 there is no price to show
            price={priced.get(lineKey(line)) ?? (busy ? "…" : null)}
            problem={problems ? problems.get(lineKey(line)) : null}
            onQuantity={(q) => changeQuantity(index, q)}
            onRemove={() => removeAt(index)}
          />
        ))}
      </ul>

      {status === "locked" && (
        <p className="km-tray-note km-tray-note--problem" role="alert">
          Some food can't be ordered now. Take it out to pay.
        </p>
      )}

      {status === "error" && (
        <div className="km-tray-note km-tray-note--error" role="alert">
          <p>{error}</p>
          <button type="button" className="km-big km-big--white" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      )}

      {quote && status !== "locked" && <MoneyCheck quote={quote.data} busy={!fresh} />}
      {!quote && busy && <p className="km-lead" aria-live="polite">Checking your food money…</p>}

      {fresh && !quote.data.canPay && (
        // Safety rule 4, in kid words. Checkout checks the same thing on the server again.
        <p className="km-tray-note km-tray-note--short" role="status">
          Oops! This is {sgd(quote.data.money.shortBy)} more than your food money today. Take something out to pay.
        </p>
      )}

      {payMessage && <p className="km-tray-note" role="status">{payMessage}</p>}

      <div className="km-bao-says">
        <img src={baoHappy} width="71.5" height="71.5" alt="" />
        <p className="km-bubble">Yum! Snap a pic after you eat 📸</p>
      </div>

      {undoToast}

      <footer className="km-footer">
        <button type="button" className="km-big km-big--mint" onClick={pay} disabled={!canPay} aria-busy={paying}>
          {fresh ? `Pay with my wallet  ·  ${sgd(quote.data.total)}` : "Pay with my wallet"}
        </button>
      </footer>
    </main>
  );
}
