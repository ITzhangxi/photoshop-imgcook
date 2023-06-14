if(typeof($)=='undefined')
  $={};

var artboardRectX = 0;
var artboardRectY = 0;
var artboardRectWidth = 0;
var artboardRectHeight = 0;

var pluginVersion = '1.1.3';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

$._ext = {
  getVersion: function() {
    return pluginVersion;
  },
  evalFile : function(path) {
    try {
      $.evalFile(path);
    } catch (e) {alert("Exception:" + e);}
  },
  evalFiles: function(jsxFolderPath) {
    var folder = new Folder(jsxFolderPath);
    if (folder.exists) {
      var jsxFiles = folder.getFiles("*.jsx");
      for (var i = 0; i < jsxFiles.length; i++) {
        var jsxFile = jsxFiles[i];
        $._ext.evalFile(jsxFile);
      }
    }
  },
  run: function(pluginPath) {
    try {
      var data = layerTree.create();
      var ret = JSON.parse(data);

      if (ret.status === 'fail') {
        return JSON.stringify(ret);
      }

      ret.data = $._ext.transformData(JSON.parse(ret.data));

      if (ret.data) {
        return JSON.stringify({
          status: 'ok',
          data: ret.data
        })
      }
    } catch (e) {
      return JSON.stringify({
        status: 'fail',
        message: e.message,
        line: e.line
      });
    }
    
  },
  copy: function(data) {
    return ActionUtils.copyToClipboard(data);
  },
  transformData: function(originData) {
    var result = {
      type: 'Block',
      id: 'Block-1'
    };

    var artboardRect = originData.artboardRect;
  
    artboardRectX = artboardRect.x;
    artboardRectY = artboardRect.y;
    artboardRectWidth = artboardRect.width;
    artboardRectHeight = artboardRect.height;
    
    result.props = {
      __VERSION__: '2.0',
      style: {
        width: artboardRectWidth,
        height: artboardRectHeight
      },
      attrs: {
        x: 0,
        y: 0
      }
    };

    result.artboardImg = originData.artboardImg;
    result.pluginVersion = pluginVersion;
    result.name = originData.name;
    result.reference = 'psd';
  
    var children = originData.children;

    children = children.map($._ext.nodeGeneration);
    result.children = [];

    children.forEach(function(child) {
      if (child.props.style.width < 0 || child.props.style.height < 0) {
        return;
      } 
      if (child.type === 'repeat') {
        result.children = result.children.concat(child.children);
      } else {
        result.children.push(child);
      }
    })
  
    return result;
  },
  nodeGeneration: function(child, index, id) {
    var childRect = child.rect;
    var x = childRect.x - artboardRectX < 0 ? 0 : childRect.x - artboardRectX;
    var y = childRect.y - artboardRectY < 0 ? 0 : childRect.y - artboardRectY;

    var width = (x + childRect.width) > artboardRectWidth ? childRect.width - (x + childRect.width - artboardRectWidth) : childRect.width;
    var height = (y + childRect.height) > artboardRectHeight ? childRect.height - (y + childRect.height - artboardRectHeight) : childRect.height;
    var robotItem = {
      __VERSION__: '2.0',
      props: {
        style: {
          width: width,
          height: height
        },
        attrs: {
          x: x,
          y: y
        }
      },
      selfId: 'layerId-' + (child.itemIndex ? child.itemIndex : id),
      children: []
    };

    if (child.classNames && child.classNames.length) {
      robotItem.classNames = child.classNames;
    }

    switch (child.cls) {
      case 'BitmapLayer':
        robotItem.type = 'Image';
        robotItem.props.attrs.source = child.pic;
        robotItem.props.style = Object.assign({}, robotItem.props.style, child.style);
        robotItem.id = "Image-" + index;
        break;
      case 'Repeat':
        robotItem.type = 'repeat';
        robotItem.id = 'Repeat-' + index;

        child.children = child.children.map(function(item, childIndex) {
          if (child.__smartobject__ && child.__layerRect__) {
            item.rect.x += child.__layerRect__.x;
            item.rect.y += child.__layerRect__.y;
          }
          if (robotItem.classNames) {
            item.classNames = robotItem.classNames;
          }
          
          return $._ext.nodeGeneration(item, index + '_' + childIndex, index + '_' + childIndex);
        });

        robotItem.children = child.children;
        break;
      case 'Text':
        robotItem.type = 'Text';
        robotItem.props.attrs.text = child.text.replace(/(\n)|(\r)|(\r\n)/g, '\\n');
        robotItem.props.attrs.lines = child.style.lines;
        robotItem.props.style = Object.assign({}, robotItem.props.style, child.style);
        robotItem.props.attrs.fixed = typeof child.isFixed != 'undefined' ? child.isFixed : false;
        robotItem.id = "Text-" + index;

        if (child.text.indexOf('\n') !== -1 ||
          child.text.indexOf('\r') !== -1 ||
          child.text.indexOf('\r\n') !== -1) {
          robotItem.props.style.whiteSpace = 'pre';
        }

        delete robotItem.props.style.fontFamily;
        break;
      case 'View':
        robotItem.type = 'Shape';
        robotItem.props.style = Object.assign({}, robotItem.props.style, child.style);
        robotItem.children = child.children;
        robotItem.id = "Shape-" + index;
        break;
      default:
        break;
    }

    return robotItem;
  },
  login: function() {
    var uuid = uuidv4();

    if (!$._ext.getToken()) {
      // open login url
      try {
        var xLib = new ExternalObject("lib:\PlugPlugExternalObject");

        if (xLib) {
          // open login page
          var eventObj = new CSXSEvent(); 
          eventObj.type = 'imgcook_login';
          eventObj.data = uuid;
          eventObj.dispatch();
        }
      } catch (e) {

      }
    } else {
      alert('您已登录 imgcook!');
    }
  },
  logout: function() {
    $._ext.writeToken('');
    alert('您已退出 imgcook');
  },

  getToken: function() {
    var path = Folder.userData;

    if (!path.exists) {
      path = new Folder.userData();
    }
    var write_file = File(path + '/.imgcook_psd_user');

    try {
      var xLib = new ExternalObject("lib:\PlugPlugExternalObject");
      var data = '';

      if (write_file.exists) {
        var read_file = File(path + '/.imgcook_psd_user');
        read_file.open('r', undefined, undefined);
  
        if (read_file !== '') {
          data = read_file.read();
          read_file.close();
        } else {
          data = '';
        }
      }

      if (xLib) {
        // open login page
        var eventObj = new CSXSEvent(); 
        eventObj.type = 'imgcook_token';
        eventObj.data = data;
        eventObj.dispatch();
      }
    } catch (e) {

    }
  },

  writeToken: function(token) {
    var path = Folder.userData;

    if (!path.exists) {
      path = new Folder.userData();
    }
    var write_file = File(path + '/.imgcook_psd_user');

    if (!write_file.exists) {
      write_file = new File(path + '/.imgcook_psd_user');
    }

    var out;

    if (write_file !== '') {
      out = write_file.open('w', undefined, undefined);
      write_file.encoding = 'UTF-8';
      write_file.lineFeed = 'Unix';
    }

    if (out !== false) {
      write_file.writeln(token);
      write_file.close();
    }

    if (token) {
      alert('登录 imgcook 成功');
    } 
  }
};
ActionUtils = {
  copyToClipboard: function(json) {
    var data = charIDToTypeID('TxtD');
    var dataToClipboardStr = stringIDToTypeID('textToClipboard');
    var desc = new ActionDescriptor();
    desc.putString(data, json);
    executeAction(dataToClipboardStr, desc, DialogModes.NO);
  },
  isEmpty: function(layer) {
    return ActionUtils.getRect(layer).width == 0 && ActionUtils.getRect(layer).height == 0;
  },
  hasVectorMask: function() {
    var hasVectorMask = false;   
    try {   
      var ref = new ActionReference();   
      var keyVectorMaskEnabled = app.stringIDToTypeID( 'vectorMask' );   
      var keyKind = app.charIDToTypeID( 'Knd ' );   
      ref.putEnumerated( app.charIDToTypeID( 'Path' ), app.charIDToTypeID( 'Ordn' ), keyVectorMaskEnabled );   
      var desc = executeActionGet( ref );   
      if ( desc.hasKey( keyKind ) ) {   
        var kindValue = desc.getEnumerationValue( keyKind );   
        if (kindValue == keyVectorMaskEnabled) {   
          hasVectorMask = true;   
        }   
      }   
    } catch (e) {   
      hasVectorMask = false;   
    }   
    return hasVectorMask;   
  },
  getRect: function(layer) {
    var bounds = layer.bounds;
    var left = bounds[0].as('px');
    var top = bounds[1].as('px');
    var right = bounds[2].as('px');
    var bottom = bounds[3].as('px');
    var width = right - left;
    var height = bottom - top;

    return {
      x: left,
      y: top,
      width: width,
      height: height
    };
  },
  hasLayerMask: function() {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    var desc = executeActionGet(ref);
    return desc.hasKey(charIDToTypeID("UsrM"));
  },
  convertToSmartObject: function() {
    var idnewPlacedLayer = stringIDToTypeID( "newPlacedLayer" );
    executeAction( idnewPlacedLayer, undefined, DialogModes.NO );
  },
  selectLayers: function(itemIndexArray) {
    var backgroundIndexOffset = 0;
    try {
      if (app.activeDocument.backgroundLayer) {
        backgroundIndexOffset = -1;
      }
    } catch (err) {}

    for (var i = 0; i < itemIndexArray.length; i++) {
      var desc = new ActionDescriptor();
      var ref = new ActionReference();
      ref.putIndex(charIDToTypeID('Lyr '), Number(itemIndexArray[i]) + backgroundIndexOffset);
      desc.putReference(charIDToTypeID('null'), ref);
      desc.putEnumerated(stringIDToTypeID('selectionModifier'),
          stringIDToTypeID('selectionModifierType'),
          stringIDToTypeID('addToSelection'));
      desc.putBoolean(charIDToTypeID('MkVs'), false);
      executeAction(charIDToTypeID('slct'), desc, DialogModes.NO);
    }
  },
  selectLayer: function(layer) {
    var backgroundIndexOffset = 0;
    try {
      if (app.activeDocument.backgroundLayer) {
        backgroundIndexOffset = -1;
      }
    } catch (err) {}
    var idslct = charIDToTypeID( "slct" );
    var desc258 = new ActionDescriptor();
    var idnull = charIDToTypeID( "null" );
        var ref148 = new ActionReference();
        var idLyr = charIDToTypeID( "Lyr " );
        ref148.putIndex( idLyr, Number(layer.itemIndex) + backgroundIndexOffset);
    desc258.putReference( idnull, ref148 );
    executeAction( idslct, desc258, DialogModes.NO );

    return desc258;
  },
  getSmartRef: function() {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    var desc = executeActionGet(ref);
    return ActionUtils.actionDescriptorToObject(desc).smartObject.fileReference;
  },
  openSmart: function() {
    var idplacedLayerEditContents = stringIDToTypeID( "placedLayerEditContents" );
    var desc3447 = new ActionDescriptor();
    executeAction( idplacedLayerEditContents, desc3447, DialogModes.NO );

    // before select should delete invisible layer for error layerSet move
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
      if (!app.activeDocument.layers[i].visible) {
        app.activeDocument.layers[i].remove();
      }
    }

    // select root in new doc
    var rootNode = app.activeDocument.layers[0];

    // create group if there is none  
    if (rootNode.typename != 'LayerSet') {
      var newGroup = activeDocument.layerSets.add();
      newGroup.name = 'TEMP_GROUP_BY_DAVINCI';

      for (var i = activeDocument.layers.length - 1, min = 0; min <= i; i -= 1) {
        if (activeDocument.layers[i].name === newGroup.name || !activeDocument.layers[i].visible) continue;
        ActionUtils.unlockLayer(activeDocument.layers[i]);
        activeDocument.layers[i].move(newGroup, ElementPlacement.INSIDE);
      }

      rootNode = app.activeDocument.layers[0];
    }

    return rootNode;
  },
  dupLayers: function() {
    var desc143 = new ActionDescriptor();  
        var ref73 = new ActionReference();  
        ref73.putClass( charIDToTypeID('Dcmn') );  
    desc143.putReference( charIDToTypeID('null'), ref73 );  
    desc143.putString( charIDToTypeID('Nm  '), activeDocument.activeLayer.name );  
        var ref74 = new ActionReference();  
        ref74.putEnumerated( charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt') );  
    desc143.putReference( charIDToTypeID('Usng'), ref74 );  
    executeAction( charIDToTypeID('Mk  '), desc143, DialogModes.NO ); 
  },
  sfwPNG24: function(file, quality) {
    var pngOpts = new ExportOptionsSaveForWeb;   
    pngOpts.format = SaveDocumentType.PNG;  
    pngOpts.PNG8 = false;   
    pngOpts.transparency = true;   
    pngOpts.interlaced = false;   
    pngOpts.quality = quality;  
    activeDocument.exportDocument(new File(file), ExportType.SAVEFORWEB, pngOpts);  
  },
  isAreaEmpty: function() {
    var bounds = activeDocument.activeLayer.bounds;
    var left = bounds[0];
    var top = bounds[1];
    var right = bounds[2];
    var bottom = bounds[3];
    var selection = app.activeDocument.selection;

    try {
      var selection_area = new Array(new Array(left, top), new Array(right, top), new Array(right, bottom), new Array(left, bottom));
      selection.select(selection_area);
      selection.copy(DialogModes.NO);
    } catch (e) {
      return true;
    } finally {
      try {
        selection.deselect();
      } catch (e) {}
    }

    return false;
  },
  unlockLayer: function(layer) {
    try {
      if (layer.isBackgroundLayer) layer.name = 'From Background';  
      if (layer.allLocked) layer.allLocked = false;  
      if (layer.pixelsLocked) layer.pixelsLocked = false;  
      if (layer.positionLocked) layer.positionLocked = false;  
      if (layer.transparentPixelsLocked) layer.transparentPixelsLocked = false; 
    } catch (e) {
    }
  },
  getExportSelectedLayer: function(layer) {
    var activeDocument = app.activeDocument;
    var docName = activeDocument.activeLayer.name.replace(/[:\/\\*\?\"\<\>\|]/g, "_").replace(/\s+/g, '_');
    var isVisible = activeDocument.activeLayer.visible;
    var path = '';

    if (!isVisible) activeDocument.activeLayer.visible = true;

    var maskGroupMap = layerTree.documents[activeDocument.id].maskGroupMap;
    var groupedLayerItemIndex;

    for (var i in maskGroupMap) {
      if (maskGroupMap[i].indexOf(String(layer.itemIndex)) != -1) {
        groupedLayerItemIndex = i;
      }
    }

    if (typeof groupedLayerItemIndex !== 'undefined') {
      var parentLayer = layerTree.documents[activeDocument.id].layerMap[groupedLayerItemIndex].layer;
      var layerRect = this.getRect(layer);
      var parentRect = this.getRect(parentLayer);

      if (
        parentRect.y >= layerRect.y &&
        parentRect.x >= layerRect.x &&
        parentRect.y + parentRect.height <= layerRect.y + layerRect.height &&
        parentRect.x + parentRect.width <= layerRect.x + layerRect.width
      ) {
        this.selectLayers([layer.itemIndex, groupedLayerItemIndex]);
      }
    }

    this.dupLayers();
    try {
      activeDocument.mergeVisibleLayers();
    } catch (e) {

    }

    var activeLayerRect = ActionUtils.getRect(app.activeDocument.activeLayer);

    try {
      ActionUtils.unlockLayer(app.activeDocument.activeLayer);
      app.bringToFront();
      app.activeDocument.trim(
        TrimType.TRANSPARENT,
        activeLayerRect.x >= 0 ? true : false,
        activeLayerRect.y >= 0 ? true : false,
        true,
        true
      );
    } catch (e) {

    }

    try {
      var random = Math.round(Math.random() * 10000);
      var tempPath = Folder.temp + "/" + docName + random + ".png";
      var file = File(tempPath); 

      this.sfwPNG24(file, 80);
      app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      if(!isVisible) app.activeDocument.activeLayer.visible = false;
      path = tempPath;
    } catch (e) {

    }
    
    return path;
  },
  isLayerFXVisible: function() {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID( "Ordn" ), charIDToTypeID( "Trgt" ) );
    var layerDesc = executeActionGet(ref);

    if (layerDesc.hasKey(stringIDToTypeID('layerFXVisible'))) {
      return layerDesc.getBoolean(stringIDToTypeID('layerFXVisible'));
    }
  },
  getLayerStyles: function() {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID( "Ordn" ), charIDToTypeID( "Trgt" ) );
    var layerDesc = executeActionGet(ref);

    if (layerDesc.hasKey(stringIDToTypeID('layerEffects'))) {
      var stylesDesc = layerDesc.getObjectValue(stringIDToTypeID('layerEffects'));
      var obj    = this.actionDescriptorToObject(stylesDesc);
      return obj;
    }
  },
  getLayerNoBounds: function() {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID( "Ordn" ), charIDToTypeID( "Trgt" ) );
    var layerDesc = executeActionGet(ref);

    if (layerDesc.hasKey(stringIDToTypeID('boundsNoEffects'))) {
      var noEffectBoundsDesc = layerDesc.getObjectValue(stringIDToTypeID('boundsNoEffects'));
      var obj    = this.actionDescriptorToObject(noEffectBoundsDesc);
      return obj;
    }
  },
  getLayerBorder: function() {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID( "Ordn" ), charIDToTypeID( "Trgt" ) );
    var layerDesc = executeActionGet(ref);
    if (layerDesc.hasKey(stringIDToTypeID('AGMStrokeStyleInfo'))) {
      var stylesDesc = layerDesc.getObjectValue(stringIDToTypeID('AGMStrokeStyleInfo'));
      var obj    = this.actionDescriptorToObject(stylesDesc);
      return obj;
    }
    return null;
  },
  getRadius: function() {
    var desc = ActionUtils.getCurrentLayerDesc();
    var descObj = ActionUtils.actionDescriptorToObject(desc);

    try {
      var keyOriginDesc = descObj.keyOriginType.getObjectValue(0);
      var keyOriginObj = ActionUtils.actionDescriptorToObject(keyOriginDesc);
    
      if (keyOriginObj && keyOriginObj.keyOriginRRectRadii) {
        return {
          borderTopLeftRadius: keyOriginObj.keyOriginRRectRadii.topLeft,
          borderTopRightRadius: keyOriginObj.keyOriginRRectRadii.topRight,
          borderBottomRightRadius: keyOriginObj.keyOriginRRectRadii.bottomRight, 
          borderBottomLeftRadius: keyOriginObj.keyOriginRRectRadii.bottomLeft
        };
      }
    } catch (e) {
      return null;
    }

    return null;
  },
  getShapeGeom: function() {
    if (app.activeDocument.pathItems.length == 0) return null;

    function sameCoord( pathPt, xy )
    {
      return (pathPt.rightDirection[xy] == pathPt.anchor[xy])
          && (pathPt.leftDirection[xy] == pathPt.anchor[xy]);
    }
    function sameCoord2( pt, xy, io )
    {
      return (sameCoord( pt, xy ) 
            && ( ((io == 0) && (pt.rightDirection[1-xy] == pt.anchor[1-xy]))
                || ((io == 1) && (pt.leftDirection[1-xy] == pt.anchor[1-xy])) ) );
    }
    for (var i = 0; i < app.activeDocument.pathItems.length; i++) {
      var pathItem = app.activeDocument.pathItems[i];

      if (pathItem.kind == PathKind.VECTORMASK && pathItem.subPathItems.length == 1) {
        var subPath = pathItem.subPathItems[0];
        if (subPath.closed && subPath.pathPoints.length == 4) { 
          var subPath = pathItem.subPathItems[0];
          var pts = subPath.pathPoints;
          
          for (i = 0; i < 4; ++i)
          {
            if (! (sameCoord( pts[i], 0 ) && sameCoord( pts[i], 1 ))) return null;
          }

          if (
            Math.abs(pts[0].anchor[0] - pts[3].anchor[0]) <= 3 &&
            Math.abs(pts[0].anchor[1] - pts[1].anchor[1]) <= 3 &&
            Math.abs(pts[2].anchor[0] - pts[1].anchor[0]) <= 3 &&
            Math.abs(pts[2].anchor[1] - pts[3].anchor[1]) <= 3
          ) {
            // radius = 0
            return true;
          }
        }
      }
    }

    return null;
  },
  getDescByLayer: function(index) {
    var desc = new ActionDescriptor();
    var idnull = charIDToTypeID('null');
    var ref = new ActionReference();
    var idLry = charIDToTypeID('Lyr ');
    ref.putIndex(idLry, index);
    desc.putReference(idnull, ref);
    return desc;
  },
  getCurrentLayerDesc: function() {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID( "Ordn" ), charIDToTypeID( "Trgt" ) );
    var layerDesc = executeActionGet(ref);
    return layerDesc;
  },
  actionDescriptorToObject: function(desc) {
    var obj = {};
    var len = desc.count;
    for(var i = 0; i < len; i++) {
      var key = desc.getKey(i);
      obj[typeIDToStringID(key)] = this.getValueByType(desc,key);
    }
    return obj;
  },
  getValueByType: function(desc, key) {
    var type = desc.getType(key);
    var value = null;
    switch(type)
    {
      case DescValueType.ALIASTYPE:
        value = "alias";
        break;
      case DescValueType.BOOLEANTYPE:
        value = desc.getBoolean(key);
        break;
      case DescValueType.CLASSTYPE:
        value = desc.getClass(key);
        break;
      case DescValueType.OBJECTTYPE:
        value = this.actionDescriptorToObject(desc.getObjectValue(key));//+" - "+desc.getObjectType(key);
        break;
      case DescValueType.ENUMERATEDTYPE:
        value = typeIDToStringID(desc.getEnumerationValue(key));
        break;
      case DescValueType.DOUBLETYPE:
        value = desc.getDouble(key);
        break;
      case DescValueType.INTEGERTYPE:
        value = desc.getInteger(key);
        break;
      case DescValueType.LARGEINTEGERTYPE:
        value = desc.getLargeInteger(key);
        break;
      case DescValueType.LISTTYPE:
        value = desc.getList(key);
        break;
      case DescValueType.RAWTYPE:
            // not implemented
        break;
      case DescValueType.REFERENCETYPE:
        value = desc.getReference(key);
        break;
      case DescValueType.STRINGTYPE:
        value = desc.getString(key);
        break;
      case DescValueType.UNITDOUBLE:
        value = desc.getUnitDoubleValue(key);
        break;
    }
    return value;
  },
  getShapeBg: function(layerDesc) {
    var adjList = layerDesc.getList(stringIDToTypeID('adjustment'));  
    var theColors = adjList.getObjectValue(0).getObjectValue(stringIDToTypeID('color'));  
    var rgb = [];  
    for (var i = 0; i < theColors.count; i++) { 
      rgb.push(theColors.getUnitDoubleValue(theColors.getKey(i)));  
    } 
    var opacity = layerDesc.getString(stringIDToTypeID('opacity'));

    return 'rgba(' + Math.floor(rgb[0]) + ',' + Math.floor(rgb[1]) + ',' + Math.floor(rgb[2]) + ', ' + opacity / 255 + ')'; 
  },
  makeHistorySnapshot: function(snapshotName) {
    var idMk = charIDToTypeID( "Mk  " );
      var desc11 = new ActionDescriptor();
      var idnull = charIDToTypeID( "null" );
        var ref5 = new ActionReference();
        var idSnpS = charIDToTypeID( "SnpS" );
        ref5.putClass( idSnpS );
      desc11.putReference( idnull, ref5 );
      var idFrom = charIDToTypeID( "From" );
        var ref6 = new ActionReference();
        var idHstS = charIDToTypeID( "HstS" );
        var idCrnH = charIDToTypeID( "CrnH" );
        ref6.putProperty( idHstS, idCrnH );
      desc11.putReference( idFrom, ref6 );
      var idNm = charIDToTypeID( "Nm  " );
      desc11.putString( idNm, snapshotName );
      var idUsng = charIDToTypeID( "Usng" );
      var idHstS = charIDToTypeID( "HstS" );
      var idFllD = charIDToTypeID( "FllD" );
      desc11.putEnumerated( idUsng, idHstS, idFllD );
    executeAction( idMk, desc11, DialogModes.NO );
  },

  removeHistorySnapshot: function(snapshotName) {
    var idDlt = charIDToTypeID( "Dlt " );
      var desc35 = new ActionDescriptor();
      var idnull = charIDToTypeID( "null" );
        var ref23 = new ActionReference();
        var idSnpS = charIDToTypeID( "SnpS" );
        ref23.putName( idSnpS, snapshotName );
      desc35.putReference( idnull, ref23 );
    executeAction( idDlt, desc35, DialogModes.NO );
  },

  restoreFromSnapshot: function(snapshotName) {
    var idslct = charIDToTypeID( "slct" );
      var desc36 = new ActionDescriptor();
      var idnull = charIDToTypeID( "null" );
        var ref24 = new ActionReference();
        var idSnpS = charIDToTypeID("SnpS");
        ref24.putName( idSnpS, snapshotName );
      desc36.putReference( idnull, ref24 );
    executeAction( idslct, desc36, DialogModes.NO );
  },

  setColoOverlay: function(r, g, b, o) {
    var idsetd = charIDToTypeID( "setd" );
    var desc29 = new ActionDescriptor();
    var idnull = charIDToTypeID( "null" );
        var ref3 = new ActionReference();
        var idPrpr = charIDToTypeID( "Prpr" );
        var idLefx = charIDToTypeID( "Lefx" );
        ref3.putProperty( idPrpr, idLefx );
        var idLyr = charIDToTypeID( "Lyr " );
        var idOrdn = charIDToTypeID( "Ordn" );
        var idTrgt = charIDToTypeID( "Trgt" );
        ref3.putEnumerated( idLyr, idOrdn, idTrgt );
    desc29.putReference( idnull, ref3 );
    var idT = charIDToTypeID( "T   " );
        var desc30 = new ActionDescriptor();
        var idScl = charIDToTypeID( "Scl " );
        var idPrc = charIDToTypeID( "#Prc" );
        desc30.putUnitDouble( idScl, idPrc, 100.000000 );
        var idSoFi = charIDToTypeID( "SoFi" );
            var desc31 = new ActionDescriptor();
            var idenab = charIDToTypeID( "enab" );
            desc31.putBoolean( idenab, true );
            var idpresent = stringIDToTypeID( "present" );
            desc31.putBoolean( idpresent, true );
            var idshowInDialog = stringIDToTypeID( "showInDialog" );
            desc31.putBoolean( idshowInDialog, true );
            var idMd = charIDToTypeID( "Md  " );
            var idBlnM = charIDToTypeID( "BlnM" );
            var idNrml = charIDToTypeID( "Nrml" );
            desc31.putEnumerated( idMd, idBlnM, idNrml );
            var idClr = charIDToTypeID( "Clr " );
                var desc32 = new ActionDescriptor();
                var idRd = charIDToTypeID( "Rd  " );
                desc32.putDouble( idRd, r );
                var idGrn = charIDToTypeID( "Grn " );
                desc32.putDouble( idGrn, g );
                var idBl = charIDToTypeID( "Bl  " );
                desc32.putDouble( idBl, b );
            var idRGBC = charIDToTypeID( "RGBC" );
            desc31.putObject( idClr, idRGBC, desc32 );
            var idOpct = charIDToTypeID( "Opct" );
            var idPrc = charIDToTypeID( "#Prc" );
            desc31.putUnitDouble( idOpct, idPrc, o );
        var idSoFi = charIDToTypeID( "SoFi" );
        desc30.putObject( idSoFi, idSoFi, desc31 );
    var idLefx = charIDToTypeID( "Lefx" );
    desc29.putObject( idT, idLefx, desc30 );
    executeAction( idsetd, desc29, DialogModes.NO );
  }
};
var notGroup = {
  en: 'Please choose the LayerSet or LayerGroup to export',
  zh: '请选中图层组或者文档节点进行导出'
};
var invisible = {
  en: 'The LayerGroup or LayerSet is invisible',
  zh: '选中的图层不可见'
};

