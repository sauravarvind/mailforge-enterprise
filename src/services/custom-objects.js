const enterprise = require('./enterprise');

module.exports = {
  getCustomObjects: enterprise.getCustomObjects,
  getCustomObject: enterprise.getCustomObject,
  createCustomObject: enterprise.createCustomObject,
  addCustomRecord: enterprise.addCustomRecord,
  deleteCustomObject: enterprise.deleteCustomObject
};
