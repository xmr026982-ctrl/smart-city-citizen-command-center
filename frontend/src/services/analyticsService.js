export const analyticsService = {
  countBy(issues, key) {
    return issues.reduce((acc, issue) => {
      const value = issue[key] || "unknown";
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  },
};