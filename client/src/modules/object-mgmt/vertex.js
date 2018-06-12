import * as d3 from 'd3';
import {
  TYPE_POINT,
  VERTEX_ATTR_SIZE,
  HTML_VERTEX_CONTAINER_CLASS,
  DEFAULT_CONFIG_GRAPH,
  REPEAT_RANGE,
  VERTEX_FORMAT_TYPE,
  POPUP_CONFIG,
  CONNECT_TYPE,
  VERTEX_GROUP_OPTION,
} from '../../const/index';
import _ from "lodash";
import PopUtils from '../../common/utilities/popup.ult';
import {
  generateObjectId,
  replaceSpecialCharacter,
  cancleSelectedPath,
  createPath,
  autoScrollOnMousedrag,
  updateGraphBoundary,
  setMinBoundaryGraph,
  allowInputNumberOnly,
  checkMinMaxValue,
  checkIsMatchRegex,
  comShowMessage,
} from '../../common/utilities/common.ult';
import ColorHash from 'color-hash';

const HTML_VERTEX_INFO_ID = 'vertexInfo';
const HTML_VERTEX_PROPERTIES_ID = 'vertexProperties';
const HTML_VERTEX_FORM_ID = 'vertexForm';
const CONNECT_KEY = 'Connected';
const HTML_GROUP_BTN_DYNAMIC_DATASET = 'groupBtnDynamicDataSet';

class Vertex {
  constructor(props) {
    this.svgSelector = props.svgSelector;
    this.objectUtils = props.objectUtils;
    this.dataContainer = props.dataContainer;
    this.mainMgmt = props.mainMgmt;

    this.handlerDragVertex = d3.drag()
      .on("start", this.dragstarted(this))
      .on("drag", this.dragged(this))
      .on("end", this.dragended(this));

    this.handlerDragConnectPoint = d3.drag()
      .on("start", this.startConnect(this))
      .on("drag", this.drawConnect(this))
      .on("end", this.endConnect(this));

    this.currentId = null;
    this.bindEventForPopupVertex();
    this.colorHash = new ColorHash({lightness: 0.7});
  }

  /**
   * Bind event and init data for controls on popup
   */
  bindEventForPopupVertex() {
    $("#vertexBtnConfirm").click(() => {
      this.confirmEditVertexInfo();
    });

    $("#vertexBtnCancel").click(() => {
      this.closePopVertexInfo();
    });

    // Validate input number
    $("#vertexRepeat").keydown(function (e) {
      allowInputNumberOnly(e);
    });

    $("#isVertexMandatory").change(function () {
      if (this.checked && $("#vertexRepeat").val() < 1) {
        $("#vertexRepeat").val(1);
      }
    });

    $("#vertexRepeat").keydown(function (e) {
      allowInputNumberOnly(e);
    });

    $("#vertexRepeat").focusout(function () {
      let rtnVal = checkMinMaxValue(this.value, $('#isVertexMandatory').prop('checked') == true ? 1 : REPEAT_RANGE.MIN, REPEAT_RANGE.MAX);
      this.value = rtnVal;
    });
  }

