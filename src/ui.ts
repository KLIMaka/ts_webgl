
import UI = require('./modules/ui/ui');

var panel = UI.panel('Header');
  // .pos('200px', '200px');

var info = {
  'X:': 0,
  'Y:': 0,
  'Dist:':0
};

var props = UI.props(Object.keys(info));
panel.append(props);

document.body.onmousemove = (e) => {
  info['X:'] = e.x;
  info['Y:'] = e.y;
  props.refresh(info);
  panel.pos(e.x+20+'', e.y+20+'');
}
document.body.appendChild(panel.elem());
