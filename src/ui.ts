
import UI = require('./modules/ui/ui');

var panel = UI.panel('Header')
  .width('200px')
  .pos('200px', '200px');

document.body.appendChild(panel.elem());