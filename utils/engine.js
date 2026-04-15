export function evaluatePortfolio(portfolio, policies) {
  const actions = [];

  const positions = portfolio.positions?.top || [];

  // Example: Allocation Policy
  const allocPolicy = policies.find(p => p.type === "allocation");

  if (allocPolicy && positions.length > 0) {
    const maxPercent = Number(allocPolicy.value);

    const total = positions.reduce((sum, p) => sum + (p.valueUsd || 0), 0);


    positions.forEach(pos => {
      const percent = (pos.valueUsd / total) * 100;

      if (percent > maxPercent) {
        actions.push({
          type: "rebalance",
          asset: pos.symbol,
          current: percent.toFixed(2),
          limit: maxPercent,
          suggestion: `Reduce ${pos.symbol} allocation`
        });
      }
    });
  }

  return actions;
}