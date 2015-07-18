const tabMagic = {
  _map: {},

  init: function() {
    let l = document.getElementsByTagName('ul');
    for (let i = 0; i < l.length; i++) {
      if (l[i].className.indexOf('tablist') >= 0) {
        let t = l[i].getElementsByTagName('li');
        for (let j = 0; j < t.length; j++) {
          tabMagic._map[t[j].getAttribute('rel')] = l[i].id;
          t[j].onclick = function() {
            tabMagic.sw(this.getAttribute('rel'));
            return false;
          };
        }
        tabMagic.sw(t[0].getAttribute('rel'));
      }
    }
  },

  sw: function(tr) {
    let tl = document.getElementsByTagName('ul');
    for (let li = 0; li < tl.length; li++) {
      if (tl[li].className.indexOf('tablist') >= 0 && tl[li].id == tabMagic._map[tr]) {
        let items = tl[li].getElementsByTagName('li');
        for (let lj = 0; lj < items.length; lj++) {
          if (items[lj].getAttribute('rel') == tr) {
            items[lj].className = 'tab_hi';
            document.getElementById(items[lj].getAttribute('rel')).style.display = 'block';
          } else {
            items[lj].className = 'tab';
            document.getElementById(items[lj].getAttribute('rel')).style.display = 'none';
          }
        }
      }
    }
  }
};

export default tabMagic;