// app.scriptPreferences.userInteractionLevel = UserInteractionLevels.neverInteract;
// app.displayDialogs = DialogModes.NO

layerTree = {
  documents: {},
  layers: {},
  rootNode: null,
  names: {},
  doc: null,
  cleanTransparency: function(rootNodeBound, rootNode) {
    if (activeDocument.layers.length == 1 && ActionUtils.isAreaEmpty()) {
      try {
        var tempHeight = UnitValue(app.activeDocument.height).as('px');
        var tempWidth = UnitValue(app.activeDocument.width).as('px');
        app.bringToFront();
        app.activeDocument.trim(TrimType.TRANSPARENT, true, true, true, true);

        var trimHeight = UnitValue(app.activeDocument.height).as('px');
        var trimWidth = UnitValue(app.activeDocument.width).as('px');

        // if (trimHeight != tempHeight || trimWidth != tempWidth) {
        rootNodeBound = ActionUtils.getRect(rootNode);
        if (trimWidth <= rootNodeBound.width) rootNodeBound.width = trimWidth;
        if (trimHeight <= rootNodeBound.height) rootNodeBound.height = trimHeight;
        if (rootNodeBound.x <= 0) rootNodeBound.x = 0;
        if (rootNodeBound.y <= 0) rootNodeBound.y = 0;
        // }
      } catch (e) {
      }
    } else {
      rootNodeBound = ActionUtils.getRect(rootNode);
      var docWidth = UnitValue(activeDocument.width).as('px');
      var docHeight = UnitValue(activeDocument.height).as('px');
      if (docWidth <= rootNodeBound.width) rootNodeBound.width = docWidth;
      if (docHeight <= rootNodeBound.height) rootNodeBound.height = docHeight;
      if (rootNodeBound.x <= 0) rootNodeBound.x = 0;
      if (rootNodeBound.y <= 0) rootNodeBound.y = 0;
    }    

    return rootNodeBound;
  },
  create: function() {
    var snapshotName;

    try {      
      var selectionLayer = app.activeDocument.activeLayer;

      if (selectionLayer.visible == false || selectionLayer.opacity == 0) {
        return JSON.stringify({
            status: 'fail',
            message: localize(invisible)
          });
      }

      if (selectionLayer.typename != 'Document' && selectionLayer.typename != 'LayerSet' && selectionLayer.kind != LayerKind.SMARTOBJECT) {
        return JSON.stringify({
            status: 'fail',
            message: localize(notGroup)
          });
      }

      snapshotName = 'DVC_SNAPSHOT' + Math.round(Math.random() * 10000);
      // SNAPSHOT
      ActionUtils.makeHistorySnapshot(snapshotName);

      if (selectionLayer.kind != LayerKind.SMARTOBJECT) {
        ActionUtils.convertToSmartObject();
      }

      ActionUtils.unlockLayer(selectionLayer);

      this.rootDocument = {
        width: UnitValue(app.activeDocument.width).as('px'),
        height: UnitValue(app.activeDocument.height).as('px')
      }
      this.rootDocumentLayer = {
        x: app.activeDocument.activeLayer.bounds[0].as('px'),
        y: app.activeDocument.activeLayer.bounds[1].as('px'),
        r: app.activeDocument.activeLayer.bounds[2].as('px'),
        b: app.activeDocument.activeLayer.bounds[3].as('px'),
      }

      var rootNode = this.rootNode = ActionUtils.openSmart();

      ActionUtils.selectLayer(rootNode);

      this.documents[app.activeDocument.id] = {
        layerArr: [],
        indexArr: [],
        groupMap: {},
        maskGroupMap: {},
        layerMap: {},
        smartMap: {},
        layerData: {},
        filterIndex: []
      };

      this.rootNode = app.activeDocument.activeLayer;
      var name = this.rootNode.name;

      var shouldResizeCanvas = false;

      if (this.rootDocumentLayer.x < 0|| this.rootDocumentLayer.y < 0) {
        shouldResizeCanvas = true;
      }
      if (this.rootDocument.width < this.rootDocumentLayer.r || this.rootDocument.height < this.rootDocumentLayer.b) {
        shouldResizeCanvas = true;
      }

      if (shouldResizeCanvas) {
        var cropX, cropY, cropWidth, cropHeight;
        if (this.rootDocumentLayer.x < 0) {
          cropX = -1 * this.rootDocumentLayer.x
        } else {
          cropX = 0
        }
        if (this.rootDocumentLayer.y < 0) {
          cropY = -1 * this.rootDocumentLayer.y
        } else {
          cropY = 0
        }
        if (this.rootDocumentLayer.b > this.rootDocument.height) {
          cropHeight = app.activeDocument.height.as('px') + (this.rootDocumentLayer.y < 0 ? this.rootDocumentLayer.y : 0) - (this.rootDocumentLayer.b - this.rootDocument.height)
        } else {
          cropHeight = app.activeDocument.height.as('px') + this.rootDocumentLayer.y
        }
        
        try {
          app.bringToFront();
          app.activeDocument.trim(TrimType.TRANSPARENT, true, true, true, true);
        } catch (e) {

        }

        if (this.rootDocumentLayer.r > this.rootDocument.width) {
          cropWidth = app.activeDocument.width.as('px') + (this.rootDocumentLayer.x < 0 ? this.rootDocumentLayer.x : 0) - (this.rootDocumentLayer.r - this.rootDocument.width)
        } else {
          cropWidth = app.activeDocument.width.as('px') + this.rootDocumentLayer.x
        }

        app.activeDocument.crop([
          UnitValue(cropX, 'px'), 
          UnitValue(cropY, 'px'),
          UnitValue(cropWidth + cropX, 'px'),
          UnitValue(cropHeight + cropY, 'px')
        ]);
      }

      this.rootNodeBound = ActionUtils.getRect(this.rootNode);
      this.rootNodeBound = this.cleanTransparency(this.rootNodeBound, this.rootNode);
      
      var artboardImg = ActionUtils.getExportSelectedLayer(this.rootNode);

      var self = this;
      this.walkLayerTree(this.rootNode, function(layer) {
        if (layer.visible) {
          self.addLayer(layer);
        }
      });

      ActionUtils.selectLayer(this.rootNode);

      var layerArr = this.iterateArr();

      app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);

      // REVERT
      ActionUtils.restoreFromSnapshot(snapshotName);

      for (var i = 0; i < layerArr.length; i++) {
        delete layerArr[i].maskUpdateRect;
        delete layerArr[i].layerNode;
      }

      try {
        var layerDescJson = ActionUtils.actionDescriptorToObject(ActionUtils.getCurrentLayerDesc());
        var artboard = layerDescJson.artboard;
        var layer = app.activeDocument.activeLayer;

        switch (artboard.artboardBackgroundType) {
          case 2:
            // black
            layerArr.push({
              rect: this.rootNodeBound,
              style: {
                backgroundColor: '#000000'
              },
              cls: 'View',
              classNames: [],
              itemIndex: layer.itemIndex
            });
            break;
          case 1:
            // white
            layerArr.push({
              rect: this.rootNodeBound,
              style: {
                backgroundColor: '#ffffff'
              },
              cls: 'View',
              classNames: [],
              itemIndex: layer.itemIndex
            });
            break;
        }
      } catch (e) {
      }

      var data = {
        children: layerArr.reverse(),
        artboardRect: this.rootNodeBound,
        artboardImg: artboardImg,
        name: name
      };

      var name = app.activeDocument.name;
      var path = app.activeDocument.path;
      var saveFile = File(path + '/' + name);
      var psdFile = new File(saveFile);
      psdSaveOptions = new PhotoshopSaveOptions();
      psdSaveOptions.embedColorProfile = true;
      psdSaveOptions.alphaChannels = true;  
      activeDocument.saveAs(psdFile, psdSaveOptions, false, Extension.LOWERCASE);

      return JSON.stringify({
        status: 'ok',
        data: JSON.stringify(data)
      });
      
    } catch (e) {
      // REVERT
      ActionUtils.restoreFromSnapshot(snapshotName);

      return JSON.stringify({
        status: 'fail',
        message: e.message,
        line: e.line
      });
    }
    
  },

  addLayer: function(layer) {
    var layerIndex = layer.itemIndex;
    ActionUtils.unlockLayer(layer);
    var rect = ActionUtils.getRect(layer);

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    if (this.documents[activeDocument.id].indexArr.indexOf(layerIndex) == -1) {
      if (layer.typename == 'LayerSet') {
        if (layer.name.indexOf('合并') != -1 || layer.name.indexOf('merge') != -1) {
          this.documents[activeDocument.id].indexArr.push(layerIndex);
          this.documents[activeDocument.id].layerArr.push(this.createNodeByLayer(layer));
        }
      } else if (layer.typename == 'ArtLayer' && (
          [LayerKind.NORMAL, LayerKind.TEXT, LayerKind.SOLIDFILL, LayerKind.GRADIENTFILL, LayerKind.SMARTOBJECT].indexOf(layer.kind) != -1
        )) {
        if (ActionUtils.isEmpty(layer)) {
          // layer.remove();
        } else {
          this.documents[activeDocument.id].indexArr.push(layerIndex);
          this.documents[activeDocument.id].layerArr.push(this.createNodeByLayer(layer));
        }
      }
    }
  },
  createNodeByLayer: function(layer, children) {
    var layerNode = {
      name: layer.name,
      rect: ActionUtils.getRect(layer),
      kind: layer.kind,
      layer: layer,
      itemIndex: layer.itemIndex,
      grouped: layer.grouped
      // amObj: ActionUtils.actionDescriptorToObject(ActionUtils.selectLayer(layer))
    };


    this.documents[activeDocument.id].layerMap[layer.itemIndex] = layerNode;

    if (children && children.length) {
      layerNode.children = children;
    }

    return layerNode;

  },
  exportImage: function(layer) {
    // select the layer and export to temp folder
    ActionUtils.selectLayer(layer);
    return ActionUtils.getExportSelectedLayer(layer);
  },
  smartHandler: function(layer, options) {
    var self = this;

    if (layer.kind == LayerKind.SMARTOBJECT) {
      ActionUtils.unlockLayer(layer);
      ActionUtils.selectLayer(layer);

      var smartRef = ActionUtils.getSmartRef();

      if (smartRef.indexOf('.psd') == -1 && smartRef.indexOf('.psb') == -1) {
        layer.name = layer.name + '合并'; // to img
        try {
          ActionUtils.selectLayer(activeDocument.layers[0]);
          ActionUtils.selectLayer(this.rootNode);
        } catch (e) {}
        return;
      }

      var style = ActionUtils.getLayerStyles();
      var rgba = [];

      if (style && style.solidFill && style.solidFill.enabled) {
        var colorOverlay = style.solidFill;
        rgba.push(colorOverlay.color.red);
        rgba.push(colorOverlay.color.grain);
        rgba.push(colorOverlay.color.blue);
        rgba.push(colorOverlay.opacity);
      }

      var layerRect = ActionUtils.getRect(layer);
      // open 
      var rootNode = ActionUtils.openSmart();
      this.documents[activeDocument.id] = {
        layerArr: [],
        indexArr: [],
        groupMap: {},
        maskGroupMap: {},
        layerMap: {},
        smartMap: {},
        layerData: {},
        filterIndex: []
      };
      
      var rootNodeBounds = ActionUtils.getRect(rootNode);
      ActionUtils.selectLayer(rootNode);
      
      try {
        this.cleanTransparency(ActionUtils.getRect(activeDocument.activeLayer), activeDocument.activeLayer)
        activeDocument.activeLayer.resize(
          layerRect.width / UnitValue(activeDocument.width).as('px') * 100,
          layerRect.height / UnitValue(activeDocument.height).as('px') * 100,
          AnchorPosition.MIDDLECENTER
        );
        this.cleanTransparency(ActionUtils.getRect(activeDocument.activeLayer), activeDocument.activeLayer)
      } catch (e) {

      }

      layerRect = this.cleanTransparency(layerRect, layer);

      if (rgba && rgba.length) {
        options.overlay = rgba;
        // iterate
        this.walkLayerTree(rootNode, function(layer) {
          if (layer.visible) {
            self.addLayer(layer);
          }
        }, options);
      } else {
        // iterate
        this.walkLayerTree(rootNode, function(layer) {
          if (layer.visible) {
            self.addLayer(layer);
          }
        }, options);
      }
      
      var smartChildren = this.iterateArr();

      // transform dimension
      for (var i = 0; i < smartChildren.length; i++) {
        smartChildren[i].rect.x += layerRect.x;
        smartChildren[i].rect.y += layerRect.y;    
        smartChildren[i].refDoc = activeDocument.id;
        smartChildren[i].__smartobject__ = true;
        smartChildren[i].__layerRect__ = {
          x: layerRect.x,
          y: layerRect.y
        }
      }

      app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      this.documents[activeDocument.id].smartMap[layer.itemIndex] = smartChildren;

      try {
        // 兼容嵌套的 smart ，回到根节点保障 walkLayer 根节点被选择继续遍历
        ActionUtils.selectLayer(app.activeDocument.layers[0]);
        // 最外层 root 节点退出
        ActionUtils.selectLayer(this.rootNode);
      } catch (e) {

      }
      
    }
  },
  walkLayerTree: function(rootLayer, callback, options) {
    if (!rootLayer.visible) {
      return;
    }

    var overlay;
    var names = [];
    options = options || {};

    var isArtLayer = rootLayer.typename == 'ArtLayer';
    var isMergeLayer = rootLayer.name.indexOf('合并') != -1 || rootLayer.name.indexOf('merge') != -1;

    if (options) {
      overlay = options.overlay;
      names = options.names || names;
    }

    if (overlay && overlay.length && rootLayer.typename == 'ArtLayer') {
      ActionUtils.selectLayer(rootLayer);
      ActionUtils.setColoOverlay(overlay[0], overlay[1], overlay[2], overlay[3]);
    }

    if (isArtLayer || (isMergeLayer && (rootLayer.kind == LayerKind.SMARTOBJECT || rootLayer.typename == 'LayerSet'))) {
      // need to export name
      this.names[activeDocument.id + '_' + rootLayer.itemIndex] = names;
    }

    if (rootLayer.typename == 'LayerSet' && (rootLayer.name.indexOf('合并') == -1 && rootLayer.name.indexOf('merge') == -1)) {
      var layers = rootLayer.layers;
      var layer;

      ActionUtils.unlockLayer(rootLayer);
      ActionUtils.selectLayer(rootLayer);
      var style = ActionUtils.getLayerStyles();
      var rgba = [];

      if (overlay && overlay.length) {
        rgba = overlay;
      } else {
        if (style && style.solidFill && style.solidFill.enabled) {
          var colorOverlay = style.solidFill;
          rgba.push(colorOverlay.color.red);
          rgba.push(colorOverlay.color.grain);
          rgba.push(colorOverlay.color.blue);
          rgba.push(colorOverlay.opacity);
        }  
      }

      names.push({
        name: rootLayer.name,
        id: activeDocument.id + '_' + rootLayer.itemIndex
      });

      for (var i = 0; i < layers.length; i++) {
        layer = layers[i];
        options.names = names;
        options = JSON.parse(JSON.stringify(options));
        // handle child layer color overlay
        if (rgba.length) {
          options.overlay = rgba;
          this.walkLayerTree(layer, callback, options);
        } else {
          this.walkLayerTree(layer, callback, options);            
        }
      }
    } else {
      if (rootLayer.kind == LayerKind.SMARTOBJECT) {
        if (rootLayer.name.indexOf('合并') == -1 && rootLayer.name.indexOf('merge') == -1) {
          names.push({
            name: rootLayer.name,
            id: activeDocument.id + '_' + rootLayer.itemIndex
          });

          options.names = names;
          options = JSON.parse(JSON.stringify(options));
          this.smartHandler(rootLayer, options);
        }
        
        callback && callback(rootLayer);
      } else {
        // 合并LayerSet && ArtLayer
        callback && callback(rootLayer);
      }
    }
  },
  getGroupMap: function(groupLayer) {
    if (groupLayer.name.indexOf('合并') != -1 || groupLayer.name.indexOf('merge') != -1) return {};
    var layers = groupLayer.layers;

    for (var i = 0; i < layers.length; i++) {
      // 遍历所有的 layerSet
      var layer = layers[i];

      if (layer.typename == 'LayerSet' && (layer.name.indexOf('合并') == -1 && layer.name.indexOf('merge') == -1)) {
        this.getGroupMap(layer);
      }
      if (layer.typename == 'ArtLayer' && 
        [LayerKind.NORMAL, LayerKind.TEXT, LayerKind.SOLIDFILL, LayerKind.GRADIENTFILL, LayerKind.GRADIENTFILL, LayerKind.SMARTOBJECT].indexOf(layer.kind) != -1) {
        if (layer.visible) {
          if (!this.documents[activeDocument.id].groupMap[groupLayer.itemIndex]) {
            this.documents[activeDocument.id].groupMap[groupLayer.itemIndex] = [String(layer.itemIndex)];
          } else {
            this.documents[activeDocument.id].groupMap[groupLayer.itemIndex].push(String(layer.itemIndex));
          }
        }
      }
    }

    return this.documents[activeDocument.id].groupMap;
  },
  getMaskRelation: function(groupLayer) {
    if (!groupLayer.layers) return {};
    var tempGroupedLayers = [];
    var layers = groupLayer.layers;

    if (groupLayer.name.indexOf('合并') != -1 || groupLayer.name.indexOf('merge') != -1) return {};

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      if (layer.typename == 'LayerSet' && layer.visible && (layer.name.indexOf('合并') == -1 && layer.name.indexOf('merge') == -1)) {
        this.getMaskRelation(layer);
      }

      if (layer.typename == 'ArtLayer' && 
        [LayerKind.NORMAL, LayerKind.TEXT, LayerKind.SOLIDFILL, LayerKind.GRADIENTFILL, LayerKind.SMARTOBJECT].indexOf(layer.kind) != -1) {        
        // 剪贴蒙版
        if (layer.grouped && layer.visible) {
          tempGroupedLayers.push(String(layer.itemIndex));
        } else if (!layer.grouped && tempGroupedLayers.length != 0) {
          if (layer.visible) {
            if (layer.kind === LayerKind.NORMAL) {
              // 如果是图像 mask 需要 merge
              var len = tempGroupedLayers.length;
              var markMerged = [];

              try {
                while (len--) {
                  var itemIndex = tempGroupedLayers[len];
                  var maskedLayer = this.documents[activeDocument.id].layerMap[itemIndex].layer;
                  maskedLayer.merge();
                  // merge 后 layers.length 会受影响
                  i--;
                  this.documents[activeDocument.id].filterIndex.push(String(itemIndex));
                  markMerged.push(String(itemIndex));
                }
              } catch (e) {
                this.documents[activeDocument.id].maskGroupMap[layer.itemIndex] = tempGroupedLayers;
              }
              this.documents[activeDocument.id].layerArr = this.documents[activeDocument.id].layerArr.filter(function(layerNode) {
                if (markMerged.indexOf(String(layerNode.itemIndex)) === -1) return true;
                return false;
              });
            } else {
              this.documents[activeDocument.id].maskGroupMap[layer.itemIndex] = tempGroupedLayers;
            }   
          } else {
            tempGroupedLayers.forEach(function(itemIndex) {
              this.documents[activeDocument.id].filterIndex.push(String(itemIndex));
            }, this);
          }
          tempGroupedLayers = [];
        }
      }
    }
    return this.documents[activeDocument.id].maskGroupMap;
  },
  getDistance: function(origin, target) {
    return {
      top: origin.y - target.y,
      right: (origin.x + origin.width) - (target.x + target.width),
      bottom: (origin.y + origin.height) - (target.y + target.height),
      left: origin.x - target.x
    }
  },
  maskAdapt: function() {
    if (!app.activeDocument.activeLayer.layers) return;

    var maskGroupMap = this.getMaskRelation(app.activeDocument.activeLayer);

    for (var parent in maskGroupMap) {
      var parentNode = this.documents[activeDocument.id].layerMap[parent];
      var childrenIndex = maskGroupMap[parent];
      var childrenNodes = childrenIndex.map(function(child, index) {
        return this.documents[activeDocument.id].layerMap[child];
      }, this);

      parentNode.hasChildMask = true;
      for (var i = 0; i < childrenNodes.length; i++) {
        var childNode = childrenNodes[i];
        var distance = this.getDistance(childNode.rect, parentNode.rect);
        var maskAdaptWidth = childNode.rect.width;
        var maskAdaptHeight = childNode.rect.height;

        // adapt mask
        if (distance.left < 0) {
          maskAdaptWidth += distance.left;
        }
        if (distance.right >= 0) {
          maskAdaptWidth -= distance.right;
        }
        if (distance.top < 0) {
          maskAdaptHeight += distance.top;
        }
        if (distance.bottom >= 0) {
          maskAdaptHeight -= distance.bottom;
        }

        childNode.maskUpdateRect = {
          maskLayerNode: parentNode,
          x: distance.left < 0 ? parentNode.rect.x : childNode.rect.x,
          y: distance.top < 0 ? parentNode.rect.y : childNode.rect.y,
          width: maskAdaptWidth,
          height: maskAdaptHeight
        };
        childNode.rect = {
          x: distance.left < 0 ? parentNode.rect.x : childNode.rect.x,
          y: distance.top < 0 ? parentNode.rect.y : childNode.rect.y,
          width: maskAdaptWidth,
          height: maskAdaptHeight
        };
      }
    }
  },
  coverAdapt: function() {
    if (!app.activeDocument.activeLayer.layers) return;
    var groupMap = this.getGroupMap(app.activeDocument.activeLayer);

    for (var parent in groupMap) {
      var parentNode = this.documents[activeDocument.id].layerMap[parent];
      var childrenIndex = groupMap[parent];
      var childrenNodes = [];

      childrenIndex.forEach(function(child) {
        var childNode = this.documents[activeDocument.id].layerMap[child];
        if (childNode) {
          childrenNodes.push(childNode);
        }
      }, this);

      childrenNodes = childrenNodes.reverse();

      // 节点从下开始向上遍历
      for (var i = 0; i < childrenNodes.length; i++) {
        var aLayerNode = childrenNodes[i];
        var aLayerRect = aLayerNode.rect;
        
        for (var j = i + 1; j < childrenNodes.length; j++) {
          var bLayerNode = childrenNodes[j];
          var bLayerRect = bLayerNode.rect;

          if ((bLayerRect.width + bLayerRect.x) >= (aLayerRect.width + aLayerRect.x) &&
            ((bLayerRect.height + bLayerRect.y) >= (aLayerRect.height + aLayerRect.y)) &&
            bLayerRect.x <= aLayerRect.x &&
            bLayerRect.y <= aLayerRect.y) {
            var bOpacity = bLayerNode.layer.opacity;
            var bFillOpacity = bLayerNode.layer.fillOpacity;
            if (bOpacity == 100 && bFillOpacity == 100) {
              aLayerNode.isCoveredLayer = true;
            }
            if (bLayerNode.grouped) {
              aLayerNode.isCoveredByGrouped = true;
            }
          }

          // 底下 a 盖住了 b，且 a 是 mask，打标
          if ((bLayerRect.width + bLayerRect.x) <= (aLayerRect.width + aLayerRect.x) &&
            ((bLayerRect.height + bLayerRect.y) <= (aLayerRect.height + aLayerRect.y)) &&
            bLayerRect.x >= aLayerRect.x &&
            bLayerRect.y >= aLayerRect.y &&
            aLayerNode.hasChildMask) {
            bLayerNode.isMaskCoveredLayer = true;
            aLayerNode.fullMask = true;
          }
        }
      }
    }
  },
  iterateArr: function() {
    var layerArr = this.documents[activeDocument.id].layerArr;

    if (layerArr.length == 0) return [];

    this.maskAdapt();
    this.coverAdapt();
    // 重新获取
    layerArr = this.documents[activeDocument.id].layerArr;
    layerArr = layerArr.map(this.iterateNode, this);

    layerArr = layerArr.reduce(function(init, item) {
      return init.concat(item);
    }, []);

    layerArr = layerArr.filter(this.filterLayer, this);

    return layerArr;
  },
  filterLayer: function(layerData) {
    if (layerData.refDoc) return true; // ignore smart children

    var rect = layerData.rect;
    var isSimpleMask = layerData.hasChildMask && layerData.isValid && !layerData.layerNode.fullMask;
    // 清理宽高1：1且小于2 多为path点
    if (rect.width <= 2 && rect.height <= 2) {
      return false;
    }

    // maskparent invisible
    if (this.documents[activeDocument.id].filterIndex.indexOf(String(layerData.itemIndex)) != -1) {
      return false;
    }

    // 清理规则 1. mask child 背景色跟 mask 一样且被包含且非图片
    if (layerData.isMaskChild && typeof layerData.pic == 'undefined' && layerData.cls == 'View' && layerData.maskUpdateRect) {
      if (layerData.maskUpdateRect.maskLayerNode.fullMask) {
        var maskNode = layerData.maskUpdateRect.maskLayerNode;
        if (maskNode.backgroundColor == layerData.backgroundColor) {
          return false;
        }
      }
    }

    if (layerData.isMaskChild && layerData.maskUpdateRect) {
      var maskIndex = layerData.maskUpdateRect.maskLayerNode.itemIndex;

      if (this.documents[activeDocument.id].maskGroupMap[maskIndex].length == 1) {
        var maskData = this.documents[activeDocument.id].layerData[maskIndex];
        if (typeof maskData.style.borderTopLeftRadius != 'undefined') {
          layerData.style.borderTopLeftRadius = maskData.style.borderTopLeftRadius;
          layerData.style.borderTopRightRadius = maskData.style.borderTopRightRadius;
          layerData.style.borderBottomRightRadius = maskData.style.borderBottomRightRadius;
          layerData.style.borderBottomLeftRadius = maskData.style.borderBottomLeftRadius;
        }
      }
    }

    // delete layerData.maskUpdateRect;
    // delete layerData.layerNode;

    if (layerData.hasChildMask) {
      layerData.style.overflow = 'hidden';
    }

    return layerData.visible;
  },
  iterateNode: function(layerNode) {
    var visible = layerNode.layer.visible;
    var layerData = {
      name: layerNode.name,
      rect: layerNode.rect,
      isMaskChild: layerNode.grouped,
      isCoveredLayer: typeof layerNode.isCoveredLayer != 'undefined' ? layerNode.isCoveredLayer : false,
      itemIndex: layerNode.itemIndex,
      hasChildMask: typeof layerNode.hasChildMask != 'undefined' ? layerNode.hasChildMask : false,
      layerNode: layerNode,
      style: {}
    };

    if (layerNode.maskUpdateRect) {
      layerData.maskUpdateRect = layerNode.maskUpdateRect;
    }

    if (layerNode.kind == LayerKind.TEXT) {
      layerData = handleTextLayer(layerNode, layerData);
    } else if (layerNode.kind == LayerKind.NORMAL) {
      layerData = handlerBitMapLayer(layerNode, layerData);
      layerData.pic = this.exportImage(layerNode.layer);
      layerData.cls = 'BitmapLayer';
    } else if (layerNode.kind == LayerKind.SOLIDFILL) {
      layerData = handleShapeGroup(layerNode, layerData);
    } else if (layerNode.name.indexOf('合并') != -1 || layerNode.name.indexOf('merge') != -1 || layerNode.kind == LayerKind.GRADIENTFILL) {
      layerData.pic = this.exportImage(layerNode.layer);
      layerData.cls = 'BitmapLayer';
    } else if (layerNode.kind == LayerKind.SMARTOBJECT) {
      var children = this.documents[activeDocument.id].smartMap[layerNode.itemIndex];

      // mask + smart
      if (layerNode.grouped && layerNode.maskUpdateRect) {
        var maskUpdateRect = layerNode.maskUpdateRect;

        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          child.__smartobject__ = true;
          var distance = this.getDistance(child.rect, maskUpdateRect);
          var maskAdaptWidth = child.rect.width;
          var maskAdaptHeight = child.rect.height;
          // adapt mask
          if (distance.left < 0) {
            maskAdaptWidth += distance.left;
          }
          if (distance.right >= 0) {
            maskAdaptWidth -= distance.right;
          }
          if (distance.top < 0) {
            maskAdaptHeight += distance.top;
          }
          if (distance.bottom >= 0) {
            maskAdaptHeight -= distance.bottom;
          }
          child.rect = {
            x: distance.left < 0 ? maskUpdateRect.x : child.rect.x,
            y: distance.top < 0 ? maskUpdateRect.y : child.rect.y,
            width: maskAdaptWidth,
            height: maskAdaptHeight
          };
        }
      }
      this.documents[activeDocument.id].layerData[layerData.itemIndex] = children;
      return children;
    }

    if (ActionUtils.hasVectorMask()) {
      layerData.hasChildMask = true;
    }
    // 兼容
    layerData.visible = visible;

    if (typeof layerNode.itemIndex != 'undefined') {
      layerData.classNames = this.names[activeDocument.id + '_' + layerNode.itemIndex];
      layerData.itemIndex = layerNode.itemIndex;
    }

    this.documents[activeDocument.id].layerData[layerData.itemIndex] = layerData;
    return layerData;
  }
};

