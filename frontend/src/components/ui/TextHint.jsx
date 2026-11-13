import { liveProblem } from "../../utils/textGuard";
import "../../styles/textguard.css";

/* The line under a written field when the text is a keyboard mash or filler.
   Quiet while the text is too short to judge. Pair it with isMash() on the
   send button so nothing like that can be sent. */
export default function TextHint({ text, title = false, className = "" }) {
  const problem = liveProblem(text, { title });
  if (!problem) return null;
  return (
    <p className={`tg-hint ${className}`} role="alert">
      <i aria-hidden>!</i>
      {problem}
    </p>
  );
}
