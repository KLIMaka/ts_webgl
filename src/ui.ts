
import UI = require('./modules/ui/ui');

var panel = UI.panel('Header');
  // .pos('200px', '200px');

var props = UI.props();
var x = UI.label('0');
var y = UI.label('0');
props
  .prop('X:', x)
  .prop('Y:', y);
panel.append(props);

document.body.onmousemove = (e) => {
  x.text(e.x+'');
  y.text(e.y+'');
}
document.body.appendChild(panel.elem());