  /**
   *
   * @param options
   * vertexType: object, required
   * vertexProperties: object, option
   * interaction: string, option
   * vertexProperties: object, option
   * id: string, option (format V*********)
   * Ex
   */
  createVertex(options) {
    let {x, y, name, description, data, id, parent, mandatory, repeat, isMenu, vertexType, isImport, connectType, groupType} = options;
    // To do: Read or load from config.
    connectType = CONNECT_TYPE.BOTH;

    if (!vertexType)
      return;
    // Deep clone vertex define
    if (isMenu) {
      let info = _.cloneDeep(this.objectUtils.getDataDefineByOption({'vertexType': vertexType}));
      data = info.data;
      description = info.description;
      groupType = info.groupType;
    }
    if (!id)
      id = generateObjectId('V');

    let vertexInfo = {
      x: x,
      y: y,
      vertexType: vertexType,
      name: name || vertexType,
      description: description || "Description",
      data: data || [],
      id: id,
      groupType: groupType,
      parent: parent || null,
      mandatory: mandatory || false,
      repeat: repeat || 1
    };
    this.dataContainer.vertex.push(vertexInfo);

    let group = this.svgSelector.selectAll(`.${HTML_VERTEX_CONTAINER_CLASS}`)
      .data(this.dataContainer.vertex)
      .enter().append("g")
      .attr("transform", `translate(${options.x}, ${options.y})`)
      .attr("id", id)
      .attr("class", `${HTML_VERTEX_CONTAINER_CLASS}`)
      .style("cursor", "default")
      .call(this.handlerDragVertex);

    // Append point connect vertex
    if (connectType)
      group.append("circle")
        .attr("class", "drag_connect connect_header")
        .attr("r", 3)
        .attr("cx", VERTEX_ATTR_SIZE.GROUP_WIDTH / 2)
        .on("mouseover", () => {
          d3.select(d3.event.target).classed("hight-light", true);
          d3.select(d3.event.target).attr("r", 4);
        })
        .on("mouseout", () => {
          d3.select(d3.event.target).classed("hight-light", false);
          d3.select(d3.event.target).attr("r", 3);
        })
        .call(this.handlerDragConnectPoint);

    let htmlContent = '';
    let len = vertexInfo.data.length;
    let presentation = window.vertexPresentation[groupType];
    for (let i = 0; i < len; i++) {
      let data = vertexInfo.data[i];
      htmlContent += `
        <div class="property" prop="${id}${CONNECT_KEY}${i}" style="height: ${VERTEX_ATTR_SIZE.PROP_HEIGHT}px">
          <label class="key" id="${id}${presentation.key}${i}" title="${data[presentation.keyTooltip] || "No data to show"}">${data[presentation.key] || ""}</label><label> : </label>
          <label class="data" id="${id}${presentation.value}${i}" title="${data[presentation.valueTooltip] || "No data to show"}">${data[presentation.value] || ""}</label>
        </div>`;

      // Input
      if (connectType === CONNECT_TYPE.BOTH || connectType === CONNECT_TYPE.LEFT)
        group.append("circle")
          .attr("class", "drag_connect")
          .attr("prop", `${id}${CONNECT_KEY}${i}`)
          .attr("type", TYPE_POINT.INPUT)
          .attr("r", 3)
          .attr("cy", VERTEX_ATTR_SIZE.HEADER_HEIGHT + VERTEX_ATTR_SIZE.PROP_HEIGHT * i + VERTEX_ATTR_SIZE.PROP_HEIGHT / 2)
          .on("mouseover", () => {
            d3.select(d3.event.target).classed("hight-light", true);
            d3.select(d3.event.target).attr("r", 4);
          })
          .on("mouseout", () => {
            d3.select(d3.event.target).classed("hight-light", false);
            d3.select(d3.event.target).attr("r", 3);
          })
          .call(this.handlerDragConnectPoint);

      // Output
      if (connectType === CONNECT_TYPE.BOTH || connectType === CONNECT_TYPE.RIGHT)
        group.append("circle")
          .attr("class", "drag_connect")
          .attr("prop", `${id}${CONNECT_KEY}${i}`)
          .attr("type", TYPE_POINT.OUTPUT)
          .attr("r", 3)
          .attr("cx", VERTEX_ATTR_SIZE.GROUP_WIDTH)
          .attr("cy", VERTEX_ATTR_SIZE.HEADER_HEIGHT + VERTEX_ATTR_SIZE.PROP_HEIGHT * i + VERTEX_ATTR_SIZE.PROP_HEIGHT / 2)
          .on("mouseover", () => {
            d3.select(d3.event.target).classed("hight-light", true);
            d3.select(d3.event.target).attr("r", 4);
          })
          .on("mouseout", () => {
            d3.select(d3.event.target).classed("hight-light", false);
            d3.select(d3.event.target).attr("r", 3);
          })
          .call(this.handlerDragConnectPoint);
    }

    let vertexHeight = VERTEX_ATTR_SIZE.HEADER_HEIGHT + VERTEX_ATTR_SIZE.PROP_HEIGHT * len;

    group.append("foreignObject")
      .attr("width", VERTEX_ATTR_SIZE.GROUP_WIDTH)
      .attr("height", vertexHeight)
      .append("xhtml:div")
      .attr("class", "vertex_content")
      .html(`
        <p class="header_name" id="${id}Name" title="${vertexInfo.description}" 
        style="height: ${VERTEX_ATTR_SIZE.HEADER_HEIGHT}px; background-color: ${this.colorHash.hex(vertexInfo.name)}">${vertexInfo.name}</p>
        <div class="vertex_data">
          ${htmlContent}
        </div>
      `);
    if (!isImport) {
      // this.initEventDrag();
      setMinBoundaryGraph(this.dataContainer);
    }
  }

