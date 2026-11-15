import Icon from "./Icon.jsx";
import TransitionLink from "./TransitionLink.jsx";

// arrive: { selector: name } on the page this goes back to, so a hero can shrink into its card (see TransitionLink)
export default function BackButton({ to, label = "Back", arrive }) {
  return (
    <TransitionLink to={to} kind="back" arrive={arrive} className="back" aria-label={label}>
      <Icon name="chevronLeft" size={22} />
    </TransitionLink>
  );
}
