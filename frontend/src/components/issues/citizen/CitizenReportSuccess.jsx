function CitizenReportSuccess({ issueId }) {
  if (!issueId) return null;

  return (
    <div className="success-box" role="status">
      Report filed. Tracking ID {issueId} is now on the command board.
    </div>
  );
}

export default CitizenReportSuccess;