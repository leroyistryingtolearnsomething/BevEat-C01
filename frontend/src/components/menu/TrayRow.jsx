import DishPhoto from "./DishPhoto.jsx";
import { lineSubtitle, problemMessage, MAX_QTY } from "../../tray.js";
import minus16 from "../../assets/figma/menu/minus-16.svg";
import plus16 from "../../assets/figma/menu/plus-16.svg";

// One row on Kids Figma 06 "My tray": photo, name, "extras · stall", price, small stepper.
// `price` is the server's line total as text, "…" while it loads, or null when there is none.
// `problem` is set when the server's 409 says this line can't be ordered any more: the row then
// says why and swaps the stepper for a big Remove button.
export default function TrayRow({ line, price, problem, onQuantity, onRemove }) {
  return (
    <li className={`km-tray-row${problem ? " km-tray-row--problem" : ""}`}>
      <DishPhoto src={line.imageUrl} name={line.name} className="km-tray-row__img" />
      <div className="km-tray-row__text">
        <p className="km-tray-row__name">{line.name}</p>
        <p className="km-tray-row__sub">{lineSubtitle(line)}</p>
        {problem ? (
          <p className="km-tray-row__why" role="alert">{problemMessage(problem)}</p>
        ) : (
          price && <p className="km-tray-row__price">{price}</p>
        )}
      </div>

      {problem ? (
        <button type="button" className="km-tray-remove" onClick={onRemove} aria-label={`Remove ${line.name}`}>
          Remove
        </button>
      ) : (
        <div className="km-tray-qty" role="group" aria-label={`How many ${line.name}`}>
          {/* down to 0 is allowed: that takes the dish out (with Undo) */}
          <button type="button" onClick={() => onQuantity(line.quantity - 1)}
            aria-label={line.quantity === 1 ? `Remove ${line.name}` : `One less ${line.name}`}>
            <img src={minus16} width="16" height="16" alt="" />
          </button>
          <span className="km-tray-qty__n" aria-live="polite">{line.quantity}</span>
          <button type="button" onClick={() => onQuantity(line.quantity + 1)} disabled={line.quantity >= MAX_QTY}
            aria-label={`One more ${line.name}`}>
            <img src={plus16} width="16" height="16" alt="" />
          </button>
        </div>
      )}
    </li>
  );
}