  /**
   * Init event drag for all vertex
   */
  initEventDrag() {
    this.svgSelector.selectAll(`.${HTML_VERTEX_CONTAINER_CLASS}`)
      .data(this.dataContainer.vertex)
      .call(this.handlerDragVertex);
    d3.selectAll(".drag_connect:not(.hide)").call(this.handlerDragConnectPoint)
      .on("mouseover", () => {
        d3.select(d3.event.target).classed("hight-light", true);
        d3.select(d3.event.target).attr("r", 4);
      })
      .on("mouseout", () => {
        d3.select(d3.event.target).classed("hight-light", false);
        d3.select(d3.event.target).attr("r", 3);
      });
  }

  /**
   * Handle event start drag vertex
   * @param d
   */
  dragstarted(self) {
    return (d) => {
      // If selected path to purpose update, but then move vertex then cancle it.
      if (window.udpateEdge)
        cancleSelectedPath();
      // Resize boundary when vertex dragged
      if (!d.parent)
        self.mainMgmt.reSizeBoundaryAsObjectDragged(d);
    }
  }

  /**
   * Handle event move vertex
   * And update position of paths related to this vertex
   * @param d
   */
  dragged(self) {
    return (d) => {
      autoScrollOnMousedrag(d);
      updateGraphBoundary(d);
      // Prevent drag object outside the window
      d.x = d3.event.x < DEFAULT_CONFIG_GRAPH.MIN_OFFSET_X ? DEFAULT_CONFIG_GRAPH.MIN_OFFSET_X : d3.event.x;
      d.y = d3.event.y < DEFAULT_CONFIG_GRAPH.MIN_OFFSET_Y ? DEFAULT_CONFIG_GRAPH.MIN_OFFSET_Y : d3.event.y;
      // Transform group
      d3.select(`#${d.id}`).attr("transform", (d, i) => {
        return "translate(" + [d.x, d.y] + ")"
      });
      self.updatePathConnect(d.id);
    }
  }

  /**
   * Call back when stop drag vertex
   * @param d
   */
  dragended(self) {
    return (d) => {
      if (d.parent) {
        self.mainMgmt.checkDragObjectOutsideBoundary(d);
      } else {
        self.mainMgmt.checkDragObjectInsideBoundary(d, "V");
        self.mainMgmt.resetSizeBoundary();
      }
      setMinBoundaryGraph(self.dataContainer);
    }
  }

  /**
   * Remove vertex element by id
   * @param vertexId
   */
  removeVertex(vertexId) {
    // Remove from DOM
    let vertexInfo = this.objectUtils.getVertexInfoById(vertexId);
    d3.select(`#${vertexId}`).remove();

    if (vertexInfo.parent)
      this.mainMgmt.removeMemberFromBoundary(vertexInfo.parent, vertexId);
    // Remove from data container
    let data = _.remove(this.dataContainer.vertex, (e) => {
      return e.id === vertexId;
    });

    setMinBoundaryGraph(this.dataContainer);

    // Remove all edge relate to vertex
    let relatePaths = this.objectUtils.findEdgeRelateToVertex(vertexId);
    relatePaths.forEach(path => {
      this.mainMgmt.removeEdge(path.id);
    });
  }

