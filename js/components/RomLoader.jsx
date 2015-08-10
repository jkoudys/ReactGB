import EmuActions from '../actions/EmuActions.js';

class RomLoader extends React.Component {
  handleLoadFile(ev) {
    var file = ev.target.files[0];
    if (!file) {
      return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
      EmuActions.receiveRom(this.result, file.name);
    };

    reader.readAsArrayBuffer(file);
  }

  handleLoadUrl(url) {
    var xhr = new XMLHttpRequest();
    url = '/tests/tetris.gb';
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      EmuActions.receiveRom(this.response, url.substring(url.lastIndexOf('/') + 1));
    };

    xhr.send();
  }

  render() {
    return (
      <section className="romloader">
        <fieldset>
          <div>
            <input type="file" onChange={this.handleLoadFile}>
              <i className="fa fa-folder-open-o" /> Open a File
            </input>
          </div>
          <div onClick={this.handleLoadUrl}>
            <i className="fa fa-globe" /> Open a URL
          </div>
        </fieldset>
      </section>
    );
  }
}

export default RomLoader;
