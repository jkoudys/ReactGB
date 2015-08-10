/**
 * Thin-class, showing the main components of the Greenbelt Route app
 */

import MenuPanel from './MenuPanel.jsx';
import RomLoader from './RomLoader.jsx';

import EmuStore from '../stores/EmuStore.js';

import EmuActions from '../actions/EmuActions.js';

class GameBoy extends React.Component {
  constructor(props) {
    super();
  }

  componentWillMount() {
    EmuStore.addChangeListener(this._onChange.bind(this));
  }

  componentWillUnmount() {
    EmuStore.removeChangeListener(this._onChange);
  }

  _onChange() {
  }

  render() {
    return (
      <section id="gameboy">
        <RomLoader />
        <MenuPanel />
      </section>
    );
  }
}

export default GameBoy;