  /**
   * Copy vertex selected
   * @param vertexId
   */
  copyVertex(vertexId) {
    let {x, y, name, description, vertexType, data, repeat, mandatory, groupType} = this.objectUtils.cloneVertexInfo(vertexId);
    x = x + VERTEX_ATTR_SIZE.SPACE_COPY;
    y = y + VERTEX_ATTR_SIZE.SPACE_COPY;
    this.createVertex({x, y, name, description, vertexType, data, repeat, mandatory, groupType});
  }

  /**
   * Make popup edit vertex info
   * @param vertexId
   */
  makePopupEditVertex(vertexId) {
    // Use in function updateVertexInfo()
    let {name, description, repeat, mandatory, data, id, groupType} = this.objectUtils.cloneVertexInfo(vertexId);
    // Get vertex group with group type
    let group = _.find(window.vertexGroupType, (g) => {
      return g.groupType === groupType;
    });
    const option = group.option;
    // Set show hide group button dynamic data set
    if(option.indexOf(VERTEX_GROUP_OPTION.DYNAMIC_DATASET) < 0)
      $(`#${HTML_GROUP_BTN_DYNAMIC_DATASET}`).hide();
    else
      $(`#${HTML_GROUP_BTN_DYNAMIC_DATASET}`).show();

    this.currentId = id;
    // Append content to popup
    $(`#vertexName`).val(name);
    $(`#vertexDesc`).val(description);
    $(`#vertexRepeat`).val(repeat);
    $(`#isVertexMandatory`).prop('checked', mandatory);

    // Generate properties vertex
    let keyHeader = window.headerForm[groupType];
    let cols = keyHeader.length;
    let rows = data.length;
    const typeData = window.vertexFormatType[groupType];
    const dataFormat = window.vertexFormat[groupType];

    let $form = $(`#${HTML_VERTEX_PROPERTIES_ID}`).empty();
    let $content = $('<tbody>');
    // Generate header table
    let $headerRow = $('<tr>');
    let $colGroup = $('<colgroup>');
    let $popWidth = 0;
    for (let i = 0; i < cols; i++) {
      let $colHdr = $('<th>').text(this.capitalizeFirstLetter(keyHeader[i]));
      $colHdr.attr('class', 'col_header');
      $colHdr.appendTo($headerRow);

      // Init col in col group
      let prop = keyHeader[i];
      let type = typeData[prop];
      let def = dataFormat[prop];
      let width = this.findLongestContent({data, prop, type, def});
      $popWidth += width;
      let $colWidth = $('<col>').attr('width', width);
      $colWidth.appendTo($colGroup);
    }
    $colGroup.appendTo($form);
    $headerRow.appendTo($content);
    $content.appendTo($form);

    // Generate content table
    for (let i = 0; i < rows; i++) {
      const dataRow = data[i];
      const $row = $('<tr>');
      for (let j = 0; j < cols; j++) {
        let prop = keyHeader[j];
        let type = typeData[prop];
        let val = dataRow[prop];
        let opt = [];

        const $col = $('<td>');
        // Get option if type is array
        if (type === VERTEX_FORMAT_TYPE.ARRAY) {
          opt = dataFormat[prop];
        } else if (type === VERTEX_FORMAT_TYPE.BOOLEAN) {
          $col.attr('class', 'checkbox_center');
        }

        let $control = this.generateControlByType({i, type, val, prop, opt, groupType});
        $control.appendTo($col);
        $col.appendTo($row);
      }
      $row.appendTo($form);
    }

    let options = {
      popupId: HTML_VERTEX_INFO_ID,
      position: 'center',
      width: $popWidth + POPUP_CONFIG.PADDING_CHAR
    }
    PopUtils.metSetShowPopup(options);
  }

  /**
   * Close popup edit vertex info
   */
  closePopVertexInfo() {
    this.currentId = null;
    let options = {popupId: HTML_VERTEX_INFO_ID}
    PopUtils.metClosePopup(options);
  }

