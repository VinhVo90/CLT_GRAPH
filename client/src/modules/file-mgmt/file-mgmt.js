import {
  HTML_ALGETA_CONTAINER_ID,
  SCREEN_SIZES,
  FILE_MGMT_HEIGHT,
} from '../../const/index';
import {comShowMessage} from '../../common/utilities/common.ult';

const HTML_INPUT_FILE_ID = 'inputFile';
const HTML_OUTPUT_FILE_ID = 'outFile';
const HTML_FILE_TYPE_ID = 'fileType';
const HTML_BTN_EXPORT_FILE_ID = 'btnExportFile';
const HTML_SELECTOR_MODE_GRPH = 'input:radio[name=graphMode]';

class FileMgmt{
  constructor(props){
    this.mainMgmt = props.mainMgmt;
    this.dataContainer = props.dataContainer;
    this.initButtonEvent();
  }

  initButtonEvent(){
    $(`#${HTML_INPUT_FILE_ID}`).change((event) => {
      this.readJsonFile(event);
    });

    $(`#${HTML_BTN_EXPORT_FILE_ID}`).click((event) => {
      this.writeJsonFileGraph();
    });

    $(HTML_SELECTOR_MODE_GRPH).change((event) => {
      let modeGraph = event.target.value;
      this.setGraphMode(modeGraph);
    });
  }

  /**
   * Read content file Vertex Type Definition
   * or  read content file Graph Data Structure
   * @param event
   */
  readJsonFile(event){
    let file = event.target.files[0];
    if(!file)
      return;

    let fileReader = new FileReader();
    fileReader.onload = () => {
      try
      {
        let data = JSON.parse(fileReader.result);
        if($(`#${HTML_FILE_TYPE_ID}`).val() === "VERTEX_TYPE"){
          // Load json data from Vertex Type Definition and append to Menu Vertex
          this.mainMgmt.reloadVertexTypes(data);
        }else{
          // Load json data from Graph Data Structure and draw to Screen
          this.mainMgmt.drawGraphFromData(data);
        }
      }
      catch (ex){
        comShowMessage("Read file error!");
      }
      finally {
        this.clearInputFile();
      }
    }
    fileReader.readAsText(file);
  }

  writeJsonFileGraph(){
    let fileName = $("#outFile").val();
    if(!fileName)
    {
      comShowMessage("Please input file name");
      return;
    }

    this.getContentGraphAsJson().then(content => {
      if(!content)
      {
        comShowMessage("No content to export");
        return;
      }

      let graph = JSON.stringify(content);
      let blob = new Blob([graph], {type: "application/json", charset: "utf-8"});

      if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, fileName);
        return;
      }

      let fileUrl = window.URL.createObjectURL(blob);
      let downLink = $('<a>');
      downLink.attr("download", `${fileName}.json`);
      downLink.attr("href", fileUrl);
      downLink.css("display", "none");
      $("body").append(downLink);
      downLink[0].click();
      downLink.remove();

      this.clearOutFileName();
    });
  }

  getContentGraphAsJson() {
    let dataContent = {vertex: [], edge: [], boundary: [], vertexTypes: {}};

    // Process data to export
    this.dataContainer.vertex.forEach(node => {
      delete node.mainScope;
      dataContent.vertex.push(node);
    });

    dataContent.edge = this.dataContainer.edge;

    this.dataContainer.boundary.forEach(boundary => {
      delete boundary.boundaryScope;
      dataContent.boundary.push(boundary);
    });

    dataContent.vertexTypes = window.vertexTypes;

    return Promise.resolve(dataContent);
  }

  clearInputFile(){
    $(`#${HTML_INPUT_FILE_ID}`).val(null);
  }

  clearOutFileName() {
    $(`#${HTML_OUTPUT_FILE_ID}`).val(null);
  }

  setGraphMode(modeGraph) {
    window.disabledCommand = modeGraph === "S" ? true : false;
  }
}

export default FileMgmt;
