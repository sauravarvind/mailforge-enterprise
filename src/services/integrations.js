const enterprise = require('./enterprise');

module.exports = {
  getIntegrations: enterprise.getIntegrations,
  getIntegration: enterprise.getIntegration,
  createIntegration: enterprise.createIntegration,
  updateIntegration: enterprise.updateIntegration,
  syncIntegration: enterprise.syncIntegration,
  deleteIntegration: enterprise.deleteIntegration
};