  /**
   * Get data vertex change
   */
  confirmEditVertexInfo() {
    // Get data on form
    let form = $(`#${HTML_VERTEX_FORM_ID}`).serializeArray();
    let data = {};
    $(form).each(function (index, obj) {
      data[obj.name] = obj.value;
    });
    data.id = this.currentId;
    this.updateVertexInfo(data);
    this.closePopVertexInfo();
  }

  /**
   * Update vertex info
   * Update value properties
   * Update name, type, ...
   * Update present (DOM)
   */
  updateVertexInfo(forms) {
    const id = forms.id;
    let vertex = this.objectUtils.getVertexInfoById(id);
    // Change name
    vertex.name = forms.vertexName;
    vertex.description = forms.vertexDesc;
    vertex.repeat = forms.vertexRepeat;
    vertex.mandatory = $(`#isVertexMandatory`).prop('checked');
    let header = d3.select(`#${id}Name`);
    let groupType = vertex.groupType;
    header.text(vertex.name).attr('title', vertex.description);
    header.style("background-color", `${this.colorHash.hex(vertex.name)}`);

    // Update properties
    let keyHeader = window.headerForm[groupType];
    let cols = keyHeader.length;
    let data = vertex.data;
    let rows = data.length;
    const typeData = window.vertexFormatType[groupType];
    let presentation = window.vertexPresentation[groupType];
    for (let i = 0; i < rows; i++) {
      const dataRow = data[i];
      for (let j = 0; j < cols; j++) {
        let prop = keyHeader[j];
        let type = typeData[prop];
        if (type === VERTEX_FORMAT_TYPE.BOOLEAN) {
          dataRow[prop] = forms[`${prop}${i}`] ? true : false;
        } else {
          dataRow[prop] = forms[`${prop}${i}`];
        }
      }

      d3.select(`#${replaceSpecialCharacter(`${id}${presentation.key}${i}`)}`)
        .text(dataRow[presentation.key])
        .attr('title', dataRow[presentation.keyTooltip]);
      d3.select(`#${replaceSpecialCharacter(`${id}${presentation.value}${i}`)}`)
        .text(dataRow[presentation.value])
        .attr('title', dataRow[presentation.valueTooltip]);
    }
  }

  /**
   * Call create connect from source to target
   * @param options
   */
  createConnect(options) {
    this.mainMgmt.createEdge(options);
  }

  /**
   * Calculate position of vertex or position of property in vertex
   * @param vertexId: string, required
   * @param prop: string, option, prop of vertex
   * @param type: string, default is O (output)
   * @returns {{x: *, y: *}}
   */
  getCoordinateProperty(id, prop, type) {
    if (!type)
      type = TYPE_POINT.OUTPUT;
    let {x, y} = this.objectUtils.getVertexInfoById(id);
    let axisX = x;
    let axisY = y;

    // If get Coordinate for vertex only
    // if(!prop)
    //   return {x: type === TYPE_POINT.OUTPUT ? axisX + VERTEX_ATTR_SIZE.GROUP_WIDTH : axisX, y: axisY + 2 };
    if (!prop)
      return {x: axisX + VERTEX_ATTR_SIZE.GROUP_WIDTH / 2, y: axisY};

    // Get index prop in object
    let index = this.findIndexPropInVertex(id, prop);
    // Calculate coordinate of prop
    // Get coordinate
    axisY = axisY + VERTEX_ATTR_SIZE.HEADER_HEIGHT + index * VERTEX_ATTR_SIZE.PROP_HEIGHT + VERTEX_ATTR_SIZE.PROP_HEIGHT / 2;
    return {
      x: type === TYPE_POINT.OUTPUT ? axisX + VERTEX_ATTR_SIZE.GROUP_WIDTH : axisX,
      y: axisY
    };
  }

