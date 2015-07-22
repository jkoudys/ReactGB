class RomLoader extends React.Component {
  render() {
    return (
      <section className="romloader">
        <fieldset>
          <div>
            <i className="fa fa-folder-open-o" /> Open a File
          </div>
          <div>
            <i className="fa fa-globe" /> Open a URL
          </div>
        </fieldset>
      </section>
    );
  }
}

export default RomLoader;