handlerBitMapLayer = function(layerNode, layerData) {
  return layerData;
}
handleShapeGroup = function(layerNode, layerData) {
  ActionUtils.selectLayer(layerNode.layer);
  var layerEffectStyleObj = ActionUtils.getLayerStyles();
  var layerFXVisible = ActionUtils.isLayerFXVisible();
  var layerBorderStyleObj = ActionUtils.getLayerBorder();
  var desc = ActionUtils.getCurrentLayerDesc();
  var isValid = true;
  var bgColor = ActionUtils.getShapeBg(desc);
  var style = {};
  var radius = ActionUtils.getRadius();

  isValid = (ActionUtils.getShapeGeom() || radius) && !ActionUtils.hasLayerMask();

  var strokeDisabled = desc.hasKey(stringIDToTypeID('AGMStrokeStyleInfo')) &&
    !desc.getObjectValue(stringIDToTypeID('AGMStrokeStyleInfo')).getBoolean(stringIDToTypeID('fillEnabled'));
  var fillOpacity = desc.hasKey(stringIDToTypeID('fillOpacity')) && desc.getInteger(stringIDToTypeID('fillOpacity'))

  if (strokeDisabled || fillOpacity == 0) {
    // backgroundColor disabled
  } else {
    if (layerEffectStyleObj && layerEffectStyleObj.solidFill) {
      var rgb = layerEffectStyleObj.solidFill.color;
      var opacity = layerEffectStyleObj.solidFill.opacity;
      bgColor = 'rgba(' + Math.floor(rgb.red) + ',' + Math.floor(rgb.grain) + ',' + Math.floor(rgb.blue) + ', ' + (opacity / 100).toFixed(2) + ')';
    }

    style.backgroundColor = bgColor;
    layerData.backgroundColor = bgColor;
    if (fillOpacity != 255) {
      style.opacity = Number((fillOpacity / 255).toFixed(2))
    }
  }

  if (layerEffectStyleObj && layerFXVisible) {
    var noEffectBounds = ActionUtils.getLayerNoBounds();
    layerData.rect = {
      x: noEffectBounds.left,
      y: noEffectBounds.top,
      width: noEffectBounds.width,
      height: noEffectBounds.height
    };
    for (var ef in layerEffectStyleObj) {
      switch (ef) {
        case 'gradientFill':
          if (layerEffectStyleObj[ef].enabled && layerEffectStyleObj[ef].type == 'linear') {
            var gradient = styleHelper.gradientAdapt(layerEffectStyleObj[ef]);
            
            if (gradient) {
              style.backgroundImage = gradient;
            } else {
              isValid = false;
            }
          }
          break;
        case 'solidFill':
        case 'innerShadow':
        case 'frameFX':
          if (layerEffectStyleObj[ef].enabled && layerEffectStyleObj[ef].paintType == 'solidColor') {
            var fx = layerEffectStyleObj[ef];
            style.borderStyle = 'solid';
            style.borderWidth = fx.size;
            style.borderColor = 'rgba(' + fx.color.red + ',' + fx.color.grain + ',' + fx.color.blue + ',' + fx.opacity / 100 + ')';
          }
          break;
        case 'dropShadow':
          if (layerEffectStyleObj[ef].enabled) {
            var color = layerEffectStyleObj[ef].color;
            var opacity = layerEffectStyleObj[ef].opacity;
            var shadowColor = 'rgba(' + color.red + ',' + color.grain + ',' + color.blue + ',' + opacity / 100 + ')';
            var distance = layerEffectStyleObj[ef].distance + 'px';
            var chokeMatte = layerEffectStyleObj[ef].chokeMatte + 'px';
            var blur = layerEffectStyleObj[ef].blur + 'px';
            style.boxShadow = distance + ' ' + chokeMatte + ' ' + blur + ' ' + shadowColor;
          }
          break;
      }
    }
  }

  if (isValid) {
    if (radius) {
      style.borderTopLeftRadius = radius.borderTopLeftRadius;
      style.borderTopRightRadius = radius.borderTopRightRadius;
      style.borderBottomRightRadius = radius.borderBottomRightRadius;
      style.borderBottomLeftRadius = radius.borderBottomLeftRadius;
    }
    if (layerBorderStyleObj) {
      if (!layerBorderStyleObj.strokeStyleContent.color) {
        isValid = false;
      } else {
        borderStyle = handleBorder(layerBorderStyleObj);
        style.borderWidth = borderStyle.borderWidth;
        style.borderStyle = borderStyle.borderStyle;
        style.borderColor = borderStyle.borderColor;
      }
    }
  }

  layerData.isValid = isValid;

  if (!isValid) {
    ActionUtils.selectLayer(layerNode.layer);
    var picUrl = ActionUtils.getExportSelectedLayer(layerNode.layer);
    layerData.pic = picUrl;
    layerData.fillType = 'image';
    layerData.cls = 'BitmapLayer';
    return layerData;
  }

  layerData.style = style;
  layerData.cls = 'View';

  return layerData; 
};