  /**
   * Find and update position connect to vertex when in move
   * @param vertexId
   */
  updatePathConnect(vertexId) {
    let srcPaths = this.objectUtils.findEdgeStartFromVertex(vertexId);
    let desPaths = this.objectUtils.findEdgeConnectToVertex(vertexId);

    srcPaths.forEach(src => {
      let edgeId = src.id;
      let prop = src.source.prop;
      let newPos = this.getCoordinateProperty(vertexId, prop, TYPE_POINT.OUTPUT);
      src.source.x = newPos.x;
      src.source.y = newPos.y;
      let options = {source: src.source};
      this.mainMgmt.updatePathConnect(edgeId, options);
    });

    desPaths.forEach(des => {
      let edgeId = des.id;
      let prop = des.target.prop;
      let newPos = this.getCoordinateProperty(vertexId, prop, TYPE_POINT.INPUT);
      des.target.x = newPos.x;
      des.target.y = newPos.y;
      let options = {target: des.target};
      this.mainMgmt.updatePathConnect(edgeId, options);
    });
  }

  /**
   * Set position for vertex
   * Called in function dragBoundary (Object boundary)
   * @param vertexId
   * @param position
   */
  setVertexPosition(vertexId, position) {
    let {x, y} = position;
    let vertexInfo = this.objectUtils.getVertexInfoById(vertexId);
    vertexInfo.x = x;
    vertexInfo.y = y;
    this.updatePathConnect(vertexId);

    d3.select(`#${vertexId}`).attr("transform", (d, i) => {
      return "translate(" + [x, y] + ")"
    });
  }

  /**
   * The function called from boundary via mainMgmt
   * In case that delete all boundary parent of vertex
   * @param vertexId
   */
  deleteVertex(vertexId) {
    // Remove from DOM
    d3.select(`#${vertexId}`).remove();
    // Remove from data container
    _.remove(this.dataContainer.vertex, (e) => {
      return e.id === vertexId;
    });
    setMinBoundaryGraph(this.dataContainer);
    // Should consider again...
    // Remove all edge relate to vertex
    let relatePaths = this.objectUtils.findEdgeRelateToVertex(vertexId);
    relatePaths.forEach(path => {
      this.mainMgmt.removeEdge(path.id);
    });
  }

  /**
   * Start creation connect
   * @param self
   * @returns {Function}
   */
  startConnect(self) {
    return function (d) {
      window.creatingEdge = true;
      d3.event.sourceEvent.stopPropagation();
      let sourceId = d3.select(d3.event.sourceEvent.target.parentNode).attr("id");
      let prop = d3.select(d3.event.sourceEvent.target).attr("prop");
      const source = self.getCoordinateProperty(sourceId, prop, TYPE_POINT.OUTPUT);
      window.sourceId = sourceId;
      source.vertexId = sourceId;
      source.prop = prop;
      window.sourceNode = source;
    }
  }

  /**
   * Draw connect belong to mouse position
   * @param self
   * @returns {Function}
   */
  drawConnect(self) {
    return function (d) {
      if (window.creatingEdge) {
        let x = d3.mouse(d3.select('svg').node())[0];
        let y = d3.mouse(d3.select('svg').node())[1];
        let pathStr = createPath(window.sourceNode, {x, y});
        d3.select('#dummyPath').attr('d', pathStr);
        d3.select('#dummyPath').style("display", "block");
        let d = {};
        d.id = window.sourceId;
        autoScrollOnMousedrag(d);
        updateGraphBoundary(d);
      }
    }
  }

  /**
   * End creation connect if destination is connect point
   * @param self
   * @returns {Function}
   */
  endConnect(self) {
    return function (d) {
      window.creatingEdge = false;
      let sCircle = d3.select(this);
      let eCircle = d3.select(d3.event.sourceEvent.target);
      if (d3.event.sourceEvent.target.tagName == "circle" && this != d3.event.sourceEvent.target) {
        let targetId = d3.select(d3.event.sourceEvent.target.parentNode).attr("id");
        let prop = d3.select(d3.event.sourceEvent.target).attr("prop");
        const target = self.getCoordinateProperty(targetId, prop, TYPE_POINT.INPUT);
        target.vertexId = targetId;
        target.prop = prop;
        let options = {source: window.sourceNode, target: target};
        self.createConnect(options);
      }
      d3.select('#dummyPath').style("display", "none");
      window.sourceNode = null;
      window.sourceId = null;
      setMinBoundaryGraph(self.dataContainer);
    }
  }

