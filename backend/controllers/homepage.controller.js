const path = require('path');
const { renderFile } = require('../utils/render');

let userAgent = '';

function getHomepageRoute(req, res) {
  userAgent = req.headers['user-agent'];

  //a function for rendering static files
  renderFile(
    res,
    path.join(__dirname, '..', '..', 'frontend/index.html'),
    'Error rendering homepage'
  );
}

module.exports = { getHomepageRoute, userAgent };