var handleBorder = function(obj) {
  var borderStyle = {};
  var borderWidth = obj.strokeStyleLineWidth;
  var borderStyle = 'solid';
  var dashs = obj.strokeStyleLineDashSet;
  var cap = obj.strokeStyleLineCapType;
  var c = obj.strokeStyleContent.color;
  var borderColor = ColorUtils.rgbToHex(c.red, c.grain, c.blue);
  
  if (dashs && dashs.count > 0) {
    if (cap == 'strokeStyleRoundCap' && dashs[0] == 0) {
      borderStyle = 'dotted';
    }
    if (cap == 'strokeStyleButtCap' && dashs[0] > 0) {
      borderStyle = 'dashed';
    }
  }

  return borderStyle = {
    borderWidth: borderWidth,
    borderStyle: borderStyle,
    borderColor: borderColor
  };
};

handleTextLayer = function(layerNode, layerData) {
  ActionUtils.selectLayer(layerNode.layer);
  var layers = handleWrapText();

  if (layers && layers.length >= 1) {
    layerData = {
      name: layerNode.name,
      rect: layerNode.rect,
      isMaskChild: layerNode.grouped,
      isCoveredLayer: false,
      cls: 'Repeat',
      children: []
    };

    if (layers.length > 1) {
      layerNode.layer.remove();
    }

    for(var j = 0; j < layers.length; j++) {
      try {
        var layer = layers[j];
        ActionUtils.selectLayer(layer);

        var layerEffectStyle = ActionUtils.getLayerStyles();
        var layerFXVisible = ActionUtils.isLayerFXVisible();
        var fonts = getFonts(layer);
        var effectColor = '';
        // 1em = 100% = 16px = 12pt
    
        if (layerEffectStyle && layerFXVisible && layerEffectStyle.solidFill && layerEffectStyle.solidFill.enabled) {
          effectColor = ColorUtils.rgbToHex(
            layerEffectStyle.solidFill.color.red,
            layerEffectStyle.solidFill.color.grain,
            layerEffectStyle.solidFill.color.blue
          );
        } 

        if (fonts.length > 1) {
          var bounds = get_text_bounds();

          // 多文本
          for (var i = 0; i < fonts.length; i++) {
            var font = fonts[i];   

            var style = {
              fontFamily: font.font,
              fontWeight: font.fontWeight,
              fontSize: Number(font.size),
              textDecoration: font.textDecoration,
              color: font.rgbaColor ? ColorUtils.rgbToHex(font.rgbaColor.red, font.rgbaColor.green, font.rgbaColor.blue) : '#000000',
              lineHeight: 1.0 * Number(font.size),
              // lineHeight: (!Number(font.leading) || (Number(font.leading) < Number(font.size))) ? 1.0 * Number(font.size) : Number(font.leading),
              letterSpacing: Math.max(Number(font.tracking), 0) * Number(font.size) / 1000,
              lines: 1
            };            

            if (style.fontWeight == 400) {
              delete style.fontWeight;
            }

            if (font.textIndent) {
              style.textIndent = font.textIndent;
            }
  
            if (effectColor) {
              style.color = effectColor;
            }
  
            style.lineHeight = Number(style.lineHeight);
      
            layerData.children.push({
              style: style,
              text: font.text,
              rect: ActionUtils.getRect(bounds[i]),
              cls: 'Text',
              name: font.text,
              isMaskChild: false,
              isCoveredLayer: false
            });
          }
        } else {
          var font = fonts[0];

          var obj = {
            rect: ActionUtils.getRect(layer),
            cls: 'Text',
            name: layer.name,
            isMaskChild: false,
            isCoveredLayer: false
          };

          if (font.font === 'Simple-Line-Icons' || font.style === 'Line-Icons') {
            obj.pic = layerTree.exportImage(layer);
            obj.cls = 'BitmapLayer';
            obj.style = {};
            layerData.children.push(obj);
            continue;
          }
      
          var style = {
            fontFamily: font.font,
            fontWeight: font.fontWeight,
            fontSize: Number(font.size),
            textDecoration: font.textDecoration,
            color: effectColor ? effectColor : (font.rgbaColor ? ColorUtils.rgbToHex(font.rgbaColor.red, font.rgbaColor.green, font.rgbaColor.blue) : '#000000'),
            lineHeight: (!Number(font.leading) || (Number(font.leading) < Number(font.size))) ? Number(font.size) * 1.0 : Number(font.leading),
            // tracking * font-size / 1000 = letter-spacing
            letterSpacing: Math.max(Number(font.tracking), 0) * Number(font.size) / 1000
          };
      
          var lines = Math.ceil(obj.rect.height / Number(style.lineHeight));
      
          if (lines <= 1) {
            style.lineHeight = 1.0 * Number(font.size);
            lines = 1;
          } else {
            style.lineHeight = obj.rect.height / lines;
          }

          if (style.fontWeight == 400) {
            delete style.fontWeight;
          }
      
          var text = font.text;
          var wrapNumsVal = text.match(/(\n)|(\r)/g);
          var wrapNums = wrapNumsVal ? wrapNumsVal.length : 0;
          var spaceMatch = text.match(/^(\s)+/g);
          var spaceLength = 0;
          style.lineHeight = Number(style.lineHeight); 
      
          if (spaceMatch && typeof spaceMatch == 'object') {
            // spaceLength = spaceMatch[0].length;
            // var fontSize = style.fontSize % 2 == 0 ? style.fontSize : (style.fontSize + 1);
            // var prefixSpaceWidth = spaceLength * Math.ceil(fontSize / 3);
            // style.textIndent = prefixSpaceWidth + 'px';
            text = text.replace(/^(\s)+/g, '');
          }
      
          try {
            style.textAlign = getAlign(layer.textItem.justification);
          } catch (e) {
      
          }

          if (font.textIndent) {
            style.textIndent = font.textIndent;
          }
      
          style.lines = lines;
          obj.style = style;
          obj.text = text;
          layerData.children.push(obj);   
          
        }
      } catch (e) {

      }
    }
  }

  return layerData;
};

