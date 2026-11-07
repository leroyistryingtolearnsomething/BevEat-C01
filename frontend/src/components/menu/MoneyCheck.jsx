import { formatSgd, toCents } from "../../tray.js";
import coin20 from "../../assets/figma/menu/coin-20.svg";

// Kids Figma 06 "Money check" card. Every number comes from the server's quote
// (POST /api/tray/quote), never from adding up prices in the browser.
// `busy` = a newer quote is loading, so these numbers are about to change.
export default function MoneyCheck({ quote, busy }) {
  const { money, total, canPay } = quote;
  const sgd = (amount) => formatSgd(toCents(amount));
  return (
    <section className={`km-money${busy ? " km-money--busy" : ""}`} aria-labelledby="km-money-title" aria-busy={busy}>
      <h2 id="km-money-title" className="km-money__title">
        <img src={coin20} width="20" height="20" alt="" />
        Money check
      </h2>
      <dl className="km-money__rows">
        <div className="km-money__row">
          <dt>My food money</dt>
          <dd className="km-money__value">{sgd(money.canSpend)}</dd>
        </div>
        <div className="km-money__row">
          <dt>This tray</dt>
          <dd className="km-money__value km-money__value--minus">− {sgd(total)}</dd>
        </div>
        <div className="km-money__line" aria-hidden="true" />
        <div className="km-money__row km-money__row--total">
          <dt>Left after</dt>
          <dd className={`km-money__left${canPay ? "" : " km-money__left--short"}`}>{sgd(money.leftAfter)}</dd>
        </div>
      </dl>
    </section>
  );
}
