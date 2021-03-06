import Vertex from '../object-mgmt/vertex';
import FileMgmt from '../file-mgmt/file-mgmt';
import MainMenu from '../menu-mgmt/main-menu';
import VertexMenu from '../menu-mgmt/vertex-menu';
import Edge from '../object-mgmt/edge';
import EdgeMenu from '../menu-mgmt/edge-menu';
import Boundary from '../object-mgmt/boundary';
import BoundaryMenu from '../menu-mgmt/boundary-menu';
import BoundaryMenuItems from '../menu-mgmt/boundary-menu-items';
import {
  comShowMessage,
  createPath,
  setSizeGraph,
  setMinBoundaryGraph,
} from '../../common/utilities/common.ult';
import * as d3 from 'd3';
import {
  HTML_ALGETA_CONTAINER_CLASS,
  HTML_VERTEX_CONTAINER_CLASS,
  HTML_EDGE_CONTAINER_CLASS,
  HTML_BOUNDARY_CONTAINER_CLASS,
  BOUNDARY_ATTR_SIZE,
  TYPE_POINT,
  VERTEX_FORMAT_TYPE, COMMON_DATA,
} from '../../const/index';
import _ from "lodash";

class MainMgmt {
  constructor(props) {
    this.svgSelector = props.svgSelector;
    this.objectUtils = props.objectUtils;
    this.dataContainer = props.dataContainer;
    this.initMarkerArrow();
    this.initPathConnect();
    this.initBBoxGroup();
    this.initAreaDrawEdge();
    this.dragPointConnector = d3.drag()
      .on("start", this.dragPointStarted(this))
      .on("drag", this.draggedPoint(this))
      .on("end", this.dragPointEnded(this));

    this.initEdgePath();

    /**
     * Init file mgmt
     */
    new FileMgmt({
      mainMgmt: this,
      dataContainer: this.dataContainer
    });

    /**
     * Init Vertex Mgmt
     * @type {VertexMgmt}
     */
    this.vertex = new Vertex({
      svgSelector: this.svgSelector,
      dataContainer: this.dataContainer,
      objectUtils: this.objectUtils,
      mainMgmt: this
    });

    /**
     * Init Edge Mgmt
     * @type {EdgeMgmt}
     */
    this.edge = new Edge({
      svgSelector: this.svgSelector,
      dataContainer: this.dataContainer,
      objectUtils: this.objectUtils,
      mainMgmt: this
    });

    /**
     * Init Boundary Mgmt
     * @type {BoundaryMgmt}
     */
    this.boundary = new Boundary({
      svgSelector: this.svgSelector,
      dataContainer: this.dataContainer,
      objectUtils: this.objectUtils,
      mainMgmt: this
    });
  }