var handleWrapText = function() {
  var layer = app.activeDocument.activeLayer;
  var text = layer.textItem.contents;
  text = text.replace(/(\r)|(\r\n)/g, '\n');
  var textArr = text.split("\n");
  var pos = layer.textItem.position;
  var leading = 0;
  var layers = [];

  try { 
    layer.textItem.leading; 
    leading = UnitValue(layer.textItem.leading).as('px')
  } catch (e) { 
    leading = getTextSize();
  }

  // 单行文本 layer.textItem.position 值是错的
  if (textArr.length === 1) {
    layers.push(layer);
    return layers;
  }

  var lines = 0;

  for (var k = 0; k < textArr.length; k++) {
    if (textArr[k]) {
      tmp = layer.duplicate();
      tmp.textItem.position = [
        pos[0], 
        UnitValue(pos[1]).as('px') + UnitValue(leading * lines, 'px')
      ];
      tmp.textItem.contents = textArr[k];
      layers.push(tmp);
      lines += Math.ceil(ActionUtils.getRect(tmp).height / leading)
    } else {
      lines += 1;
    }
  }

  return layers;
}

var getAlign = function(align) {
  switch (align) {
    case Justification.LEFT:
      return 'left';
    case Justification.CENTER:
      return 'center';
    case Justification.RIGHT:
      return 'right';
  }
}

var spaceWidth = {
  '12': 4,
  '14': 5,
  '16': 6,
  '18': 6,
  '20': 6,
  '22': 8,
  '24': 8,
  '26': 8,
  '28': 10,
  '30': 10,
  '32': 10,
  '34': 12,
  '36': 12,
  '38': 13,
  '40': 13,
  '42': 14,
  '44': 15,
  '46': 15,
  '48': 16,
  '50': 16
};

var getPrefixSpace = function(spaceMap, spaceWidth, ret) {
  var oneWidth = spaceMap['&#12288;'];
  var halfWidth = spaceMap['&#8194;'];
  var quarterWidth = spaceMap['&#8197;'];

  if (oneWidth <= spaceWidth) {
    ret += '&#12288;';
    spaceWidth -= oneWidth;
  } else if (halfWidth <= spaceWidth) {
    ret += '&#8194;';
    spaceWidth -= halfWidth;
  } else if (quarterWidth <= spaceWidth) {
    ret += '&#8197;';
    spaceWidth -= quarterWidth;
  }

  if (spaceWidth < quarterWidth) {
    return ret;
  } else {
    return getPrefixSpace(spaceMap, spaceWidth, ret);
  }
};

function getTextSize(){  
  var ref = new ActionReference();  
  ref.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));  
  var desc = executeActionGet(ref).getObjectValue(stringIDToTypeID('textKey'));  
  var textSize =  desc.getList(stringIDToTypeID('textStyleRange')).getObjectValue(0).getObjectValue(stringIDToTypeID('textStyle')).getDouble (stringIDToTypeID('size'));  
  if (desc.hasKey(stringIDToTypeID('transform'))) {  
              var mFactor = desc.getObjectValue(stringIDToTypeID('transform')).getUnitDoubleValue (stringIDToTypeID("yy") );  
      textSize = (textSize* mFactor).toFixed(2);  
      }  
  return Number(textSize).toFixed(2);  
} 

var getFonts = function(textLayer) {
  var fonts = [];
  var font_content_detection = false;
  function markReturnedContentText(text) {
    if (font_content_detection) {
      return font_content_detection_symbols[0] + text + font_content_detection_symbols[1] + "\r";
    } else {
      return text;
    }
  }

  if (textLayer.kind == LayerKind.TEXT) {
    //var co = new SolidColor();
    //co = textLayer.textItem.color;
    //app.activeDocument.activeLayer = textLayer;
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));   
    var layerDesc = executeActionGet(ref);
    var textDesc  = layerDesc.getObjectValue(stringIDToTypeID('textKey'));
    var rangeList = textDesc.getList(stringIDToTypeID('textStyleRange'));
    var pRangeList; 
    var textIndent = 0;

    if (textDesc.hasKey(stringIDToTypeID('paragraphStyleRange'))) {
      pRangeList = textDesc.getList(stringIDToTypeID('paragraphStyleRange'));
      for (var n = 0; n < pRangeList.count; n++) {
        var paragraphStyle = ActionUtils.actionDescriptorToObject(pRangeList.getObjectValue(n));
        if (paragraphStyle && paragraphStyle.paragraphStyle && paragraphStyle.paragraphStyle.impliedFirstLineIndent) {
          textIndent = paragraphStyle.paragraphStyle.impliedFirstLineIndent;
          break;
        }
      }
    }

    for (var m = 0; m < rangeList.count; m++) {
      var styleDesc = rangeList.getObjectValue(m).getObjectValue(stringIDToTypeID('textStyle'));
      var aFrom = rangeList.getObjectValue(m).getInteger(stringIDToTypeID('from'));
      var aTo = rangeList.getObjectValue(m).getInteger(stringIDToTypeID('to'));

      if (m > 0) {
        if (rangeList.getObjectValue(m - 1).getInteger(stringIDToTypeID('from')) == aFrom 
          && rangeList.getObjectValue(m - 1).getInteger(stringIDToTypeID('to')) == aTo) continue;
      }

      var theLetters = app.activeDocument.activeLayer.textItem.contents.substring(aFrom, aTo);
      var aFont;

      if (styleDesc.hasKey(stringIDToTypeID('fontPostScriptName'))) {
        aFont = styleDesc.getString(stringIDToTypeID('fontPostScriptName'));
      } else {
        aFont = '';
        // this.InkAlert('I cannot detect one of the fonts of layer "' + this.theLayer.name + '".\r Text range [' + aFrom.toString() + ',' + aTo.toString() + ']' );
        //move to the next font into the loop.
      }

      var aStyle     = styleDesc.hasKey(stringIDToTypeID('FntS')) && styleDesc.getString(app.charIDToTypeID("FntS"));
      var aSize      = new UnitValue(styleDesc.getUnitDoubleValue(stringIDToTypeID('size')), "px");
      var textDecoration = 'none';
      var fontStyle = 'normal';
      var fontWeight = 400;

      if (styleDesc.hasKey(stringIDToTypeID('strikethrough')) &&
        typeIDToStringID(styleDesc.getEnumerationValue(stringIDToTypeID('strikethrough'))) == 'xHeightStrikethroughOn') {
        textDecoration = 'line-through';
      } else if (styleDesc.hasKey(stringIDToTypeID('underline')) &&
        typeIDToStringID(styleDesc.getEnumerationValue(stringIDToTypeID('underline'))) == 'underlineOnLeftInVertical') {
        textDecoration = 'underline';
      }

      if (styleDesc.hasKey(stringIDToTypeID('syntheticItalic')) &&
        styleDesc.getString(stringIDToTypeID('syntheticItalic')) == true) {
        fontStyle = 'italic';
      }

      if (styleDesc.hasKey(stringIDToTypeID('syntheticBold')) &&
        styleDesc.getString(stringIDToTypeID('syntheticBold')) == true) {
        fontWeight = 700;
      }

      //var aCaps      = styleDesc.getEnumerationValue(app.stringIDToTypeID("fontCaps"));
      //var aStrikeThrough = styleDesc.getEnumerationValue(app.stringIDToTypeID("strikethrough"));
            //var aUnderline     = styleDesc.getEnumerationValue(app.stringIDToTypeID("Undl"));
            //alert( aUnderline );
            //,  italics = textStyle.getBoolean(sTID("italics"))

      //Check if font has been transformed
      if (textDesc.hasKey(stringIDToTypeID('transform'))) {
        var mFactor = textDesc.getObjectValue(stringIDToTypeID('transform')).getUnitDoubleValue (stringIDToTypeID("yy") );
        aSize = Math.round(aSize * mFactor);
      }
      //get font color
      var colorDesc;
      var aColor;
      var aRgbaColor;

      try {
        colorDesc = styleDesc.getObjectValue(charIDToTypeID("Clr "));
        aColor = extractFontColor( colorDesc );
        aRgbaColor = { 
          red:Math.round(aColor.rgb.red),
          green:Math.round(aColor.rgb.green),
          blue:Math.round(aColor.rgb.blue),
          alpha:( Math.round(app.activeDocument.activeLayer.fillOpacity ) / 100) 
        };
      } catch (e) {
        aColor     = undefined;
        aRgbaColor = undefined;
      }

      //get leading
      if (styleDesc.hasKey(stringIDToTypeID('leading'))) {
        var aLeading = new UnitValue(styleDesc.getUnitDoubleValue(stringIDToTypeID('leading')), "px");
      } else {
        var aLeading = "";
      }

      //get tracking
      if (styleDesc.hasKey(stringIDToTypeID('tracking'))) {
        var aTracking = new UnitValue(styleDesc.getUnitDoubleValue(stringIDToTypeID('tracking')), "px");
      } else {
        var aTracking = "";
      }
      var merged = false;
      var txt = theLetters;

      if (txt.length > 0) {
        if (fonts.length > 0) {
          for (var x = m - 1; x < m; x++) {
            try {
              var font = fonts[fonts.length - 1];
              if (font.size === aSize && font.color.rgb.hexValue === aColor.rgb.hexValue && font.leading === aLeading) {
                if (font.text !== txt) {
                  font.text += markReturnedContentText(txt);
                }
                merged = true;
              }
            } 
            catch (e) {}
          }
        }

        txt = markReturnedContentText(txt).replace(/^(\s)+/g, '')
        txt = markReturnedContentText(txt).replace(/(\s)+$/g, '')
        
        if (!merged && txt) {
          fonts.push({ 
            text: txt,
            font: aFont,
            size: aSize,
            style: aStyle,
            color: aColor,
            rgbaColor: aRgbaColor,
            leading: Math.round(aLeading),
            tracking: aTracking,
            textDecoration: textDecoration,
            fontStyle: fontStyle,
            fontWeight: fontWeight,
            textIndent: textIndent
          });
        }
      }
    };
    return fonts;
  }
};

var extractFontColor = function(colorDesc) {
  var color = new SolidColor();

  switch( app.activeDocument.mode ) {
    case DocumentMode.GRAYSCALE:
      color.gray.gray = colorDesc.getDouble(charIDToTypeID('Gry '));
      break;
    case DocumentMode.RGB:
      color.rgb.red   = colorDesc.getDouble(charIDToTypeID('Rd  '));
      color.rgb.green = colorDesc.getDouble(charIDToTypeID('Grn '));
      color.rgb.blue  = colorDesc.getDouble(charIDToTypeID('Bl  '));
    break;
    case DocumentMode.CMYK:
      color.cmyk.cyan    = colorDesc.getDouble(charIDToTypeID('Cyn '));
      color.cmyk.magenta = colorDesc.getDouble(charIDToTypeID('Mgnt'));
      color.cmyk.yellow  = colorDesc.getDouble(charIDToTypeID('Ylw '));
      color.cmyk.black   = colorDesc.getDouble(charIDToTypeID('Blck'));
    break;
    case DocumentMode.LAB:
      color.lab.l = colorDesc.getDouble(charIDToTypeID('Lmnc'));
      color.lab.a = colorDesc.getDouble(charIDToTypeID('A   '));
      color.lab.b = colorDesc.getDouble(charIDToTypeID('B   '));
    break;
  }

  return color; 
};

function get_text_bounds()  
    {  
    var doc = activeDocument;  
    var layer = doc.activeLayer;  
  
    toggle_other_visible(true); // only the current layer is visible  
  
    var r = new ActionReference();      
    r.putProperty(stringIDToTypeID("property"), stringIDToTypeID("textKey"));      
    r.putEnumerated(stringIDToTypeID("layer"), stringIDToTypeID("ordinal"), stringIDToTypeID("targetEnum"));      
  
    var list = executeActionGet(r).getObjectValue(stringIDToTypeID("textKey")).getList(stringIDToTypeID("textStyleRange"));  
  
    var range = new Array();  
    var bounds = new Array();    
    // get text styles and their ranges  
  
    for (var i = 0; i < list.count; i++)  
        {  
        var obj = list.getObjectValue(i);  
        range.push([obj.getInteger(stringIDToTypeID("from")), obj.getInteger(stringIDToTypeID("to")), obj.getObjectValue(stringIDToTypeID("textStyle"))]);  
        }  
  
    var c = new SolidColor(); with (c.rgb) { red = green = blue = 255; }  
  
    for (var i = 0; i < list.count; i++)  
        {  
        // set the color of all text to white  
        layer.textItem.color = c;   
  
        // set the color of the current text range to black     
        var color = new ActionDescriptor();    
        color.putDouble(stringIDToTypeID("red"),   0);    
        color.putDouble(stringIDToTypeID("green"), 0);    
        color.putDouble(stringIDToTypeID("blue"),  0);    
        range[i][2].putObject(stringIDToTypeID("color"), stringIDToTypeID("RGBColor"), color);    

        set_text_style(range[i][0], range[i][1], range[i][2]);   
        // make selection from composite channel  
        selection_from_rgb(); 
        doc.selection.invert(); 

        try {
          doc.selection.bounds
        } catch (e) {
          continue
        }
        
        // remember the current range and bounds of the text  
        bounds.push({ from:range[i][0], to:range[i][1], bounds:doc.selection.bounds });   
        }  
  
    doc.selection.deselect();  
  
    toggle_other_visible(true); // restore the visibility of all layers  
  
    return bounds;  
    }  
  
