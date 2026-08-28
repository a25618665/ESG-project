function createRiskController(riskService) {
  return {
    async summary(req, res, next) {
      try {
        const riskSummary = await riskService.getRiskSummary();
        res.json({ data: riskSummary });
      } catch (error) {
        next(error);
      }
    },
    async events(req, res, next) {
      try {
        const result = await riskService.getRiskEvents(req.query);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createRiskController };