  /**
   * Init Marker Arrow use for edge
   */
  initMarkerArrow() {
    this.svgSelector.append("svg:defs").append("svg:marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 10)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .style("stroke", "black");
  }

  /**
   * Init path connect used to create path
   */
  initPathConnect() {
    this.svgSelector.append("svg:g").append("svg:path")
      .attr("id", "dummyPath")
      .attr("class", "dummy-edge solid")
      .attr("fill", "none")
      .attr("marker-end", "url(#arrow)");
  }

  /**
   * init area create path
   */
  initAreaDrawEdge() {
    this.svgSelector.append("g")
      .attr("id", "pivotEgde");

  }

  /**
   * Init path use for simulate change source or target connect
   */
  initEdgePath() {
    let groupPoint = this.svgSelector.append("g")
      .attr("id", "groupEdgePoint");
    let group = this.svgSelector.append("g")
      .attr("id", "groupEdgePath");
    group.append("path")
      .attr("id", "edgePath")
      .attr("class", "dummy-path dash")
      .attr("fill", "none")
      .attr("stroke", "#2795EE");
    // .attr("marker-end", "url(#arrow)");

    // Append point to drag start or end connect point
    groupPoint.append("circle")
      .attr("id", "pointStart")
      .attr("class", "dragPoint")
      .attr("type", TYPE_POINT.OUTPUT)
      .attr("fill", "#2795EE")
      .attr("r", 3)
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .attr("stroke", "#2795EE");

    groupPoint.append("circle")
      .attr("id", "pointEnd")
      .attr("class", "dragPoint")
      .attr("type", TYPE_POINT.INPUT)
      .attr("fill", "#2795EE")
      .attr("r", 3)
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .attr("stroke", "#2795EE");

    d3.selectAll('.dragPoint').call(this.dragPointConnector);
    d3.select('#groupEdgePoint').style("display", "none");
  }

  /**
   * Get vertex types and vertex group... when user import
   * For main context and vertex.
   * @param data
   */
  async reloadVertexTypes(data) {
    // Validate structure file invalid
    // Option vertex type definition but choose graph type file
    if (data.vertex || data.edge || data.boundary || data.position || data.vertexTypes) {
      comShowMessage("Invalid structure file vertex type definition");
      return;
    }

    const {VERTEX, VERTEX_GROUP} = data;
    // Set global vertex types
    // The content vertex type on graph alway
    // give to content vertex type was import from Vertex Type Defination
    this.getVertexFormatType(VERTEX_GROUP);
    this.getVertexTypesShowFull(data);
    COMMON_DATA.vertexDefine = data;
    COMMON_DATA.vertexTypes = VERTEX;
    COMMON_DATA.vertexGroup = VERTEX_GROUP;
    COMMON_DATA.isImportVertexTypeDefine = true;

    // Validate vertex type
    let isMisMatch = await this.validateVertexTypesInGraph();

    // Now just show message warning for user. Not stop working
    if (isMisMatch)
      comShowMessage("Vertex type in Vertex Type Definition and Data Graph Structure are mismatch." +
        "\n Please check again!");

    // Init main menu and menu for objects
    this.initMenuContext();
  }

  /**
   * Draw graph with data import by user
   * @param data
   */
  async drawGraphFromData(data) {
    this.clearAll();
    // Validate content
    let errorContent = await this.validateGraphDataStructure(data);
    if (errorContent) {
      comShowMessage("Format or data in Data Graph Structure is corrupted. You should check it!");
      // return;
    }

    // Store vertex types
    const {vertexTypes} = data;
    const {VERTEX, VERTEX_GROUP} = vertexTypes;
    COMMON_DATA.vertexTypesOld = VERTEX;

    // Validate vertex type
    let isMisMatch = await this.validateVertexTypesInGraph();
    // Now just show message warning for user. Not stop working
    if (isMisMatch) {
      comShowMessage("Vertex type in Vertex Type Definition and Data Graph Structure are mismatch." +
        "\n Please check again!");
      // return;
    }

    // If still not import Vertex Type Definition then reset it.
    if (!COMMON_DATA.isImportVertexTypeDefine) {
      this.getVertexFormatType(VERTEX_GROUP);
      this.getVertexTypesShowFull(vertexTypes);
      COMMON_DATA.vertexTypes = VERTEX;
      COMMON_DATA.vertexDefine = vertexTypes;
      COMMON_DATA.vertexGroup = VERTEX_GROUP;
    }

    // Draw boundary
    let arrBoundary = data.boundary;
    arrBoundary.forEach(boundary => {
      let {x, y} = data.position.find(element => {
        return element.id === boundary.id;
      });
      boundary.x = x;
      boundary.y = y;
      boundary.isImport = true;
      this.boundary.createBoundary(boundary);
    });

    // Draw vertex
    let arrVertex = data.vertex;
    arrVertex.forEach(vertex => {
      let {x, y} = data.position.find(element => {
        return element.id === vertex.id;
      });
      vertex.x = x;
      vertex.y = y;
      vertex.isImport = true;
      this.vertex.createVertex(vertex);
    });

    // Draw edge
    let arrEdge = data.edge;
    arrEdge.forEach(edge => {
      this.edge.createEdge(edge);
    });

    // Rescan child of boundary to reset size
    arrBoundary.forEach(boundary => {
      const members = boundary.member;
      members.forEach(mem => {
        if (!mem.show)
          this.boundary.selectMemberVisible(boundary.id, mem, true);
      });
    });

    this.initMenuContext();
    this.updateHeightBoundary();
  }

  /**
   * Validate Graph Data Structure
   * with embedded vertex type
   * Validate content
   */
  async validateGraphDataStructure(data) {
    // Validate struct data
    if (!data.vertex || !data.edge || !data.boundary || !data.position || !data.vertexTypes ||
      (Object.keys(data.vertexTypes).length === 0 && data.vertexTypes.constructor === Object)) {
      return Promise.resolve(true);
    }

    // Validate embedded vertex type with vertices
    let dataTypes = data.vertexTypes['VERTEX'];
    let vertices = this.removeDuplicates(data.vertex, "vertexType");
    let types = this.getListVertexType(dataTypes);
    for (let vertex of vertices) {
      let type = vertex.vertexType;
      // If vertex type not exit in embedded vertex type
      if (types.indexOf(type) < 0) {
        console.log("[Graph Data Structure] Vertex type not exit in embedded vertex type");
        return Promise.resolve(true);
      }

      // Validate data key between embedded vertex and vetex in graph.
      let dataSource = vertex.data;
      let dataTarget = _.find(dataTypes, {'vertexType': type});
      let keySource = Object.keys(dataSource[0] || {});
      let keyTarget = Object.keys(dataTarget.data[0] || {});
      // Check length key
      if (this.checkLengthMisMatch(keySource, keyTarget)) {
        console.log("[Graph Data Structure] Data's length is different");
        return Promise.resolve(true);
      }

      // Check mismatch key
      let flag = await this.checkKeyMisMatch(keySource, keyTarget);

      if (flag) {
        console.log("[Graph Data Structure] Key vertex at source not exit in target");
        return Promise.resolve(true);
      }
    }

    return Promise.resolve(false);
  }

  /**
   * Validate embedded Vertex Types in Graph Data Structure
   * with Vertex Type Definition
   */
  async validateVertexTypesInGraph() {
    if (!COMMON_DATA.vertexTypes || !COMMON_DATA.vertexTypesOld) {
      console.log("Targe or soruce is null");
      return Promise.resolve(false);
    }

    const source = COMMON_DATA.vertexTypes;
    const target = COMMON_DATA.vertexTypesOld;
    const current = this.getListVertexType(source);
    const old = this.getListVertexType(target);
    // Compare length
    if (this.checkLengthMisMatch(current, old)) {
      console.log("[Vertex Type Define] Length is different");
      return Promise.resolve(true);
    }

    // Check key exit
    let lenKey = current.length;
    for (let i = 0; i < lenKey; i++) {
      let type = current[i];
      if (old.indexOf(type) < 0) {
        console.log("Vetex type import don't match with vertex type in graph");
        return Promise.resolve(true);
      }
    }

    // Check data key in every vertex type
    for (let i = 0; i < lenKey; i++) {
      let type = current[i];
      let dataSource = _.find(source, {'vertexType': type});
      let dataTarget = _.find(target, {'vertexType': type});
      let src = Object.keys(dataSource.data[0] || {});
      let tgt = Object.keys(dataTarget.data[0] || {});

      if (this.checkLengthMisMatch(src, tgt)) {
        console.log("Length of vertex element is different");
        return Promise.resolve(true);
      }

      let misMatchKey = await this.checkKeyMisMatch(src, tgt);
      if (misMatchKey) {
        console.log("Key of vertex element is different");
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  /**
   * Check length of source and target is match
   * @param src
   * @param tgt
   * @returns {boolean}
   */
  checkLengthMisMatch(src, tgt) {
    return src.length != tgt.length ? true : false;
  }

  /**
   * Check key of source and target is match
   * @param src
   * @param tgt
   * @returns {boolean}
   */
  checkKeyMisMatch(src, tgt) {
    let misMatch = false;
    src.forEach(key => {
      if (tgt.indexOf(key) < 0) {
        misMatch = true;
      }
    });

    return Promise.resolve(misMatch);
  }

  /**
   * Init context menu on object
   * When read file vertex type
   * Or when read file graph data
   */
  initMenuContext() {
    // Remove old menu dom if exit
    d3.selectAll(".context-menu-list").remove();

    // Main menu
    new MainMenu({
      selector: `.${HTML_ALGETA_CONTAINER_CLASS}`,
      mainMgmt: this
    });

    // Vertex menu
    new VertexMenu({
      selector: `.${HTML_VERTEX_CONTAINER_CLASS}`,
      vertex: this.vertex,
      objectUtils: this.objectUtils,
      dataContainer: this.dataContainer
    });

    // Vertex menu
    new EdgeMenu({
      selector: `.${HTML_EDGE_CONTAINER_CLASS}`,
      edge: this.edge,
    });

    // Boundary menu
    new BoundaryMenu({
      selector: `.${HTML_BOUNDARY_CONTAINER_CLASS}`,
      boundary: this.boundary,
      dataContainer: this.dataContainer
    });

    // Boundary Menu Items
    new BoundaryMenuItems({
      selector: `.${HTML_BOUNDARY_CONTAINER_CLASS}`,
      boundary: this.boundary,
      objectUtils: this.objectUtils
    });
  }

  createVertex(opt) {
    this.vertex.createVertex(opt);
  }

  createEdge(opt) {
    this.edge.createEdge(opt);
  }

  createBoundary(opt) {
    this.boundary.createBoundary(opt);
  }

  updatePathConnect(edgeId, opt) {
    this.edge.updatePathConnect(edgeId, opt);
  }

  /**
   * When a vertex|boundary move
   * Resize if any boundary with size smaller than vertex|boundary size
   */
  reSizeBoundaryAsObjectDragged(infos) {
    // Get box object
    const {height, width} = this.objectUtils.getBBoxObject(infos.id);

    d3.select("svg").selectAll(`.${HTML_BOUNDARY_CONTAINER_CLASS}`).each((d, i, node) => {
      if (d.id != infos.id && !d.parent) {
        let boundaryId = d.id;
        let bBox = this.objectUtils.getBBoxObject(boundaryId);
        if (height >= bBox.height)
          this.boundary.setHeightBoundary(boundaryId, height + 43);
        if (width >= bBox.width)
          this.boundary.setWidthBoundary(boundaryId, width + 15);
      }
    });
  }

  /**
   * Reset size boundary when an boundary|vertex drag end.
   */
  resetSizeBoundary() {
    d3.select("svg").selectAll(`.${HTML_BOUNDARY_CONTAINER_CLASS}`).each((d, i, node) => {
      let orderObject = 0;
      let hBeforeElements = 42;
      let wBoundary = BOUNDARY_ATTR_SIZE.BOUND_WIDTH;
      let marginTop = 5;
      let boundaryId = d.id;
      let boundaryMembers = d.member;

      boundaryMembers.forEach(member => {
        if (member.show) {
          let objectId = member.id;
          const {width, height} = this.objectUtils.getBBoxObject(objectId);
          orderObject++;
          hBeforeElements += height;
          if (width > wBoundary)
            wBoundary = width + (member.type === "B" ? 10 : 0);
        }
      });

      let hBoundary = hBeforeElements + marginTop * orderObject;
      this.boundary.setHeightBoundary(boundaryId, hBoundary);
      this.boundary.setWidthBoundary(boundaryId, wBoundary);
    });
  }

  // Check drag inside boundary
  checkDragObjectInsideBoundary(srcInfos, type) {
    // Get box object
    // Get box object
    const {height, width} = this.objectUtils.getBBoxObject(srcInfos.id);
    let xSrc = srcInfos.x;
    let ySrc = srcInfos.y;
    let wBSrc = xSrc + width;
    // let hBSrc = ySrc + height;

    // Define method reverse
    let reverse = (input) => {
      let ret = new Array;
      for (let i = input.length - 1; i >= 0; i--) {
        ret.push(input[i]);
      }
      return ret;
    };

    // Cause: When multi boundary overlap that drags an object inside
    // then it will be added to => regulation add to the highest boundary
    let reverseBoundary = reverse(this.dataContainer.boundary);
    reverseBoundary.forEach((item) => {
      // The condition d.id != srcInfos.id used to check inside boundary
      // But it not affect to check inside vertex
      if (!item.parent && item.id != srcInfos.id && !srcInfos.parent) {
        // Calculate box for boundary
        let boundaryId = item.id;
        let xTar = item.x;
        let yTar = item.y;
        let bBoxTar = this.objectUtils.getBBoxObject(item.id);
        let wBTar = xTar + bBoxTar.width;
        let hBTar = yTar + bBoxTar.height;

        if ((xSrc >= xTar) && (ySrc >= yTar) && (wBSrc <= wBTar) && (ySrc <= hBTar)) {
          let member = {id: srcInfos.id, type, show: true};
          let index = this.objectUtils.getIndexFromPositionForObject(boundaryId, srcInfos);
          this.boundary.addMemberToBoundaryWithIndex(boundaryId, member, index);
          srcInfos.parent = boundaryId;
        }
      }
    });
  }

  /**
   * @param srcInfos Object drag
   * @param type type of object drag
   * Function using change index of object in boundary parent when drag in boundary
   */
  changeIndexInBoundaryForObject(srcInfos, type) {
    let {parent, id} = srcInfos;
    let {member} = this.objectUtils.getBoundaryInfoById(parent);
    let indexOld = this.getIndexBy(member, "id", id);
    // let member = { id, type, show: true };
    let indexNew = this.objectUtils.getIndexFromPositionForObject(parent, srcInfos);
    this.boundary.changeIndexMemberToBoundary(parent, indexOld, indexNew);
    srcInfos.parent = parent;
  }

  /**
   * @param arr Array object
   * @param name key compare
   * @param value value compare
   * @return i (index of object match condition)
   */
  getIndexBy(arr, name, value) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i][name] == value) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Check drag outside boundary
   */
  checkDragObjectOutsideBoundary(srcInfos) {
    // Get box object
    const {id, parent} = srcInfos;
    let {height, width} = this.objectUtils.getBBoxObject(id);
    let xSrc = srcInfos.x;
    let ySrc = srcInfos.y;
    let wBSrc = xSrc + width;
    let hBSrc = ySrc + height;

    // Parent
    const {x, y} = this.objectUtils.getBoundaryInfoById(parent);
    let pBox = this.objectUtils.getBBoxObject(parent);
    let xParent = x + pBox.width;
    let yParent = y + pBox.height;

    // Check drag outside a boundary
    // if ((xSrc < x) || (ySrc < y) || (wBSrc > xParent) || (hBSrc > yParent)) {
    //Change condition object out boundary parent
    if ((( wBSrc < x) || ( xParent < xSrc )) || ((hBSrc < y ) || ( yParent < ySrc ))) {
      this.boundary.removeMemberFromBoundary(parent, srcInfos.id);
      srcInfos.parent = null;
      return true;
    }
    return false;
  }

  // Set vertex position
  setVertexPosition(vertexId, position) {
    this.vertex.setVertexPosition(vertexId, position);
  }

  // Delete vertex call from removeChildElementsBoundary
  deleteVertex(vertexId) {
    this.vertex.deleteVertex(vertexId);
  }

  /**
   * Clear all element on graph
   * And reinit marker def
   */
  clearAll() {
    // Delete all element inside SVG
    COMMON_DATA.isShowReduced = false;
    d3.select("svg").selectAll("*").remove();

    // Clear all data cotainer for vertex, boundary, edge
    this.dataContainer.vertex = [];
    this.dataContainer.boundary = [];
    this.dataContainer.edge = [];
    this.initMarkerArrow();
    this.initPathConnect();
    this.initEdgePath();
    this.initBBoxGroup();
    this.initAreaDrawEdge();
    setSizeGraph();
  }

  /**
   * Start drag point connect
   * @param self
   * @returns {Function}
   */
  dragPointStarted() {
    return function () {
      COMMON_DATA.isUpdateEdge = true;
    }
  }

  /**
   * Drag connect belong to mouse position
   * @param self
   * @returns {Function}
   */
  draggedPoint(self) {
    return function () {
      if (!COMMON_DATA.isUpdateEdge)
        return;

      let pathStr = null;
      let x = d3.mouse(d3.select('svg').node())[0];
      let y = d3.mouse(d3.select('svg').node())[1];
      const type = d3.select(this).attr("type");
      if (type === "O") {
        let px = Number(d3.select("#pointEnd").attr("cx"));
        let py = Number(d3.select("#pointEnd").attr("cy"));
        // pathStr = createPath({x: x - 1, y: y - 1}, {x: px, y: py});
        pathStr = createPath({x, y}, {x: px, y: py});
      } else {
        let px = Number(d3.select("#pointStart").attr("cx"));
        let py = Number(d3.select("#pointStart").attr("cy"));
        // pathStr = createPath({x: px, y: py}, {x: x - 1, y: y - 1});
        pathStr = createPath({x: px, y: py}, {x, y});
      }

      d3.select('#edgePath').attr('d', pathStr);
      d3.select('#groupEdgePath').style("display", "block");
    }
  }

  /**
   * End creation connect if destination is connect point
   * @param self
   * @returns {Function}
   */
  dragPointEnded(self) {
    return function () {
      if (d3.event.sourceEvent.target.tagName == "circle" && this != d3.event.sourceEvent.target) {
        COMMON_DATA.isUpdateEdge = false;
        const type = d3.select(this).attr("type");
        let refId = d3.select(d3.event.sourceEvent.target.parentNode).attr("id");
        let prop = d3.select(d3.event.sourceEvent.target).attr("prop");
        let edgeId = d3.select('#edgePath').attr('ref');
        const refObj = self.vertex.getCoordinateProperty(refId, prop, type);
        refObj.vertexId = refId;
        refObj.prop = prop;
        type === "O" ? self.edge.updatePathConnect(edgeId, {source: refObj}) : self.edge.updatePathConnect(edgeId, {target: refObj});

        d3.select('#groupEdgePoint').style("display", "none");
        d3.select("#groupEdgePoint").moveToBack();
      }

      d3.select('#groupEdgePath').style("display", "none");
      d3.select("#edgePath").moveToBack();
    }
  }

  /**
   * Show boundary, vertex reduced as policy
   * Show graph elements connected by edges only
   * Boundary: show vertices which have any edges only and boundaries
   * Vertex: The vertices in group SHOW_FULL_ALWAYS not effected by show reduced
   * The remain vertex then show header and connected properties only
   */
  showReduced() {
    COMMON_DATA.isShowReduced = true;
    let edge = this.dataContainer.edge;
    let full = COMMON_DATA.groupVertexOption["SHOW_FULL_ALWAYS"];
    let lstVer = [], lstProp = [];

    // Filter the vertex effected by show reduced
    lstVer = _.filter(this.dataContainer.vertex, (e) => {
      return full.indexOf(e.vertexType) < 0;
    });
    lstVer.forEach((vertex) => {
      d3.select(`#${vertex.id}`).selectAll('.drag_connect:not(.connect_header)').classed("hide", true);
      d3.select(`#${vertex.id}`).selectAll('.property').classed("hide", true);
    });

    // Get vertex and property can display
    edge.forEach((edgeItem) => {
      lstProp.push({
        vert: edgeItem.source.vertexId,
        prop: edgeItem.source.prop
      }, {vert: edgeItem.target.vertexId, prop: edgeItem.target.prop});
    });

    lstVer.forEach((vertexItem) => {
      let arrPropOfVertex = [];
      lstProp.forEach((propItem) => {
        if (propItem.vert === vertexItem.id) {
          if (arrPropOfVertex.indexOf(propItem.prop) === -1) {
            arrPropOfVertex.push(propItem.prop);
          }
        }
      });
      d3.select(`#${vertexItem.id}`).classed("hide", false); // Enable Vertex
      arrPropOfVertex.forEach((propItem) => {
        d3.select(`#${vertexItem.id}`).select(".property[prop='" + propItem + "']").classed("hide", false);
        d3.select(`#${vertexItem.id}`).select(".property[prop='" + propItem + "']").classed("hide", false);
      });
      this.vertex.updatePathConnect(vertexItem.id); // Re-draw edge
      /* Update Circle */
      this.vertex.updatePositionConnect(arrPropOfVertex, d3.select(`#${vertexItem.id}`), vertexItem.id);
    });

    this.vertex.resetSizeVertex(false);
    this.updateHeightBoundary();
  }

  /**
   * Show full graph
   */
  showFull() {
    let edges = this.dataContainer.edge;
    COMMON_DATA.isShowReduced = false;
    /** Vertex **/
    d3.selectAll('.drag_connect.reduced').remove();
    d3.selectAll('.property').classed("hide", false);
    d3.selectAll('.drag_connect').classed("hide", false);

    // Filter the vertex exit edge
    let len = edges.length;
    let vertices = [];
    for (let i = 0; i < len; i++) {
      let edge = edges[i];
      vertices.push(edge.source.vertexId);
      vertices.push(edge.target.vertexId);
    }

    vertices = Array.from(new Set(vertices))
    len = vertices.length;
    // Re-draw edge
    for (let i = 0; i < len; i++) {
      let id = vertices[i];
      this.vertex.updatePathConnect(id);
    }
    this.vertex.resetSizeVertex(true);
    this.updateHeightBoundary();
  }

  /**
   * get list vertex type will show on menu
   * @param array data
   * @returns {*}
   */
  getListVertexType(data) {
    let types = [];
    let len = data.length;
    for (let i = 0; i < len; i++) {
      let type = data[i];
      types.push(type.vertexType);
    }

    return types;
  }

  /**
   * The box simulate new position of vertex or boundary dragged.
   */
  initBBoxGroup() {
    this.svgSelector.append("svg:g")
      .attr("transform", `translate(0.5, 0.5)`)
      .append("svg:rect")
      .attr("id", "dummyBBox")
      .attr("class", "dummy-edge stroke-dasharray")
      // .attr("stroke-dasharray", "3 3")
      .attr("fill", "none");
  }

  /**
   * When dragging a vertex or boundary then update attribute for bbox
   * Update coordinate
   * Update size
   */
  updateAttrBBoxGroup(data) {
    d3.select('#dummyBBox').attr('x', data.x);
    d3.select('#dummyBBox').attr('y', data.y);
    d3.select('#dummyBBox').attr('width', data.type == "B" ? data.width - 20 : data.width - 7);
    d3.select('#dummyBBox').attr('height', data.type == "B" ? data.height : data.height - 3);
    d3.select('#dummyBBox').style("display", "block");
    d3.select(d3.select("#dummyBBox").node().parentNode).moveToFront();
  }

  hiddenBBoxGroup() {
    d3.select('#dummyBBox').style("display", "none");
  }

  removeMemberFromBoundary(parentId, vertexId) {
    this.boundary.removeMemberFromBoundary(parentId, vertexId);
  }

  removeEdge(edgeId) {
    this.edge.removeEdge(edgeId);
  }

  getVertexFormatType(vertexGroup) {
    vertexGroup.forEach(group => {
      const {groupType, dataElementFormat, vertexPresentation} = group;
      COMMON_DATA.headerForm[groupType] = Object.keys(dataElementFormat);
      COMMON_DATA.vertexPresentation[groupType] = vertexPresentation;
      COMMON_DATA.vertexFormat[groupType] = dataElementFormat;
      COMMON_DATA.vertexGroupType[groupType] = group;
      let formatType = {};
      let header = COMMON_DATA.headerForm[groupType];
      let len = header.length;
      for (let i = 0; i < len; i++) {
        let key = header[i];
        let value = dataElementFormat[key];
        let type = typeof(value);
        if (type === "boolean") {
          formatType[key] = VERTEX_FORMAT_TYPE.BOOLEAN; // For boolean
        } else if (type === "object" && Array.isArray(value)) {
          formatType[key] = VERTEX_FORMAT_TYPE.ARRAY; // For array
        } else if (type === "number") {
          formatType[key] = VERTEX_FORMAT_TYPE.NUMBER; // For number
        } else {
          formatType[key] = VERTEX_FORMAT_TYPE.STRING; // For string and other type
        }
      }

      COMMON_DATA.vertexFormatType[groupType] = formatType;
    });
  }

  getVertexTypesShowFull(data) {
    const group = data["VERTEX_GROUP"];
    const vertex = data["VERTEX"];
    let len = group.length;
    for (let i = 0; i < len; i++) {
      let groupType = group[i].groupType;
      let groupOption = group[i].option;
      let lenOpt = groupOption.length;
      for (let j = 0; j < lenOpt; j++) {
        let option = groupOption[j];
        let groupVertex = _.filter(vertex, (e) => {
            return e.groupType === groupType;
          }
        );
        let groupAction = [];
        groupVertex.forEach(e => {
          groupAction.push(e.vertexType);
        });
        COMMON_DATA.groupVertexOption[option] = groupAction;
      }
    }
  }

  /**
   * Removing Duplicate Objects From An Array By Property
   * @param myArr
   * @param prop
   * @author: Dwayne
   * @reference: https://ilikekillnerds.com/2016/05/removing-duplicate-objects-array-property-name-javascript/
   */
  removeDuplicates(myArr, prop) {
    return myArr.filter((obj, pos, arr) => {
      return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
    });
  }

  updateHeightBoundary() {
    // Get all boundary that without parent but have child
    let boundaries = _.filter(this.dataContainer.boundary, (g) => {
      return g.parent != null;
    });
    boundaries.forEach(boundary => {
      this.boundary.resizeParentBoundary(boundary.id);
    });
    boundaries = _.filter(this.dataContainer.boundary, (g) => {
      return g.parent == null && g.member.length > 0;
    });
    boundaries.forEach(boundary => {
      this.boundary.reorderPositionMember(boundary.id);
    });

    setMinBoundaryGraph(this.dataContainer);
  }

  reorderPositionMember(boundaryId) {
    this.boundary.reorderPositionMember(boundaryId);
  }
};
export default MainMgmt;