////////////////////////////////////////////////////////////////////////////////////////////  
function toggle_other_visible(viz)  
    {     
    try {  
        var d = new ActionDescriptor();  
        var r = new ActionReference();  
        r.putEnumerated(stringIDToTypeID("layer"), stringIDToTypeID("ordinal"), stringIDToTypeID("targetEnum"));      
        d.putReference(stringIDToTypeID("null"), r);  
        d.putBoolean(stringIDToTypeID("toggleOthers"), true);  
        executeAction(stringIDToTypeID(viz?"show":"hide"), d, DialogModes.NO);   
        }  
    catch (e) { throw(e); }  
    }  
  
////////////////////////////////////////////////////////////////////////////////////////////  
function set_text_style(from, to, style)      
    {      
    try {      
        var d = new ActionDescriptor();      
        var r = new ActionReference();      
        r.putEnumerated(stringIDToTypeID("textLayer"), stringIDToTypeID("ordinal"), stringIDToTypeID("targetEnum"));      
        d.putReference(stringIDToTypeID("null"), r);      
        var d1 = new ActionDescriptor();      
        var l1 = new ActionList();      
        var d2 = new ActionDescriptor();      
        d2.putInteger(stringIDToTypeID("from"), from);      
        d2.putInteger(stringIDToTypeID("to"),  to);      
        d2.putObject(stringIDToTypeID("textStyle"), stringIDToTypeID("textStyle"), style);      
        l1.putObject(stringIDToTypeID("textStyleRange"), d2);      
        d1.putList(stringIDToTypeID("textStyleRange"), l1);      
        d.putObject(stringIDToTypeID("to"), stringIDToTypeID("textLayer"), d1);      
        executeAction(stringIDToTypeID("set"), d, DialogModes.NO);      
        }      
    catch (e) { throw(e); }       
    }      
  
////////////////////////////////////////////////////////////////////////////////////////////  
function selection_from_rgb()    
    {    
    try {      
        var d = new ActionDescriptor();    
        var r = new ActionReference();    
        r.putProperty(stringIDToTypeID("channel"), stringIDToTypeID("selection"));    
        d.putReference(stringIDToTypeID("null"), r);    
        var r = new ActionReference();    
        r.putEnumerated(stringIDToTypeID("channel"), stringIDToTypeID("channel"), stringIDToTypeID("RGB")); 
        d.putReference(stringIDToTypeID("to"), r);    
        executeAction(stringIDToTypeID("set"), d, DialogModes.NO);    
        }      
    catch (e) { throw(e); }       
    }   
//INK
// Licence: GPL <http://www.gnu.org/licenses/gpl.html>
//------------------------------------------------------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//------------------------------------------------------------------------------

ColorUtils = {
  getColorByDocumentMode: function( desc ) 
  {
    var color = new SolidColor();

    switch( app.activeDocument.mode )
    {
      case DocumentMode.GRAYSCALE:
        color.gray.gray = desc.getDouble(charIDToTypeID('Gry '));
      break;
          case DocumentMode.RGB:
               color.rgb.red   = desc.getDouble(charIDToTypeID('Rd  '));
               color.rgb.green = desc.getDouble(charIDToTypeID('Grn '));
               color.rgb.blue  = desc.getDouble(charIDToTypeID('Bl  '));
          break;
          case DocumentMode.CMYK:
               color.cmyk.cyan    = desc.getDouble(charIDToTypeID('Cyn '));
               color.cmyk.magenta = desc.getDouble(charIDToTypeID('Mgnt'));
               color.cmyk.yellow  = desc.getDouble(charIDToTypeID('Ylw '));
               color.cmyk.black   = desc.getDouble(charIDToTypeID('Blck'));
          break;
          case DocumentMode.LAB:
               color.lab.l = desc.getDouble(charIDToTypeID('Lmnc'));
               color.lab.a = desc.getDouble(charIDToTypeID('A   '));
               color.lab.b = desc.getDouble(charIDToTypeID('B   '));
          break;
    }
    return color;          
  },
  //1. Solid Fill
  //------------------------------
  //2. Gradient Fill
  //------------------------------
  //3. Layer color
  //------------------------------
  blend:function( layerColor, fxSolidFillColor, fxGradientFillColor, roundMyValues, colorFormat ) 
    {
      var myColors         = [];
      var continueBlending = true;

      //contains final blend results.
      var theBlend        = {};
      theBlend.colorItems = [];
      theBlend.type       = "";

      //final output
      var blendOutput        = {};
      blendOutput.type       = "";
      blendOutput.colorItems = [];
      blendOutput.css        = "";
      blendOutput.css_gr_lb  = "";

      //there are 2 different types.
      //[{rgba:{}, location:-1}], 'solid'
      //[{rgba:{}, location:0}, {rgba:{}, location:100}], 'gradient'
      function addToMyColors( colorItems, type ) 
      {
        myColors.push( { colorItems:colorItems, type:type } );
      }
      function createColorItem( rgba, location )
      {
        if ( location == undefined ) {
          location = -1;
        }
        return { rgba:rgba, location:location };
      }
      //this is for testing.
      var colorCode = "";

      //1. solid fill fx.
      if ( fxSolidFillColor.enabled && fxSolidFillColor.rgba.alpha > 0 ) 
      {
        addToMyColors( [ createColorItem( fxSolidFillColor.rgba, -1 ) ], 'solid' );
        colorCode += "s";

        if ( fxSolidFillColor.rgba.alpha == 1 ) 
        {
          continueBlending = false;
        }
      }

      //2. gradient fill fx 
      if ( continueBlending && fxGradientFillColor.enabled && fxGradientFillColor.alpha > 0 ) 
      {
        var gradientColorItems = [];
        for ( var i = 0; i < fxGradientFillColor.stops.length; i++ ) 
        {
          var gradientStopRGBAObj = { red:fxGradientFillColor.stops[i].red, 
                        green:fxGradientFillColor.stops[i].green,
                        blue:fxGradientFillColor.stops[i].blue,
                        alpha:fxGradientFillColor.stops[i].alpha };

          gradientColorItems.push( createColorItem( gradientStopRGBAObj, fxGradientFillColor.stops[i].location ) );
        }
        addToMyColors( gradientColorItems, 'gradient' );
        colorCode += "g";
      }

      //3. layer color  
      if ( continueBlending && layerColor.enabled && layerColor.rgba != undefined ) 
      {
        if ( layerColor.rgba.alpha > 0 ) 
        {
          addToMyColors( [ createColorItem( layerColor.rgba, -1 ) ], 'solid' );
        }
        colorCode += "o";
      }


      for ( var i = 0; i < myColors.length; i++ ) 
      {
        if ( i == 0 ) {
          theBlend.colorItems = myColors[0].colorItems;
          theBlend.type       = myColors[0].type;
        }
        else {
          //theBlend is already gradient
          if ( theBlend.colorItems.length > myColors[i].colorItems.length ) 
          {
            for ( var k = 0; k < theBlend.colorItems.length; k++ ) 
            {
              //blend theBlend gradient stop with myColors[i].colorItems[0]
              //theBlend is always OVER.
              var blendStop = ColorUtils.blendRGBAColors( theBlend.colorItems[k].rgba, myColors[i].colorItems[0].rgba );
              theBlend.colorItems[k] = createColorItem( blendStop, theBlend.colorItems[k].location );
            }

          }
          //myColors[i] is gradient
          else if ( theBlend.colorItems.length < myColors[i].colorItems.length ) 
          {
            theBlend.type = "gradient";

            //we are gonna replace into theBlend on the fly so 
            //we need to register the original object.
            var origTheBlend        = {};
            origTheBlend.colorItems = [];
            origTheBlend.colorItems.push( theBlend.colorItems[0] );

            for ( var k = 0; k < myColors[i].colorItems.length; k++ ) 
            {
              //blend myColors[i].colorItems with theBlend.colorItems[0]
              var blendStop = ColorUtils.blendRGBAColors( origTheBlend.colorItems[0].rgba, myColors[i].colorItems[k].rgba );
              theBlend.colorItems[k] = createColorItem( blendStop, myColors[i].colorItems[k].location );
            }
          }
          //neither is gradient (solid)
          else {
            theBlend.type = "solid";
            var blendColor = ColorUtils.blendRGBAColors( theBlend.colorItems[0].rgba, myColors[i].colorItems[0].rgba );
            theBlend.colorItems[0] = createColorItem( blendColor, -1 );
          }
        }
      }

      //build final output.
      blendOutput.type = theBlend.type;

      if ( roundMyValues )
      {
        for ( var i = 0; i < theBlend.colorItems.length; i++ ) 
        {
          blendOutput.colorItems[i]            = theBlend.colorItems[i];
          blendOutput.colorItems[i].rgba.red   = Math.round( theBlend.colorItems[i].rgba.red );
          blendOutput.colorItems[i].rgba.green = Math.round( theBlend.colorItems[i].rgba.green );
          blendOutput.colorItems[i].rgba.blue  = Math.round( theBlend.colorItems[i].rgba.blue );
          blendOutput.colorItems[i].rgba.alpha = Math.round( theBlend.colorItems[i].rgba.alpha * 100 ) / 100;
        } 
      }
      else
      {
        blendOutput.colorItems = theBlend.colorItems;
      }

      if ( blendOutput.type == "gradient" )
      {
        //gradient fill.
        var cssColorsStops = [];
        for ( var i = 0; i < blendOutput.colorItems.length; i++ ) 
        {
          var cssColorStop      = {};
          cssColorStop.css      = Ps2CssUtils.rgbaObjToCSS( blendOutput.colorItems[i].rgba );
          cssColorStop.location = blendOutput.colorItems[i].location;
          cssColorsStops.push( cssColorStop );
        }

        blendOutput.css = Ps2CssUtils.gradientToCSS( fxGradientFillColor.angle, 
                                 fxGradientFillColor.type, 
                                 cssColorsStops,
                                 false );

        blendOutput.css_gr_lb  = Ps2CssUtils.gradientToCSS( fxGradientFillColor.angle, 
                                      fxGradientFillColor.type, 
                                      cssColorsStops,
                                      true );
      }
      else
      {
        //solid fill.
        if ( blendOutput.colorItems.length > 0 ) 
        {
          blendOutput.css = Ps2CssUtils.rgbaObjToCSS( blendOutput.colorItems[0].rgba );

          var myhex = ColorUtils.rgbToHex( blendOutput.colorItems[0].rgba.red,
                                 blendOutput.colorItems[0].rgba.green, 
                                 blendOutput.colorItems[0].rgba.blue );
          myhex    += " (alpha: " + blendOutput.colorItems[0].rgba.alpha.toString() + ")";
          blendOutput.hex = myhex;
        }
      }
      return blendOutput;
    },
  //Object 1 is OVER Object 2.
    blendRGBAColors:function( rgba1, rgba2 ) 
    {
      var blendRgba = {};

    //calculate new alpha
    var blendprimaryAlpha   = Math.max( rgba1.alpha, rgba2.alpha );
    var blendsecondaryAlpha = Math.min( rgba1.alpha, rgba2.alpha );
    blendRgba.alpha = blendprimaryAlpha + blendsecondaryAlpha * ( 1 - blendprimaryAlpha );

    //calculate RGB blend
    blendRgba.red   = ColorUtils.blendRGBAComponent(rgba1.red, rgba2.red, rgba1.alpha, rgba2.alpha, blendRgba.alpha );
    blendRgba.green = ColorUtils.blendRGBAComponent(rgba1.green, rgba2.green, rgba1.alpha, rgba2.alpha, blendRgba.alpha );
    blendRgba.blue  = ColorUtils.blendRGBAComponent(rgba1.blue, rgba2.blue, rgba1.alpha, rgba2.alpha, blendRgba.alpha );

    return blendRgba;
    },
    //Important: A is the element OVER B
    blendRGBAComponent:function( ca, cb, aa, ab, ba ) 
    {
      var bc;
    if ( aa == 1 ) {
      bc = ca;
    }
    else {
      bc = ( ca * aa + cb * ab * ( 1 - aa ) ) / ba;
    }
    return bc;
    },
    //get RGBA value at a point between 0 and 1.
    getGradientRGBAPoint:function( sRgba, eRgba, pointA, pointPos ) 
    {
    var pointRGBA   = {};
    pointRGBA.red   = ColorUtils.getGradientPointComponentByPos( sRgba.red, eRgba.red, pointPos );
    pointRGBA.green = ColorUtils.getGradientPointComponentByPos( sRgba.green, eRgba.green, pointPos );
    pointRGBA.blue  = ColorUtils.getGradientPointComponentByPos( sRgba.blue, eRgba.blue, pointPos );
    pointRGBA.alpha = pointA;
    return pointRGBA;
  },

  //giving that start component is at 0 and end component is at 1.
  getGradientPointComponentByPos:function(sc,ec,pointPos) 
  {
    //component at point
    var pointC = 0;

    //qt of component that is changing from 0 to 1.
    var cRange = Math.abs( ec - sc );

    //component increase at point
    var pointCI = cRange * pointPos;

    if ( sc > ec ) {
      pointC = sc - pointCI;
    }
    else if ( sc < ec ) {
      pointC = sc + pointCI;
    }
    else if ( sc == ec ) {
      pointC = sc;
    }
    return pointC;
  },


  /*
   * RGB object to css string
   */
  RGBtoString : function( r, g, b ) 
  {
    return( "rgb(" + Math.round( r ) + "," + Math.round( g ) + "," + Math.round( b ) + ");" );
  },

  /*
   * RGBA object to css string
   */
  RGBAtoString : function( r, g, b, a ) 
  {
    return( "rgba(" + Math.round( r ) + "," + Math.round( g ) + "," + Math.round( b ) + "," + ( Math.round( a ) / 100 ) + ");" );
  },

  
  /*
   * RGB to #
   */
  rgbToHex:function(r, g, b) 
  {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  /*
   * # to RGB
   */
  hexToRgb:function(hex) 
  {
      // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
      var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, function(m, r, g, b) {
          return r + r + g + g + b + b;
      });

      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
      } : null;
  },
  //calculate average alpha between stops[i].alpha (internal, css stop rgba alpha)
  //and gradient fill fx opacity (external, main fx alpha. 0-100)
  averageGradientInOutAlpha:function( stops, mainOpacity )
  {
    for ( var i = 0; i < stops.length; i++ )
    {
      var stopAverageAlpha   = Math.round( ( ( stops[i].alpha * 100 ) * mainOpacity ) / 100 ) / 100;
      stops[i].alpha         = stopAverageAlpha;
    }
  
    return stops;
  },
  //merge PS color stops and transparency stops in a single, rgba color stops array.
  mergeGradientCTStops:function( cStops, tStops ) 
  {
    //array to be returned.
    var stops  = [];

    //private functions.
    //search into cStop or tStop wheter we 
    //have a stop in this particular location.
    function searchCStopByLocation( location ) {
      var arrID = -1;
      for ( var i = 0; i < cStops.length; i++ )
      { 
        if ( convertGradientPSLocation(location) == convertGradientPSLocation(cStops[i].location) ) {
          arrID = i;
          break;
        }
      }
      return arrID;
    }
    function searchTStopByLocation( location ) {
      var arrID = -1;
      for ( var i = 0; i < tStops.length; i++ )
      {
        if ( convertGradientPSLocation(location) == convertGradientPSLocation(tStops[i].location) ) {
          arrID = i;
          break;
        } 
      }
      return arrID;
    }
    //search for a transparency stop 'on the left' of a point location.
    function searchForLeftTStop( location ) 
    {
      var leftID = -1;
      for ( var i = 0; i < tStops.length; i++ )
      {
        if ( convertGradientPSLocation(tStops[i].location) < convertGradientPSLocation(location) )
        {
          leftID = i;
        }
        else 
        {
          break;
        }   
      }
      return leftID;
    }
    //search for a transparency stop 'on the right' of a point location.
    function searchForRightTStop( location ) 
    {
      var rightID = -1;
      for ( var i = (tStops.length-1); i >= 0; i-- )
      {
        if ( convertGradientPSLocation(tStops[i].location) > convertGradientPSLocation(location) )
        {
          rightID = i;
        }
        else 
        {
          break;
        }   
      }
      return rightID;
    }
    //search for a color stop 'on the left' of a point location.
    function searchForLeftCStop( location ) 
    {
      var leftID = -1;
      for ( var i = 0; i < cStops.length; i++ )
      {
        if ( convertGradientPSLocation(cStops[i].location) < convertGradientPSLocation(location) )
        {
          leftID = i;
        }
        else 
        {
          break;
        }   
      }
      return leftID;
    }
    //search for a color stop 'on the right' of a point location.
    function searchForRightCStop( location ) 
    {
      var rightID = -1;
      for ( var i = (cStops.length-1); i >= 0; i-- )
      {
        if ( convertGradientPSLocation(cStops[i].location) > convertGradientPSLocation(location) )
        {
          rightID = i;
        }
        else 
        {
          break;
        }   
      }
      return rightID;
    }

    //convert PS gradient location to % location
    function convertGradientPSLocation( location )
    {
      return ( Math.round( ( location / 4096 ) * 100 ) );
    }
    
    //when a colorstop does not have a matching transparency stop, we manually create it in the cStop location.
    function createCStopAlpha( cStopID ) 
    {
      var myAlpha = 0;

      var leftTstopID = searchForLeftTStop( cStops[cStopID].location );
      var rightTstopID = searchForRightTStop( cStops[cStopID].location );

      if ( leftTstopID != -1 && rightTstopID != -1 ) 
      {
        //case .1
        var relRange = convertGradientPSLocation(tStops[rightTstopID].location) - convertGradientPSLocation(tStops[leftTstopID].location);
        var relPos   = convertGradientPSLocation(cStops[cStopID].location) - convertGradientPSLocation(tStops[leftTstopID].location);     
        
        //return a number between 0 and 1 that im going to use to calculate the mid point alpha.
        var posRatio = ( relPos / relRange ) * 1;
        myAlpha      = ColorUtils.getGradientPointComponentByPos(tStops[leftTstopID].opacity,tStops[rightTstopID].opacity,posRatio);
      }
      else if ( leftTstopID == -1 && rightTstopID != -1 ) 
      {
        //case .2
        myAlpha = tStops[rightTstopID].opacity;
      }
      else if ( leftTstopID != -1 && rightTstopID == -1 ) 
      {
        //case .3
        myAlpha = tStops[leftTstopID].opacity;
      }
      return myAlpha;
    }
    //when a tranparencyStop does not have a matching color stop, we manually create it in the tStop location.
    function createTStopRGB( tStopID ) 
    {
      var myRGB = {};

      var leftCstopID = searchForLeftCStop( tStops[tStopID].location );
      var rightCstopID = searchForRightCStop( tStops[tStopID].location );

      if ( leftCstopID != -1 && rightCstopID != -1 ) 
      {
        //case .1
        var relRange = convertGradientPSLocation(cStops[rightCstopID].location) - convertGradientPSLocation(cStops[leftCstopID].location);
        var relPos   = convertGradientPSLocation(tStops[tStopID].location) - convertGradientPSLocation(cStops[leftCstopID].location);
        //return a number between 0 and 1 that im going to use to calculate the mid point rgb
        var posRatio = ( relPos / relRange ) * 1;
        myRGB.red    = ColorUtils.getGradientPointComponentByPos(cStops[leftCstopID].solidColor.rgb.red, cStops[rightCstopID].solidColor.rgb.red, posRatio);
        myRGB.green  = ColorUtils.getGradientPointComponentByPos(cStops[leftCstopID].solidColor.rgb.green, cStops[rightCstopID].solidColor.rgb.green, posRatio);
        myRGB.blue   = ColorUtils.getGradientPointComponentByPos(cStops[leftCstopID].solidColor.rgb.blue , cStops[rightCstopID].solidColor.rgb.blue , posRatio);
      }
      else if ( leftCstopID == -1 && rightCstopID != -1 ) 
      {
        //case .2
        myRGB = cStops[rightCstopID].solidColor.rgb;
      }
      else if ( leftCstopID != -1 && rightCstopID == -1 ) 
      {
        //case .3
        myRGB = cStops[leftCstopID].solidColor.rgb;
      }
      return myRGB;
    }

    //push merged stop into return array
    function storeStop( red, green, blue, alpha, location ) 
    {
      stops.push( { red:red, green:green, blue:blue, alpha:alpha, location:location } );
    }

    var locationMatchingID = -1;
    for ( var i = 0; i < cStops.length; i++ ) 
    {
      locationMatchingID = searchTStopByLocation( cStops[i].location );

      //alpha value for this colorStop (a.k.a tranparencyStop.)
      var cStopAlpha;

      //colorStop without matching transparencyStop
      if ( locationMatchingID == -1 ) 
      {
        cStopAlpha = createCStopAlpha( i );
      }
      else 
      {
        cStopAlpha = tStops[locationMatchingID].opacity;
      }

      storeStop( Math.round( cStops[i].solidColor.rgb.red ),
             Math.round( cStops[i].solidColor.rgb.green ),
             Math.round( cStops[i].solidColor.rgb.blue ),
             ( Math.round(cStopAlpha) / 100),
             convertGradientPSLocation(cStops[i].location) );
    }
    for ( var i = 0; i < tStops.length; i++ ) 
    {
      locationMatchingID = searchCStopByLocation( tStops[i].location );

      //tStop without matching cStop
      if ( locationMatchingID == -1 ) 
      {
        var tStopRGB = createTStopRGB( i );
        storeStop( Math.round( tStopRGB.red ),
               Math.round( tStopRGB.green ),
               Math.round( tStopRGB.blue ),
               ( Math.round(tStops[i].opacity) / 100),
               convertGradientPSLocation(tStops[i].location) );
      }
      else 
      {
        //there is a matching color stop.
        //this stop has been already add in the color stops loop.
        //...
      }
    }

    //resort stops by position since there might be some shuffling.
    stops.sort(function(obj1, obj2) 
    {
      return obj1.location - obj2.location;
    });

    return stops;
  }
};
//  json2.js
//  2017-06-12
//  Public Domain.
//  NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