  /**
   * Update position circle connect on vertex
   * @param arrProp
   * @param vertex
   */
  updatePositionConnect(arrProp, vertex, id) {
    for (const prop of arrProp) {
      if (prop != null) {
        let count = this.findIndexPropInVertex(id, prop);
        // To do: Read or load from config.
        let connectType = CONNECT_TYPE.BOTH;
        // Input
        if (connectType === CONNECT_TYPE.BOTH || connectType === CONNECT_TYPE.LEFT)
          vertex.insert("circle", ":first-child")
            .attr("class", "drag_connect reduced")
            .attr("prop", prop)
            .attr("r", 3)
            .attr("cy", VERTEX_ATTR_SIZE.HEADER_HEIGHT + VERTEX_ATTR_SIZE.PROP_HEIGHT * count + VERTEX_ATTR_SIZE.PROP_HEIGHT / 2)
            .on("mouseover", () => {
              d3.select(d3.event.target).classed("hight-light", true);
              d3.select(d3.event.target).attr("r", 4);
            })
            .on("mouseout", () => {
              d3.select(d3.event.target).classed("hight-light", false);
              d3.select(d3.event.target).attr("r", 3);
            })
            .call(this.handlerDragConnectPoint);

        // Output
        if (connectType === CONNECT_TYPE.BOTH || connectType === CONNECT_TYPE.RIGHT)
          vertex.insert("circle", ":first-child")
            .attr("class", "drag_connect reduced")
            .attr("prop", prop)
            .attr("r", 3)
            .attr("cx", VERTEX_ATTR_SIZE.GROUP_WIDTH)
            .attr("cy", VERTEX_ATTR_SIZE.HEADER_HEIGHT + VERTEX_ATTR_SIZE.PROP_HEIGHT * count + VERTEX_ATTR_SIZE.PROP_HEIGHT / 2)
            .on("mouseover", () => {
              d3.select(d3.event.target).classed("hight-light", true);
              d3.select(d3.event.target).attr("r", 4);
            })
            .on("mouseout", () => {
              d3.select(d3.event.target).classed("hight-light", false);
              d3.select(d3.event.target).attr("r", 3);
            })
            .call(this.handlerDragConnectPoint);
      }
    }
  }

  /**
   * Calculate height vertex base properties connectted
   * @param id
   * @param isShowFull used in case vertex just have header.
   * @returns {number}
   */
  resetSizeVertex(isShowFull = false) {
    let vertexes = this.dataContainer.vertex;
    vertexes.forEach(vertex => {
      let exitConnect = false;
      let vertexId = vertex.id;
      // Get all prop that not hide
      let arrProp = d3.select(`#${vertexId}`).selectAll('.property:not(.hide)');
      let tmpArry = arrProp._groups[0];
      // When not any edge connect to properties of vertex,
      // Check exit edge connect to vertex
      if (tmpArry.length < 1)
        exitConnect = this.objectUtils.checkExitEdgeConnectToVertex(vertexId);

      let element = $(`#${vertexId} .vertex_content`);
      element.parent()
        .attr('height', tmpArry.length ?
          VERTEX_ATTR_SIZE.HEADER_HEIGHT + VERTEX_ATTR_SIZE.PROP_HEIGHT * tmpArry.length : isShowFull ?
            VERTEX_ATTR_SIZE.HEADER_HEIGHT : exitConnect ? VERTEX_ATTR_SIZE.HEADER_HEIGHT : VERTEX_ATTR_SIZE.HEADER_HEIGHT);
    });
  }

