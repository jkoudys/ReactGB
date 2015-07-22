/**
 * Thin-class, showing the main components of the Greenbelt Route app
 */

import MenuPanel from './MenuPanel.jsx';
import RomLoader from './RomLoader.jsx';

import GameStore from '../stores/GameStore.js';

import GameActions from '../actions/GameActions.js';

class GameBoy extends React.Component {
  constructor(props) {
    super();
  }

  componentWillMount() {
    GameStore.addChangeListener(this._onChange.bind(this));
  }

  componentWillUnmount() {
    GameStore.removeChangeListener(this._onChange);
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