//  USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
//  NOT CONTROL.

//  This file creates a global JSON object containing two methods: stringify
//  and parse. This file provides the ES5 JSON capability to ES3 systems.
//  If a project might run on IE8 or earlier, then this file should be included.
//  This file does nothing on ES5 systems.

//      JSON.stringify(value, replacer, space)
//          value       any JavaScript value, usually an object or array.
//          replacer    an optional parameter that determines how object
//                      values are stringified for objects. It can be a
//                      function or an array of strings.
//          space       an optional parameter that specifies the indentation
//                      of nested structures. If it is omitted, the text will
//                      be packed without extra whitespace. If it is a number,
//                      it will specify the number of spaces to indent at each
//                      level. If it is a string (such as "\t" or "&nbsp;"),
//                      it contains the characters used to indent at each level.
//          This method produces a JSON text from a JavaScript value.
//          When an object value is found, if the object contains a toJSON
//          method, its toJSON method will be called and the result will be
//          stringified. A toJSON method does not serialize: it returns the
//          value represented by the name/value pair that should be serialized,
//          or undefined if nothing should be serialized. The toJSON method
//          will be passed the key associated with the value, and this will be
//          bound to the value.

//          For example, this would serialize Dates as ISO strings.

//              Date.prototype.toJSON = function (key) {
//                  function f(n) {
//                      // Format integers to have at least two digits.
//                      return (n < 10)
//                          ? "0" + n
//                          : n;
//                  }
//                  return this.getUTCFullYear()   + "-" +
//                       f(this.getUTCMonth() + 1) + "-" +
//                       f(this.getUTCDate())      + "T" +
//                       f(this.getUTCHours())     + ":" +
//                       f(this.getUTCMinutes())   + ":" +
//                       f(this.getUTCSeconds())   + "Z";
//              };

//          You can provide an optional replacer method. It will be passed the
//          key and value of each member, with this bound to the containing
//          object. The value that is returned from your method will be
//          serialized. If your method returns undefined, then the member will
//          be excluded from the serialization.

//          If the replacer parameter is an array of strings, then it will be
//          used to select the members to be serialized. It filters the results
//          such that only members with keys listed in the replacer array are
//          stringified.

//          Values that do not have JSON representations, such as undefined or
//          functions, will not be serialized. Such values in objects will be
//          dropped; in arrays they will be replaced with null. You can use
//          a replacer function to replace those with JSON values.

//          JSON.stringify(undefined) returns undefined.

//          The optional space parameter produces a stringification of the
//          value that is filled with line breaks and indentation to make it
//          easier to read.

//          If the space parameter is a non-empty string, then that string will
//          be used for indentation. If the space parameter is a number, then
//          the indentation will be that many spaces.

//          Example:

//          text = JSON.stringify(["e", {pluribus: "unum"}]);
//          // text is '["e",{"pluribus":"unum"}]'

//          text = JSON.stringify(["e", {pluribus: "unum"}], null, "\t");
//          // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

//          text = JSON.stringify([new Date()], function (key, value) {
//              return this[key] instanceof Date
//                  ? "Date(" + this[key] + ")"
//                  : value;
//          });
//          // text is '["Date(---current time---)"]'

//      JSON.parse(text, reviver)
//          This method parses a JSON text to produce an object or array.
//          It can throw a SyntaxError exception.

//          The optional reviver parameter is a function that can filter and
//          transform the results. It receives each of the keys and values,
//          and its return value is used instead of the original value.
//          If it returns what it received, then the structure is not modified.
//          If it returns undefined then the member is deleted.

//          Example:

//          // Parse the text. Values that look like ISO date strings will
//          // be converted to Date objects.

//          myData = JSON.parse(text, function (key, value) {
//              var a;
//              if (typeof value === "string") {
//                  a =
//   /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
//                  if (a) {
//                      return new Date(Date.UTC(
//                         +a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]
//                      ));
//                  }
//                  return value;
//              }
//          });

//          myData = JSON.parse(
//              "[\"Date(09/09/2001)\"]",
//              function (key, value) {
//                  var d;
//                  if (
//                      typeof value === "string"
//                      && value.slice(0, 5) === "Date("
//                      && value.slice(-1) === ")"
//                  ) {
//                      d = new Date(value.slice(5, -1));
//                      if (d) {
//                          return d;
//                      }
//                  }
//                  return value;
//              }
//          );

//  This is a reference implementation. You are free to copy, modify, or
//  redistribute.

/*jslint
    eval, for, this
*/

/*property
    JSON, apply, call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/


// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

if (typeof JSON !== "object") {
  JSON = {};
}

(function () {
  "use strict";

  var rx_one = /^[\],:{}\s]*$/;
  var rx_two = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
  var rx_three = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
  var rx_four = /(?:^|:|,)(?:\s*\[)+/g;
  var rx_escapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
  var rx_dangerous = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

  function f(n) {
      // Format integers to have at least two digits.
      return (n < 10)
          ? "0" + n
          : n;
  }

  function this_value() {
      return this.valueOf();
  }

  if (typeof Date.prototype.toJSON !== "function") {

      Date.prototype.toJSON = function () {

          return isFinite(this.valueOf())
              ? (
                  this.getUTCFullYear()
                  + "-"
                  + f(this.getUTCMonth() + 1)
                  + "-"
                  + f(this.getUTCDate())
                  + "T"
                  + f(this.getUTCHours())
                  + ":"
                  + f(this.getUTCMinutes())
                  + ":"
                  + f(this.getUTCSeconds())
                  + "Z"
              )
              : null;
      };

      Boolean.prototype.toJSON = this_value;
      Number.prototype.toJSON = this_value;
      String.prototype.toJSON = this_value;
  }

  var gap;
  var indent;
  var meta;
  var rep;


  function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

      rx_escapable.lastIndex = 0;
      return rx_escapable.test(string)
          ? "\"" + string.replace(rx_escapable, function (a) {
              var c = meta[a];
              return typeof c === "string"
                  ? c
                  : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
          }) + "\""
          : "\"" + string + "\"";
  }


  function str(key, holder) {

// Produce a string from holder[key].

      var i;          // The loop counter.
      var k;          // The member key.
      var v;          // The member value.
      var length;
      var mind = gap;
      var partial;
      var value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

      if (
          value
          && typeof value === "object"
          && typeof value.toJSON === "function"
      ) {
          value = value.toJSON(key);
      }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

      if (typeof rep === "function") {
          value = rep.call(holder, key, value);
      }

// What happens next depends on the value's type.

      switch (typeof value) {
      case "string":
          return quote(value);

      case "number":

// JSON numbers must be finite. Encode non-finite numbers as null.

          return (isFinite(value))
              ? String(value)
              : "null";

      case "boolean":
      case "null":

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce "null". The case is included here in
// the remote chance that this gets fixed someday.

          return String(value);

// If the type is "object", we might be dealing with an object or an array or
// null.

      case "object":

// Due to a specification blunder in ECMAScript, typeof null is "object",
// so watch out for that case.

          if (!value) {
              return "null";
          }

// Make an array to hold the partial results of stringifying this object value.

          gap += indent;
          partial = [];

// Is the value an array?

          if (Object.prototype.toString.apply(value) === "[object Array]") {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

              length = value.length;
              for (i = 0; i < length; i += 1) {
                  partial[i] = str(i, value) || "null";
              }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

              v = partial.length === 0
                  ? "[]"
                  : gap
                      ? (
                          "[\n"
                          + gap
                          + partial.join(",\n" + gap)
                          + "\n"
                          + mind
                          + "]"
                      )
                      : "[" + partial.join(",") + "]";
              gap = mind;
              return v;
          }

// If the replacer is an array, use it to select the members to be stringified.

          if (rep && typeof rep === "object") {
              length = rep.length;
              for (i = 0; i < length; i += 1) {
                  if (typeof rep[i] === "string") {
                      k = rep[i];
                      v = str(k, value);
                      if (v) {
                          partial.push(quote(k) + (
                              (gap)
                                  ? ": "
                                  : ":"
                          ) + v);
                      }
                  }
              }
          } else {

// Otherwise, iterate through all of the keys in the object.

              for (k in value) {
                  if (Object.prototype.hasOwnProperty.call(value, k)) {
                      v = str(k, value);
                      if (v) {
                          partial.push(quote(k) + (
                              (gap)
                                  ? ": "
                                  : ":"
                          ) + v);
                      }
                  }
              }
          }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

          v = partial.length === 0
              ? "{}"
              : gap
                  ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}"
                  : "{" + partial.join(",") + "}";
          gap = mind;
          return v;
      }
  }

// If the JSON object does not yet have a stringify method, give it one.

  if (typeof JSON.stringify !== "function") {
      meta = {    // table of character substitutions
          "\b": "\\b",
          "\t": "\\t",
          "\n": "\\n",
          "\f": "\\f",
          "\r": "\\r",
          "\"": "\\\"",
          "\\": "\\\\"
      };
      JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

          var i;
          gap = "";
          indent = "";

// If the space parameter is a number, make an indent string containing that
// many spaces.

          if (typeof space === "number") {
              for (i = 0; i < space; i += 1) {
                  indent += " ";
              }

// If the space parameter is a string, it will be used as the indent string.

          } else if (typeof space === "string") {
              indent = space;
          }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

          rep = replacer;
          if (replacer && typeof replacer !== "function" && (
              typeof replacer !== "object"
              || typeof replacer.length !== "number"
          )) {
              throw new Error("JSON.stringify");
          }

// Make a fake root object containing our value under the key of "".
// Return the result of stringifying the value.

          return str("", {"": value});
      };
  }


// If the JSON object does not yet have a parse method, give it one.

  if (typeof JSON.parse !== "function") {
      JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

          var j;

          function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

              var k;
              var v;
              var value = holder[key];
              if (value && typeof value === "object") {
                  for (k in value) {
                      if (Object.prototype.hasOwnProperty.call(value, k)) {
                          v = walk(value, k);
                          if (v !== undefined) {
                              value[k] = v;
                          } else {
                              delete value[k];
                          }
                      }
                  }
              }
              return reviver.call(holder, key, value);
          }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

          text = String(text);
          rx_dangerous.lastIndex = 0;
          if (rx_dangerous.test(text)) {
              text = text.replace(rx_dangerous, function (a) {
                  return (
                      "\\u"
                      + ("0000" + a.charCodeAt(0).toString(16)).slice(-4)
                  );
              });
          }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with "()" and "new"
// because they can cause invocation, and "=" because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with "@" (a non-JSON character). Second, we
// replace all simple value tokens with "]" characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or "]" or
// "," or ":" or "{" or "}". If that is so, then the text is safe for eval.

          if (
              rx_one.test(
                  text
                      .replace(rx_two, "@")
                      .replace(rx_three, "]")
                      .replace(rx_four, "")
              )
          ) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The "{" operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

              j = eval("(" + text + ")");

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

              return (typeof reviver === "function")
                  ? walk({"": j}, "")
                  : j;
          }

// If the text is not JSON parseable, then a SyntaxError is thrown.

          throw new SyntaxError("JSON.parse");
      };
  }
}());
if (!Array.prototype.filter){
  Array.prototype.filter = function(func, thisArg) {
    'use strict';
    if ( ! ((typeof func === 'Function' || typeof func === 'function') && this) )
        throw new TypeError();
   
    var len = this.length >>> 0,
        res = new Array(len), // preallocate array
        t = this, c = 0, i = -1;
    if (thisArg === undefined){
      while (++i !== len){
        // checks to see if the key was set
        if (i in this){
          if (func(t[i], i, t)){
            res[c++] = t[i];
          }
        }
      }
    }
    else{
      while (++i !== len){
        // checks to see if the key was set
        if (i in this){
          if (func.call(thisArg, t[i], i, t)){
            res[c++] = t[i];
          }
        }
      }
    }
   
    res.length = c; // shrink down array to proper size
    return res;
  };
}

// Production steps of ECMA-262, Edition 5, 15.4.4.18
// Reference: http://es5.github.io/#x15.4.4.18
if (!Array.prototype.forEach) {

  Array.prototype.forEach = function(callback/*, thisArg*/) {

    var T, k;

    if (this == null) {
      throw new TypeError('this is null or not defined');
    }

    // 1. Let O be the result of calling toObject() passing the
    // |this| value as the argument.
    var O = Object(this);

    // 2. Let lenValue be the result of calling the Get() internal
    // method of O with the argument "length".
    // 3. Let len be toUint32(lenValue).
    var len = O.length >>> 0;

    // 4. If isCallable(callback) is false, throw a TypeError exception. 
    // See: http://es5.github.com/#x9.11
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function');
    }

    // 5. If thisArg was supplied, let T be thisArg; else let
    // T be undefined.
    if (arguments.length > 1) {
      T = arguments[1];
    }

    // 6. Let k be 0.
    k = 0;

    // 7. Repeat while k < len.
    while (k < len) {

      var kValue;

      // a. Let Pk be ToString(k).
      //    This is implicit for LHS operands of the in operator.
      // b. Let kPresent be the result of calling the HasProperty
      //    internal method of O with argument Pk.
      //    This step can be combined with c.
      // c. If kPresent is true, then
      if (k in O) {

        // i. Let kValue be the result of calling the Get internal
        // method of O with argument Pk.
        kValue = O[k];

        // ii. Call the Call internal method of callback with T as
        // the this value and argument list containing kValue, k, and O.
        callback.call(T, kValue, k, O);
      }
      // d. Increase k by 1.
      k++;
    }
    // 8. return undefined.
  };
}

