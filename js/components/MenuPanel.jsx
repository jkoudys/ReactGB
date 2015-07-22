class RomInfo extends React.Component {
  render() {
    // ROM name: 0x0134
    var name = 'TETRIS';
    var size = 0xFFFF;
    var filename = 'tetris.gb';
    return (
      <section id="rominfo">
        <h3><i className="fa fa-table" /> {name}</h3>
        <dl>
          <dt>Filename</dt>
          <dd>{filename}</dd>
          <dt>Size</dt>
          <dd>{size + ' bytes'}</dd>
          <dt>Game Code</dt>
          <dd>123</dd>
          <dt>Type</dt>
          <dd>RUMBLE + SRAM</dd>
        </dl>
      </section>
    );
  }
}

class SaveStates extends React.Component {
  render() {
    // TODO: get array from localStorage
    // We'll use the state.id to get its cache key
    var states = [
      {time: Date.now() - 1000, id: 123}
    ];
    // TODO: make sure this only runs when we update the save, since it's expensive
    var fmt = Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric'});

    return (
      <section id="savestates">
        <h3><i className="fa fa-database" /> Save Games</h3>
        <ul>
          {states.map(function(state) {
            return <li><a className="loadstate">{fmt.format(state.time)}</a></li>;
          })}
          <li><a className="newstate">Save New State</a></li>
        </ul>
        <fieldset>
          <button title="Download battery save">
            <i className="fa fa-download" />
          </button>
          <button title="Upload battery save">
            <i className="fa fa-upload" />
          </button>
        </fieldset>
      </section>
    );
  }
}

class EmulatorLog extends React.Component {
  render() {
    var log = [
      {time: 50, message: 'z80 reset'},
      {time: 120, message: 'ROM loaded'}
    ];
    return (
      <section id="emulatorlog">
        <h3><i className="fa fa-list" /> Log</h3>
        <table>
          {log.map(function(entry) {
            return (
              <tr>
                <td>{entry.time + 'ms'}</td>
                <td>{entry.message}</td>
              </tr>
              );
          })}
        </table>
      </section>
    );
  }
}

class MenuPanel extends React.Component {
  constructor() {
    super();
    this.state = {open: (document.body.offsetWidth > 1400), submenu: null};
    this.handleClose = this.handleClose.bind(this);
    this.handleOpen = this.handleOpen.bind(this);
  }

  handleClose() {
    this.setState({open: false});
  }

  handleOpen() {
    this.setState({open: true});
  }

  render() {
    var menuToggle;
    var back;
    if (!this.state.open) {
      menuToggle = <button key="menutoggle" className="menutoggle" onClick={this.handleOpen}><i className="fa fa-chevron-left" /> menu</button>;
    }
    if (this.state.submenu) {
      back = <button key="back" className="back"><i className="fa fa-chevron-left" /></button>
    }
    return (
      <aside className={'menupanel' + (this.state.open ? ' open' : '')}>
        <nav className="controls">
          <h1>Menu</h1>
          <button className="close" onClick={this.handleClose}><i className="fa fa-times" /></button>
          {back}
          {menuToggle}
        </nav>
        <section>
          <section className="submenus">
            <nav>
              <ul>
                <li><i className="fa fa-cogs" /> Debugger</li>
                <li><i className="fa fa-picture-o" /> Tile Browser</li>
              </ul>
            </nav>
          </section>
          <RomInfo />
          <SaveStates />
          <EmulatorLog />
        </section>
      </aside>
    );
  }
}

export default MenuPanel;
