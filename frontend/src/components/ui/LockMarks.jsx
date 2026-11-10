/* Corner brackets and a light sweep on a locked row (styles: .ac-lock in admin-command-live.css) */
export default function LockMarks() {
  return (
    <>
      <i className="ac-lock tl" aria-hidden /><i className="ac-lock tr" aria-hidden />
      <i className="ac-lock bl" aria-hidden /><i className="ac-lock br" aria-hidden />
      <span className="ac-lock-sweep" aria-hidden />
    </>
  );
}