// Production steps of ECMA-262, Edition 5, 15.4.4.19
// Reference: http://es5.github.io/#x15.4.4.19
if (!Array.prototype.map) {

  Array.prototype.map = function(callback/*, thisArg*/) {

    var T, A, k;

    if (this == null) {
      throw new TypeError('this is null or not defined');
    }

    // 1. Let O be the result of calling ToObject passing the |this| 
    //    value as the argument.
    var O = Object(this);

    // 2. Let lenValue be the result of calling the Get internal 
    //    method of O with the argument "length".
    // 3. Let len be ToUint32(lenValue).
    var len = O.length >>> 0;

    // 4. If IsCallable(callback) is false, throw a TypeError exception.
    // See: http://es5.github.com/#x9.11
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function');
    }

    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
    if (arguments.length > 1) {
      T = arguments[1];
    }

    // 6. Let A be a new array created as if by the expression new Array(len) 
    //    where Array is the standard built-in constructor with that name and 
    //    len is the value of len.
    A = new Array(len);

    // 7. Let k be 0
    k = 0;

    // 8. Repeat, while k < len
    while (k < len) {

      var kValue, mappedValue;

      // a. Let Pk be ToString(k).
      //   This is implicit for LHS operands of the in operator
      // b. Let kPresent be the result of calling the HasProperty internal 
      //    method of O with argument Pk.
      //   This step can be combined with c
      // c. If kPresent is true, then
      if (k in O) {

        // i. Let kValue be the result of calling the Get internal 
        //    method of O with argument Pk.
        kValue = O[k];

        // ii. Let mappedValue be the result of calling the Call internal 
        //     method of callback with T as the this value and argument 
        //     list containing kValue, k, and O.
        mappedValue = callback.call(T, kValue, k, O);

        // iii. Call the DefineOwnProperty internal method of A with arguments
        // Pk, Property Descriptor
        // { Value: mappedValue,
        //   Writable: true,
        //   Enumerable: true,
        //   Configurable: true },
        // and false.

        // In browsers that support Object.defineProperty, use the following:
        // Object.defineProperty(A, k, {
        //   value: mappedValue,
        //   writable: true,
        //   enumerable: true,
        //   configurable: true
        // });

        // For best browser support, use the following:
        A[k] = mappedValue;
      }
      // d. Increase k by 1.
      k++;
    }

    // 9. return A
    return A;
  };
}

// Production steps of ECMA-262, Edition 5, 15.4.4.21
// Reference: http://es5.github.io/#x15.4.4.21
// https://tc39.github.io/ecma262/#sec-array.prototype.reduce
if (!Array.prototype.reduce) {
  Array.prototype.reduce = function(callback /*, initialValue*/) {
    if (this === null) {
      throw new TypeError( 'Array.prototype.reduce ' + 
        'called on null or undefined' );
    }
    if (typeof callback !== 'function') {
      throw new TypeError( callback +
        ' is not a function');
    }

    // 1. Let O be ? ToObject(this value).
    var o = Object(this);

    // 2. Let len be ? ToLength(? Get(O, "length")).
    var len = o.length >>> 0; 

    // Steps 3, 4, 5, 6, 7      
    var k = 0; 
    var value;

    if (arguments.length >= 2) {
      value = arguments[1];
    } else {
      while (k < len && !(k in o)) {
        k++; 
      }

      // 3. If len is 0 and initialValue is not present,
      //    throw a TypeError exception.
      if (k >= len) {
        throw new TypeError( 'Reduce of empty array ' +
          'with no initial value' );
      }
      value = o[k++];
    }

    // 8. Repeat, while k < len
    while (k < len) {
      // a. Let Pk be ! ToString(k).
      // b. Let kPresent be ? HasProperty(O, Pk).
      // c. If kPresent is true, then
      //    i.  Let kValue be ? Get(O, Pk).
      //    ii. Let accumulator be ? Call(
      //          callbackfn, undefined,
      //          « accumulator, kValue, k, O »).
      if (k in o) {
        value = callback(value, o[k], k, o);
      }

      // d. Increase k by 1.      
      k++;
    }

    // 9. Return accumulator.
    return value;
  }
}

// Production steps of ECMA-262, Edition 5, 15.4.4.14
// Reference: http://es5.github.io/#x15.4.4.14
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function(searchElement, fromIndex) {

    var k;

    // 1. Let o be the result of calling ToObject passing
    //    the this value as the argument.
    if (this == null) {
      throw new TypeError('"this" is null or not defined');
    }

    var o = Object(this);

    // 2. Let lenValue be the result of calling the Get
    //    internal method of o with the argument "length".
    // 3. Let len be ToUint32(lenValue).
    var len = o.length >>> 0;

    // 4. If len is 0, return -1.
    if (len === 0) {
      return -1;
    }

    // 5. If argument fromIndex was passed let n be
    //    ToInteger(fromIndex); else let n be 0.
    var n = fromIndex | 0;

    // 6. If n >= len, return -1.
    if (n >= len) {
      return -1;
    }

    // 7. If n >= 0, then Let k be n.
    // 8. Else, n<0, Let k be len - abs(n).
    //    If k is less than 0, then let k be 0.
    k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

    // 9. Repeat, while k < len
    while (k < len) {
      // a. Let Pk be ToString(k).
      //   This is implicit for LHS operands of the in operator
      // b. Let kPresent be the result of calling the
      //    HasProperty internal method of o with argument Pk.
      //   This step can be combined with c
      // c. If kPresent is true, then
      //    i.  Let elementK be the result of calling the Get
      //        internal method of o with the argument ToString(k).
      //   ii.  Let same be the result of applying the
      //        Strict Equality Comparison Algorithm to
      //        searchElement and elementK.
      //  iii.  If same is true, return k.
      if (k in o && o[k] === searchElement) {
        return k;
      }
      k++;
    }
    return -1;
  };
}

try {
	Object.assign({}, {foo: 'bar'})
}
catch(err) {
	// failed: so we're in IE8
	(function() {
	  Object.assign = function(has){
	    'use strict';
	    return assign;
	    function assign(target, source) {
	      for (var i = 1; i < arguments.length; i++) {
	        copy(target, arguments[i]);
	      }
	      return target;
	    }
	    function copy(target, source) {
	      for (var key in source) {
	        if (has.call(source, key)) {
	          target[key] = source[key];
	        }
	      }
	    }
	  }({}.hasOwnProperty);
	}());
}
//INK
// Licence: GPL <http://www.gnu.org/licenses/gpl.html>
//------------------------------------------------------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//------------------------------------------------------------------------------

Ps2CssUtils = {
  borderToCSS:function( size, rgba )
  {
    return( size.toString() + "px solid " + Ps2CssUtils.rgbaObjToCSS( rgba ) );
  },
  //inset: true | false
  //rgba:red green blue alpha object
  //distance:x px
  //angle:-180 / +180
  shadowToCSS:function( inset, rgba, distance, angle, blur )
  {
    var xop = 1;
    var yop = 1;

    var minPoint = 0;
    var midPoint = 0;
    var maxPoint = 0;
    var lowop    = "x";

    if ( angle == 180 ) {
      angle = -180;
    }

    if ( angle >= -180 && angle < -90 ) 
    {
      minPoint = -180;
      midPoint = -135;
      maxPoint = -90;
      xop      = 1;
      yop      = -1;
      lowop    = "x";
    }
    else if ( angle >= -90 && angle < 0 ) 
    {
      minPoint = -90;
      midPoint = -45;
      maxPoint = 0;
      xop      = -1;
      yop      = -1;
      lowop    = "y";
    }
    else if ( angle >= 0 && angle < 90 ) 
    {
      minPoint = 0;
      midPoint = 45;
      maxPoint = 90;
      xop      = -1;
      yop      = 1;
      lowop    = "x";

    }
    else if ( angle >= 90 && angle < 180 ) 
    {
      minPoint = 90;
      midPoint = 135;
      maxPoint = 180;
      xop      = 1;
      yop      = 1;
      lowop    = "x";
    }

    var relangle = angle - minPoint;
    var relmax   = maxPoint - minPoint;
    var relmid   = midPoint - minPoint;

    var ratio1 = Math.abs( Math.round( ( relangle / relmax ) * 100 ) / 100 );
    var ratio2 = 1 - ratio1;
    var xratio = 0;
    var yratio = 0;

    if ( lowop == "x" ) 
    {
      if ( relangle <= (relmid / 2) ) 
      { 
        xratio = Math.max( ratio1, ratio2 );
        yratio = Math.min( ratio1, ratio2 );
      }
      else 
      {
        xratio = Math.min( ratio1, ratio2 );
        yratio = Math.max( ratio1, ratio2 );
      }
    }
    else 
    {
      if ( relangle <= (relmid / 2) ) 
      {
        yratio = Math.max( ratio1, ratio2 );
        xratio = Math.min( ratio1, ratio2 );
      }
      else
      {
        yratio = Math.min( ratio1, ratio2 );
        xratio = Math.max( ratio1, ratio2 );
      }
    }

    //might want to add a xratio * (xratio / 2) and yratio * (yratio / 2).
    var xdist = Math.round( distance * xratio ) * xop;
    var ydist = Math.round( distance * yratio ) * yop;

    var shadowCSSstr = "";
    if ( inset ) {
      shadowCSSstr += "inset ";
    }
    shadowCSSstr += xdist.toString() + "px ";
    shadowCSSstr += ydist.toString() + "px ";
    shadowCSSstr += blur.toString() + "px ";
    //spread.
    shadowCSSstr += "0px ";
    //color
    shadowCSSstr += Ps2CssUtils.rgbaObjToCSS( rgba );

    return( shadowCSSstr );
  },
  //angle: degrees, type: radial | linear
  gradientToCSS:function( angle, type, stops, linebreak ) 
  {
    var output = "";
    output += type + "-gradient(";
    if ( type != "radial" ) 
    {
      output += angle.toString() + "deg, ";
    }
    if ( linebreak ) {
      output += "\r"; 
    }
    for ( var i = 0; i < stops.length; i++ ) {
      output += stops[i].css + " " + stops[i].location.toString() + "%";
      if ( i < ( stops.length - 1 ) ) {
        output += ", ";
        if ( linebreak )
        { 
          output += "\r"; 
        }
      }
    }
    output +=  ")";
    return output;
  },
  rgbaToCSS:function( r,g,b,a ) 
  {
    var str = "rgba(" + ( r.toString() ) + "," + ( g.toString() ) + "," + ( b.toString() ) + "," + a.toString() + ")";
    return str;
  },
  rgbaObjToCSS:function( rgbaObj ) 
  {
    var str = "rgba(" + ( rgbaObj.red.toString() ) + "," + ( rgbaObj.green.toString() ) + "," + ( rgbaObj.blue.toString() ) + "," + rgbaObj.alpha.toString() + ")";
    return str;
  }
};



styleHelper = {
  gradientAdapt: function(fill) {
    var colorStops = [];
    var transpStops = [];

    var angle = fill.angle;

    if (Math.abs(angle - 90) <= 5) {
      angle = 'to top';
    } else if (Math.abs(angle + 90) <= 5) {
      angle = 'to bottom';
    } else if (Math.abs(angle) <= 5) {
      angle = 'to right';
    } else if (Math.abs(angle - 180) <= 5 || Math.abs(angle + 180) <= 5) {
      angle = 'to left';
    } else {
      return null;
    }

    for (var i = 0; i < fill.gradient['colors'].count; i++) {
      var colorDesc = fill.gradient['colors'].getObjectValue(i);
      var colorStop = {};
      colorStop.location = colorDesc.getInteger(stringIDToTypeID('location'));
      colorStop.midpoint = colorDesc.getInteger(stringIDToTypeID('midpoint'));
      var colorD = colorDesc.getObjectValue(stringIDToTypeID('color'));
      var color = ColorUtils.getColorByDocumentMode( colorD );
      var rgbStr = ColorUtils.RGBtoString( color.rgb.red, color.rgb.green, color.rgb.blue );
      
      colorStops.push(rgbStr.slice(0, -1));
    }

    for (var i = 0; i < fill.gradient['transparency'].count; i++) {
      var transpDesc      = fill.gradient["transparency"].getObjectValue(i);
      var transpStop      = {};
      transpStop.location = transpDesc.getInteger(stringIDToTypeID('location'));
      transpStop.midpoint = transpDesc.getInteger(stringIDToTypeID('midpoint'));
      transpStop.opacity  = transpDesc.getInteger(stringIDToTypeID('opacity'));

      if (transpStop.opacity) {
        transpStops.push(transpStop.opacity);
      }
    }

    return 'linear-gradient(' + angle + ', ' + colorStops[0] + ', ' + colorStops[colorStops.length - 1] + ')';
  },
  convertGradientPSLocation: function( location ) {
    return ( Math.round( ( location / 4096 ) * 100 ) );
  }
};