  /**
   * Generate control with options
   * @param options
   * @returns {*}
   */
  generateControlByType(options) {
    let $control = null;
    const {i, type, val, prop, opt, groupType} = options;
    let defaultVal = window.vertexFormat[groupType][prop];
    switch (type) {
      case VERTEX_FORMAT_TYPE.BOOLEAN:
        $control = $('<input>');
        $control.attr('type', 'checkbox');
        $control.attr('name', `${prop}${i}`);
        $control.prop('checked', typeof(val) == 'boolean' ? val : defaultVal);
        $control.attr("value", val);
        break;
      case VERTEX_FORMAT_TYPE.ARRAY:
        let firstOpt = opt[0];
        $control = $('<select>');
        $control.attr('name', `${prop}${i}`);
        $control.attr('class', 'form-control');
        $.each(opt, (key, value) => {
          $control
            .append($("<option></option>")
              .attr("value", value || firstOpt)
              .prop('selected', value === (val || firstOpt))
              .text(value));
        });
        break;
      case VERTEX_FORMAT_TYPE.NUMBER:
        $control = $('<input>');
        $control.attr('type', 'text');
        $control.attr('name', `${prop}${i}`);
        $control.attr("value", !isNaN(val) ? val : defaultVal);
        $control.attr('class', 'form-control');
        $control
          .on('keydown', function (e) {
            allowInputNumberOnly(e);
          })
          .on('focusout', function (e) {
            if (this.value && !checkIsMatchRegex(this.value)) {
              comShowMessage("Input invalid");
              this.value = "";
            } else {
              if (isNaN(this.value)) {
                comShowMessage("Input invalid");
                this.value = "";
              }
            }
          });
        break;
      default:
        $control = $('<input>');
        $control.attr('type', 'text');
        $control.attr('name', `${prop}${i}`);
        $control.attr("value", val != undefined ? val : defaultVal);
        $control.attr('class', 'form-control');
    }

    return $control;
  }

  /**
   * Upper case first letter
   */
  capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * Find index of prop in vertex properties
   * @param vertexId
   * @param prop
   * @returns {number}
   */
  findIndexPropInVertex(vertexId, prop) {
    // Find index prop in object
    let arrayProp = d3.select(`#${vertexId}`).selectAll('.property:not(.hide)');
    let tmpArry = arrayProp._groups[0];

    let index = 0;
    for (let ele in tmpArry) {
      if (d3.select(tmpArry[ele]).attr('prop') === prop) {
        break;
      }
      index += 1;
    }

    return index;
  }

  findLongestContent(configs) {
    let {data, prop, type, def} = configs;
    let firstRow = data[0];
    let arr = [];

    // If type is boolean or first undefined or firstRow is empty
    if ((type === VERTEX_FORMAT_TYPE.BOOLEAN) || !firstRow)
      return prop.toString().length * POPUP_CONFIG.WIDTH_CHAR + POPUP_CONFIG.PADDING_CHAR;

    //  If object firstRow hasn't it own the specified property
    if (!firstRow.hasOwnProperty(prop)) {
      let lengthProp = prop.toString().length;
      let lengthDef = def.toString().length;
      let type = typeof(def);
      if(type === "object" && Array.isArray(def))
        lengthDef = this.getLongestContentFromArry(def).toString().length;
      return (lengthProp > lengthDef ? lengthProp * POPUP_CONFIG.WIDTH_CHAR : lengthDef * POPUP_CONFIG.WIDTH_CHAR) + POPUP_CONFIG.PADDING_CHAR;
    }

    // From an array of objects, extract value of a property as array
    if (type === VERTEX_FORMAT_TYPE.ARRAY) {
      arr = def;
    } else {
      arr = data.map(e => e[prop]);
    }
    let longest = this.getLongestContentFromArry(arr);
    if (longest.toString().length < prop.toString().length)
      return prop.toString().length * POPUP_CONFIG.WIDTH_CHAR + POPUP_CONFIG.PADDING_CHAR;

    return longest.toString().length * (type === VERTEX_FORMAT_TYPE.ARRAY ? POPUP_CONFIG.WIDTH_CHAR_UPPER : POPUP_CONFIG.WIDTH_CHAR) + POPUP_CONFIG.PADDING_CHAR;
  }

  getLongestContentFromArry(arr) {
    return arr.reduce((a, b) => {
      let firstTmp = a + "";
      let secondTmp = b + "";
      return firstTmp.length > secondTmp.length ? firstTmp : secondTmp;
    });
  }
}

export default Vertex;
